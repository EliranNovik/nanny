import { useEffect, useLayoutEffect, useState, useMemo } from "react";
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
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { LiveJobHeaderPill } from "@/components/messages/LiveJobHeaderPill";
import { useLiveJobConversationBanner } from "@/hooks/useLiveJobConversationBanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Bell,
  Briefcase,
  MessageSquare,
  Home,
  Rss,
  Newspaper,
  User,
  PlusSquare,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChatPage from "./ChatPage";
import { useSearchParams } from "react-router-dom";
import {
  useMessagesInbox,
  type InboxConversation,
} from "@/hooks/data/useMessagesInbox";
import { ChatParticipantProfilePeek } from "@/components/messages/ChatParticipantProfilePeek";

/** City for inbox row: job location first, else other user profile city */
function inboxRowLocation(convo: Conversation): string | null {
  const profile = convo.other_user_profile;
  const job = convo.job_summary;
  const loc = (job?.location_city || profile?.city || "").trim();
  return loc || null;
}

function trimPreviewNoise(body: string | null | undefined): string {
  if (!body) return "";
  return body.trim().replace(/^✓+\s*/u, "").trimStart();
}

type Conversation = InboxConversation;

type InboxRow =
  | { kind: "chat"; key: string; sortAt: number; conversation: Conversation }
  | { kind: "activity"; key: string; sortAt: number; alert: NotificationAlert };

