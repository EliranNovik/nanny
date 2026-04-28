import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
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
  persistHiddenChatUserIds,
} from "@/lib/inboxHiddenChats";
import { LiveJobHeaderPill } from "@/components/messages/LiveJobHeaderPill";
import { type JobSummaryRow } from "@/lib/chatJobContext";
import { useLiveJobConversationBanner } from "@/hooks/useLiveJobConversationBanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  ChevronLeft,
  Bell,
  Briefcase,
  MessageSquare,
  Home,
  Rss,
  User,
  PlusSquare,
  Trash2,
  X,
  Heart,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import ChatPage from "./ChatPage";
import { useSearchParams } from "react-router-dom";

/** One muted line under the name: category · city · Done when relevant */
function inboxRowSubtitle(convo: Conversation): string | null {
  const profile = convo.other_user_profile;
  const job = convo.job_summary;
  
  const loc = (job?.location_city || profile?.city || "").trim();
  const rating = profile?.average_rating;
  const count = (profile as any)?.total_ratings;
  
  const ratingStr = rating && Number(rating) > 0 
    ? `${Number(rating).toFixed(1)}${count ? ` (${count})` : ""}` 
    : "New";
    
  if (loc) return `${loc} · ${ratingStr}`;
  return loc || null;
}

function trimPreviewNoise(body: string | null | undefined): string {
  if (!body) return "";
  return body.trim().replace(/^✓+\s*/u, "").trimStart();
}

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
    average_rating?: number | null;
    total_ratings?: number | null;
    city?: string | null;
  };
  /** Joined from job_requests for status + preview */
  job_summary?: JobSummaryRow | null;
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
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ conversationId?: string }>();
  /** `/messages?conversation=` or `/messages/:conversationId` (both routes render this page) */
  const conversationId =
    searchParams.get("conversation") ?? params.conversationId ?? null;

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
  const [isManageMode, setIsManageMode] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [favoriteUserIds, setFavoriteUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setFavoriteUserIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", user.id);
      if (!cancelled && data) {
        setFavoriteUserIds(new Set(data.map((r: any) => r.favorite_user_id)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleProfileFavorite = async (targetUserId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.id) return;

    const isCurrentlyFav = favoriteUserIds.has(targetUserId);
    try {
      if (isCurrentlyFav) {
        const { error } = await supabase
          .from("profile_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("favorite_user_id", targetUserId);
        if (error) throw error;
        setFavoriteUserIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        addToast({ title: "Removed from saved profiles", variant: "success" });
      } else {
        const { error } = await supabase
          .from("profile_favorites")
          .insert({ user_id: user.id, favorite_user_id: targetUserId });
        if (error) throw error;
        setFavoriteUserIds((prev) => {
          const next = new Set(prev);
          next.add(targetUserId);
          return next;
        });
        addToast({ title: "Saved to profiles", variant: "success" });
      }
    } catch (err) {
      console.error("[MessagesPage] toggleProfileFavorite:", err);
      addToast({ title: "Could not update", variant: "error" });
    }
  };

  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, role")
        .ilike("full_name", `%${userSearchQuery}%`)
        .neq("id", user?.id || "")
        .limit(10);
      if (!cancelled && data) {
        setUserSearchResults(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userSearchQuery, user?.id]);

  const handleCreateChat = async (selectedUserId: string) => {
    if (!user) return;
    setNewChatOpen(false);
    setUserSearchQuery("");

    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(client_id.eq.${user.id},freelancer_id.eq.${selectedUserId}),and(client_id.eq.${selectedUserId},freelancer_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        handleConversationClick(existing.id);
      } else {


        const client_id = profile?.role === "client" ? user.id : selectedUserId;
        const freelancer_id = profile?.role === "freelancer" ? user.id : selectedUserId;

        const { data: created } = await supabase
          .from("conversations")
          .insert({ client_id, freelancer_id })
          .select("id")
          .single();

        if (created) {
          handleConversationClick(created.id);
        }
      }
    } catch (err) {
      console.error("[MessagesPage] Error starting chat:", err);
    }
  };

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

  const inboxUnreadTotal = useMemo(
    () => conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
    [conversations],
  );

  const activeConversationForChat = useMemo(() => {
    if (!conversationId) return null;
    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  /** Resolves job from `conversations.id` in DB — inbox row may not match URL conversation id */
  const liveJobHeaderBanner = useLiveJobConversationBanner(
    conversationId,
    user?.id,
  );

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
        .select("full_name, photo_url, average_rating, total_ratings, city")
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
          .select("id, full_name, photo_url, average_rating, total_ratings, city")
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
                  average_rating: otherProfile?.average_rating ?? null,
                  total_ratings: (otherProfile as any)?.total_ratings ?? null,
                  city: otherProfile?.city || null,
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

        const jobIds = [
          ...new Set(
            sortedConversations
              .map((c) => c.job_id)
              .filter((id): id is string => !!id),
          ),
        ];
        let withJobRows = sortedConversations;
        if (jobIds.length > 0) {
          const { data: jobRows } = await supabase
            .from("job_requests")
            .select(
              "id, status, stage, service_type, care_type, location_city, start_at",
            )
            .in("id", jobIds);
          const jm = new Map(
            (jobRows ?? []).map((j) => [j.id as string, j as JobSummaryRow]),
          );
          withJobRows = sortedConversations.map((c) =>
            c.job_id && jm.has(c.job_id)
              ? { ...c, job_summary: jm.get(c.job_id)! }
              : c,
          );
        }

        setConversations(withJobRows);

        // Cache the data for instant loading next time
        if (user && profile) {
          try {
            localStorage.setItem(
              `messages_${user.id}_${profile.role}`,
              JSON.stringify({
                timestamp: Date.now(),
                data: {
                  conversations: withJobRows,
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
            const { data: convoData } = await supabase
              .from("conversations")
              .select("client_id, freelancer_id")
              .eq("id", newMsg.conversation_id)
              .maybeSingle();

            if (convoData && user?.id) {
              const otherUserId =
                convoData.client_id === user.id
                  ? convoData.freelancer_id
                  : convoData.client_id;

              if (newMsg.sender_id === otherUserId) {
                setHiddenChatUserIds((prev) => {
                  if (!prev.has(otherUserId)) return prev;
                  const next = new Set(prev);
                  next.delete(otherUserId);
                  persistHiddenChatUserIds(user.id, next);
                  return next;
                });
              }
            }
            void refreshInbox(false);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
          },
          () => {
            void refreshInbox(false);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversations",
          },
          () => {
            void refreshInbox(false);
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
      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-background dark:bg-zinc-950">
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:pt-0">
            <div className="w-full min-w-0 max-w-full space-y-0.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex w-full items-center gap-3 px-4 py-4">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
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

  // Show contact panel with conversation list and chat inline
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-background dark:bg-zinc-950">
      {/* Contact Panel - Left Sidebar - Always visible on desktop, full page on mobile */}
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-shrink-0 flex-col overflow-hidden border-r border-border/30 bg-transparent md:w-80 lg:w-96",
          "md:flex",
          mobileView === "contacts" ? "flex" : "hidden md:flex",
        )}
      >
        {/* Header — in document flow (no fixed + duplicate pt — avoids double safe-area gap on mobile) */}
        <div
          className={cn(
            "z-40 flex shrink-0 border-b border-border/30 bg-background/95 px-4 pb-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:bg-background/95",
            "pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:pt-4",
            "md:bg-transparent md:backdrop-blur-none",
          )}
        >
          <div className="flex items-start gap-2 sm:gap-3">
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
              className="mt-0.5 shrink-0 md:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                Messages
              </h2>
              {(inboxUnreadTotal > 0 || visibleActivityAlerts.length > 0) && (
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  role="status"
                >
                  {inboxUnreadTotal > 0 ? (
                    <span className="font-medium text-foreground">
                      {inboxUnreadTotal} unread
                    </span>
                  ) : (
                    <span>All read</span>
                  )}
                  {visibleActivityAlerts.length > 0 ? (
                    <>
                      <span className="text-muted-foreground/60"> · </span>
                      <span>
                        {visibleActivityAlerts.length} update
                        {visibleActivityAlerts.length === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Unified inbox: active chats + job / hire activity */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 bg-transparent [&_[data-radix-scroll-area-viewport]]:min-w-0 [&_[data-radix-scroll-area-viewport]]:max-w-full [&_[data-radix-scroll-area-viewport]]:bg-transparent">
            {inboxRows.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  No conversations yet
                </h3>
                <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  When you message a helper or respond to a request, it appears
                  here with job context so you can act quickly.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="font-semibold"
                    onClick={() =>
                      navigate(
                        profile?.role === "client"
                          ? "/client/explore"
                          : profile?.role === "freelancer"
                            ? "/freelancer/explore"
                            : "/client/home",
                      )
                    }
                  >
                    {profile?.role === "client"
                      ? "Browse helpers"
                      : profile?.role === "freelancer"
                        ? "Browse jobs"
                        : "Go to home"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="font-semibold"
                    onClick={() =>
                      navigate(
                        profile?.role === "client"
                          ? "/client/home"
                          : "/freelancer/home",
                      )
                    }
                  >
                    Start a request
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full min-w-0 max-w-full space-y-0.5 overflow-x-hidden">
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
                        className="cursor-pointer px-4 py-3 pr-[max(1rem,env(safe-area-inset-right,0px))] text-left transition-colors hover:bg-muted/30 dark:hover:bg-zinc-900/50 w-full"
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
                              <Avatar className="h-14 w-14 flex-shrink-0">
                                <AvatarImage src={a.sender_photo} />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                                  {a.title.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div
                                className={cn(
                                  "h-14 w-14 rounded-full flex items-center justify-center",
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
                                <ActivityIcon className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="relative min-w-0 flex-1">
                            {a.created_at && (
                              <span className="pointer-events-none absolute right-0 top-0 z-[1] max-w-[6rem] whitespace-nowrap text-right text-[12px] font-semibold tabular-nums text-muted-foreground/80">
                                {formatTime(a.created_at)}
                              </span>
                            )}
                            <div className="min-w-0 max-w-full pr-24">
                              <p className="mb-0.5 truncate text-[12px] font-medium text-muted-foreground">
                                {kind}
                              </p>
                              <p className="truncate text-[17px] font-semibold text-foreground">
                                {a.title}
                              </p>
                              {a.description && (
                                <p className="mt-0.5 truncate text-[14px] text-muted-foreground">
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
                  const subtitle = inboxRowSubtitle(convo);

                  return (
                    <div
                      key={row.key}
                      className={cn(
                        "cursor-pointer px-4 py-3 pr-[max(1rem,env(safe-area-inset-right,0px))] transition-colors hover:bg-muted/30 dark:hover:bg-zinc-900/50 relative border-l-2 border-transparent md:bg-transparent",
                        isActive && "bg-muted/50 dark:bg-zinc-900/70 border-l-primary",
                        convo.unread_count > 0 &&
                          !isActive &&
                          "bg-muted/20 dark:bg-muted/10",
                      )}
                      onClick={() => handleConversationClick(convo.id)}
                    >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="relative shrink-0 pt-0.5">
                            <Avatar className="h-14 w-14 flex-shrink-0">
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
                              <div className="absolute -right-0.5 -top-0.5 h-4 min-w-[1rem] rounded-full bg-primary px-1 flex items-center justify-center">
                                <span className="text-[10px] font-semibold tabular-nums leading-none text-primary-foreground">
                                  {convo.unread_count > 9
                                    ? "9+"
                                    : convo.unread_count}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="relative min-w-0 flex-1">
                            {convo.last_message && (
                              <span className="pointer-events-none absolute right-0 top-0 z-[1] max-w-[5.5rem] whitespace-nowrap text-right text-[13px] tabular-nums text-muted-foreground">
                                {formatTime(convo.last_message.created_at)}
                              </span>
                            )}
                            <div className="min-w-0 max-w-full pr-16">
                              <p
                                className={cn(
                                  "truncate text-[17px] font-semibold text-foreground flex items-center gap-1.5",
                                  convo.unread_count > 0 && "text-foreground",
                                )}
                              >
                                <span>{convo.other_user_profile?.full_name || "User"}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (convo.other_user_id) toggleProfileFavorite(convo.other_user_id, e);
                                  }}
                                  className="p-0.5 rounded-full hover:bg-muted/50 transition-colors z-10"
                                >
                                  <Heart
                                    className={cn(
                                      "h-4 w-4 transition-all",
                                      convo.other_user_id && favoriteUserIds.has(convo.other_user_id)
                                        ? "fill-rose-500 text-rose-500 scale-110"
                                        : "text-muted-foreground/60 hover:text-rose-500"
                                    )}
                                  />
                                </button>
                              </p>
                              {subtitle ? (
                                <p className="mt-0.5 truncate text-[14px] text-muted-foreground">
                                  {subtitle}
                                </p>
                              ) : null}
                              {convo.last_message && (
                                <p
                                  className={cn(
                                    "mt-1 line-clamp-2 text-[14px] leading-snug text-muted-foreground",
                                    convo.unread_count > 0 &&
                                      "font-medium text-foreground/90",
                                  )}
                                >
                                  {convo.last_message.sender_id === user?.id
                                    ? "You · "
                                    : ""}
                                  {convo.last_message.attachment_type
                                    ? convo.last_message.attachment_type ===
                                      "image"
                                      ? "Photo"
                                      : convo.last_message.attachment_name ||
                                        "File"
                                    : trimPreviewNoise(
                                        convo.last_message.body,
                                      )}
                                </p>
                              )}
                            </div>
                            {isManageMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (convo.other_user_id) {
                                    hideChatForUser(convo.other_user_id);
                                  }
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md transition-colors"
                                aria-label="Remove conversation"
                              >
                                <X className="h-4 w-4" />
                              </button>
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

        {/* Mobile Action Box */}
        <div className="flex md:hidden shrink-0 items-center justify-around border-t border-border/30 bg-background/95 px-4 pt-2.5 pb-4 h-[71px]">
          <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
                <PlusSquare className="h-6 w-6" />
                <span className="text-[11px] font-medium">New Chat</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md p-6">
              <DialogHeader>
                <DialogTitle>Start a New Chat</DialogTitle>
              </DialogHeader>
              <input
                type="text"
                placeholder="Search users..."
                className="w-full mt-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {userSearchResults.map((u) => (
                  <button
                    key={u.id}
                    className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted/50 text-left"
                    onClick={() => handleCreateChat(u.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.photo_url || ""} />
                      <AvatarFallback>{u.full_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{u.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground uppercase">{u.role || ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={() => setIsManageMode(!isManageMode)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors",
              isManageMode ? "text-red-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trash2 className="h-6 w-6" />
            <span className="text-[11px] font-medium">{isManageMode ? "Done" : "Remove"}</span>
          </button>
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden md:flex shrink-0 items-center justify-around border-t border-border/30 bg-background/95 px-4 pt-2.5 pb-4 h-[71px]">
          <Link
            to={profile?.role === "freelancer" ? "/freelancer/home" : "/client/home"}
            className={cn(
              "flex flex-col items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground",
              (location.pathname.startsWith("/freelancer/home") || location.pathname.startsWith("/client/home")) && "text-primary hover:text-primary"
            )}
          >
            <Home className="h-6 w-6" />
          </Link>

          <Link
            to={profile?.role === "freelancer" ? "/freelancer/explore" : "/client/explore"}
            className={cn(
              "flex flex-col items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground",
              (location.pathname.startsWith("/freelancer/explore") || location.pathname.startsWith("/client/explore")) && "text-primary hover:text-primary"
            )}
          >
            <Rss className="h-6 w-6" />
          </Link>

          <Link
            to="/messages"
            className={cn(
              "flex flex-col items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground",
              location.pathname.startsWith("/messages") && "text-primary hover:text-primary"
            )}
          >
            <MessageCircle className="h-6 w-6" />
          </Link>

          <Link
            to={profile?.role === "freelancer" ? "/freelancer/profile" : "/client/profile"}
            className={cn(
              "flex flex-col items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground",
              (location.pathname.startsWith("/freelancer/profile") || location.pathname.startsWith("/client/profile")) && "text-primary hover:text-primary"
            )}
          >
            <User className="h-6 w-6" />
          </Link>
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
            const selectedConvo = activeConversationForChat;
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
                    "z-40 flex shrink-0 items-center gap-2 border-b border-border/30 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:bg-background/95",
                    "fixed left-0 right-0 top-0 md:hidden",
                    "px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToContacts}
                    className="shrink-0 self-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex min-w-0 flex-1 items-center gap-2 self-center">
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
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold truncate flex items-center gap-1.5">
                        {otherUserProfile?.full_name || "User"}
                        <button
                          type="button"
                          onClick={(e) => {
                            if (otherUserId) toggleProfileFavorite(otherUserId, e);
                          }}
                          className="p-0.5 rounded-full hover:bg-muted/50 transition-colors"
                        >
                          <Heart
                            className={cn(
                              "h-4 w-4 transition-all",
                              otherUserId && favoriteUserIds.has(otherUserId)
                                ? "fill-rose-500 text-rose-500 scale-110"
                                : "text-muted-foreground/60 hover:text-rose-500"
                            )}
                          />
                        </button>
                      </h2>
                    </div>
                    {liveJobHeaderBanner && (
                      <LiveJobHeaderPill
                        categoryLabel={liveJobHeaderBanner.categoryLabel}
                        href={liveJobHeaderBanner.href}
                        className="max-w-[min(42vw,9.5rem)] shrink-0 self-center"
                      />
                    )}
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
                      className="hidden shrink-0 items-center gap-2 text-muted-foreground hover:text-primary transition-colors md:flex"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </Button>
                  </div>
                </div>

                {liveJobHeaderBanner && (
                  <div className="hidden shrink-0 items-center justify-end border-b border-border/30 bg-background/90 px-4 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 md:flex dark:bg-background/95">
                    <LiveJobHeaderPill
                      categoryLabel={liveJobHeaderBanner.categoryLabel}
                      href={liveJobHeaderBanner.href}
                    />
                  </div>
                )}

                {/* Chat Page area — top inset clears fixed mobile chat header (single row: back + avatar + name + optional pill) */}
                <div
                  className={cn(
                    "relative min-h-0 flex-1 overflow-hidden",
                    "pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+3.5rem)] md:pt-0",
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
