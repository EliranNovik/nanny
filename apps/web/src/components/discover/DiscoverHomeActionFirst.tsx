import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Clock,
  PlayCircle,
  PlusCircle,
  Search,
  UsersRound,
  Wifi,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { supabase } from "@/lib/supabase";
import {
  navigateToHelpersBrowse,
  navigateToWorkBrowseRequests,
} from "@/lib/discoverBrowseNavigate";
import { DiscoverHomeRealtimeStrip } from "@/components/discover/DiscoverHomeRealtimeStrip";
import { DiscoverHomeRecentActivity } from "@/components/discover/DiscoverHomeRecentActivity";
import { DiscoverHomeHeroDesktopLiveColumn } from "@/components/discover/DiscoverHomeHeroDesktopLiveColumn";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import { DISCOVER_PRIMARY_HERO_IMAGES } from "@/components/discover/discoverHomeHeroImages";
import { recordFirstMeaningfulAction } from "@/lib/sessionConversionAnalytics";
import { matchesCommunityRequestsIncoming } from "@/lib/communityRequestsNotificationFilter";
import { useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { useDiscoverOpenHelpRequests } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";

type HomeMode = "hire" | "work";

type Props = {
  homeMode: HomeMode;
  explorePath: string;
  workPrimaryPath: string;
  createRequestPath: string;
};

const HIRE = {
  badge: "FAST & EASY",
  title: "Find someone in minutes.",
  sub: "Post what you need and get matched with helpers nearby — fast.",
  primary: "Post a request",
} as const;

const WORK = {
  badge: "JOBS NEAR YOU",
  title: "People need help right now.",
  sub: "Go live and get requests instantly in your area.",
  primary: "Go live now",
} as const;

/** Same stack + padding for both hire/work heroes; modest min-height keeps imagery balanced. */
const heroInnerClassName =
  "relative flex min-h-[10rem] flex-col sm:min-h-[12.5rem] md:min-h-[13rem]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-start px-5 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-5 md:px-7 md:pb-4 md:pt-6";

const heroTopBlockClassName = "flex max-w-xl flex-col gap-3 md:gap-3.5";

/** Primary hero CTAs — calm, product-grade (avoid loud “SaaS gradient” chrome). */
const heroCtaBaseClassName = cn(
  "group inline-flex h-11 w-fit min-w-[10.5rem] max-w-[min(100%,17rem)] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold tracking-normal sm:h-12 sm:min-w-[11.5rem] sm:px-6 sm:text-[15px]",
  "border shadow-sm transition-[transform,box-shadow,background-color,border-color] motion-reduce:transition-none",
  "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
);

const heroTitleBlockClassName = "max-w-[17rem] space-y-1.5 pr-1 sm:max-w-[19rem]";

export function DiscoverHomeActionFirst({
  homeMode,
  explorePath,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isHire = homeMode === "hire";
  const { data: categoryAvatars = {} } = useDiscoverLiveAvatars(user?.id);
  const { data: frData } = useFreelancerRequests(user?.id);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);
  const [pendingWorkRequestsOpen, setPendingWorkRequestsOpen] = useState(false);
  const fetchOpenHelpPool =
    !isHire && !!user?.id && profile?.role !== "freelancer";
  const { data: openHelpRows = [] } = useDiscoverOpenHelpRequests(
    fetchOpenHelpPool,
    user?.id,
  );
  const viewerId = profile?.id ?? null;
  const [freelancerLiveUntil, setFreelancerLiveUntil] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!viewerId || isHire) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .select("live_until")
        .eq("user_id", viewerId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[DiscoverHomeActionFirst] live_until:", error);
        setFreelancerLiveUntil(null);
        return;
      }
      setFreelancerLiveUntil(data?.live_until ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerId, isHire]);

  const isWorkLive =
    !isHire && isFreelancerInActive24hLiveWindow({ live_until: freelancerLiveUntil });

  const liveUntilMs = useMemo(() => {
    if (!freelancerLiveUntil) return null;
    const t = new Date(freelancerLiveUntil).getTime();
    if (Number.isNaN(t)) return null;
    return t;
  }, [freelancerLiveUntil]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isWorkLive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isWorkLive]);

  const liveRemainingMs = liveUntilMs != null ? Math.max(0, liveUntilMs - nowMs) : 0;
  const liveRemainingLabel = useMemo(() => {
    if (!isWorkLive || liveUntilMs == null) return null;
    const totalSeconds = Math.floor(liveRemainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    if (hours > 0) return `${hours}:${mm}:${ss}`;
    return `${minutes}:${ss}`;
  }, [isWorkLive, liveRemainingMs, liveUntilMs]);

  /** Total live helper slots across Discover home categories (same pool as the strip). */
  const hireLiveHelperCount = useMemo(() => {
    let n = 0;
    for (const cat of DISCOVER_HOME_CATEGORIES) {
      if (cat.id === ALL_HELP_CATEGORY_ID) continue;
      if (!isServiceCategoryId(cat.id)) continue;
      const avs = categoryAvatars[cat.id];
      if (Array.isArray(avs)) n += avs.length;
    }
    return n;
  }, [categoryAvatars]);

  /** Live requests: freelancer inbox count or client open-help RPC rows (same rules as the strip). */
  const workLivePostCount = useMemo(() => {
    if (!user?.id) return 0;
    if (profile?.role === "freelancer") {
      return (frData?.inboundNotifications ?? []).filter((n) =>
        matchesCommunityRequestsIncoming(n, {
          excludeClientId: user.id,
        }),
      ).length;
    }
    return openHelpRows.length;
  }, [frData, openHelpRows, profile?.role, user?.id]);

  const myRequestsCount = useMemo(() => {
    return (frData?.myOpenRequests ?? []).length;
  }, [frData]);

  const pendingWorkRequestsCount = useMemo(() => {
    return (frData?.inboundNotifications ?? []).filter((n) =>
      Boolean(n.isConfirmed),
    ).length;
  }, [frData]);

  function renderFixedBottomBrowseDock() {
    const bottomOffset = "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]";

    /**
     * Round Icon Button style:
     * - h-14 w-14 (mobile) / h-16 w-16 (desktop)
     * - High-end shadow and blur
     */
    const roundBtnBase = cn(
      "group relative flex h-16 w-16 items-center justify-center rounded-full border shadow-xl transition-all duration-300",
      "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "md:h-[4.5rem] md:w-[4.5rem]"
    );

    const countBadge = cn(
      "absolute -right-0.5 -top-0.5 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white px-1.5 text-[11px] font-black tabular-nums text-white shadow-sm dark:border-zinc-950",
    );

    return (
      <div
        className={cn(
          "pointer-events-auto fixed inset-x-0 z-[140]",
          bottomOffset,
          "flex justify-center"
        )}
      >
        <div className="flex items-center gap-4 px-4 pb-2">
          {isHire ? (
            <>
              {/* Browse Helpers */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent("discover_bottom_browse_helpers", { mode: homeMode });
                  navigateToHelpersBrowse(navigate);
                }}
                className={cn(
                  roundBtnBase,
                  "border-indigo-500/20 bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25",
                  "dark:border-indigo-400/30 dark:bg-indigo-600"
                )}
                aria-label="Browse helpers"
              >
                <Search className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2.5} aria-hidden />
                {hireLiveHelperCount > 0 && (
                  <span className={cn(countBadge, "bg-indigo-500 shadow-indigo-600/50")}>
                    {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                  </span>
                )}
              </button>

              {/* My Requests (only for clients) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMyRequestsOpen(true);
                }}
                className={cn(
                  roundBtnBase,
                  "border-slate-200/80 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white",
                  "shadow-lg"
                )}
                aria-label="My Requests"
              >
                <ClipboardList className="h-7 w-7 md:h-8 md:w-8 text-slate-700 dark:text-slate-300" strokeWidth={2} aria-hidden />
                {myRequestsCount > 0 && (
                  <span className={cn(countBadge, "bg-orange-500 border-white dark:border-zinc-900")}>
                    {myRequestsCount > 9 ? "9+" : myRequestsCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Browse Jobs */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent("discover_bottom_find_people_in_need", {
                    mode: homeMode,
                  });
                  navigateToWorkBrowseRequests(navigate, profile);
                }}
                className={cn(
                  roundBtnBase,
                  "border-emerald-500/20 bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-emerald-500/25",
                  "dark:border-emerald-400/30 dark:bg-emerald-600"
                )}
                aria-label="Browse users requests"
              >
                <UsersRound className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2.5} aria-hidden />
                {workLivePostCount > 0 && (
                  <span className={cn(countBadge, "bg-emerald-500 shadow-emerald-500/50")}>
                    {workLivePostCount > 99 ? "99+" : workLivePostCount}
                  </span>
                )}
              </button>

              {/* Pending Requests (for freelancers) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingWorkRequestsOpen(true);
                }}
                className={cn(
                  roundBtnBase,
                  "border-slate-200/80 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white",
                  "shadow-lg"
                )}
                aria-label="Pending Requests"
              >
                <Clock className="h-7 w-7 md:h-8 md:w-8 text-slate-700 dark:text-slate-300" strokeWidth={2.5} aria-hidden />
                {pendingWorkRequestsCount > 0 && (
                  <span className={cn(countBadge, "bg-emerald-500 border-white dark:border-zinc-900")}>
                    {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function onStartRequest() {
    trackEvent("discover_primary_cta", { mode: homeMode });
    if (isHire) {
      navigate(createRequestPath);
      recordFirstMeaningfulAction("home_primary_create_request");
      return;
    }
    navigate(workPrimaryPath);
    recordFirstMeaningfulAction("home_primary_work");
  }

  const workTheme = WORK;

  // Shared font sizes/weights for mobile hero
  const mobileHeroTitleClass = "text-[1.375rem] font-black leading-[1.2] tracking-tight text-white drop-shadow-md";
  const mobileHeroBadgeClass = "inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/25 backdrop-blur-md px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-sm mb-2";

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden md:gap-5",
      )}
    >
      {renderFixedBottomBrowseDock()}

      {/* ===== MOBILE ONLY LAYOUT ===== */}
      <div className="flex flex-1 md:hidden flex-col gap-0 pb-[5rem]">
        <div className="shrink-0 pt-0 px-1">
          <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
        </div>

        <div className="flex-1 mt-3 flex flex-col">
          {isHire ? (
            <section className="relative flex flex-col w-full flex-1 overflow-hidden ring-1 ring-black/10 shadow-sm min-h-[22rem]">
              <img src="/pexels-rdne-6646861.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" />
              {/* Split gradient: one for top text, one for bottom button */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              <div className="relative flex flex-col justify-end flex-1 w-full p-6 pb-24">
                {/* Section Badge - Top Left Corner */}
                <div className="absolute top-4 left-4 z-[10]">
                  <div className={cn(mobileHeroBadgeClass, "mb-0")}>
                    <Zap className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                    <span className="truncate">{HIRE.badge}</span>
                  </div>
                </div>

                {/* Primary Action - Top Right Corner */}
                <button
                  onClick={onStartRequest}
                  type="button"
                  className="absolute top-4 right-4 z-[10] group inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-black shadow-lg transition-all bg-white text-violet-950 hover:bg-slate-50 active:scale-[0.98]"
                >
                  <PlusCircle className="h-5 w-5 shrink-0 text-violet-800" strokeWidth={3} aria-hidden />
                  <span>{HIRE.primary}</span>
                </button>

                <div className="min-w-0">
                  <h2 className={mobileHeroTitleClass}>
                    {HIRE.title}
                  </h2>
                </div>
              </div>
            </section>
          ) : (
            <section className="relative flex flex-col w-full flex-1 overflow-hidden ring-1 ring-black/10 shadow-sm min-h-[22rem]">
              <img src="/pexels-tima-miroshnichenko-6197046.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" />
              {/* Split gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              <div className="relative flex flex-col justify-end flex-1 w-full p-6 pb-24">
                {/* Section Badge - Top Left Corner */}
                <div className="absolute top-4 left-4 z-[10]">
                  <div className={cn(mobileHeroBadgeClass, "mb-0")}>
                    <Wifi className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                    <span className="truncate">{workTheme.badge}</span>
                  </div>
                </div>

                {/* Primary Action - Top Right Corner */}
                <div className="absolute top-4 right-4 z-[10] flex flex-col items-end gap-2">
                  <button
                    onClick={onStartRequest}
                    type="button"
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-black shadow-lg transition-all bg-white text-emerald-950 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <PlayCircle className="h-5 w-5 shrink-0 text-emerald-800" strokeWidth={3} aria-hidden />
                    <span>{workTheme.primary}</span>
                  </button>
                  {isWorkLive && (
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white drop-shadow-md bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                       <span className="relative flex h-2 w-2 shrink-0">
                          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 motion-reduce:animate-none" />
                          <span className="relative block h-2 w-2 rounded-full bg-emerald-400" />
                       </span>
                       Active
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className={mobileHeroTitleClass}>
                    {workTheme.title}
                  </h2>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ===== DESKTOP ONLY LAYOUT ===== */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden gap-5">
        <div
          className={cn(
            "grid shrink-0 grid-cols-1 gap-4 md:gap-5 lg:gap-6",
            user?.id &&
            "md:grid-cols-[minmax(0,1fr)_min(19rem,32%)] md:items-stretch",
          )}
        >
          {isHire ? (
            <section
              className={cn(
                "relative mx-auto w-full max-w-full shrink-0 overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none",
                "ring-1 ring-black/[0.06] ring-inset",
              )}
            >
              <div className={heroInnerClassName}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.hire}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />

                <div className={heroStackClassName}>
                  <div className={heroTopBlockClassName}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md sm:px-3 sm:py-1.5">
                          <Zap
                            className={cn(discoverIcon.sm, "shrink-0")}
                            strokeWidth={DISCOVER_STROKE}
                            aria-hidden
                          />
                          {HIRE.badge}
                        </div>
                      </div>
                      <div className={cn(heroTitleBlockClassName, "mt-2 pr-0")}>
                        <h2
                          className="text-[1.5rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[1.625rem]"
                          style={{
                            textShadow:
                              "0 2px 20px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.45)",
                          }}
                        >
                          {HIRE.title}
                        </h2>
                        <p
                          className="whitespace-pre-line text-[0.875rem] font-normal leading-snug text-white/95 sm:text-[15px]"
                          style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
                        >
                          {HIRE.sub}
                        </p>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={onStartRequest}
                          className={cn(
                            heroCtaBaseClassName,
                            "h-11 w-fit min-w-[12.75rem] max-w-full justify-between px-4",
                            "border-white/70 bg-white text-violet-950",
                            "shadow-[0_12px_34px_-20px_rgba(0,0,0,0.55)]",
                            "hover:bg-white hover:shadow-[0_16px_40px_-22px_rgba(0,0,0,0.6)]",
                            "focus-visible:ring-white/80",
                          )}
                        >
                          <PlusCircle
                            className="h-[1.05rem] w-[1.05rem] shrink-0 text-violet-800"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span>{HIRE.primary}</span>
                          <ChevronRight
                            className={cn(
                              discoverIcon.sm,
                              "shrink-0 text-slate-400 transition group-hover:translate-x-px group-hover:text-slate-600",
                            )}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section
              className={cn(
                "relative mx-auto w-full max-w-full shrink-0 overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none",
                "ring-1 ring-black/[0.06] ring-inset",
              )}
            >
              <div className={heroInnerClassName}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.work}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />

                <div className={heroStackClassName}>
                  <div className={heroTopBlockClassName}>
                    <div className="min-w-0">
                      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md sm:px-3 sm:py-1.5">
                        <Wifi
                          className={cn(discoverIcon.sm, "shrink-0")}
                          strokeWidth={DISCOVER_STROKE}
                          aria-hidden
                        />
                        {workTheme.badge}
                      </div>
                      <div className={cn(heroTitleBlockClassName, "mt-2 pr-0")}>
                        <h2
                          className="text-[1.5rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[1.625rem]"
                          style={{
                            textShadow:
                              "0 2px 20px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.45)",
                          }}
                        >
                          {workTheme.title}
                        </h2>
                        <p
                          className="text-[0.875rem] font-normal leading-snug text-white/95 sm:text-[15px]"
                          style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
                        >
                          {workTheme.sub}
                        </p>
                      </div>
                      <div className="mt-3">
                        {isWorkLive ? (
                          <div className="flex w-full items-center gap-3">
                            <div
                              className={cn(
                                "inline-flex shrink-0 items-center gap-2 rounded-full",
                                "bg-emerald-950 px-3 py-2 text-white shadow-sm",
                                "ring-1 ring-inset ring-emerald-900/40",
                              )}
                              aria-label={
                                liveRemainingLabel
                                  ? `Live time remaining ${liveRemainingLabel}`
                                  : "Live"
                              }
                            >
                              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
                              </span>
                              <span className="text-[11px] font-black uppercase tracking-[0.18em]">
                                Live
                              </span>
                              {liveRemainingLabel ? (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black tabular-nums tracking-wide">
                                  {liveRemainingLabel}
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div
                                className="text-[13px] font-semibold leading-snug text-white"
                                style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
                              >
                                You are live right now.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={onStartRequest}
                            className={cn(
                              heroCtaBaseClassName,
                              "h-11 w-fit min-w-[12.75rem] max-w-full justify-between px-4",
                              "border-white/70 bg-white text-emerald-950",
                              "shadow-[0_12px_34px_-20px_rgba(0,0,0,0.55)]",
                              "hover:bg-white hover:shadow-[0_16px_40px_-22px_rgba(0,0,0,0.6)]",
                              "focus-visible:ring-white/80",
                            )}
                          >
                            <PlayCircle
                              className="h-[1.05rem] w-[1.05rem] shrink-0 text-emerald-800"
                              strokeWidth={2}
                              aria-hidden
                            />
                            <span>{workTheme.primary}</span>
                            <ChevronRight
                              className={cn(
                                discoverIcon.sm,
                                "shrink-0 text-slate-400 transition group-hover:translate-x-px group-hover:text-slate-600",
                              )}
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          <DiscoverHomeHeroDesktopLiveColumn />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden pt-2 flex flex-col gap-2">
          <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
          <DiscoverHomeRecentActivity viewerRole={isHire ? "client" : "freelancer"} />
        </div>
      </div>

      {/* My Requests Modal */}
      <Dialog open={myRequestsOpen} onOpenChange={setMyRequestsOpen}>
        <DialogContent className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 p-0 shadow-2xl",
          "max-md:fixed max-md:bottom-0 max-md:top-auto max-md:h-[85vh] max-md:w-full max-md:translate-y-0",
          "md:max-h-[min(90vh,40rem)] md:max-w-2xl"
        )}>
          <DialogHeader className="shrink-0 border-b border-border/30 bg-background/95 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black tracking-tight">Your requests</DialogTitle>
              <DialogClose className="rounded-full p-2 text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-6 w-6" strokeWidth={2.5} />
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-4">
            <ExploreMyPostedRequests />
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Work Requests Modal */}
      <Dialog open={pendingWorkRequestsOpen} onOpenChange={setPendingWorkRequestsOpen}>
        <DialogContent className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 p-0 shadow-2xl",
          "max-md:fixed max-md:bottom-0 max-md:top-auto max-md:h-[85vh] max-md:w-full max-md:translate-y-0",
          "md:max-h-[min(90vh,40rem)] md:max-w-2xl"
        )}>
          <DialogHeader className="shrink-0 border-b border-border/30 bg-background/95 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black tracking-tight">Pending responses</DialogTitle>
              <DialogClose className="rounded-full p-2 text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-6 w-6" strokeWidth={2.5} />
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-4">
            <ExplorePendingResponses />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