function shouldOpenMobileChatPane(): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth >= 768) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("conversation")) return true;
  return /\/messages\/[^/]+/.test(window.location.pathname);
}

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ conversationId?: string }>();
  /** `/messages?conversation=` or `/messages/:conversationId` (both routes render this page) */
  const conversationId =
    searchParams.get("conversation") ?? params.conversationId ?? null;

  const inboxQuery = useMessagesInbox(user?.id, profile?.role);
  const conversations = inboxQuery.data ?? [];
  const [activityAlerts, setActivityAlerts] = useState<NotificationAlert[]>([]);
  const [dismissedActivityIds, setDismissedActivityIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hiddenChatUserIds, setHiddenChatUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const loading = inboxQuery.isPending && conversations.length === 0;
  const [isManageMode, setIsManageMode] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);

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

  useEffect(() => {
    if (!newChatOpen) {
      setUserSearchQuery("");
      setUserSearchResults([]);
    }
  }, [newChatOpen]);

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


        // Deterministic assignment to ensure unique conversation record
        const [idA, idB] = [user.id, selectedUserId].sort();
        const client_id = idA;
        const freelancer_id = idB;

        const { data: created } = await supabase
          .from("conversations")
          .insert({ client_id, freelancer_id, job_id: null })
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

  const chatInboxRows = useMemo((): Extract<InboxRow, { kind: "chat" }>[] => {
    const rows: Extract<InboxRow, { kind: "chat" }>[] = [];
    for (const c of conversations) {
      const oid = c.other_user_id;
      if (oid && hiddenChatUserIds.has(oid)) continue;
      const sortAt = c.last_message?.created_at
        ? new Date(c.last_message.created_at).getTime()
        : new Date(c.created_at).getTime();
      rows.push({ kind: "chat", key: `chat-${c.id}`, sortAt, conversation: c });
    }
    rows.sort((x, y) => y.sortAt - x.sortAt);
    return rows;
  }, [conversations, hiddenChatUserIds]);

  const activityInboxRows = useMemo((): Extract<InboxRow, { kind: "activity" }>[] => {
    const rows: Extract<InboxRow, { kind: "activity" }>[] = [];
    for (const a of visibleActivityAlerts) {
      const sortAt = a.created_at ? new Date(a.created_at).getTime() : 0;
      rows.push({ kind: "activity", key: `act-${a.id}`, sortAt, alert: a });
    }
    rows.sort((x, y) => y.sortAt - x.sortAt);
    return rows;
  }, [visibleActivityAlerts]);

  const [inboxTab, setInboxTab] = useState<"messages" | "news">("messages");

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

  const [mobileView, setMobileView] = useState<"contacts" | "chat">(() =>
    shouldOpenMobileChatPane() ? "chat" : "contacts",
  );
  /** When URL has ?conversation= but list has not loaded that row yet (e.g. new direct chat). */
  const [directChatHeader, setDirectChatHeader] = useState<{
    otherUserId: string;
    other_user_profile: {
      full_name: string | null;
      photo_url: string | null;
      city?: string | null;
    };
  } | null>(null);

  // Keep mobile pane in sync with URL (useLayoutEffect avoids one frame with chat hidden).
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (conversationId) {
      setInboxTab("messages");
      setMobileView("chat");
    } else {
      setMobileView("contacts");
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
        .select("full_name, photo_url, city")
        .eq("id", otherId)
        .single();
      if (!cancelled) {
        setDirectChatHeader({
          otherUserId: otherId,
          other_user_profile: {
            full_name: p?.full_name ?? null,
            photo_url: p?.photo_url ?? null,
            city: p?.city ?? null,
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, user, conversations]);

  useEffect(() => {
    if (!user?.id || !profile) {
      setActivityAlerts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchInboxActivityAlerts(user, profile, {
          includeUnreadMessageAlerts: false,
        });
        if (!cancelled) setActivityAlerts(rows);
      } catch (e) {
        console.error("[MessagesPage] activity", e);
        if (!cancelled) setActivityAlerts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  useEffect(() => {
    if (!user?.id || !profile) return;

    const channel = supabase
      .channel(`messages-inbox-unhide-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const newMsg = payload.new as { conversation_id: string; sender_id: string };
          const { data: convoData } = await supabase
            .from("conversations")
            .select("client_id, freelancer_id")
            .eq("id", newMsg.conversation_id)
            .maybeSingle();

          if (!convoData) return;
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
        },
      )
      .subscribe();

    let activityCh: ReturnType<typeof supabase.channel> | null = null;
    const onActivityChange = () => {
      void inboxQuery.refetch();
    };

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
      void supabase.removeChannel(channel);
      if (activityCh) void supabase.removeChannel(activityCh);
    };
  }, [user?.id, profile, inboxQuery]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (user?.id) {
          setDismissedActivityIds(loadDismissedActivityIds(user.id));
        }
        void inboxQuery.refetch();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user?.id, inboxQuery]);

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
      <div
        data-messages-page=""
        className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-background"
      >
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
                  <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
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
    <div
      data-messages-page=""
      className="flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-background"
    >
      {/* Contact Panel - Left Sidebar - Always visible on desktop, full page on mobile */}
      <div
        className={cn(
          "relative flex h-full min-h-0 w-full flex-shrink-0 flex-col overflow-hidden bg-transparent md:w-80 lg:w-96",
          "md:flex",
          mobileView === "contacts" ? "flex" : "hidden md:flex",
        )}
      >
        {/*
          Mobile: fixed frosted top + bottom (WhatsApp-style). Middle list scrolls edge-to-edge
          with padding so rows pass under the chrome. Desktop: normal in-flow flex column.
        */}
        <div className="max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-40 md:contents">
          {/* Header */}
          <div
            className={cn(
              "z-40 flex shrink-0 px-4 pb-3",
              "pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:pt-4",
              "max-md:border-b max-md:border-border/10 max-md:bg-background/72 max-md:backdrop-blur-2xl",
              "max-md:supports-[backdrop-filter]:bg-background/48",
              "max-md:dark:bg-background/58 max-md:dark:supports-[backdrop-filter]:bg-background/38",
              "md:bg-background/95 md:backdrop-blur-md md:supports-[backdrop-filter]:bg-background/85",
              "md:dark:bg-background/95 md:border-b-0 md:backdrop-blur-md",
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
              className={cn(
                "mt-0.5 shrink-0 md:hidden",
                "ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]",
              )}
            >
              <HeaderBackChevron />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                Inbox
              </h2>
              {inboxTab === "messages" ? (
                <p className="mt-1 text-xs text-muted-foreground" role="status">
                  {inboxUnreadTotal > 0 ? (
                    <span className="font-medium text-foreground">
                      {inboxUnreadTotal} unread
                    </span>
                  ) : (
                    <span>All read</span>
                  )}
                </p>
              ) : visibleActivityAlerts.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground" role="status">
                  <span>
                    {visibleActivityAlerts.length} update
                    {visibleActivityAlerts.length === 1 ? "" : "s"}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground" role="status">
                  Nothing new
                </p>
              )}
            </div>
          </div>
          </div>

          {/* Messages vs news */}
          <div
            className={cn(
              "shrink-0 px-4 pb-3 pt-1",
              "max-md:border-b max-md:border-border/10 max-md:bg-background/72 max-md:backdrop-blur-2xl",
              "max-md:supports-[backdrop-filter]:bg-background/48",
              "max-md:dark:bg-background/58 max-md:dark:supports-[backdrop-filter]:bg-background/38",
              "max-md:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]",
              "md:bg-transparent md:shadow-none md:backdrop-blur-none",
            )}
          >
          <div
            className="flex rounded-xl bg-muted/45 p-1 ring-1 ring-border/10 dark:bg-zinc-900/75 dark:ring-white/5"
            role="tablist"
            aria-label="Inbox sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inboxTab === "messages"}
              onClick={() => setInboxTab("messages")}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                inboxTab === "messages"
                  ? "bg-background text-foreground shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>Messages</span>
              {inboxUnreadTotal > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                  {inboxUnreadTotal > 99 ? "99+" : inboxUnreadTotal}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inboxTab === "news"}
              onClick={() => setInboxTab("news")}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                inboxTab === "news"
                  ? "bg-background text-foreground shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Newspaper className="h-4 w-4 shrink-0" aria-hidden />
              <span>News</span>
              {visibleActivityAlerts.length > 0 ? (
                <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-foreground dark:bg-white/15">
                  {visibleActivityAlerts.length > 99
                    ? "99+"
                    : visibleActivityAlerts.length}
                </span>
              ) : null}
            </button>
          </div>
          </div>
        </div>

        {/* Messages list or activity / news list — scrolls under mobile chrome */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden max-md:min-h-0">
          <ScrollArea
            className={cn(
              "min-h-0 flex-1 bg-transparent",
              "[&_[data-radix-scroll-area-viewport]]:min-w-0",
              "[&_[data-radix-scroll-area-viewport]]:max-w-full",
              "[&_[data-radix-scroll-area-viewport]]:bg-transparent",
              "[&_[data-radix-scroll-area-viewport]]:max-md:pt-[calc(max(0.75rem,env(safe-area-inset-top,0px))+7.85rem)]",
              inboxTab === "messages"
                ? "[&_[data-radix-scroll-area-viewport]]:max-md:pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))]"
                : "[&_[data-radix-scroll-area-viewport]]:max-md:pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
            )}
          >
            {inboxTab === "messages" ? (
              chatInboxRows.length === 0 ? (
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
              <div className="w-full min-w-0 max-w-full overflow-x-hidden">
                {chatInboxRows.map((row, index) => {
                  const convo = row.conversation;
                  const initials =
                    convo.other_user_profile?.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "?";

                  const isActive = conversationId === convo.id;
                  const locationLabel = inboxRowLocation(convo);

                  return (
                    <div
                      key={row.key}
                      className={cn(
                        "relative cursor-pointer px-4 py-4 pr-[max(1rem,env(safe-area-inset-right,0px))] transition-colors hover:bg-muted/30 dark:hover:bg-zinc-900/50 border-l-2 border-transparent md:bg-transparent",
                        isActive && "bg-muted/50 dark:bg-zinc-900/70 border-l-primary",
                        convo.unread_count > 0 &&
                          !isActive &&
                          "bg-muted/20 dark:bg-muted/10",
                      )}
                      onClick={() => handleConversationClick(convo.id)}
                    >
                      {/*
                        Row divider — indented so it starts after the avatar.
                        Skipped on the first row so the inbox only shows the
                        faint top/bottom edges of the box.
                      */}
                      {index > 0 ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-[5.5rem] right-4 top-0 h-px bg-border/70 dark:bg-white/[0.22] md:left-[5.125rem]"
                        />
                      ) : null}
                        <div className="flex min-w-0 items-start gap-3.5">
                          <div className="relative shrink-0 pt-0.5">
                            <Avatar className="h-[3.625rem] w-[3.625rem] flex-shrink-0 md:h-[3.25rem] md:w-[3.25rem]">
                              <AvatarImage
                                src={
                                  convo.other_user_profile?.photo_url ||
                                  undefined
                                }
                              />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            {convo.unread_count > 0 && (
                              <div className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1">
                                <span className="text-[11px] font-semibold tabular-nums leading-none text-primary-foreground">
                                  {convo.unread_count > 9
                                    ? "9+"
                                    : convo.unread_count}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="relative min-w-0 flex-1">
                            {convo.last_message && (
                              <span className="pointer-events-none absolute right-0 top-0 z-[1] max-w-[6.5rem] whitespace-nowrap text-right text-sm font-medium tabular-nums text-muted-foreground">
                                {formatTime(convo.last_message.created_at)}
                              </span>
                            )}
                            <div className="min-w-0 max-w-full pr-[5.5rem]">
                              <p
                                className={cn(
                                  "flex min-w-0 items-baseline gap-x-1.5 text-[17px] font-semibold leading-snug text-foreground md:text-base",
                                  convo.unread_count > 0 && "text-foreground",
                                )}
                              >
                                <span className="min-w-0 truncate">
                                  {convo.other_user_profile?.full_name ||
                                    "User"}
                                </span>
                                {locationLabel ? (
                                  <span className="shrink-0 font-normal text-[15px] text-muted-foreground md:text-[15px]">
                                    · {locationLabel}
                                  </span>
                                ) : null}
                              </p>
                              {convo.last_message && (
                                <p
                                  className={cn(
                                    "mt-1 truncate text-[15px] leading-snug text-muted-foreground md:text-[15px]",
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
            ))
            : activityInboxRows.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Newspaper className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  No updates yet
                </h3>
                <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Job invites, confirmations, and other activity will show up here
                  when something needs your attention.
                </p>
              </div>
            ) : (
              <div className="w-full min-w-0 max-w-full space-y-0.5 overflow-x-hidden">
                {activityInboxRows.map((row) => {
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
                            <Avatar className="h-12 w-12 flex-shrink-0">
                              <AvatarImage src={a.sender_photo} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                                {a.title.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div
                              className={cn(
                                "h-12 w-12 rounded-full flex items-center justify-center",
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
                              <ActivityIcon className="h-5 w-5" />
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
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Mobile Action Box — messages tab only; fixed frosted footer */}
        {inboxTab === "messages" ? (
        <div
          className={cn(
            "flex shrink-0 items-center justify-around px-4 md:hidden",
            "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40",
            "max-md:border-t max-md:border-border/10 max-md:bg-background/72 max-md:backdrop-blur-2xl",
            "max-md:supports-[backdrop-filter]:bg-background/48",
            "max-md:dark:bg-background/58 max-md:dark:supports-[backdrop-filter]:bg-background/38",
            "max-md:shadow-[0_-10px_32px_-14px_rgba(0,0,0,0.4)]",
            "pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] min-h-[4.75rem]",
          )}
        >
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground active:scale-[0.98]"
            onClick={() => setNewChatOpen(true)}
          >
            <PlusSquare className="h-6 w-6" />
            <span className="text-[11px] font-semibold">New Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManageMode(!isManageMode)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-colors active:scale-[0.98]",
              isManageMode
                ? "bg-red-500/12 text-red-600 hover:bg-red-500/18 dark:text-red-400"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Trash2 className="h-6 w-6" />
            <span className="text-[11px] font-semibold">
              {isManageMode ? "Done" : "Remove"}
            </span>
          </button>
        </div>
        ) : null}

        {/* Desktop Tab Bar */}
        <div className="hidden md:flex shrink-0 items-center justify-around border-t border-border/20 bg-background/95 px-4 pt-2.5 pb-4 h-[71px] dark:border-white/[0.04]">
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
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100 dark:bg-background">
                {/* Mobile chat bar — fixed to viewport top; conversation scrolls underneath */}
                <div
                  className={cn(
                    "z-40 flex shrink-0 items-center gap-2",
                    "border-b border-border/15 bg-white dark:bg-background",
                    "fixed left-0 right-0 top-0 md:hidden",
                    "px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToContacts}
                    className={cn(
                      "shrink-0 self-center",
                      "ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]",
                    )}
                  >
                    <HeaderBackChevron />
                  </Button>
                  <div className="flex min-w-0 flex-1 items-center gap-2 self-center">
                    <ChatParticipantProfilePeek
                      userId={otherUserId}
                      preview={
                        otherUserProfile
                          ? {
                              full_name: otherUserProfile.full_name,
                              photo_url: otherUserProfile.photo_url,
                              city: otherUserProfile.city ?? null,
                            }
                          : null
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
                    </ChatParticipantProfilePeek>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-semibold leading-tight">
                        {otherUserProfile?.full_name || "User"}
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
                      className={cn(
                        "hidden shrink-0 items-center gap-2 text-muted-foreground transition-colors hover:text-primary md:flex",
                        "ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]",
                      )}
                    >
                      <HeaderBackChevron className="h-6 w-6" />
                      <span>Back</span>
                    </Button>
                  </div>
                </div>

                {/*
                  Desktop chat header — absolutely overlaid so the conversation
                  scrolls beneath it, mirroring the composer's translucent feel.
                */}
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 z-20 hidden h-[3.5rem] items-center justify-between gap-3 px-5",
                    "border-b border-border/15 bg-white dark:bg-background",
                    "md:flex",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ChatParticipantProfilePeek
                      userId={otherUserId}
                      preview={
                        otherUserProfile
                          ? {
                              full_name: otherUserProfile.full_name,
                              photo_url: otherUserProfile.photo_url,
                              city: otherUserProfile.city ?? null,
                            }
                          : null
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
                    </ChatParticipantProfilePeek>
                    <h2 className="min-w-0 truncate text-base font-semibold leading-tight text-foreground">
                      {otherUserProfile?.full_name || "User"}
                    </h2>
                  </div>
                  {liveJobHeaderBanner && (
                    <LiveJobHeaderPill
                      categoryLabel={liveJobHeaderBanner.categoryLabel}
                      href={liveJobHeaderBanner.href}
                      className="shrink-0"
                    />
                  )}
                </div>

                {/*
                  Chat Page area — wrapper has zero top inset on both viewports
                  so the message list sits flush against the top of the chat
                  column and scrolls UNDER the translucent floating header.
                  The clearance lives inside `ChatPage`'s scroll container
                  (`pt-[...]`) so the first message is positioned correctly
                  initially but slides under the header as the user scrolls —
                  which is what produces the glassy blur on both mobile and
                  desktop.
                */}
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <div className="messages-chat-container h-full min-h-0">
                    <ChatPage
                      key={conversationId || "none"}
                      conversationId={conversationId}
                      hideBackButton={true}
                      otherUserId={otherUserId}
                      chatPaneVisible={
                        mobileView === "chat" ||
                        typeof window !== "undefined" && window.innerWidth >= 768
                      }
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
                Pick a conversation from your Messages list.
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent
          overlayClassName="max-md:bg-black/45"
          className={cn(
            "flex max-h-[min(88dvh,640px)] w-full flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl",
            "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[min(92dvh,720px)]",
            "max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-[1.5rem] max-md:rounded-b-none",
            "!max-md:data-[state=open]:slide-in-from-left-0 !max-md:data-[state=open]:slide-in-from-top-0",
            "!max-md:data-[state=closed]:slide-out-to-left-0 !max-md:data-[state=closed]:slide-out-to-top-0",
            "!max-md:data-[state=open]:zoom-in-100 !max-md:data-[state=closed]:zoom-out-100",
            "!max-md:data-[state=open]:slide-in-from-bottom !max-md:data-[state=closed]:slide-out-to-bottom",
            "md:max-w-md md:rounded-2xl md:p-6",
          )}
        >
          <DialogTitle className="sr-only">Start a new chat</DialogTitle>

          <div className="flex shrink-0 justify-center pt-3 pb-1 md:hidden">
            <div
              className="h-1 w-10 rounded-full bg-muted-foreground/35"
              aria-hidden
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-5 py-3.5 md:border-0 md:px-0 md:pb-2 md:pt-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-base">
              New chat
            </h2>
            <DialogClose asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogClose>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-1 md:px-0 md:pb-0 md:pt-0">
            <div className="relative shrink-0">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search by name…"
                autoComplete="off"
                className="h-12 w-full rounded-2xl border border-border/50 bg-muted/30 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 md:h-11 md:text-sm"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] md:max-h-60">
              {userSearchQuery.trim() && userSearchResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No users found
                </p>
              ) : null}
              <div className="space-y-1">
                {userSearchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                    onClick={() => void handleCreateChat(u.id)}
                  >
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={u.photo_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {u.full_name?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">
                        {u.full_name || "User"}
                      </p>
                      {u.role ? (
                        <p className="truncate text-sm capitalize text-muted-foreground">
                          {u.role}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
