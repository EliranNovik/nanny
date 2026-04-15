import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  HeartHandshake,
  HelpingHand,
  Megaphone,
  Search,
  Users,
} from "lucide-react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { LiveTimer } from "@/components/LiveTimer";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { DiscoverHomeActivitySection } from "@/components/discover/DiscoverHomeActivitySection";
import { DiscoverHomeLiveTrackerBoard } from "@/components/discover/DiscoverHomeLiveTrackerBoard";
import { DiscoverHomeLatestReviews } from "@/components/discover/DiscoverHomeLatestReviews";
import { DiscoverHomeLatestPosts } from "@/components/discover/DiscoverHomeLatestPosts";
import { DiscoverHomeLatestOwnPosts } from "@/components/discover/DiscoverHomeLatestOwnPosts";
import { DiscoverHomeRecentActivity } from "@/components/discover/DiscoverHomeRecentActivity";
 
type DiscoverRole = "client" | "freelancer";

type DiscoverHomeMode = "hire" | "work";

const HOME_INTENT_STORAGE_KEY = "mamalama_discover_home_intent_v1";

/** Action-oriented lines on category tiles (hire tab) — real-time / urgent tone */
const DISCOVER_CATEGORY_ACTION_LINE: Record<string, string> = {
  cleaning: "Need cleaning now?",
  cooking: "Find a cook today",
  pickup_delivery: "Quick delivery",
  nanny: "Need childcare?",
  other_help: "Odd jobs & more",
  all_help: "Browse everything",
};

/** Work tab — CTA to post availability per service */
const DISCOVER_CATEGORY_WORK_LINE: Record<string, string> = {
  cleaning: "Post cleaning availability",
  cooking: "Post cooking availability",
  pickup_delivery: "Post delivery & errands availability",
  nanny: "Post childcare availability",
  other_help: "Post availability for odd jobs",
};

function initials(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  if (!t) return "??";
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : (parts[0]?.[1] ?? "");
  const s = (first + last).toUpperCase();
  return s || "??";
}

/**
 * Best future deadline for the request card: confirmation end, computed window, community expiry
 * (snapshot or live post row), then scheduled job start.
 */
function requestLiveExpiresAtIso(r: {
  confirm_ends_at?: string | null;
  confirm_starts_at?: string | null;
  confirm_window_seconds?: number | null;
  community_post_expires_at?: string | null;
  linked_post_expires_at?: string | null;
  start_at?: string | null;
}): string | null {
  const now = Date.now();
  const tryFuture = (iso: string | null | undefined) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t) || t <= now) return null;
    return iso;
  };

  let iso = tryFuture(r.confirm_ends_at);
  if (iso) return iso;

  if (r.confirm_starts_at != null && r.confirm_window_seconds != null && r.confirm_window_seconds > 0) {
    const start = Date.parse(r.confirm_starts_at);
    if (!Number.isNaN(start)) {
      const endMs = start + r.confirm_window_seconds * 1000;
      if (endMs > now) return new Date(endMs).toISOString();
    }
  }

  iso = tryFuture(r.community_post_expires_at);
  if (iso) return iso;

  iso = tryFuture(r.linked_post_expires_at);
  if (iso) return iso;

  iso = tryFuture(r.start_at);
  if (iso) return iso;

  return null;
}

function HelpRequestLiveExpiryRow({ expiresAtIso }: { expiresAtIso: string }) {
  return (
    <div className="mt-1 flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
      <Clock className="h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live</span>
      <ExpiryCountdown
        expiresAtIso={expiresAtIso}
        compact
        endedLabel="Ended"
        className="!font-mono text-[11px] font-semibold tabular-nums text-orange-700 dark:text-orange-400"
      />
    </div>
  );
}

/** When no future deadline exists (e.g. confirmation ended), still show a live elapsed timer. */
function HelpRequestLiveElapsedRow({ createdAtIso }: { createdAtIso: string }) {
  return (
    <div className="mt-1 flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
      <Clock className="h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live</span>
      <span className="font-mono text-[11px] font-semibold tabular-nums text-orange-700 dark:text-orange-400">
        <LiveTimer createdAt={createdAtIso} />
      </span>
    </div>
  );
}

