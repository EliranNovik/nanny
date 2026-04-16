import { useToast } from "@/components/ui/toast";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  ChevronRight,
  Clock,
  HeartHandshake,
  HelpingHand,
  Megaphone,
  Search,
} from "lucide-react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { LiveTimer } from "@/components/LiveTimer";
import { INTERACTIVE_CARD_HOVER } from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import {
  DISCOVER_HOME_CATEGORIES,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
 import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { DiscoverHomeActivitySection } from "@/components/discover/DiscoverHomeActivitySection";
import { DiscoverHomeLiveTrackerBoard } from "@/components/discover/DiscoverHomeLiveTrackerBoard";
import { DiscoverHomeLatestReviews } from "@/components/discover/DiscoverHomeLatestReviews";
import { DiscoverHomeLatestPosts } from "@/components/discover/DiscoverHomeLatestPosts";
import { DiscoverHomeLatestOwnPosts } from "@/components/discover/DiscoverHomeLatestOwnPosts";
import { DiscoverHomeRecentActivity } from "@/components/discover/DiscoverHomeRecentActivity";
import { useDiscoverHomeScrollHeader } from "@/context/DiscoverHomeScrollHeaderContext";
import { useClientRequests } from "@/hooks/data/useClientRequests";
import { useDiscoverFeed, useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
type DiscoverRole = "client" | "freelancer";
type DiscoverHomeMode = "hire" | "work";
const HOME_INTENT_STORAGE_KEY = "mamalama_discover_home_intent_v1";
/** Mobile compact header: show full top chrome again only when scroll is within this distance of the top. */
const DISCOVER_HOME_EXPAND_HEADER_TOP_PX = 32;
/** Hire tab — short title + supporting line (browse live board). */
const DISCOVER_CATEGORY_HIRE_CARD: Record<string, { title: string; subtitle: string }> = {
  cleaning: { title: "Cleaning", subtitle: "See who’s live near you" },
  cooking: { title: "Cooking", subtitle: "Find cooks available now" },
  pickup_delivery: { title: "Delivery & errands", subtitle: "Quick runs, live posts" },
  nanny: { title: "Childcare", subtitle: "Trusted help, available now" },
  other_help: { title: "Other help", subtitle: "Odd jobs & one-off tasks" },
  all_help: { title: "All categories", subtitle: "Browse every live post" },
};

/** Work tab — short action title + subtitle (post availability). */
const DISCOVER_CATEGORY_WORK_CARD: Record<string, { title: string; subtitle: string }> = {
  cleaning: { title: "Post cleaning", subtitle: "Reach nearby clients" },
  cooking: { title: "Post cooking", subtitle: "Go live in this category" },
  pickup_delivery: { title: "Post delivery", subtitle: "Reach nearby clients" },
  nanny: { title: "Post childcare", subtitle: "Go live in this category" },
  other_help: { title: "Post odd jobs", subtitle: "Reach nearby clients" },
};

function initials(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  if (!t) return "??";
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last =
    parts.length > 1
      ? (parts[parts.length - 1]?.[0] ?? "")
      : (parts[0]?.[1] ?? "");
  const s = (first + last).toUpperCase();
  return s || "??";
}

type DiscoverCategoryAvatar = {
  id: string;
  photo_url: string | null;
  full_name: string | null;
};

function DiscoverHomeCategoryTile({
  variant,
  imageSrc,
  title,
  subtitle,
  liveCountDisplay,
  statusSuffix,
  avatars,
  onClick,
  ariaLabel,
}: {
  variant: "hire" | "work";
  imageSrc: string;
  title: string;
  subtitle: string;
  liveCountDisplay: string;
  /** Shown after count in the live pill, e.g. "now" / "live" (sentence case). */
  statusSuffix: string;
  avatars?: DiscoverCategoryAvatar[];
  onClick: () => void;
  ariaLabel: string;
}) {
  const focusRing =
    variant === "hire"
      ? "focus-visible:ring-orange-500/65"
      : "focus-visible:ring-emerald-500/65";
  const ctaIconClass =
    variant === "hire" ? "text-orange-600" : "text-emerald-600";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "group relative aspect-square shrink-0 grow-0 snap-start overflow-hidden rounded-2xl text-left outline-none",
        /** Mobile: slightly narrower than half-row so ~2 cards + peek of third imply horizontal scroll */
        "max-md:basis-[calc((100%-1rem)/2.25)] md:basis-auto md:w-full md:snap-none",
        "shadow-md ring-1 ring-black/5 transition-[transform,box-shadow] duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-xl hover:ring-black/10",
        "active:translate-y-0 active:scale-[0.98] active:shadow-md motion-reduce:hover:translate-y-0",
        "dark:ring-white/10 dark:hover:ring-white/15",
        `focus-visible:ring-2 focus-visible:ring-inset ${focusRing}`,
      )}
    >
      <img
        src={imageSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.06] group-active:scale-[1.02] motion-reduce:group-hover:scale-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/15 via-transparent to-transparent transition-opacity duration-300 group-hover:from-black/20"
        aria-hidden
      />
      {avatars?.length ? (
        <div
          className="pointer-events-none absolute right-2 top-2 z-[3] flex -space-x-2 sm:right-2.5 sm:top-2.5"
          aria-hidden
        >
          {avatars.slice(0, 3).map((p) => (
            <Avatar
              key={p.id}
              className="h-7 w-7 ring-2 ring-white/40 shadow-md sm:h-8 sm:w-8"
            >
              <AvatarImage src={p.photo_url || undefined} className="object-cover" />
              <AvatarFallback className="bg-white/90 text-[10px] font-bold text-slate-800 dark:bg-zinc-800 dark:text-slate-100">
                {initials(p.full_name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute left-2 top-2 z-[3] sm:left-2.5 sm:top-2.5",
          "inline-flex max-w-[min(100%,11rem)] items-center gap-1.5 rounded-full px-2.5 py-1",
          "bg-black/55 text-white backdrop-blur-md",
          "ring-1 ring-white/20 shadow-sm",
        )}
        aria-hidden
      >
        <span className="text-[13px] font-bold tabular-nums leading-none tracking-tight">
          {liveCountDisplay}
        </span>
        <span className="text-[11px] font-medium leading-none text-white/90">
          {statusSuffix}
        </span>
      </div>
      {/** Taller, darker bottom scrim so white copy stays readable on bright photos */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[78%]",
          "bg-[linear-gradient(to_top,rgb(0_0_0/0.96)_0%,rgb(0_0_0/0.88)_18%,rgb(0_0_0/0.72)_38%,rgb(0_0_0/0.38)_58%,rgb(0_0_0/0.12)_78%,transparent_100%)]",
        )}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 z-[2] flex flex-col justify-end p-2.5 pb-2 sm:p-3 sm:pb-2.5">
        <p className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] sm:text-base">
          {title}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:text-[12px]">
          {subtitle}
        </p>
        <div className="mt-2.5 flex justify-end">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white",
              "shadow-[0_6px_20px_rgba(0,0,0,0.45)] ring-2 ring-white/95",
              "transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95",
              "motion-reduce:group-hover:scale-100",
            )}
            aria-hidden
          >
            <ChevronRight
              className={cn("h-5 w-5", ctaIconClass)}
              strokeWidth={2.75}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </button>
  );
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
  if (
    r.confirm_starts_at != null &&
    r.confirm_window_seconds != null &&
    r.confirm_window_seconds > 0
  ) {
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
    <div
      className="mt-1 flex min-w-0 items-center gap-1.5"
      role="status"
      aria-live="polite"
    >
      <Clock
        className="h-4 w-4 shrink-0 text-orange-600 sm:h-3.5 sm:w-3.5 dark:text-orange-400"
        aria-hidden
      />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
        Live
      </span>
      <ExpiryCountdown
        expiresAtIso={expiresAtIso}
        compact
        endedLabel="Ended"
        className="!font-mono text-xs font-semibold tabular-nums text-orange-700 sm:text-[11px] dark:text-orange-400"
      />
    </div>
  );
}

