import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, ArrowLeft, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChatPage from "./ChatPage";
import { useSearchParams } from "react-router-dom";
import { getJobStageBadge } from "@/lib/jobStages";

interface Conversation {
  id: string;
  job_id: string;
  client_id: string;
  freelancer_id: string;
  created_at: string;
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
  };
  unread_count: number;
}

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const loadConversationsRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    async function loadConversations() {
      if (!user || !profile) return;

      try {
        let convos;
        
        // Fetch conversations based on user role
        if (profile.role === "client") {
          const { data } = await supabase
            .from("conversations")
            .select("id, job_id, client_id, freelancer_id, created_at")
            .eq("client_id", user.id)
            .order("created_at", { ascending: false });
          convos = data;
        } else {
          // Freelancer
          const { data } = await supabase
            .from("conversations")
            .select("id, job_id, client_id, freelancer_id, created_at")
            .eq("freelancer_id", user.id)
            .order("created_at", { ascending: false });
          convos = data;
        }

        if (!convos || convos.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        // Group conversations by other user ID first
        const conversationsByUser = new Map<string, typeof convos>();
        
        for (const convo of convos) {
          const otherUserId = profile.role === "client" 
            ? convo.freelancer_id 
            : convo.client_id;
          
          if (!conversationsByUser.has(otherUserId)) {
            conversationsByUser.set(otherUserId, []);
          }
          conversationsByUser.get(otherUserId)!.push(convo);
        }

        // Now process each user group to aggregate messages and unread counts across all their conversations
        const enriched = await Promise.all(
          Array.from(conversationsByUser.entries()).map(async ([otherUserId, userConversations]) => {
            // Fetch profile once per user
            const { data: otherProfile } = await supabase
              .from("profiles")
              .select("full_name, photo_url")
              .eq("id", otherUserId)
              .single();

            // Get all conversation IDs for this user
            const conversationIds = userConversations.map(c => c.id);

            // Find the most recent message across ALL conversations with this user
            const { data: allMessages } = await supabase
              .from("messages")
              .select("body, created_at, sender_id, read_at, read_by, attachment_type, attachment_name, conversation_id")
              .in("conversation_id", conversationIds)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            // Count unread messages across ALL conversations with this user
            const { count: totalUnread } = await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .in("conversation_id", conversationIds)
              .eq("sender_id", otherUserId)
              .is("read_at", null);

            // Get the conversation ID of the most recent message (or use the first conversation)
            const mostRecentConversationId = allMessages?.conversation_id || userConversations[0].id;
            const mostRecentConversation = userConversations.find(c => c.id === mostRecentConversationId) || userConversations[0];

            // Fetch job info for the most recent conversation
            const { data: job } = await supabase
              .from("job_requests")
              .select("id, status, care_type, children_count, children_age_group, start_at")
              .eq("id", mostRecentConversation.job_id)
              .single();

            return {
              ...mostRecentConversation,
              other_user_profile: {
                full_name: otherProfile?.full_name || null,
                photo_url: otherProfile?.photo_url || null,
              },
              job: job || undefined,
              last_message: allMessages || undefined,
              unread_count: totalUnread || 0,
            };
          })
        );

        // Filter to only conversations with jobs (job-related conversations)
        const jobRelatedConversations = enriched.filter(c => c.job);

        // Sort by last message time
        const sortedConversations = jobRelatedConversations.sort((a, b) => {
          const timeA = a.last_message?.created_at 
            ? new Date(a.last_message.created_at).getTime() 
            : 0;
          const timeB = b.last_message?.created_at 
            ? new Date(b.last_message.created_at).getTime() 
            : 0;
          return timeB - timeA; // Most recent first
        });

        setConversations(sortedConversations);
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
            
            // Determine other user ID based on role
            const otherUserId = profile.role === "client" 
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
                      return {
                        ...convo,
                        unread_count: Math.max(0, convo.unread_count - 1),
                        last_message: convo.last_message?.created_at === updatedMsg.created_at
                          ? {
                              ...convo.last_message,
                              read_at: updatedMsg.read_at,
                              read_by: updatedMsg.read_by,
                            }
                          : convo.last_message,
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

  function handleConversationClick(convoId: string) {
    setSearchParams({ conversation: convoId });
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
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Contact Panel - Left Sidebar - Always visible on desktop */}
      <div className="w-80 lg:w-96 border-r bg-card flex flex-col flex-shrink-0 hidden md:flex">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(profile?.role === "client" ? "/dashboard" : "/freelancer/profile")}
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
            <div className="divide-y">
              {conversations.map((convo) => {
                const initials = convo.other_user_profile?.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "?";

                const isActive = conversationId === convo.id;
                
                // Format job label
                const formatJobLabel = (job: typeof convo.job) => {
                  if (!job) return "";
                  const careTypeMap: Record<string, string> = {
                    occasional: "One-time",
                    part_time: "Part-time",
                    full_time: "Full-time",
                  };
                  const careType = careTypeMap[job.care_type] || job.care_type;
                  
                  if (job.start_at) {
                    const startDate = new Date(job.start_at);
                    const today = new Date();
                    const isToday = startDate.toDateString() === today.toDateString();
                    if (isToday) {
                      return `Nanny – Today`;
                    }
                    return `Nanny – ${startDate.toLocaleDateString()}`;
                  }
                  
                  if (job.status === "completed") {
                    return "Nanny – Completed";
                  }
                  
                  return `Nanny – ${careType}`;
                };
                
                // Get job status badge
                const getJobStatus = (job: typeof convo.job) => {
                  if (!job) return null;
                  if (job.status === "active" || job.status === "locked") {
                    return { label: "Active", variant: "default" as const };
                  }
                  if (job.status === "completed") {
                    return { label: "Completed", variant: "outline" as const };
                  }
                  return null;
                };
                
                const jobLabel = formatJobLabel(convo.job);
                const jobStatus = getJobStatus(convo.job);

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
                            "font-semibold truncate text-sm",
                            convo.unread_count > 0 && "font-bold"
                          )}>
                            {convo.other_user_profile?.full_name || "User"}
                          </p>
                          {convo.last_message && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTime(convo.last_message.created_at)}
                            </span>
                          )}
                        </div>
                        {/* Job Label */}
                        {jobLabel && (
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs text-muted-foreground truncate">{jobLabel}</span>
                            {jobStatus && (
                              <Badge variant={jobStatus.variant} className="text-[10px] px-1.5 py-0 h-4">
                                {jobStatus.label}
                              </Badge>
                            )}
                            {convo.job?.stage && (
                              <Badge variant={getJobStageBadge(convo.job.stage).variant} className="text-[10px] px-1.5 py-0 h-4">
                                {getJobStageBadge(convo.job.stage).label}
                              </Badge>
                            )}
                          </div>
                        )}
                        {convo.last_message && (
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {convo.last_message.sender_id === user?.id && (
                                <div className="flex-shrink-0">
                                  {convo.last_message.read_at && convo.last_message.read_by ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                  ) : convo.last_message.read_at ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  )}
                                </div>
                              )}
                              <p className={cn(
                                "text-xs truncate",
                                convo.unread_count > 0 
                                  ? "text-foreground font-medium" 
                                  : "text-muted-foreground"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {conversationId ? (() => {
          // Find the conversation to get the otherUserId
          const selectedConvo = conversations.find(c => c.id === conversationId);
          const otherUserId = selectedConvo 
            ? (profile?.role === "client" ? selectedConvo.freelancer_id : selectedConvo.client_id)
            : undefined;
          
          return <ChatPage 
            conversationId={conversationId} 
            hideBackButton={true} 
            otherUserId={otherUserId}
          />;
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

