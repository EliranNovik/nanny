import {
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  User,
  PlusSquare,
  Search,
  Trash2,
  X,
  Bookmark,
  Check,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { glassBadgeClass } from "@/lib/glassBadge";
import ChatPage from "./ChatPage";
import { useSearchParams } from "react-router-dom";
import {
  useMessagesInbox,
  type InboxConversation,
} from "@/hooks/data/useMessagesInbox";
import { prefetchChatThread } from "@/hooks/data/useChatThread";
import { ChatSimpleHeader } from "@/components/messages/ChatSimpleHeader";
import { useChatHeaderAvatarStatus } from "@/hooks/useChatHeaderAvatarStatus";

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

function inboxNavIconClass(isActive: boolean) {
  return cn(
    "bottom-nav-mobile-tab-glyph h-7 w-7 transition-[width,height,transform]",
    isActive
      ? "bottom-nav-mobile-tab-glyph-active fill-current stroke-none text-zinc-950 dark:text-white"
      : "fill-none stroke-[2] text-zinc-950/65 dark:text-white/65",
  );
}

function MessagesInboxNavItem({
  active,
  label,
  onClick,
  ariaLabel,
  children,
  className,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col items-center justify-center px-0 py-0",
        className,
      )}
    >
      {active ? (
        <span
          className="bottom-nav-tab-active-glass pointer-events-none absolute"
          aria-hidden
        />
      ) : null}
      <div className="bottom-nav-mobile-tab-inner relative z-[1] flex w-full flex-col items-center justify-center px-0 py-0">
        <div className="bottom-nav-mobile-icon-slot relative flex w-full items-center justify-center overflow-visible">
          {children}
        </div>
      </div>
    </button>
  );
}

