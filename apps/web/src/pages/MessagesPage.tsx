import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Loader2, ArrowLeft, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChatPage from "./ChatPage";
import { useSearchParams } from "react-router-dom";

interface Conversation {
  id: string;
  job_id: string | null;
  client_id: string;
  freelancer_id: string;
  created_at: string;
  other_user_id?: string;
  other_user_profile?: {
    full_name: string | null;
    photo_url: string | null;
  };
  job?: {
    id: string;
    status: string;
    stage: string | null;
    care_type: string;
    children_count: number;
    children_age_group: string;
    start_at: string | null;
  };
  last_message?: {
    body: string | null;
    created_at: string;
    sender_id: string;
    read_at: string | null;
    read_by: string | null;
    attachment_type?: string | null;
    attachment_name?: string | null;
  } | undefined;
  unread_count: number;
}

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");

  // Try to load cached data immediately
  const getCachedMessagesData = () => {
    try {
      const cached = localStorage.getItem(`messages_${user?.id}_${profile?.role}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 300000) {
          return parsed.data;
        }
      }
    } catch (e) { }
    return null;
  };

  const cachedData = (user && profile) ? getCachedMessagesData() : null;
  const [conversations, setConversations] = useState<Conversation[]>(cachedData?.conversations || []);
  const [loading, setLoading] = useState(!cachedData);
  const loadConversationsRef = useRef<(() => Promise<void>) | null>(null);
  const [mobileView, setMobileView] = useState<"contacts" | "chat">("contacts");
  /** When URL has ?conversation= but list has not loaded that row yet (e.g. new direct chat). */
  const [directChatHeader, setDirectChatHeader] = useState<{
    otherUserId: string;
    other_user_profile: { full_name: string | null; photo_url: string | null };
  } | null>(null);

  // Update mobile view when conversationId changes
  useEffect(() => {
    if (conversationId) {
      if (window.innerWidth < 768) {
        setMobileView("chat");
      }
    } else {
      if (window.innerWidth < 768) {
        setMobileView("contacts");
      }
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !user) {
      setDirectChatHeader(null);
      return;
    }
    if (conversations.some((c) => c.id === conversationId)) {
      setDirectChatHeader(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: convo } = await supabase
        .from("conversations")
        .select("client_id, freelancer_id")
        .eq("id", conversationId)
        .single();
      if (!convo || cancelled) return;
      const otherId =
        convo.client_id === user.id ? convo.freelancer_id : convo.client_id;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, photo_url")
        .eq("id", otherId)
        .single();
      if (!cancelled) {
        setDirectChatHeader({
          otherUserId: otherId,
          other_user_profile: {
            full_name: p?.full_name ?? null,
            photo_url: p?.photo_url ?? null,
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, user, conversations]);

  useEffect(() => {
    async function loadConversations() {
      if (!user || !profile) return;

      try {
        // Fetch conversations (cap rows so initial load stays fast)
        const { data: convos } = await supabase
          .from("conversations")
          .select("id, job_id, client_id, freelancer_id, created_at")
          .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(500);

        if (!convos || convos.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const conversationsByUser = new Map<string, typeof convos>();
        for (const convo of convos) {
          const otherUserId = convo.client_id === user.id
            ? convo.freelancer_id
            : convo.client_id;

          if (otherUserId === user.id) continue;

          if (!conversationsByUser.has(otherUserId)) {
            conversationsByUser.set(otherUserId, []);
          }
          conversationsByUser.get(otherUserId)!.push(convo);
        }

        if (conversationsByUser.size === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        // One profile query for all contacts (was N round-trips)
        const uniqueOtherIds = Array.from(conversationsByUser.keys());
        const { data: profilesRows } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", uniqueOtherIds);

        const profileById = new Map(
          (profilesRows ?? []).map((p) => [p.id, p])
        );

        const entries = Array.from(conversationsByUser.entries());
        /** Limit parallel Supabase calls per wave (each contact = 2 queries + optional job). */
        const BATCH = 8;
        const enriched: Conversation[] = [];

        for (let i = 0; i < entries.length; i += BATCH) {
          const slice = entries.slice(i, i + BATCH);
          const batch = await Promise.all(
            slice.map(async ([otherUserId, userConversations]) => {
              const conversationIds = userConversations.map((c) => c.id);
              const otherProfile = profileById.get(otherUserId);

              const [messagesRes, unreadRes] = await Promise.all([
                supabase
                  .from("messages")
                  .select(
                    "body, created_at, sender_id, read_at, read_by, attachment_type, attachment_name, conversation_id"
                  )
                  .in("conversation_id", conversationIds)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from("messages")
                  .select("*", { count: "exact", head: true })
                  .in("conversation_id", conversationIds)
                  .eq("sender_id", otherUserId)
                  .is("read_at", null),
              ]);

              const row = messagesRes.data;
              const totalUnread = unreadRes.count ?? 0;

              const mostRecentConversationId =
                row?.conversation_id || userConversations[0].id;
              const mostRecentConversation =
                userConversations.find((c) => c.id === mostRecentConversationId) ||
                userConversations[0];

              let job:
                | {
                    id: string;
                    status: string;
                    stage: string | null;
                    care_type: string;
                    service_type: string;
                    children_count: number;
                    children_age_group: string;
                    start_at: string | null;
                  }
                | undefined;
              if (mostRecentConversation.job_id) {
                const { data: jobRow } = await supabase
                  .from("job_requests")
                  .select(
                    "id, status, stage, care_type, service_type, children_count, children_age_group, start_at"
                  )
                  .eq("id", mostRecentConversation.job_id)
                  .single();
                job = jobRow ?? undefined;
              }

              const last_message = row
                ? {
                    body: row.body,
                    created_at: row.created_at,
                    sender_id: row.sender_id,
                    read_at: row.read_at,
                    read_by: row.read_by,
                    attachment_type: row.attachment_type,
                    attachment_name: row.attachment_name,
                  }
                : undefined;

              return {
                ...mostRecentConversation,
                other_user_id: otherUserId,
                other_user_profile: {
                  full_name: otherProfile?.full_name || null,
                  photo_url: otherProfile?.photo_url || null,
                },
                job: job || undefined,
                last_message,
                unread_count: totalUnread,
              } as Conversation;
            })
          );
          enriched.push(...batch);
        }

        // Include job-linked and direct (no job) chats
        const sortedConversations = enriched.sort((a, b) => {
          const timeA = a.last_message?.created_at
            ? new Date(a.last_message.created_at).getTime()
            : 0;
          const timeB = b.last_message?.created_at
            ? new Date(b.last_message.created_at).getTime()
            : 0;
          return timeB - timeA; // Most recent first
        });

        setConversations(sortedConversations);

        // Cache the data for instant loading next time
        if (user && profile) {
          try {
            localStorage.setItem(`messages_${user.id}_${profile.role}`, JSON.stringify({
              timestamp: Date.now(),
              data: {
                conversations: sortedConversations
              }
            }));
          } catch (e) {
            // Ignore cache errors
          }
        }
      } catch (err) {
        console.error("Error loading conversations:", err);
      } finally {
        setLoading(false);
      }
    }

    loadConversationsRef.current = loadConversations;
    loadConversations();

    // Subscribe to new messages and read updates
    if (user && profile) {
      const channel = supabase
        .channel("messages-updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            const newMsg = payload.new as any;

            // Fetch the conversation to determine the other user ID
            const { data: convoData } = await supabase
              .from("conversations")
              .select("client_id, freelancer_id")
              .eq("id", newMsg.conversation_id)
              .single();

            if (!convoData) {
              // If conversation not found, reload
              if (loadConversationsRef.current) {
                loadConversationsRef.current();
              }
              return;
            }

            // Identify the other user ID correctly regardless of current profile role
            const otherUserId = convoData.client_id === user.id
              ? convoData.freelancer_id
              : convoData.client_id;

            const isFromOtherUser = newMsg.sender_id === otherUserId;
            const newMessageTime = new Date(newMsg.created_at).getTime();

            // Update the conversation's last message and unread count
            setConversations((prev) => {
              // Find conversation with the same otherUserId (deduplicated)
              const convo = prev.find(c => {
                const cOtherUserId = profile.role === "client"
                  ? c.freelancer_id
                  : c.client_id;
                return cOtherUserId === otherUserId;
              });

              // If not found, reload to get grouped version
              if (!convo) {
                if (loadConversationsRef.current) {
                  loadConversationsRef.current();
                }
                return prev;
              }

              // Check if this message is more recent than the current last_message
              const currentLastMessageTime = convo.last_message?.created_at
                ? new Date(convo.last_message.created_at).getTime()
                : 0;

              // Update the matching conversation
              return prev.map((c) => {
                const cOtherUserId = profile.role === "client"
                  ? c.freelancer_id
                  : c.client_id;

                // Update if it's a conversation with the same otherUserId
                if (cOtherUserId === otherUserId) {
                  const newUnreadCount = isFromOtherUser && !newMsg.read_at
                    ? (c.unread_count || 0) + 1
                    : c.unread_count;

                  // Only update last_message if this message is more recent
                  const shouldUpdateLastMessage = newMessageTime > currentLastMessageTime;

                  return {
                    ...c,
                    last_message: shouldUpdateLastMessage ? {
                      body: newMsg.body || "",
                      created_at: newMsg.created_at,
                      sender_id: newMsg.sender_id,
                      read_at: newMsg.read_at,
                      read_by: newMsg.read_by,
                      attachment_type: newMsg.attachment_type,
                      attachment_name: newMsg.attachment_name,
                    } : c.last_message,
                    unread_count: newUnreadCount,
                  };
                }
                return c;
              }).sort((a, b) => {
                // Sort by last message time (most recent first)
                const timeA = a.last_message?.created_at
                  ? new Date(a.last_message.created_at).getTime()
                  : 0;
                const timeB = b.last_message?.created_at
                  ? new Date(b.last_message.created_at).getTime()
                  : 0;
                return timeB - timeA;
              });
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            const updatedMsg = payload.new as any;
            // If a message was marked as read, update unread count
            if (updatedMsg.read_at) {
              // Fetch the conversation to determine the other user ID
              const { data: convoData } = await supabase
                .from("conversations")
                .select("client_id, freelancer_id")
                .eq("id", updatedMsg.conversation_id)
                .single();

              if (!convoData) return;

              // Determine other user ID based on role
              const otherUserId = profile.role === "client"
                ? convoData.freelancer_id
                : convoData.client_id;

              setConversations((prev) =>
                prev.map((convo) => {
                  // Check if this conversation has the same otherUserId (deduplicated)
                  const cOtherUserId = profile.role === "client"
                    ? convo.freelancer_id
                    : convo.client_id;

                  if (cOtherUserId === otherUserId) {
                    // Check if this message was from the other user
                    if (updatedMsg.sender_id === otherUserId && convo.unread_count > 0) {
                      const updatedLastMessage = convo.last_message?.created_at === updatedMsg.created_at
                        ? (convo.last_message ? {
                          ...convo.last_message,
                          read_at: updatedMsg.read_at || null,
                          read_by: updatedMsg.read_by || null,
                        } : undefined)
                        : convo.last_message;

                      return {
                        ...convo,
                        unread_count: Math.max(0, convo.unread_count - 1),
                        last_message: updatedLastMessage,
                      };
                    }
                  }
                  return convo;
                })
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, profile]);

  // Update cache whenever conversations change (from real-time updates or initial load)
  useEffect(() => {
    if (user && profile && conversations.length >= 0) {
      try {
        localStorage.setItem(`messages_${user.id}_${profile.role}`, JSON.stringify({
          timestamp: Date.now(),
          data: { conversations }
        }));
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [conversations, user, profile]);

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  // Handle selecting a conversation
  const handleConversationClick = (convoId: string) => {
    setSearchParams({ conversation: convoId });
    // On mobile, switch to chat view
    if (window.innerWidth < 768) {
      setMobileView("chat");
    }
  };

  function handleBackToContacts() {
    setSearchParams({});
    setMobileView("contacts");
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show contact panel with conversation list and chat inline
  return (
    <div className="h-screen flex gradient-mesh overflow-hidden">
      {/* Contact Panel - Left Sidebar - Always visible on desktop, full page on mobile */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r bg-card flex flex-col flex-shrink-0",
        "md:flex",
        mobileView === "contacts" ? "flex" : "hidden md:flex"
      )}>
        {/* Header - Fixed on mobile, integrated on desktop */}
        <div className="p-4 border-b flex-shrink-0 bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(profile?.role === "client" ? "/dashboard" : "/freelancer/dashboard")}
              className="md:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold">Messages</h2>
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Messages</h3>
              <p className="text-sm text-muted-foreground">
                {profile?.role === "client"
                  ? "Start a job request to begin chatting with nannies."
                  : "You'll see conversations here once clients start chatting."}
              </p>
            </div>
          ) : (
            <div className="divide-y space-y-0.5">
              {conversations.map((convo) => {
                const initials = convo.other_user_profile?.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "?";

                const isActive = conversationId === convo.id;

                // Format job label
                const formatJobLabel = (job: any) => {
                  if (!job) return "";
                  const serviceTypeMap: Record<string, string> = {
                    cleaning: "Cleaning",
                    cooking: "Cooking",
                    pickup_delivery: "Pickup & Delivery",
                    nanny: "Nanny",
                    other_help: "Other Help",
                  };
                  const careTypeMap: Record<string, string> = {
                    occasional: "One-time",
                    part_time: "Part-time",
                    full_time: "Full-time",
                  };

                  const serviceName = serviceTypeMap[job.service_type] || "Job";
                  const careTypeName = careTypeMap[job.care_type] || job.care_type || "";

                  if (job.status === "completed") {
                    return `${serviceName} – Completed`;
                  }

                  if (job.start_at) {
                    const startDate = new Date(job.start_at);
                    const today = new Date();
                    const isToday = startDate.toDateString() === today.toDateString();
                    if (isToday) {
                      return `${serviceName} – Today`;
                    }
                    return `${serviceName} – ${startDate.toLocaleDateString()}`;
                  }

                  return careTypeName ? `${serviceName} – ${careTypeName}` : serviceName;
                };

                const jobLabel = convo.job ? formatJobLabel(convo.job) : "Direct chat";

                return (
                  <div
                    key={convo.id}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors relative",
                      isActive && "bg-orange-100 dark:bg-orange-950/30"
                    )}
                    onClick={() => handleConversationClick(convo.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12 flex-shrink-0">
                          <AvatarImage src={convo.other_user_profile?.photo_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {convo.unread_count > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                            <span className="text-[10px] font-bold text-primary-foreground">
                              {convo.unread_count > 9 ? "9+" : convo.unread_count}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={cn(
                            "font-bold truncate text-[16px] text-slate-900 dark:text-slate-100",
                            convo.unread_count > 0 && "font-black"
                          )}>
                            {convo.other_user_profile?.full_name || "User"}
                          </p>
                          {convo.last_message && (
                            <span className="text-[12px] font-bold text-muted-foreground/60 flex-shrink-0">
                              {formatTime(convo.last_message.created_at)}
                            </span>
                          )}
                        </div>
                        {/* Job Label */}
                        {jobLabel && (
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[13px] font-semibold text-primary/80 truncate">{jobLabel}</span>
                          </div>
                        )}
                        {convo.last_message && (
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {convo.last_message.sender_id === user?.id && (
                                <div className="flex-shrink-0">
                                  {convo.last_message.read_at && convo.last_message.read_by ? (
                                    <CheckCheck className="w-4 h-4 text-blue-500" />
                                  ) : convo.last_message.read_at ? (
                                    <CheckCheck className="w-4 h-4 text-muted-foreground/60" />
                                  ) : (
                                    <Check className="w-4 h-4 text-muted-foreground/60" />
                                  )}
                                </div>
                              )}
                              <p className={cn(
                                "text-[14px] truncate leading-tight",
                                convo.unread_count > 0
                                  ? "text-foreground font-bold"
                                  : "text-muted-foreground font-medium"
                              )}>
                                {convo.last_message.sender_id === user?.id && "You: "}
                                {convo.last_message.attachment_type
                                  ? (convo.last_message.attachment_type === "image"
                                    ? "📷 Image"
                                    : `📎 ${convo.last_message.attachment_name || "File"}`)
                                  : (convo.last_message.body || "")}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area - Right Side */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden",
        mobileView === "chat" ? "flex" : "hidden md:flex"
      )}>
        {conversationId ? (() => {
          const selectedConvo = conversations.find(c => c.id === conversationId);
          const otherUserId = selectedConvo?.other_user_id ?? directChatHeader?.otherUserId;
          const otherUserProfile =
            selectedConvo?.other_user_profile ?? directChatHeader?.other_user_profile;
          const otherInitials = otherUserProfile?.full_name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "?";

          return (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Back Button Header - Sticky */}
              <div className="md:hidden p-4 border-b bg-card/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToContacts}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={otherUserProfile?.photo_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {otherInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold truncate">
                        {otherUserProfile?.full_name || "User"}
                      </h2>
                    </div>
                    {/* Desktop Back Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(profile?.role === "client" ? "/dashboard" : "/freelancer/dashboard")}
                      className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Chat Page area */}
              <div className="flex-1 overflow-hidden relative">
                <div className="messages-chat-container h-full">
                  <ChatPage
                    key={conversationId || "none"}
                    conversationId={conversationId}
                    hideBackButton={true}
                    otherUserId={otherUserId}
                  />
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-b from-muted/20 to-background">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Choose a conversation from the list to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