function readStoredHomeMode(): DiscoverHomeMode | null {
  try {
    const v = localStorage.getItem(HOME_INTENT_STORAGE_KEY);
    if (v === "hire" || v === "work") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function DiscoverHomeContent({ role }: { role: DiscoverRole }) {
  const navigate = useNavigate();
  const isClient = role === "client";
  const { user, profile } = useAuth();

  const [homeMode, setHomeMode] = useState<DiscoverHomeMode>(() => {
    const stored = readStoredHomeMode();
    if (stored) return stored;
    return isClient ? "hire" : "work";
  });

  useEffect(() => {
    try {
      localStorage.setItem(HOME_INTENT_STORAGE_KEY, homeMode);
    } catch {
      /* ignore */
    }
  }, [homeMode]);

  const myPostedUrl = buildJobsUrl("client", "my_requests");

  type LatestClientRequest = {
    id: string;
    created_at: string;
    status: string | null;
    care_type: string | null;
    service_type: string | null;
    location_city: string | null;
    confirm_ends_at: string | null;
    confirm_starts_at: string | null;
    confirm_window_seconds: number | null;
    community_post_id: string | null;
    community_post_expires_at: string | null;
    /** From `community_posts` when the job links to a post — fills gaps if snapshot column is empty. */
    linked_post_expires_at?: string | null;
    start_at: string | null;
  };

  const [latestRequests, setLatestRequests] = useState<LatestClientRequest[]>([]);
  const [latestRequestsLoading, setLatestRequestsLoading] = useState(false);
  const [acceptedCountsByJobId, setAcceptedCountsByJobId] = useState<Record<string, number>>({});
  const [acceptedAvatarsByJobId, setAcceptedAvatarsByJobId] = useState<
    Record<string, { id: string; photo_url: string | null; full_name: string | null }[]>
  >({});

  function formatRequestTitle(r: LatestClientRequest): string {
    const raw = (r.care_type || r.service_type || "").trim();
    if (!raw) return "Request for help";
    return raw
      .split("_")
      .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
      .join(" ");
  }

  function requestImageSrc(r: LatestClientRequest): string | null {
    const id = (r.service_type || r.care_type || "").trim();
    if (!id) return null;
    const fromService = SERVICE_CATEGORIES.find((c) => c.id === id)?.imageSrc;
    if (fromService) return fromService;
    const fromDiscover = DISCOVER_HOME_CATEGORIES.find((c) => c.id === id)?.imageSrc;
    return fromDiscover ?? null;
  }

  useEffect(() => {
    if (homeMode !== "hire") return;
    if (!user?.id || profile?.role !== "client") {
      setLatestRequests([]);
      setAcceptedCountsByJobId({});
      setAcceptedAvatarsByJobId({});
      return;
    }

    let cancelled = false;
    setLatestRequestsLoading(true);
    void (async () => {
      const { data: reqs, error: reqErr } = await supabase
        .from("job_requests")
        .select(
          [
            "id, created_at, status, care_type, service_type, location_city",
            "confirm_ends_at, confirm_starts_at, confirm_window_seconds",
            "community_post_id, community_post_expires_at, start_at",
          ].join(", ")
        )
        .eq("client_id", user.id)
        .in("status", ["ready", "notifying", "confirmations_closed"])
        .order("created_at", { ascending: false })
        .limit(4);

      if (cancelled) return;
      if (reqErr) {
        console.warn("[DiscoverHomeContent] latest requests", reqErr);
        setLatestRequests([]);
        setAcceptedCountsByJobId({});
        setAcceptedAvatarsByJobId({});
        setLatestRequestsLoading(false);
        return;
      }

      const rawRows = (reqs ?? []) as unknown as LatestClientRequest[];
      const nowIso = new Date().toISOString();
      const postIds = [...new Set(rawRows.map((r) => r.community_post_id).filter(Boolean))] as string[];
      const linkedExpiryByPostId: Record<string, string> = {};
      if (postIds.length > 0) {
        const { data: postRows, error: postErr } = await supabase
          .from("community_posts")
          .select("id, expires_at")
          .in("id", postIds)
          .gt("expires_at", nowIso);
        if (postErr) {
          console.warn("[DiscoverHomeContent] latest requests post expiry", postErr);
        } else {
          for (const pr of postRows ?? []) {
            const row = pr as { id: string; expires_at: string };
            if (row.id && row.expires_at) linkedExpiryByPostId[row.id] = row.expires_at;
          }
        }
      }

      const rows = rawRows.map((r) => ({
        ...r,
        linked_post_expires_at: r.community_post_id
          ? linkedExpiryByPostId[r.community_post_id] ?? null
          : null,
      }));
      setLatestRequests(rows);

      if (rows.length === 0) {
        setAcceptedCountsByJobId({});
        setAcceptedAvatarsByJobId({});
        setLatestRequestsLoading(false);
        return;
      }

      const jobIds = rows.map((r) => r.id);
      const { data: confs, error: confErr } = await supabase
        .from("job_confirmations")
        .select(
          `
            job_id,
            freelancer_id,
            created_at,
            profiles!job_confirmations_freelancer_id_fkey ( id, photo_url, full_name )
          `
        )
        .in("job_id", jobIds)
        .eq("status", "available")
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (confErr) {
        console.warn("[DiscoverHomeContent] latest request accepts", confErr);
        setAcceptedCountsByJobId({});
        setAcceptedAvatarsByJobId({});
        setLatestRequestsLoading(false);
        return;
      }

      const counts: Record<string, number> = {};
      const avatars: Record<string, { id: string; photo_url: string | null; full_name: string | null }[]> = {};
      (confs as any[] | null)?.forEach((c) => {
        const jobId = String(c.job_id ?? "");
        if (!jobId) return;
        counts[jobId] = (counts[jobId] || 0) + 1;
        if (!avatars[jobId]) avatars[jobId] = [];
        if (avatars[jobId].length >= 3) return;
        const raw = c.profiles;
        const p = Array.isArray(raw) ? raw[0] : raw;
        avatars[jobId].push(
          p
            ? { id: String(p.id), photo_url: (p.photo_url ?? null) as string | null, full_name: (p.full_name ?? null) as string | null }
            : { id: String(c.freelancer_id ?? ""), photo_url: null, full_name: null }
        );
      });

      setAcceptedCountsByJobId(counts);
      setAcceptedAvatarsByJobId(avatars);
      setLatestRequestsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [homeMode, user?.id, profile?.role]);

  const onCategoryClick = (id: string) => {
    navigate(`/public/posts?category=${encodeURIComponent(id)}`);
  };

  const onWorkCategoryPostAvailability = (id: string) => {
    navigate(`/availability/post-now?category=${encodeURIComponent(id)}`);
  };

  const hireHelpersPath = isClient ? "/client/helpers" : "/public/posts";
  const workPrimaryPath = isClient ? "/availability/post-now" : buildJobsUrl("freelancer", "requests");

  const [livePostsByCategory, setLivePostsByCategory] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0]))
  );
  const [categoryAuthorAvatars, setCategoryAuthorAvatars] = useState<
    Record<string, { id: string; full_name: string | null; photo_url: string | null }[]>
  >(() => Object.fromEntries(DISCOVER_HOME_CATEGORIES.map((c) => [c.id, []])));
  const [livePostsCountLoading, setLivePostsCountLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLivePostsCountLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("get_community_feed_public", {
        p_category: null,
      });
      if (cancelled) return;
      if (error) {
        console.error("[DiscoverHomeContent] category counts", error);
        setLivePostsByCategory(
          Object.fromEntries(DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0]))
        );
        setLivePostsCountLoading(false);
        return;
      }
      const rows = (data ?? []) as { category: string | null }[];
      const next: Record<string, number> = Object.fromEntries(
        DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0])
      );
      for (const row of rows) {
        const cat = row.category?.trim();
        if (
          cat &&
          cat !== ALL_HELP_CATEGORY_ID &&
          cat in next
        ) {
          next[cat] += 1;
        }
      }
      next[ALL_HELP_CATEGORY_ID] = rows.length;
      setLivePostsByCategory(next);
      setLivePostsCountLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nowIso = new Date().toISOString();
      const categoryIds = Array.from(
        new Set([
          ...DISCOVER_HOME_CATEGORIES.map((c) => c.id),
          ...SERVICE_CATEGORIES.map((c) => c.id),
        ])
      ).filter((id) => id && id !== ALL_HELP_CATEGORY_ID);

      const { data, error } = await supabase
        .from("community_posts")
        .select(
          `
            id,
            category,
            author_id,
            created_at,
            author:profiles!author_id (
              id,
              full_name,
              photo_url
            )
          `
        )
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .in("category", categoryIds)
        .order("created_at", { ascending: false })
        .limit(220);

      if (cancelled) return;
      if (error) {
        console.warn("[DiscoverHomeContent] category avatars:", error);
        setCategoryAuthorAvatars(Object.fromEntries(DISCOVER_HOME_CATEGORIES.map((c) => [c.id, []])));
        return;
      }

      const next: Record<string, { id: string; full_name: string | null; photo_url: string | null }[]> = {};
      for (const id of categoryIds) next[id] = [];

      const seen = new Map<string, Set<string>>();
      for (const row of (data ?? []) as any[]) {
        const cat = String(row?.category ?? "").trim();
        if (!cat || !(cat in next)) continue;
        const author = row?.author;
        const authorId = String(author?.id ?? row?.author_id ?? "").trim();
        if (!authorId) continue;
        if (!seen.has(cat)) seen.set(cat, new Set());
        const set = seen.get(cat)!;
        if (set.has(authorId)) continue;
        if (next[cat].length >= 3) continue;
        set.add(authorId);
        next[cat].push({
          id: authorId,
          full_name: (author?.full_name as string | null) ?? null,
          photo_url: (author?.photo_url as string | null) ?? null,
        });
      }

      // Ensure keys exist for tiles even if empty.
      const allTileIds = Array.from(new Set([...DISCOVER_HOME_CATEGORIES.map((c) => c.id), ...SERVICE_CATEGORIES.map((c) => c.id)]));
      for (const id of allTileIds) {
        if (!next[id]) next[id] = [];
      }

      setCategoryAuthorAvatars(next);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const liveCountLabel = useMemo(
    () => (catId: string) => {
      if (livePostsCountLoading) return "…";
      const n = livePostsByCategory[catId];
      return n === undefined ? "0" : n > 99 ? "99+" : String(n);
    },
    [livePostsByCategory, livePostsCountLoading]
  );

  const discoverCategoryScrollRef = useRef<HTMLDivElement>(null);
  const [discoverCategoryScroll, setDiscoverCategoryScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const refreshDiscoverCategoryScroll = useCallback(() => {
    const el = discoverCategoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setDiscoverCategoryScroll({
      canScrollLeft: scrollLeft > 2,
      canScrollRight: max > 2 && scrollLeft < max - 2,
    });
  }, []);

  useLayoutEffect(() => {
    if (homeMode !== "hire" && homeMode !== "work") return;
    const el = discoverCategoryScrollRef.current;
    if (!el) return;
    refreshDiscoverCategoryScroll();
    el.addEventListener("scroll", refreshDiscoverCategoryScroll, { passive: true });
    const ro = new ResizeObserver(() => refreshDiscoverCategoryScroll());
    ro.observe(el);
    window.addEventListener("resize", refreshDiscoverCategoryScroll);
    return () => {
      el.removeEventListener("scroll", refreshDiscoverCategoryScroll);
      ro.disconnect();
      window.removeEventListener("resize", refreshDiscoverCategoryScroll);
    };
  }, [homeMode, refreshDiscoverCategoryScroll, livePostsByCategory, livePostsCountLoading]);

  const scrollDiscoverCategories = useCallback((dir: "left" | "right") => {
    const el = discoverCategoryScrollRef.current;
    if (!el) return;
    const step = Math.min(Math.round(el.clientWidth * 0.85), 360);
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  }, []);

  return (
    <div className="relative min-h-screen gradient-mesh pb-6 md:pb-12">
      <div
        className={cn(
          "fixed inset-x-0 z-[45] pointer-events-none",
          /** Directly under fixed BottomNav header — keep in sync with `.app-content-below-fixed-header` in index.css */
          "top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
          "bg-background"
        )}
      >
        <div className="app-desktop-shell pointer-events-auto">
          <div className="w-full px-2 py-2">
            <div role="tablist" aria-label="What are you here for?">
              {/** Track: neutral glass; colored gradient only on the active thumb */}
              <div
                className={cn(
                  "relative mx-auto grid min-h-[62px] w-full max-w-[22rem] grid-cols-2 gap-0.5 overflow-hidden rounded-full p-1 sm:max-w-[24rem] sm:min-h-[70px]",
                  "border border-border bg-white dark:bg-muted",
                  /** Recessed “well” — keep dark inset subtle (heavy inset reads as a black band on the pill) */
                  "shadow-[inset_0_3px_14px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]",
                  "dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]",
                  "transition-shadow duration-300"
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1 bottom-1 left-1 z-[5] rounded-full",
                    "w-[calc((100%-0.625rem)/2)] will-change-transform",
                    /** Inset depth — lighter dark shadows so the thumb doesn’t get a muddy bottom band */
                    "shadow-[inset_0_2px_0_rgba(255,255,255,0.28),inset_0_-6px_14px_rgba(0,0,0,0.38),inset_0_0_0_1px_rgba(0,0,0,0.12)]",
                    "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-4px_12px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(0,0,0,0.18)]",
                    "transition-[transform,background-image] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                    homeMode === "hire"
                      ? "translate-x-0 bg-gradient-to-r from-orange-500 to-red-600"
                      : "translate-x-[calc(100%+0.125rem)] bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700"
                  )}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "hire"}
                  aria-label={homeMode === "hire" ? undefined : "I need help"}
                  onClick={() => setHomeMode("hire")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-3 py-2.5 sm:min-h-[62px] sm:px-3.5",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "hire"
                      ? "gap-2.5 text-white sm:gap-3"
                      : "gap-2.5 text-foreground/70 hover:text-foreground/85 sm:gap-3 dark:text-foreground/65"
                  )}
                >
                  <HeartHandshake
                    className={cn(
                      "h-6 w-6 shrink-0 transition-transform duration-300 sm:h-7 sm:w-7",
                      homeMode === "hire"
                        ? "scale-105 text-white"
                        : "text-foreground/65 dark:text-foreground/55"
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {homeMode === "hire" && (
                    <span className="max-w-[min(100%,11rem)] truncate text-left text-sm font-bold leading-tight tracking-tight sm:max-w-[12rem] sm:text-base">
                      I need help
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeMode === "work"}
                  aria-label={homeMode === "work" ? undefined : "Help others"}
                  onClick={() => setHomeMode("work")}
                  className={cn(
                    "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-3 py-2.5 sm:min-h-[62px] sm:px-3.5",
                    "transition-[color,transform] duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    homeMode === "work"
                      ? "gap-2.5 text-white sm:gap-3"
                      : "gap-2.5 text-foreground/70 hover:text-foreground/85 sm:gap-3 dark:text-foreground/65"
                  )}
                >
                  <HelpingHand
                    className={cn(
                      "h-6 w-6 shrink-0 transition-transform duration-300 sm:h-7 sm:w-7",
                      homeMode === "work"
                        ? "scale-105 text-white"
                        : "text-foreground/65 dark:text-foreground/55"
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {homeMode === "work" && (
                    <span className="max-w-[min(100%,11rem)] truncate text-left text-sm font-bold leading-tight tracking-tight sm:max-w-[12rem] sm:text-base">
                      Help others
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "app-desktop-shell",
          /** Tab strip: py + full-width themed pill toggle (~62–70px) + border + gap */
          "pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem)]"
        )}
      >
        <div className="flex w-full flex-col gap-6 md:gap-8 lg:gap-10">
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:gap-4 lg:gap-6">
            <div className="order-2 min-w-0 flex-1 md:order-1">
              <DiscoverHomeActivitySection mode={homeMode} viewerRole={role} />
            </div>

            {(homeMode === "hire" && isClient) ||
            (homeMode === "work" && isClient) ||
            (homeMode === "work" && !isClient) ? (
              <div
                className={cn(
                  "order-1 w-full shrink-0 md:order-2",
                  homeMode === "hire" && isClient
                    ? "md:w-[min(100%,36rem)] lg:w-[min(100%,40rem)]"
                    : "md:w-[min(100%,22rem)] lg:w-[min(100%,26rem)]"
                )}
              >
                {homeMode === "hire" && isClient ? (
                  <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-3">
                    <button
                      type="button"
                      onClick={() => navigate("/client/create")}
                      className={cn(
                        "group flex w-full min-w-0 items-center gap-2.5 rounded-xl py-1.5 text-left outline-none transition-colors sm:gap-3",
                        "md:flex-1",
                        "focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "dark:gap-3 dark:py-2.5 dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]"
                      )}
                      aria-label="Post a request for help"
                    >
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
                        "bg-orange-500 shadow-orange-500/20",
                        "dark:bg-orange-500/15 dark:text-orange-400 dark:shadow-none"
                      )}
                    >
                      <Megaphone className="h-7 w-7" aria-hidden strokeWidth={2.25} />
                    </div>
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 transition-colors sm:gap-3",
                        "bg-muted group-hover:bg-muted/90"
                      )}
                    >
                      <div className="min-w-0 flex-1 leading-snug">
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Get help</p>
                        <p className="text-base font-semibold text-foreground">Post a request for help</p>
                        <p className="text-sm text-muted-foreground">Tell us what you need.</p>
                      </div>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 self-center text-muted-foreground transition group-hover:translate-x-0.5"
                        aria-hidden
                        strokeWidth={2}
                      />
                    </div>
                  </button>
                    <button
                      type="button"
                      onClick={() => navigate(hireHelpersPath)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2.5 rounded-xl py-1.5 text-left outline-none transition-all sm:gap-3",
                        "md:flex-1",
                        "hover:bg-muted/40 active:scale-[0.99]",
                        "focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]"
                      )}
                      aria-label="Find helpers"
                    >
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-orange-600 shadow-sm",
                          "bg-orange-500/10 ring-1 ring-orange-500/15",
                          "dark:bg-orange-500/15 dark:text-orange-400 dark:shadow-none"
                        )}
                      >
                        <Search className="h-7 w-7" aria-hidden strokeWidth={2.25} />
                      </div>
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 transition-colors sm:gap-3",
                          "bg-muted hover:bg-muted/90"
                        )}
                      >
                        <div className="min-w-0 flex-1 leading-snug">
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Search</p>
                          <p className="text-base font-semibold text-foreground">Find helpers</p>
                          <p className="text-sm text-muted-foreground">Map & profiles</p>
                        </div>
                        <ChevronRight
                          className="h-5 w-5 shrink-0 self-center text-muted-foreground"
                          aria-hidden
                          strokeWidth={2}
                        />
                      </div>
                    </button>
                  </div>
                ) : null}

                {homeMode === "work" && isClient ? (
                  <button
                    type="button"
                    onClick={() => navigate(workPrimaryPath)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl py-1.5 text-left outline-none transition-colors sm:gap-3",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "dark:gap-3 dark:py-2.5 dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]"
                    )}
                    aria-label="Post availability"
                  >
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
                        "bg-emerald-600 shadow-emerald-600/20",
                        "dark:bg-emerald-500/15 dark:text-emerald-400 dark:shadow-none"
                      )}
                    >
                      <CalendarPlus className="h-7 w-7" aria-hidden strokeWidth={2.25} />
                    </div>
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 transition-colors sm:gap-3",
                        "bg-muted group-hover:bg-muted/90"
                      )}
                    >
                      <div className="min-w-0 flex-1 leading-snug">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Go live</p>
                        <p className="text-base font-semibold text-foreground">Post availability</p>
                        <p className="text-sm text-muted-foreground">Go live so people can find you.</p>
                      </div>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 self-center text-muted-foreground transition group-hover:translate-x-0.5"
                        aria-hidden
                        strokeWidth={2}
                      />
                    </div>
                  </button>
                ) : null}

                {homeMode === "work" && !isClient ? (
                  <button
                    type="button"
                    onClick={() => navigate(workPrimaryPath)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left outline-none transition-all",
                      "hover:bg-muted/45 active:scale-[0.99]",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Users className="h-6 w-6" aria-hidden strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1 leading-none">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Open work</p>
                      <p className="mt-0.5 text-base font-bold text-foreground">Browse open requests</p>
                    </div>
                    <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {homeMode === "hire" && (
            <section
              className={cn(
                "md:mb-0 md:mt-0",
                "-mx-4 w-[calc(100%+2rem)] px-2 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3",
                "md:mx-0 md:w-full md:px-0"
              )}
              aria-label="Service categories"
            >
              <div className="relative">
                <div
                  ref={discoverCategoryScrollRef}
                  className={cn(
                    "flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]",
                    "md:grid md:grid-cols-6 md:gap-3 md:overflow-visible md:snap-none md:overscroll-auto md:touch-auto md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:auto"
                  )}
                >
                  {DISCOVER_HOME_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      aria-label={
                        livePostsCountLoading
                          ? `${cat.label}, loading live post count`
                          : `${cat.label}, ${livePostsByCategory[cat.id] ?? 0} live posts`
                      }
                      onClick={() => onCategoryClick(cat.id)}
                      className={cn(
                        "group relative aspect-square shrink-0 grow-0 snap-start overflow-hidden rounded-2xl text-left outline-none",
                        "basis-[calc((100%-0.5rem)/2)] md:basis-auto md:w-full md:snap-none",
                        "shadow-md transition-[transform,box-shadow] duration-200 hover:shadow-lg active:scale-[0.97]",
                        "focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-inset"
                      )}
                    >
                      <img
                        src={cat.imageSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-200 group-hover:scale-105 group-active:scale-[0.98] group-active:brightness-110"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-[1] bg-black/35 transition-opacity duration-200 group-active:bg-black/25"
                        aria-hidden
                      />
                      {categoryAuthorAvatars[cat.id]?.length ? (
                        <div
                          className="pointer-events-none absolute right-1.5 top-1.5 z-[2] flex -space-x-2 sm:right-2 sm:top-2"
                          aria-hidden
                        >
                          {categoryAuthorAvatars[cat.id].slice(0, 3).map((p) => (
                            <Avatar key={p.id} className="h-7 w-7 shadow-sm sm:h-8 sm:w-8">
                              <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                              <AvatarFallback className="bg-white/85 text-[10px] font-black text-slate-800 dark:bg-zinc-800 dark:text-slate-100">
                                {initials(p.full_name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      ) : null}
                      <span
                        className={cn(
                          "absolute left-2 top-2 z-[2] rounded-full px-3 py-1 text-xs font-black tabular-nums leading-none sm:left-2.5 sm:top-2.5 md:left-3 md:top-3 md:px-3.5 md:py-1.5 md:text-sm",
                          "bg-black/45 text-white opacity-95 ring-1 ring-white/15 backdrop-blur-[2px]",
                          "dark:bg-black/50 dark:text-white"
                        )}
                        aria-hidden
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{liveCountLabel(cat.id)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 sm:text-xs md:text-sm">
                            now
                          </span>
                        </span>
                      </span>
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-28 pb-2 px-1.5 sm:pt-32 sm:pb-2.5 sm:px-2"
                        aria-hidden
                      />
                      <span className="absolute inset-x-0 bottom-0 z-[2] px-2 pb-8 pt-2 text-center text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] max-md:pt-4 md:px-1.5 md:pt-3 md:text-base lg:text-lg md:pb-9">
                        {DISCOVER_CATEGORY_ACTION_LINE[cat.id] ?? cat.label}
                      </span>
                      <ChevronRight
                        className="pointer-events-none absolute bottom-2 right-2 z-[3] h-5 w-5 text-white/95 drop-shadow-md"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Scroll categories left"
                  disabled={!discoverCategoryScroll.canScrollLeft}
                  onClick={() => scrollDiscoverCategories("left")}
                  className={cn(
                    "md:hidden",
                    "absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:left-3 sm:h-11 sm:w-11",
                    "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                    "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                    "disabled:pointer-events-none disabled:opacity-30"
                  )}
                >
                  <ChevronLeft className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Scroll categories right"
                  disabled={!discoverCategoryScroll.canScrollRight}
                  onClick={() => scrollDiscoverCategories("right")}
                  className={cn(
                    "md:hidden",
                    "absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:right-3 sm:h-11 sm:w-11",
                    "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                    "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                    "disabled:pointer-events-none disabled:opacity-30"
                  )}
                >
                  <ChevronRight className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </section>
          )}

          {homeMode === "hire" && user?.id && profile?.role === "client" && latestRequests.length > 0 && (
            <section className="px-1" aria-label="Your latest requests">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Your latest requests
                  </p>
                  
                </div>
                <button
                  type="button"
                  onClick={() => navigate(myPostedUrl)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
                    "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  Show more
                </button>
              </div>

              {latestRequestsLoading ? (
                <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-4 text-sm text-muted-foreground">
                  Loading your latest requests…
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {latestRequests.slice(0, 1).map((r) => {
                      const count = acceptedCountsByJobId[r.id] || 0;
                      const helpers = acceptedAvatarsByJobId[r.id] || [];
                      const imgSrc = requestImageSrc(r);
                      const liveIso = requestLiveExpiresAtIso(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(myPostedUrl)}
                          className={cn(
                            "relative w-full rounded-xl bg-muted/20 p-2.5 text-left transition-colors dark:bg-muted/40",
                            "hover:bg-muted/30 active:bg-muted/45 dark:hover:bg-muted/55 dark:active:bg-muted/70",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          )}
                        >
                          {count > 0 ? (
                            <span
                              className={cn(
                                "absolute right-1.5 top-1.5 z-[1] inline-flex h-6 min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums leading-none text-white shadow-sm",
                                "bg-gradient-to-r from-orange-500 to-red-600",
                                "ring-1 ring-orange-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                              )}
                            >
                              {count}
                            </span>
                          ) : null}
                          <div
                            className={cn(
                              "flex items-start justify-between gap-3",
                              count > 0 ? "pr-9" : undefined
                            )}
                          >
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                              {formatRequestTitle(r)}
                            </p>
                            <div className="flex shrink-0 items-center">
                              <div className="flex -space-x-2.5">
                                {helpers.slice(0, 3).map((p) => (
                                  <Avatar key={p.id} className="h-9 w-9 border-2 border-background shadow-md">
                                    <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-card text-[11px] font-black text-foreground">
                                      {initials(p.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center gap-2.5">
                            <div
                              className="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-xl border border-orange-500/20 bg-muted/40 shadow-sm ring-1 ring-orange-500/15"
                              aria-hidden
                            >
                              {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : null}
                              <div className="pointer-events-none absolute inset-0 bg-black/15" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-muted-foreground">
                                {r.location_city?.trim() ? r.location_city.trim() : "No location"}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Posted {new Date(r.created_at).toLocaleDateString()}
                              </p>
                              {liveIso ? (
                                <HelpRequestLiveExpiryRow expiresAtIso={liveIso} />
                              ) : (
                                <HelpRequestLiveElapsedRow createdAtIso={r.created_at} />
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="hidden sm:grid sm:grid-cols-1 sm:gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4 lg:gap-3">
                    {latestRequests.slice(0, 4).map((r) => {
                      const count = acceptedCountsByJobId[r.id] || 0;
                      const helpers = acceptedAvatarsByJobId[r.id] || [];
                      const imgSrc = requestImageSrc(r);
                      const liveIso = requestLiveExpiresAtIso(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(myPostedUrl)}
                          className={cn(
                            "relative w-full rounded-2xl bg-muted/20 p-4 text-left transition-colors dark:bg-muted/30",
                            "hover:bg-muted/25 active:bg-muted/40 dark:hover:bg-muted/45 dark:active:bg-muted/60",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          )}
                        >
                          {count > 0 ? (
                            <span
                              className={cn(
                                "absolute right-1.5 top-1.5 z-[1] inline-flex h-6 min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums leading-none text-white shadow-sm",
                                "bg-gradient-to-r from-orange-500 to-red-600",
                                "ring-1 ring-orange-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                              )}
                            >
                              {count}
                            </span>
                          ) : null}
                          <div
                            className={cn(
                              "flex items-start justify-between gap-3",
                              count > 0 ? "pr-9" : undefined
                            )}
                          >
                            <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                              {formatRequestTitle(r)}
                            </p>
                            <div className="flex shrink-0 items-center">
                              <div className="flex -space-x-2.5">
                                {helpers.slice(0, 3).map((p) => (
                                  <Avatar key={p.id} className="h-10 w-10 border-2 border-background shadow-md">
                                    <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-card text-[11px] font-black text-foreground">
                                      {initials(p.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-3">
                            <div
                              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-orange-500/20 bg-muted/40 shadow-sm ring-1 ring-orange-500/15"
                              aria-hidden
                            >
                              {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : null}
                              <div className="pointer-events-none absolute inset-0 bg-black/15" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-muted-foreground">
                                {r.location_city?.trim() ? r.location_city.trim() : "No location"}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                Posted {new Date(r.created_at).toLocaleDateString()}
                              </p>
                              {liveIso ? (
                                <HelpRequestLiveExpiryRow expiresAtIso={liveIso} />
                              ) : (
                                <HelpRequestLiveElapsedRow createdAtIso={r.created_at} />
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {homeMode === "hire" && user?.id && profile?.role === "client" && (
            <div className="mb-4 px-1 md:mb-0">
              <DiscoverHomeLiveTrackerBoard variant="hire" />
            </div>
          )}

          {homeMode === "hire" && !isClient && (
            <section className="mb-1 px-1 md:mb-0" aria-label="Find helpers">
              <button
                type="button"
                onClick={() => navigate(hireHelpersPath)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left outline-none transition-all",
                  "hover:bg-muted/40 active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
                  <Search className="h-5 w-5" aria-hidden strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isClient ? "Search" : "Browse"}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {isClient ? "Find helpers" : "See who’s offering help"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isClient ? "Map & profiles" : "Open the live board"}
                  </p>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 self-center text-muted-foreground"
                  aria-hidden
                  strokeWidth={2}
                />
              </button>
            </section>
          )}

          {homeMode === "work" && (
            <section
              className={cn(
                "mb-6 mt-0 md:mb-0",
                "-mx-4 w-[calc(100%+2rem)] px-2 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3",
                "md:mx-0 md:w-full md:px-0"
              )}
              aria-label="Post availability by category"
            >
              <div className="relative">
                <div
                  ref={discoverCategoryScrollRef}
                  className={cn(
                    "flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]",
                    "md:grid md:grid-cols-6 md:gap-3 md:overflow-visible md:snap-none md:overscroll-auto md:touch-auto md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:auto"
                  )}
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      aria-label={
                        livePostsCountLoading
                          ? `${cat.label}, loading live post count`
                          : `${DISCOVER_CATEGORY_WORK_LINE[cat.id] ?? cat.label}, ${livePostsByCategory[cat.id] ?? 0} live posts in category`
                      }
                      onClick={() => onWorkCategoryPostAvailability(cat.id)}
                      className={cn(
                        "group relative aspect-square shrink-0 grow-0 snap-start overflow-hidden rounded-2xl text-left outline-none",
                        "basis-[calc((100%-0.5rem)/2)] md:basis-auto md:w-full md:snap-none",
                        "shadow-md transition-[transform,box-shadow] duration-200 hover:shadow-lg active:scale-[0.97]",
                        "focus-visible:ring-2 focus-visible:ring-emerald-500/65 focus-visible:ring-inset"
                      )}
                    >
                      <img
                        src={cat.imageSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-200 group-hover:scale-105 group-active:scale-[0.98] group-active:brightness-110"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-[1] bg-black/35 transition-opacity duration-200 group-active:bg-black/25"
                        aria-hidden
                      />
                      {categoryAuthorAvatars[cat.id]?.length ? (
                        <div
                          className="pointer-events-none absolute right-1.5 top-1.5 z-[2] flex -space-x-2 sm:right-2 sm:top-2"
                          aria-hidden
                        >
                          {categoryAuthorAvatars[cat.id].slice(0, 3).map((p) => (
                            <Avatar key={p.id} className="h-7 w-7 shadow-sm sm:h-8 sm:w-8">
                              <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                              <AvatarFallback className="bg-white/85 text-[10px] font-black text-slate-800 dark:bg-zinc-800 dark:text-slate-100">
                                {initials(p.full_name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      ) : null}
                      <span
                        className={cn(
                          "absolute left-2 top-2 z-[2] rounded-full px-3 py-1 text-xs font-black tabular-nums leading-none sm:left-2.5 sm:top-2.5 md:left-3 md:top-3 md:px-3.5 md:py-1.5 md:text-sm",
                          "bg-black/45 text-white opacity-95 ring-1 ring-white/15 backdrop-blur-[2px]",
                          "dark:bg-black/50 dark:text-white"
                        )}
                        aria-hidden
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{liveCountLabel(cat.id)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 sm:text-xs md:text-sm">
                            live
                          </span>
                        </span>
                      </span>
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-28 pb-2 px-1.5 sm:pt-32 sm:pb-2.5 sm:px-2"
                        aria-hidden
                      />
                      <span className="absolute inset-x-0 bottom-0 z-[2] px-2 pb-8 pt-2 text-center text-base font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] max-md:pt-4 md:px-1.5 md:pt-3 md:text-base lg:text-lg md:pb-9">
                        {DISCOVER_CATEGORY_WORK_LINE[cat.id] ?? cat.label}
                      </span>
                      <ChevronRight
                        className="pointer-events-none absolute bottom-2 right-2 z-[3] h-5 w-5 text-white/95 drop-shadow-md"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Scroll categories left"
                  disabled={!discoverCategoryScroll.canScrollLeft}
                  onClick={() => scrollDiscoverCategories("left")}
                  className={cn(
                    "md:hidden",
                    "absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:left-3 sm:h-11 sm:w-11",
                    "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                    "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                    "disabled:pointer-events-none disabled:opacity-30"
                  )}
                >
                  <ChevronLeft className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Scroll categories right"
                  disabled={!discoverCategoryScroll.canScrollRight}
                  onClick={() => scrollDiscoverCategories("right")}
                  className={cn(
                    "md:hidden",
                    "absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:right-3 sm:h-11 sm:w-11",
                    "border border-white/55 bg-white/25 text-foreground shadow-lg backdrop-blur-md",
                    "transition-[opacity,transform] hover:bg-white/40 hover:shadow-xl active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "dark:border-white/15 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
                    "disabled:pointer-events-none disabled:opacity-30"
                  )}
                >
                  <ChevronRight className="h-6 w-6 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </section>
          )}

          {homeMode === "work" && <DiscoverHomeLatestOwnPosts />}

          {homeMode === "work" && (
            <div className="mb-4 md:mb-0">
              <DiscoverHomeLiveTrackerBoard variant="work" />
            </div>
          )}

          {homeMode === "work" && <DiscoverHomeRecentActivity viewerRole={role} />}

          {homeMode === "work" && (
            <div className="mb-6 mt-2 md:mb-0 md:mt-0">
              <DiscoverHomeLatestReviews />
            </div>
          )}

          {homeMode === "hire" && (
          <div className="mb-4 mt-6 md:mb-0 md:mt-0">
            <DiscoverHomeLatestPosts />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