/** When no future deadline exists (e.g. confirmation ended), still show a live elapsed timer. */
function HelpRequestLiveElapsedRow({ createdAtIso }: { createdAtIso: string }) {
  return (
    <div
      className="mt-1 flex min-w-0 items-center gap-1.5"
      role="status"
      aria-live="polite"
    >
      <Clock
        className="h-4 w-4 shrink-0 text-orange-600 sm:h-3.5 sm:w-3.5 dark:text-orange-400"
        aria-hidden
      />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
        Live
      </span>
      <span className="font-mono text-xs font-semibold tabular-nums text-orange-700 sm:text-[11px] dark:text-orange-400">
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
  const { compact: discoverHeaderCompact, setCompact: setDiscoverHeaderCompact } =
    useDiscoverHomeScrollHeader();
  const { addToast } = useToast();
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
      addToast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "error",
      });
    } /* ignore */
  }, [homeMode]);
  const myPostedUrl = buildJobsUrl("client", "my_requests");
  
  const { data: myReqsData, isLoading: latestRequestsLoading } = useClientRequests(isClient ? user?.id : undefined, 4);
  const { data: categoryCounts = {}, isLoading: livePostsCountLoading } = useDiscoverFeed();
  const { data: categoryAvatars = {} } = useDiscoverLiveAvatars();

  const latestRequests = myReqsData?.myRequests || [];
  const acceptedCountsByJobId = myReqsData?.confirmedCounts || {};
  const acceptedAvatarsByJobId: Record<string, { id: string; photo_url: string | null; full_name: string | null }[]> = {};

  const livePostsByCategory = categoryCounts;
  const categoryAuthorAvatars = categoryAvatars;

  function formatRequestTitle(r: { care_type?: string | null; service_type?: string | null }): string {
    const raw = (r.care_type || r.service_type || "").trim();
    if (!raw) return "Request for help";
    return raw
      .split("_")
      .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
      .join(" ");
  }

  function requestImageSrc(r: { service_type?: string | null; care_type?: string | null }): string | null {
    const id = (r.service_type || r.care_type || "").trim();
    if (!id) return null;
    const fromService = SERVICE_CATEGORIES.find((c) => c.id === id)?.imageSrc;
    if (fromService) return fromService;
    const fromDiscover = DISCOVER_HOME_CATEGORIES.find((c) => c.id === id)?.imageSrc;
    return fromDiscover ?? null;
  }

  const onCategoryClick = (id: string) => {
    navigate(`/public/posts?category=${encodeURIComponent(id)}`);
  };
  const onWorkCategoryPostAvailability = (id: string) => {
    navigate(`/availability/post-now?category=${encodeURIComponent(id)}`);
  };
  const hireHelpersPath = isClient ? "/client/helpers" : "/public/posts";
  const workPrimaryPath = isClient
    ? "/availability/post-now"
    : buildJobsUrl("freelancer", "requests");

  const liveCountLabel = useMemo(
    () => (catId: string) => {
      if (livePostsCountLoading) return "…";
      const n = livePostsByCategory[catId];
      return n === undefined ? "0" : n > 99 ? "99+" : String(n);
    },
    [livePostsByCategory, livePostsCountLoading],
  );
  /** Mobile: hide global top chrome on scroll down; restore only when scrolled back to the top. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767.98px)");
    let lastY = window.scrollY ?? document.documentElement.scrollTop;

    const onScroll = () => {
      if (!mq.matches) return;
      const y = window.scrollY ?? document.documentElement.scrollTop;
      const delta = y - lastY;
      lastY = y;
      if (y < DISCOVER_HOME_EXPAND_HEADER_TOP_PX) {
        setDiscoverHeaderCompact(false);
        return;
      }
      if (delta > 6) setDiscoverHeaderCompact(true);
    };

    const onMqChange = () => {
      if (!mq.matches) setDiscoverHeaderCompact(false);
    };

    mq.addEventListener("change", onMqChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("scroll", onScroll);
      setDiscoverHeaderCompact(false);
    };
  }, [setDiscoverHeaderCompact]);

  return (
    <div
      className="relative min-h-screen bg-slate-50/50 dark:bg-background pb-6 md:pb-12"
      data-discover-home-page=""
      data-discover-home-compact={discoverHeaderCompact ? "" : undefined}
    >
      {/**
       * Mobile: keep `top:0` + full-width `bg-background` always — animating `top` left a gap where
       * scroll content showed through. Animate an inner spacer height instead.
       */}
      <div
        className={cn(
          "fixed inset-x-0 z-[55] pointer-events-none bg-background",
          "max-md:top-0",
          "md:top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "shrink-0 bg-background md:hidden",
            "max-md:transition-[height] max-md:duration-[420ms] max-md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:max-md:transition-none",
            discoverHeaderCompact
              ? "h-[env(safe-area-inset-top,0px)]"
              : "h-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
          )}
        />
        <div className="app-desktop-shell pointer-events-auto">
          <div className="w-full px-2 py-2">
            <div role="tablist" aria-label="What are you here for?">
              {/** Track: neutral glass; colored gradient only on the active thumb */}
              <div
                className={cn(
                  "relative mx-auto grid min-h-[56px] w-full max-w-[22rem] grid-cols-2 gap-1 overflow-hidden rounded-full p-1.5 sm:max-w-[24rem] sm:min-h-[64px]",
                  "bg-slate-100/80 border border-slate-200/60 shadow-inner",
                  "dark:bg-zinc-900/50 dark:border-zinc-800/60 leading-none",
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 z-[5] rounded-[9999px]",
                    "w-[calc((100%-1rem)/2)] will-change-transform",
                    "bg-white shadow-sm ring-1 ring-slate-900/5",
                    "dark:bg-zinc-800 dark:ring-white/10 dark:shadow-none",
                    "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    homeMode === "hire"
                      ? "translate-x-0"
                      : "translate-x-[calc(100%+0.25rem)]",
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
                      ? "gap-2.5 text-slate-900 dark:text-white sm:gap-3"
                      : "gap-2.5 text-slate-500 hover:text-slate-700 sm:gap-3 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  <HeartHandshake
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                      homeMode === "hire"
                        ? "text-orange-500"
                        : "text-slate-400 dark:text-zinc-500",
                    )}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {homeMode === "hire" && (
                    <span className="max-w-[min(100%,11rem)] truncate text-left text-sm font-bold leading-tight tracking-tight sm:max-w-[12rem] sm:text-[15px]">
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
                      ? "gap-2.5 text-slate-900 dark:text-white sm:gap-3"
                      : "gap-2.5 text-slate-500 hover:text-slate-700 sm:gap-3 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  <HelpingHand
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                      homeMode === "work"
                        ? "text-emerald-500"
                        : "text-slate-400 dark:text-zinc-500",
                    )}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {homeMode === "work" && (
                    <span className="max-w-[min(100%,11rem)] truncate text-left text-sm font-bold leading-tight tracking-tight sm:max-w-[12rem] sm:text-[15px]">
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
          "app-desktop-shell" /** Tab strip: py + full-width themed pill toggle (~62–70px) + border + gap */,
          "pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem)]",
          discoverHeaderCompact &&
            "max-md:pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem-3.5rem)]",
          "max-md:transition-[padding-top] max-md:duration-[420ms] max-md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:max-md:transition-none",
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
                    : "md:w-[min(100%,22rem)] lg:w-[min(100%,26rem)]",
                )}
              >
                {homeMode === "hire" && isClient ? (
                  <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-3">
                    <button
                      type="button"
                      onClick={() => navigate("/client/create")}
                      className={cn(
                        "group flex w-full min-w-0 items-center gap-2.5 rounded-[20px] p-2 text-left outline-none sm:gap-3",
                        "md:flex-1",
                        "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5",
                        "shadow-sm",
                        INTERACTIVE_CARD_HOVER,
                        "focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                      aria-label="Post a request for help"
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
                          "bg-gradient-to-br from-orange-400 to-orange-500 text-white",
                        )}
                      >
                        <Megaphone
                          className="h-6 w-6"
                          aria-hidden
                          strokeWidth={2.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1 leading-snug">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-0.5">
                          Get help
                        </p>
                        <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                          Post a request for help
                        </p>
                        <p className="text-[13px] font-medium text-slate-500 dark:text-zinc-400 leading-tight">
                          Tell us what you need.
                        </p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors mr-1">
                        <ChevronRight
                          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                          strokeWidth={2.5}
                        />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(hireHelpersPath)}
                      className={cn(
                        "group flex w-full min-w-0 items-center gap-2.5 rounded-[20px] p-2 text-left outline-none sm:gap-3",
                        "md:flex-1",
                        "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5",
                        "shadow-sm",
                        INTERACTIVE_CARD_HOVER,
                        "focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                      aria-label="Find helpers"
                    >
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
                          "bg-slate-100 text-slate-700 border border-slate-200/50 dark:bg-zinc-800 dark:text-slate-300 dark:border-white/5",
                        )}
                      >
                        <Search
                          className="h-6 w-6"
                          aria-hidden
                          strokeWidth={2.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1 leading-snug">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-0.5">
                          Search
                        </p>
                        <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                          Find helpers
                        </p>
                        <p className="text-[13px] font-medium text-slate-500 dark:text-zinc-400 leading-tight">
                          Map & profiles
                        </p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-800 transition-colors mr-1">
                        <ChevronRight
                          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
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
                      "group flex w-full min-w-0 items-center gap-2.5 rounded-[20px] p-2 text-left outline-none sm:gap-3",
                      "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5",
                      "shadow-sm",
                      INTERACTIVE_CARD_HOVER,
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                    aria-label="Post availability"
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
                        "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white",
                      )}
                    >
                      <CalendarPlus
                        className="h-6 w-6"
                        aria-hidden
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className="min-w-0 flex-1 leading-snug">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">
                        Go live
                      </p>
                      <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                        Post availability
                      </p>
                      <p className="text-[13px] font-medium text-slate-500 dark:text-zinc-400 leading-tight">
                        Go live so people can find you.
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors mr-1">
                      <ChevronRight
                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                        strokeWidth={2.5}
                      />
                    </div>
                  </button>
                ) : null}

                {homeMode === "work" && !isClient ? (
                  <button
                    type="button"
                    onClick={() => navigate(workPrimaryPath)}
                    className={cn(
                      "group flex w-full min-w-0 items-center gap-2.5 rounded-[20px] p-2 text-left outline-none sm:gap-3",
                      "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5",
                      "shadow-sm",
                      INTERACTIVE_CARD_HOVER,
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 border border-slate-200/50 dark:bg-zinc-800 dark:text-slate-300 dark:border-white/5 shadow-sm">
                      <ChevronRight
                        className="h-6 w-6"
                        aria-hidden
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className="min-w-0 flex-1 leading-snug">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-0.5">
                        Open work
                      </p>
                      <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                        Browse open requests
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-800 transition-colors mr-1">
                      <ChevronRight
                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                        strokeWidth={2.5}
                      />
                    </div>
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
                "md:mx-0 md:w-full md:px-0",
              )}
              aria-label="Service categories"
            >
              <div className="relative">
                <div
                  className={cn(
                    "flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden",
                    "max-md:pr-2",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]",
                    "md:grid md:grid-cols-6 md:gap-3 md:overflow-visible md:snap-none md:overscroll-auto md:touch-auto md:pr-0 md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:auto",
                  )}
                >
                  {DISCOVER_HOME_CATEGORIES.map((cat) => {
                    const copy = DISCOVER_CATEGORY_HIRE_CARD[cat.id] ?? {
                      title: cat.label,
                      subtitle: "Browse live posts near you",
                    };
                    return (
                      <DiscoverHomeCategoryTile
                        key={cat.id}
                        variant="hire"
                        imageSrc={cat.imageSrc}
                        title={copy.title}
                        subtitle={copy.subtitle}
                        liveCountDisplay={liveCountLabel(cat.id)}
                        statusSuffix="now"
                        avatars={categoryAuthorAvatars[cat.id]}
                        onClick={() => onCategoryClick(cat.id)}
                        ariaLabel={
                          livePostsCountLoading
                            ? `${cat.label}, loading live post count`
                            : `${copy.title}. ${livePostsByCategory[cat.id] ?? 0} live now. ${copy.subtitle}`
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {homeMode === "hire" &&
            user?.id &&
            profile?.role === "client" &&
            latestRequests.length > 0 && (
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
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
                              "group relative w-full rounded-xl p-3 text-left bg-white dark:bg-zinc-900",
                              "border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
                              INTERACTIVE_CARD_HOVER,
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
                            )}
                          >
                            {count > 0 ? (
                              <span
                                className={cn(
                                  "absolute right-1.5 top-1.5 z-[1] inline-flex h-6 min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums leading-none text-white shadow-sm",
                                  "bg-gradient-to-r from-orange-500 to-red-600",
                                  "ring-1 ring-orange-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
                                )}
                              >
                                {count}
                              </span>
                            ) : null}
                            <div
                              className={cn(
                                "flex items-start justify-between gap-3",
                                count > 0 ? "pr-9" : undefined,
                              )}
                            >
                              <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                                {formatRequestTitle(r)}
                              </p>
                              <div className="flex shrink-0 items-center">
                                <div className="flex -space-x-2.5">
                                  {helpers.slice(0, 3).map((p) => (
                                    <Avatar
                                      key={p.id}
                                      className="h-9 w-9 border-2 border-background shadow-md"
                                    >
                                      <AvatarImage
                                        src={p.photo_url || undefined}
                                        className="object-cover"
                                      />
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
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                                <div className="pointer-events-none absolute inset-0 bg-black/15" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-base font-semibold text-muted-foreground">
                                  {r.location_city?.trim()
                                    ? r.location_city.trim()
                                    : "No location"}
                                </p>
                                <p className="mt-0.5 text-base text-muted-foreground">
                                  Posted{" "}
                                  {new Date(r.created_at).toLocaleDateString()}
                                </p>
                                {liveIso ? (
                                  <HelpRequestLiveExpiryRow
                                    expiresAtIso={liveIso}
                                  />
                                ) : (
                                  <HelpRequestLiveElapsedRow
                                    createdAtIso={r.created_at}
                                  />
                                )}
                              </div>
                              <ChevronRight
                                className="h-5 w-5 shrink-0 text-muted-foreground"
                                aria-hidden
                                strokeWidth={2}
                              />
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
                              "group relative w-full rounded-2xl p-4 text-left bg-white dark:bg-zinc-900",
                              "border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
                              INTERACTIVE_CARD_HOVER,
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
                            )}
                          >
                            {count > 0 ? (
                              <span
                                className={cn(
                                  "absolute right-1.5 top-1.5 z-[1] inline-flex h-6 min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums leading-none text-white shadow-sm",
                                  "bg-gradient-to-r from-orange-500 to-red-600",
                                  "ring-1 ring-orange-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
                                )}
                              >
                                {count}
                              </span>
                            ) : null}
                            <div
                              className={cn(
                                "flex items-start justify-between gap-3",
                                count > 0 ? "pr-9" : undefined,
                              )}
                            >
                              <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                                {formatRequestTitle(r)}
                              </p>
                              <div className="flex shrink-0 items-center">
                                <div className="flex -space-x-2.5">
                                  {helpers.slice(0, 3).map((p) => (
                                    <Avatar
                                      key={p.id}
                                      className="h-10 w-10 border-2 border-background shadow-md"
                                    >
                                      <AvatarImage
                                        src={p.photo_url || undefined}
                                        className="object-cover"
                                      />
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
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                                <div className="pointer-events-none absolute inset-0 bg-black/15" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-muted-foreground">
                                  {r.location_city?.trim()
                                    ? r.location_city.trim()
                                    : "No location"}
                                </p>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  Posted{" "}
                                  {new Date(r.created_at).toLocaleDateString()}
                                </p>
                                {liveIso ? (
                                  <HelpRequestLiveExpiryRow
                                    expiresAtIso={liveIso}
                                  />
                                ) : (
                                  <HelpRequestLiveElapsedRow
                                    createdAtIso={r.created_at}
                                  />
                                )}
                              </div>
                              <ChevronRight
                                className="h-5 w-5 shrink-0 text-muted-foreground"
                                aria-hidden
                                strokeWidth={2}
                              />
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
                  "group flex w-full items-center gap-3 rounded-[20px] p-2.5 text-left bg-white dark:bg-zinc-900",
                  "border border-slate-200/80 dark:border-white/5 shadow-sm",
                  INTERACTIVE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
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
                "md:mx-0 md:w-full md:px-0",
              )}
              aria-label="Post availability by category"
            >
              <div className="relative">
                <div
                  className={cn(
                    "flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden",
                    "max-md:pr-2",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]",
                    "md:grid md:grid-cols-6 md:gap-3 md:overflow-visible md:snap-none md:overscroll-auto md:touch-auto md:pr-0 md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:auto",
                  )}
                >
                  {SERVICE_CATEGORIES.map((cat) => {
                    const copy = DISCOVER_CATEGORY_WORK_CARD[cat.id] ?? {
                      title: `Post ${cat.label.toLowerCase()}`,
                      subtitle: "Go live in this category",
                    };
                    return (
                      <DiscoverHomeCategoryTile
                        key={cat.id}
                        variant="work"
                        imageSrc={cat.imageSrc}
                        title={copy.title}
                        subtitle={copy.subtitle}
                        liveCountDisplay={liveCountLabel(cat.id)}
                        statusSuffix="live"
                        avatars={categoryAuthorAvatars[cat.id]}
                        onClick={() => onWorkCategoryPostAvailability(cat.id)}
                        ariaLabel={
                          livePostsCountLoading
                            ? `${cat.label}, loading live post count`
                            : `${copy.title}. ${livePostsByCategory[cat.id] ?? 0} live in category. ${copy.subtitle}`
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {homeMode === "work" && <DiscoverHomeLatestOwnPosts />}

          {homeMode === "work" && (
            <div className="mb-4 md:mb-0">
              <DiscoverHomeLiveTrackerBoard variant="work" />
            </div>
          )}

          {homeMode === "work" && (
            <DiscoverHomeRecentActivity viewerRole={role} />
          )}

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