function InboxSecuredFooter() {
  return (
    <div className="flex items-center justify-center gap-2.5 px-4 py-8 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] md:py-10">
      <ShieldCheck
        className="h-[1.375rem] w-[1.375rem] shrink-0 text-emerald-500 dark:text-emerald-400 md:h-6 md:w-6"
        aria-hidden
      />
      <p className="text-center text-sm font-medium leading-snug text-muted-foreground md:text-[15px]">
        Secured within{" "}
        <span className="text-foreground/75 dark:text-white/70">tebnu.com</span>
      </p>
    </div>
  );
}

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactFilterUnread, setContactFilterUnread] = useState(false);
  const [contactFilterFavorites, setContactFilterFavorites] = useState(false);
  const [favoriteUserIds, setFavoriteUserIds] = useState<Set<string>>(
    () => new Set(),
  );

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
    if (!user?.id) {
      setFavoriteUserIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      if (error) {
        console.warn("[MessagesPage] profile_favorites:", error);
        setFavoriteUserIds(new Set());
        return;
      }
      setFavoriteUserIds(
        new Set((data ?? []).map((row) => row.favorite_user_id as string)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const filteredChatInboxRows = useMemo(() => {
    const q = contactSearchQuery.trim().toLowerCase();
    return chatInboxRows.filter((row) => {
      const convo = row.conversation;
      if (contactFilterUnread && !(convo.unread_count > 0)) return false;
      if (contactFilterFavorites) {
        const oid = convo.other_user_id;
        if (!oid || !favoriteUserIds.has(oid)) return false;
      }
      if (!q) return true;
      const name = convo.other_user_profile?.full_name?.toLowerCase() ?? "";
      const loc = inboxRowLocation(convo)?.toLowerCase() ?? "";
      const preview = trimPreviewNoise(convo.last_message?.body).toLowerCase();
      return name.includes(q) || loc.includes(q) || preview.includes(q);
    });
  }, [
    chatInboxRows,
    contactFilterFavorites,
    contactFilterUnread,
    contactSearchQuery,
    favoriteUserIds,
  ]);

  const hasContactListFilters =
    contactFilterUnread ||
    contactFilterFavorites ||
    contactSearchQuery.trim().length > 0;

  const contactFilterChipClass = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors",
      active
        ? "bg-primary/10 text-foreground dark:bg-primary/15"
        : "bg-muted/30 text-muted-foreground hover:bg-muted/45 hover:text-foreground dark:bg-zinc-900/60 dark:hover:text-foreground",
    );

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
      is_verified?: boolean | null;
    };
  } | null>(null);

  const activeChatOtherUserId = useMemo(() => {
    if (!conversationId) return null;
    return (
      activeConversationForChat?.other_user_id ??
      directChatHeader?.otherUserId ??
      null
    );
  }, [conversationId, activeConversationForChat, directChatHeader]);

  const chatAvatarStatus = useChatHeaderAvatarStatus(activeChatOtherUserId);

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
        .select("full_name, photo_url, city, is_verified")
        .eq("id", otherId)
        .single();
      if (!cancelled) {
        setDirectChatHeader({
          otherUserId: otherId,
          other_user_profile: {
            full_name: p?.full_name ?? null,
            photo_url: p?.photo_url ?? null,
            city: p?.city ?? null,
            is_verified: p?.is_verified ?? null,
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
  const prefetchConversationThread = useCallback(
    (convoId: string, otherUserId?: string) => {
      if (!user?.id) return;
      void prefetchChatThread(queryClient, convoId, user.id, otherUserId);
    },
    [queryClient, user?.id],
  );

  const handleConversationClick = (convoId: string, otherUserId?: string) => {
    prefetchConversationThread(convoId, otherUserId);
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
          <div className="z-40 hidden shrink-0 bg-transparent px-4 pb-4 pt-4 md:block">
            <div className="flex w-full items-center gap-3">
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
        {/* Desktop: inbox section tabs in sidebar header. Mobile uses bottom nav bar. */}
        <div className="hidden md:contents">
          <div
            className={cn(
              "z-40 flex shrink-0 items-center gap-2.5 bg-transparent px-4 pb-3 sm:gap-3 md:pt-4",
            )}
          >
            <div
              className={cn(
                "flex w-auto gap-0.5 rounded-full p-1 md:min-w-0 md:flex-1 md:gap-0",
                glassBadgeClass,
              )}
              role="tablist"
              aria-label="Inbox sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inboxTab === "messages"}
                aria-label={
                  inboxUnreadTotal > 0
                    ? `Messages, ${inboxUnreadTotal} unread`
                    : "Messages"
                }
                onClick={() => setInboxTab("messages")}
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors md:min-w-0 md:flex-1 md:gap-2 md:py-2.5 md:text-sm md:font-semibold",
                  inboxTab === "messages"
                    ? "bg-background/75 text-foreground shadow-sm backdrop-blur-sm dark:bg-zinc-800/90 dark:text-white"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground dark:hover:bg-white/[0.06]",
                )}
              >
                <MessageCircle className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden />
                <span className="hidden md:inline">Messages</span>
                {inboxUnreadTotal > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground md:static md:translate-none">
                    {inboxUnreadTotal > 99 ? "99+" : inboxUnreadTotal}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inboxTab === "news"}
                aria-label={
                  visibleActivityAlerts.length > 0
                    ? `News, ${visibleActivityAlerts.length} items`
                    : "News"
                }
                onClick={() => setInboxTab("news")}
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors md:min-w-0 md:flex-1 md:gap-2 md:py-2.5 md:text-sm md:font-semibold",
                  inboxTab === "news"
                    ? "bg-background/75 text-foreground shadow-sm backdrop-blur-sm dark:bg-zinc-800/90 dark:text-white"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground dark:hover:bg-white/[0.06]",
                )}
              >
                <Bell className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden />
                <span className="hidden md:inline">News</span>
                {visibleActivityAlerts.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-foreground dark:bg-white/15 md:static md:translate-none">
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
              "max-md:[&>[data-orientation=vertical]]:hidden",
              "[&_[data-radix-scroll-area-viewport]]:min-w-0",
              "[&_[data-radix-scroll-area-viewport]]:max-w-full",
              "[&_[data-radix-scroll-area-viewport]]:bg-transparent",
              "[&_[data-radix-scroll-area-viewport]]:max-md:[scrollbar-width:none]",
              "[&_[data-radix-scroll-area-viewport]]:max-md:[-ms-overflow-style:none]",
              "[&_[data-radix-scroll-area-viewport]]:max-md:[&::-webkit-scrollbar]:hidden",
              "[&_[data-radix-scroll-area-viewport]]:max-md:pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
              "[&_[data-radix-scroll-area-viewport]]:max-md:pb-[calc(5.75rem+max(0.5rem,var(--app-safe-bottom,env(safe-area-inset-bottom,0px))))]",
            )}
          >
            {inboxTab === "messages" ? (
              chatInboxRows.length === 0 ? (
              <>
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
              <InboxSecuredFooter />
              </>
            ) : (
              <>
                <div className="shrink-0 px-4 pb-3 pt-2 md:pt-3">
                  <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <input
                        type="search"
                        placeholder="Search"
                        autoComplete="off"
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="h-[3.75rem] w-full rounded-2xl border-0 bg-muted/30 pl-10 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:bg-muted/45 dark:bg-zinc-900/60 dark:focus:bg-zinc-900/75 md:h-14 md:text-sm"
                      />
                      {contactSearchQuery.trim() ? (
                        <button
                          type="button"
                          onClick={() => setContactSearchQuery("")}
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                  </div>
                  <div className="-mx-4 mt-2.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-max min-w-full gap-2">
                      <button
                        type="button"
                        aria-pressed={contactFilterUnread}
                        onClick={() => setContactFilterUnread((v) => !v)}
                        className={contactFilterChipClass(contactFilterUnread)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Unread</span>
                        {inboxUnreadTotal > 0 ? (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-primary dark:bg-primary/25">
                            {inboxUnreadTotal > 99 ? "99+" : inboxUnreadTotal}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-pressed={contactFilterFavorites}
                        onClick={() => setContactFilterFavorites((v) => !v)}
                        className={contactFilterChipClass(contactFilterFavorites)}
                      >
                        <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>Favorites</span>
                      </button>
                    </div>
                  </div>
                </div>

                {filteredChatInboxRows.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      No conversations match
                    </p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                      Try a different search or turn off a filter.
                    </p>
                    {hasContactListFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 font-semibold"
                        onClick={() => {
                          setContactSearchQuery("");
                          setContactFilterUnread(false);
                          setContactFilterFavorites(false);
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                ) : (
              <div className="w-full min-w-0 max-w-full overflow-x-hidden">
                {filteredChatInboxRows.map((row, index) => {
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
                      onClick={() =>
                        handleConversationClick(
                          convo.id,
                          convo.other_user_id,
                        )
                      }
                      onTouchStart={() =>
                        prefetchConversationThread(
                          convo.id,
                          convo.other_user_id,
                        )
                      }
                      onMouseEnter={() =>
                        prefetchConversationThread(
                          convo.id,
                          convo.other_user_id,
                        )
                      }
                    >
                      {/*
                        Row divider — indented so it starts after the avatar.
                        Skipped on the first row so the inbox only shows the
                        faint top/bottom edges of the box.
                      */}
                      {index > 0 ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-[5.5rem] right-4 top-0 h-px bg-border/70 dark:bg-white/[0.08] md:left-[5.125rem]"
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
                                    "mt-1 truncate text-[16px] leading-snug text-muted-foreground md:text-base",
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
                <InboxSecuredFooter />
              </>
            )
          ) : activityInboxRows.length === 0 ? (
              <>
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  No updates yet
                </h3>
                <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Job invites, confirmations, and other activity will show up here
                  when something needs your attention.
                </p>
              </div>
              <InboxSecuredFooter />
              </>
            ) : (
              <>
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
              <InboxSecuredFooter />
              </>
            )}
          </ScrollArea>

        </div>

        {/* Mobile: unified inbox chrome — back, tabs, and actions in one bottom nav pill */}
        {mobileView === "contacts" ? (
          <nav
            className={cn(
              "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 md:hidden",
              "pb-[max(0.5rem,var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))]",
            )}
            role="tablist"
            aria-label="Messages inbox"
          >
            <div className="bottom-nav-mobile-shell pointer-events-auto w-full max-w-none">
              <div className="bottom-nav-mobile-items-row flex w-full items-center justify-evenly gap-0 overflow-visible px-0 py-0">
                <MessagesInboxNavItem
                  label="Back"
                  onClick={() =>
                    navigate(
                      profile?.role === "client"
                        ? "/client/home"
                        : "/freelancer/home",
                    )
                  }
                >
                  <HeaderBackChevron className="h-5 w-5 text-zinc-950 dark:text-white" />
                </MessagesInboxNavItem>

                <MessagesInboxNavItem
                  active={inboxTab === "messages"}
                  label="Messages"
                  ariaLabel={
                    inboxUnreadTotal > 0
                      ? `Messages, ${inboxUnreadTotal} unread`
                      : "Messages"
                  }
                  onClick={() => setInboxTab("messages")}
                >
                  <MessageCircle
                    className={inboxNavIconClass(inboxTab === "messages")}
                    aria-hidden
                  />
                  {inboxUnreadTotal > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-red-600 px-0.5 text-[10px] font-black leading-none text-white">
                      {inboxUnreadTotal > 9 ? "9+" : inboxUnreadTotal}
                    </span>
                  ) : null}
                </MessagesInboxNavItem>

                <MessagesInboxNavItem
                  active={inboxTab === "news"}
                  label="News"
                  ariaLabel={
                    visibleActivityAlerts.length > 0
                      ? `News, ${visibleActivityAlerts.length} items`
                      : "News"
                  }
                  onClick={() => setInboxTab("news")}
                >
                  <Bell
                    className={inboxNavIconClass(inboxTab === "news")}
                    aria-hidden
                  />
                  {visibleActivityAlerts.length > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/25 px-0.5 text-[10px] font-black leading-none text-foreground dark:bg-white/20">
                      {visibleActivityAlerts.length > 9
                        ? "9+"
                        : visibleActivityAlerts.length}
                    </span>
                  ) : null}
                </MessagesInboxNavItem>

                {inboxTab === "messages" ? (
                  <>
                    <MessagesInboxNavItem
                      label="New"
                      ariaLabel="New message"
                      onClick={() => setNewChatOpen(true)}
                    >
                      <PlusSquare
                        className="bottom-nav-mobile-tab-glyph h-7 w-7 fill-none stroke-[2] text-zinc-950/65 dark:text-white/65"
                        aria-hidden
                      />
                    </MessagesInboxNavItem>

                    <MessagesInboxNavItem
                      label={isManageMode ? "Done" : "Remove"}
                      ariaLabel={
                        isManageMode ? "Done removing" : "Remove conversations"
                      }
                      onClick={() => setIsManageMode(!isManageMode)}
                      className={
                        isManageMode
                          ? "text-red-600 dark:text-red-400"
                          : undefined
                      }
                    >
                      {isManageMode ? (
                        <Check
                          className="bottom-nav-mobile-tab-glyph h-7 w-7 stroke-[2] text-red-600 dark:text-red-400"
                          aria-hidden
                        />
                      ) : (
                        <Trash2
                          className="bottom-nav-mobile-tab-glyph h-7 w-7 fill-none stroke-[2] text-zinc-950/65 dark:text-white/65"
                          aria-hidden
                        />
                      )}
                    </MessagesInboxNavItem>
                  </>
                ) : null}
              </div>
            </div>
          </nav>
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
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden chat-screen">
                <ChatSimpleHeader
                  userId={otherUserId}
                  displayName={otherUserProfile?.full_name || "User"}
                  initials={otherInitials}
                  photoUrl={otherUserProfile?.photo_url}
                  isVerified={Boolean(otherUserProfile?.is_verified)}
                  isLive24h={chatAvatarStatus.isLive24h}
                  hasPostedRequest={chatAvatarStatus.hasPostedRequest}
                  preview={
                    otherUserProfile
                      ? {
                          full_name: otherUserProfile.full_name,
                          photo_url: otherUserProfile.photo_url,
                          city: otherUserProfile.city ?? null,
                        }
                      : null
                  }
                  showBackButton
                  onBack={handleBackToContacts}
                  className="fixed left-0 right-0 top-0 md:relative md:top-auto"
                />

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
