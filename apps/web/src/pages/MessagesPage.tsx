import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchInboxActivityAlerts,
  inboxActivityKindLabel,
  type NotificationAlert,
} from "@/lib/inboxActivityAlerts";
import {
  loadDismissedActivityIds,
  persistDismissedActivityIds,
} from "@/lib/inboxDismissedActivity";
import {
  loadHiddenChatUserIds,
  persistHiddenChatUserIds,
} from "@/lib/inboxHiddenChats";
import { InboxChatSwipeRow } from "@/components/messages/InboxChatSwipeRow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  ChevronLeft,
  Check,
  CheckCheck,
  Bell,
  Briefcase,
  MessageSquare,
} from "lucide-react";
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
  last_message?:
    | {
        body: string | null;
        created_at: string;
        sender_id: string;
        read_at: string | null;
        read_by: string | null;
        attachment_type?: string | null;
        attachment_name?: string | null;
      }
    | undefined;
  unread_count: number;
}

type InboxRow =
  | { kind: "chat"; key: string; sortAt: number; conversation: Conversation }
  | { kind: "activity"; key: string; sortAt: number; alert: NotificationAlert };

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");

  // Try to load cached data immediately
  const getCachedMessagesData = () => {
    try {
      const cached = localStorage.getItem(
        `messages_${user?.id}_${profile?.role}`,
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 300000) {
          return parsed.data;
        }
      }
    } catch (e) {}
    return null;
  };

  const cachedData = user && profile ? getCachedMessagesData() : null;
  const [conversations, setConversations] = useState<Conversation[]>(
    cachedData?.conversations || [],
  );
  const [activityAlerts, setActivityAlerts] = useState<NotificationAlert[]>([]);
  const [dismissedActivityIds, setDismissedActivityIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hiddenChatUserIds, setHiddenChatUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(!cachedData);
  const loadConversationsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setDismissedActivityIds(new Set());
      setHiddenChatUserIds(new Set());
      return;
    }
    setDismissedActivityIds(loadDismissedActivityIds(user.id));
    setHiddenChatUserIds(loadHiddenChatUserIds(user.id));
  }, [user?.id]);

  const visibleActivityAlerts = useMemo(
    () => activityAlerts.filter((a) => !dismissedActivityIds.has(a.id)),
    [activityAlerts, dismissedActivityIds],
  );

  const inboxRows = useMemo((): InboxRow[] => {
    const rows: InboxRow[] = [];
    for (const c of conversations) {
      const oid = c.other_user_id;
      if (oid && hiddenChatUserIds.has(oid)) continue;
      const sortAt = c.last_message?.created_at
        ? new Date(c.last_message.created_at).getTime()
        : new Date(c.created_at).getTime();
      rows.push({ kind: "chat", key: `chat-${c.id}`, sortAt, conversation: c });
    }
    for (const a of visibleActivityAlerts) {
      const sortAt = a.created_at ? new Date(a.created_at).getTime() : 0;
      rows.push({ kind: "activity", key: `act-${a.id}`, sortAt, alert: a });
    }
    rows.sort((x, y) => y.sortAt - x.sortAt);
    return rows;
  }, [conversations, visibleActivityAlerts, hiddenChatUserIds]);
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
          return;
        }

        const conversationsByUser = new Map<string, typeof convos>();
        for (const convo of convos) {
          const otherUserId =
            convo.client_id === user.id ? convo.freelancer_id : convo.client_id;

          if (otherUserId === user.id) continue;

          if (!conversationsByUser.has(otherUserId)) {
            conversationsByUser.set(otherUserId, []);
          }
          conversationsByUser.get(otherUserId)!.push(convo);
        }

        if (conversationsByUser.size === 0) {
          setConversations([]);
          return;
        }

        // One profile query for all contacts (was N round-trips)
        const uniqueOtherIds = Array.from(conversationsByUser.keys());
        const { data: profilesRows } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", uniqueOtherIds);

        const profileById = new Map((profilesRows ?? []).map((p) => [p.id, p]));

        const entries = Array.from(conversationsByUser.entries());
        /** Limit parallel Supabase calls per wave (each contact = 2 queries). */
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
                    "body, created_at, sender_id, read_at, read_by, attachment_type, attachment_name, conversation_id",
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
                userConversations.find(
                  (c) => c.id === mostRecentConversationId,
                ) || userConversations[0];

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
                last_message,
                unread_count: totalUnread,
              } as Conversation;
            }),
          );
          enriched.push(...batch);
        }

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
            localStorage.setItem(
              `messages_${user.id}_${profile.role}`,
              JSON.stringify({
                timestamp: Date.now(),
                data: {
                  conversations: sortedConversations,
                },
              }),
            );
          } catch (e) {
            // Ignore cache errors
          }
        }
      } catch (err) {
        console.error("Error loading conversations:", err);
      }
    }

    async function loadActivity() {
      if (!user?.id || !profile) {
        setActivityAlerts([]);
        return;
      }
      try {
        const rows = await fetchInboxActivityAlerts(user, profile, {
          includeUnreadMessageAlerts: false,
        });
        setActivityAlerts(rows);
      } catch (e) {
        console.error("[MessagesPage] activity", e);
        setActivityAlerts([]);
      }
    }

    async function refreshInbox(showSpinner: boolean) {
      if (!user || !profile) {
        setConversations([]);
        setActivityAlerts([]);
        setLoading(false);
        return;
      }
      if (showSpinner) setLoading(true);
      try {
        await Promise.all([loadConversations(), loadActivity()]);
      } catch (e) {
        console.error("[MessagesPage] refresh", e);
      } finally {
        if (showSpinner) setLoading(false);
      }
    }

    loadConversationsRef.current = () => {
      void refreshInbox(false);
    };
    void refreshInbox(!cachedData);

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
            const otherUserId =
              convoData.client_id === user.id
                ? convoData.freelancer_id
                : convoData.client_id;

            const isFromOtherUser = newMsg.sender_id === otherUserId;
            const newMessageTime = new Date(newMsg.created_at).getTime();

            if (isFromOtherUser && user?.id) {
              setHiddenChatUserIds((prev) => {
                if (!prev.has(otherUserId)) return prev;
                const next = new Set(prev);
                next.delete(otherUserId);
                persistHiddenChatUserIds(user.id, next);
                return next;
              });
            }

            // Update the conversation's last message and unread count
            setConversations((prev) => {
              // Find conversation with the same otherUserId (deduplicated)
              const convo = prev.find((c) => {
                const cOtherUserId =
                  profile.role === "client" ? c.freelancer_id : c.client_id;
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
              return prev
                .map((c) => {
                  const cOtherUserId =
                    profile.role === "client" ? c.freelancer_id : c.client_id;

                  // Update if it's a conversation with the same otherUserId
                  if (cOtherUserId === otherUserId) {
                    const newUnreadCount =
                      isFromOtherUser && !newMsg.read_at
                        ? (c.unread_count || 0) + 1
                        : c.unread_count;

                    // Only update last_message if this message is more recent
                    const shouldUpdateLastMessage =
                      newMessageTime > currentLastMessageTime;

                    return {
                      ...c,
                      last_message: shouldUpdateLastMessage
                        ? {
                            body: newMsg.body || "",
                            created_at: newMsg.created_at,
                            sender_id: newMsg.sender_id,
                            read_at: newMsg.read_at,
                            read_by: newMsg.read_by,
                            attachment_type: newMsg.attachment_type,
                            attachment_name: newMsg.attachment_name,
                          }
                        : c.last_message,
                      unread_count: newUnreadCount,
                    };
                  }
                  return c;
                })
                .sort((a, b) => {
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
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            const updatedMsg = payload.new as {
              read_at?: string | null;
              conversation_id?: string;
              sender_id?: string;
              created_at?: string;
              read_by?: string | null;
            };
            if (!updatedMsg.read_at || !user?.id || !updatedMsg.conversation_id)
              return;

            const { data: convoData } = await supabase
              .from("conversations")
              .select("client_id, freelancer_id")
              .eq("id", updatedMsg.conversation_id)
              .single();

            if (!convoData) return;

            const otherUserId =
              convoData.client_id === user.id
                ? convoData.freelancer_id
                : convoData.client_id;

            const pairOr = `and(client_id.eq.${user.id},freelancer_id.eq.${otherUserId}),and(client_id.eq.${otherUserId},freelancer_id.eq.${user.id})`;
            const { data: pairConvos } = await supabase
              .from("conversations")
              .select("id")
              .or(pairOr);

            const convoIds = (pairConvos ?? []).map((c) => c.id as string);
            if (convoIds.length === 0) return;

            const { count } = await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .in("conversation_id", convoIds)
              .eq("sender_id", otherUserId)
              .is("read_at", null);

            const unread = count ?? 0;

            setConversations((prev) =>
              prev.map((convo) => {
                const cOther =
                  convo.client_id === user.id
                    ? convo.freelancer_id
                    : convo.client_id;
                if (cOther !== otherUserId) return convo;

                const updatedLastMessage =
                  convo.last_message?.created_at === updatedMsg.created_at
                    ? convo.last_message
                      ? {
                          ...convo.last_message,
                          read_at: updatedMsg.read_at ?? null,
                          read_by: updatedMsg.read_by ?? null,
                        }
                      : undefined
                    : convo.last_message;

                return {
                  ...convo,
                  unread_count: unread,
                  last_message: updatedLastMessage,
                };
              }),
            );
          },
        )
        .subscribe();

      const onActivityChange = () => {
        loadConversationsRef.current?.();
      };

      let activityCh: ReturnType<typeof supabase.channel> | null = null;
      if (profile.role === "freelancer") {
        activityCh = supabase
          .channel(`inbox-activity-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "job_candidate_notifications",
              filter: `freelancer_id=eq.${user.id}`,
            },
            onActivityChange,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "job_requests",
              filter: `selected_freelancer_id=eq.${user.id}`,
            },
            onActivityChange,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "job_confirmations",
              filter: `freelancer_id=eq.${user.id}`,
            },
            onActivityChange,
          );
        activityCh.subscribe();
      } else if (profile.role === "client") {
        activityCh = supabase
          .channel(`inbox-activity-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "job_requests",
              filter: `client_id=eq.${user.id}`,
            },
            onActivityChange,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "job_confirmations",
            },
            onActivityChange,
          );
        activityCh.subscribe();
      }

      return () => {
        supabase.removeChannel(channel);
        if (activityCh) supabase.removeChannel(activityCh);
      };
    }
  }, [user, profile]);

  // Reconcile inbox after time away (e.g. dismissed a job confirmation elsewhere)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (user?.id) {
          setDismissedActivityIds(loadDismissedActivityIds(user.id));
        }
        loadConversationsRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user?.id]);

  // Update cache whenever conversations change (from real-time updates or initial load)
  useEffect(() => {
    if (user && profile && conversations.length >= 0) {
      try {
        localStorage.setItem(
          `messages_${user.id}_${profile.role}`,
          JSON.stringify({
            timestamp: Date.now(),
            data: { conversations },
          }),
        );
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
    // Compact so inbox timestamps fit on narrow screens (avoid full locale string clipping)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== now.getFullYear()
        ? { year: "2-digit" as const }
        : {}),
    });
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

  function hideChatForUser(otherUserId: string) {
    if (!user?.id) return;
    const active = conversations.find((c) => c.id === conversationId);
    if (active?.other_user_id === otherUserId) {
      handleBackToContacts();
    }
    setHiddenChatUserIds((prev) => {
      if (prev.has(otherUserId)) return prev;
      const next = new Set(prev);
      next.add(otherUserId);
      persistHiddenChatUserIds(user.id, next);
      return next;
    });
  }

  function handleActivityClick(alert: NotificationAlert) {
    setDismissedActivityIds((prev) => {
      if (prev.has(alert.id)) return prev;
      const next = new Set(prev);
      next.add(alert.id);
      if (user?.id) persistDismissedActivityIds(user.id, next);
      return next;
    });

    if (alert.type === "job_request" && user?.id) {
      void supabase
        .from("job_candidate_notifications")
        .update({ status: "closed" })
        .eq("id", alert.id)
        .eq("freelancer_id", user.id);
    }

    navigate(alert.link);
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-slate-50/50 dark:bg-zinc-950">
        <div className="flex h-full min-h-0 w-full flex-shrink-0 flex-col overflow-hidden border-r border-border/30 bg-transparent md:w-80 lg:w-96 md:flex">
          <div className="z-40 flex shrink-0 border-b border-border/30 bg-background/95 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:bg-transparent md:pt-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-md md:hidden" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+5.25rem)] md:pt-0">
            <div className="mt-2 w-full min-w-0 max-w-full divide-y space-y-0.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex w-full items-center gap-3 px-4 py-4">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-transparent md:flex">
          <div className="text-center">
            <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
            <Skeleton className="mx-auto mb-2 h-6 w-32" />
            <Skeleton className="mx-auto h-4 w-64" />
          </div>
        </div>
      </div>
    );
  }

  /** Mobile fixed inbox header height below safe-area — keep in sync with header block below */
  const messagesMobileHeaderInset =
    "pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+5.25rem)] md:pt-0";

  // Show contact panel with conversation list and chat inline
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-slate-50/50 dark:bg-zinc-950">
      {/* Contact Panel - Left Sidebar - Always visible on desktop, full page on mobile */}
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-shrink-0 flex-col overflow-hidden border-r border-border/30 bg-transparent md:w-80 lg:w-96",
          "md:flex",
          mobileView === "contacts" ? "flex" : "hidden md:flex",
        )}
      >
        {/* Header — fixed on mobile so list scrolls underneath; static in sidebar on md+ */}
        <div
          className={cn(
            "z-40 flex shrink-0 border-b border-border/30 bg-background/95 px-4 pb-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:bg-background/95",
            "fixed left-0 right-0 top-0 md:static md:z-auto",
            "pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:pt-4",
            "md:bg-transparent md:backdrop-blur-none",
          )}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate(
                  profile?.role === "client"
                    ? "/client/home"
                    : "/freelancer/home",
                )
              }
              className="md:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight">Inbox</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chats, job invites, responses, and updates
              </p>
            </div>
          </div>
        </div>

        {/* Unified inbox: active chats + job / hire activity — inset clears fixed header on mobile */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            messagesMobileHeaderInset,
          )}
        >
          <ScrollArea className="min-h-0 flex-1 bg-transparent [&_[data-radix-scroll-area-viewport]]:min-w-0 [&_[data-radix-scroll-area-viewport]]:max-w-full [&_[data-radix-scroll-area-viewport]]:bg-transparent">
            {inboxRows.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Nothing here yet</h3>
                <p className="text-sm text-muted-foreground">
                  Your chats and job updates will show here. Start a
                  conversation from a profile or job to see it in this list.
                </p>
              </div>
            ) : (
              <div className="w-full min-w-0 max-w-full divide-y space-y-0.5 overflow-x-hidden">
                {inboxRows.map((row) => {
                  if (row.kind === "activity") {
                    const a = row.alert;
                    const kind = inboxActivityKindLabel(a.type);
                    const ActivityIcon =
                      a.type === "message"
                        ? MessageSquare
                        : a.type === "job_request"
                          ? Bell
                          : Briefcase;
                    return (
                      <div
                        key={row.key}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer px-4 py-4 pr-[max(1rem,env(safe-area-inset-right,0px))] hover:bg-white dark:hover:bg-zinc-900/40 transition-colors text-left w-full"
                        onClick={() => handleActivityClick(a)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleActivityClick(a);
                          }
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative shrink-0">
                            {a.sender_photo ? (
                              <Avatar className="h-10 w-10 flex-shrink-0">
                                <AvatarImage src={a.sender_photo} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {a.title.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-full flex items-center justify-center",
                                  a.type === "job_request" &&
                                    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                                  a.type === "confirmation" &&
                                    "bg-sky-500/15 text-sky-700 dark:text-sky-400",
                                  a.type === "job_update" &&
                                    "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                                  a.type === "message" &&
                                    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
                                )}
                              >
                                <ActivityIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="relative min-w-0 flex-1">
                            {a.created_at && (
                              <span className="pointer-events-none absolute right-0 top-0 z-[1] max-w-[6rem] whitespace-nowrap text-right text-[10px] font-semibold tabular-nums text-muted-foreground/80">
                                {formatTime(a.created_at)}
                              </span>
                            )}
                            <div className="min-w-0 max-w-full pr-24">
                              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                                {kind}
                              </div>
                              <p className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                                {a.title}
                              </p>
                              {a.description && (
                                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                                  {a.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const convo = row.conversation;
                  const initials =
                    convo.other_user_profile?.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "?";

                  const isActive = conversationId === convo.id;

                  return (
                    <InboxChatSwipeRow
                      key={row.key}
                      onHide={() => {
                        const oid = convo.other_user_id;
                        if (oid) hideChatForUser(oid);
                      }}
                    >
                      <div
                        className={cn(
                          "cursor-pointer px-4 py-4 pr-[max(1rem,env(safe-area-inset-right,0px))] hover:bg-white dark:hover:bg-zinc-900/40 transition-colors relative border-l-[3px] border-transparent md:bg-transparent",
                          isActive && "bg-white dark:bg-zinc-900/60 border-orange-500",
                        )}
                        onClick={() => handleConversationClick(convo.id)}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="relative shrink-0">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage
                                src={
                                  convo.other_user_profile?.photo_url ||
                                  undefined
                                }
                              />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            {convo.unread_count > 0 && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                                <span className="text-[10px] font-bold text-primary-foreground">
                                  {convo.unread_count > 9
                                    ? "9+"
                                    : convo.unread_count}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="relative min-w-0 flex-1">
                            {convo.last_message && (
                              <span className="pointer-events-none absolute right-0 top-0 z-[1] max-w-[6rem] whitespace-nowrap text-right text-[10px] font-semibold tabular-nums text-muted-foreground/80">
                                {formatTime(convo.last_message.created_at)}
                              </span>
                            )}
                            <div className="min-w-0 max-w-full pr-24">
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                                Chat
                              </div>
                              <p
                                className={cn(
                                  "mb-1 truncate text-[16px] font-bold text-slate-900 dark:text-slate-100",
                                  convo.unread_count > 0 && "font-black",
                                )}
                              >
                                {convo.other_user_profile?.full_name || "User"}
                              </p>
                              {convo.last_message && (
                                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                  {convo.last_message.sender_id ===
                                    user?.id && (
                                    <div className="shrink-0">
                                      {convo.last_message.read_at &&
                                      convo.last_message.read_by ? (
                                        <CheckCheck className="h-4 w-4 text-blue-500" />
                                      ) : convo.last_message.read_at ? (
                                        <CheckCheck className="h-4 w-4 text-muted-foreground/60" />
                                      ) : (
                                        <Check className="h-4 w-4 text-muted-foreground/60" />
                                      )}
                                    </div>
                                  )}
                                  <p
                                    className={cn(
                                      "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] leading-tight",
                                      convo.unread_count > 0
                                        ? "font-bold text-foreground"
                                        : "font-medium text-muted-foreground",
                                    )}
                                  >
                                    {convo.last_message.sender_id ===
                                      user?.id && "You: "}
                                    {convo.last_message.attachment_type
                                      ? convo.last_message.attachment_type ===
                                        "image"
                                        ? "📷 Image"
                                        : `📎 ${convo.last_message.attachment_name || "File"}`
                                      : convo.last_message.body || ""}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </InboxChatSwipeRow>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Chat Area - Right Side */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          mobileView === "chat" ? "flex" : "hidden md:flex",
        )}
      >
        {conversationId ? (
          (() => {
            const selectedConvo = conversations.find(
              (c) => c.id === conversationId,
            );
            const otherUserId =
              selectedConvo?.other_user_id ?? directChatHeader?.otherUserId;
            const otherUserProfile =
              selectedConvo?.other_user_profile ??
              directChatHeader?.other_user_profile;
            const otherInitials =
              otherUserProfile?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "?";

            return (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Mobile chat bar — fixed to viewport top; conversation scrolls underneath */}
                <div
                  className={cn(
                    "z-40 flex shrink-0 border-b border-border/30 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:bg-background/95",
                    "fixed left-0 right-0 top-0 md:hidden",
                    "px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBackToContacts}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (otherUserId) navigate(`/profile/${otherUserId}`);
                        }}
                        disabled={!otherUserId}
                        className="rounded-full shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                        aria-label={
                          otherUserId
                            ? `View ${otherUserProfile?.full_name || "user"} public profile`
                            : undefined
                        }
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage
                            src={otherUserProfile?.photo_url || undefined}
                          />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {otherInitials}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold truncate">
                          {otherUserProfile?.full_name || "User"}
                        </h2>
                      </div>
                      {/* Desktop Back Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(
                            profile?.role === "client"
                              ? "/client/home"
                              : "/freelancer/home",
                          )
                        }
                        className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Chat Page area — top inset clears fixed mobile chat header */}
                <div
                  className={cn(
                    "relative min-h-0 flex-1 overflow-hidden",
                    "pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+4.25rem)] md:pt-0",
                  )}
                >
                  <div className="messages-chat-container h-full min-h-0">
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
          })()
        ) : (
          <div className="hidden flex-1 items-center justify-center bg-transparent md:flex">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Select a chat</h3>
              <p className="text-sm text-muted-foreground">
                Pick a conversation from your inbox, or open a job update from
                the list.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
