import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Clock,
  PlayCircle,
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
import { DiscoverHirePostRequestStrip } from "@/components/discover/DiscoverHirePostRequestStrip";
import { ExploreHelpOthersLiveStrip } from "@/components/discover/ExploreHelpOthersLiveStrip";
import { DiscoverHomeRealtimeStrip } from "@/components/discover/DiscoverHomeRealtimeStrip";
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
import { writeDiscoverHomeIntent } from "@/lib/discoverHomeIntent";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";
import { DiscoverHomePostedHelpRequests } from "@/components/discover/DiscoverHomePostedHelpRequests";
import { DiscoverHomeFavoriteRequests } from "@/components/discover/DiscoverHomeFavoriteRequests";
import { DiscoverHomeMyOpenRequests } from "@/components/discover/DiscoverHomeMyOpenRequests";
import { DiscoverHomeSavedProfiles } from "@/components/discover/DiscoverHomeSavedProfiles";
import { DiscoverHomeMyLiveHelpJobs } from "@/components/discover/DiscoverHomeMyLiveHelpJobs";
import { DiscoverHomeReviewsDesktopStrip } from "@/components/discover/DiscoverHomeReviewsDesktopStrip";

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
  badge: "POSTS NEAR YOU",
  title: "Community requests",
  sub: "Go live and get requests instantly in your area.",
  primary: "Go live now",
} as const;

/** Same stack + padding for both hire/work heroes; flex-1 + shared min-heights keeps both modes aligned in the desktop grid row. */
const heroInnerClassName =
  "relative flex min-h-[10rem] flex-1 flex-col sm:min-h-[12.5rem] md:min-h-[16rem]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-start px-5 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-5 md:px-7 md:pb-4 md:pt-6";

const heroTopBlockClassName = "flex max-w-xl flex-col gap-3 md:gap-3.5";

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
  const { data: liveAvatarsPayload } = useDiscoverLiveAvatars(user?.id);
  const categoryAvatars = liveAvatarsPayload?.byCategory ?? {};
  const { data: frData } = useFreelancerRequests(user?.id);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);

  const [pendingWorkRequestsOpen, setPendingWorkRequestsOpen] = useState(false);
  const [quickMoreOpen, setQuickMoreOpen] = useState(false);
  const fetchOpenHelpPool =
    !isHire && !!user?.id && profile?.role !== "freelancer";
  const { data: openHelpRows = [] } = useDiscoverOpenHelpRequests(
    fetchOpenHelpPool,
    user?.id,
  );
  /** Prefer auth user id if profile row is still hydrating (common on `/client/home`). */
  const viewerId = profile?.id ?? user?.id ?? null;
  const [freelancerLiveMeta, setFreelancerLiveMeta] = useState<{
    live_until: string | null;
    available_now: boolean | null;
  }>({ live_until: null, available_now: null });

  const loadFreelancerLiveMeta = useCallback(async () => {
    if (!viewerId || isHire) return;
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("live_until, available_now")
      .eq("user_id", viewerId)
      .maybeSingle();
    if (error) {
      console.warn("[DiscoverHomeActionFirst] live_until:", error);
      setFreelancerLiveMeta({ live_until: null, available_now: null });
      return;
    }
    setFreelancerLiveMeta({
      live_until: data?.live_until ?? null,
      available_now: data?.available_now ?? null,
    });
  }, [viewerId, isHire]);

  useEffect(() => {
    void loadFreelancerLiveMeta();
  }, [loadFreelancerLiveMeta]);

  /** Clients + freelancers both persist 24h go-live on `freelancer_profiles` — refetch when returning to the tab. */
  useEffect(() => {
    if (isHire) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadFreelancerLiveMeta();
    };
    window.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [isHire, loadFreelancerLiveMeta]);

  /** Helpers list / Discover helpers use the strict 24h go-live window — match dock + hero FAB. */
  const isInActive24hGoLiveWindow =
    !isHire &&
    isFreelancerInActive24hLiveWindow({ live_until: freelancerLiveMeta.live_until });

  const liveUntilMs = useMemo(() => {
    if (!freelancerLiveMeta.live_until) return null;
    const t = new Date(freelancerLiveMeta.live_until).getTime();
    if (Number.isNaN(t)) return null;
    return t;
  }, [freelancerLiveMeta.live_until]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isInActive24hGoLiveWindow) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isInActive24hGoLiveWindow]);

  const liveRemainingLabel = useMemo(() => {
    if (!isInActive24hGoLiveWindow || liveUntilMs == null) return null;
    const liveRemainingMs = Math.max(0, liveUntilMs - nowMs);
    const totalSeconds = Math.floor(liveRemainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    if (hours > 0) return `${hours}:${mm}:${ss}`;
    return `${minutes}:${ss}`;
  }, [isInActive24hGoLiveWindow, liveUntilMs, nowMs]);

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

  const hireMoreMenuTotal = useMemo(
    () => hireLiveHelperCount + myRequestsCount,
    [hireLiveHelperCount, myRequestsCount],
  );

  const pendingWorkRequestsCount = useMemo(() => {
    return (frData?.inboundNotifications ?? []).filter((n) =>
      Boolean(n.isConfirmed),
    ).length;
  }, [frData]);

  const workMoreMenuTotal = useMemo(
    () =>
      isInActive24hGoLiveWindow
        ? pendingWorkRequestsCount
        : workLivePostCount + pendingWorkRequestsCount,
    [
      isInActive24hGoLiveWindow,
      pendingWorkRequestsCount,
      workLivePostCount,
    ],
  );

  /** Smooth shadow pulse on dock FABs (`box-shadow` keyframes; respects `motion-safe`). */
  const primaryCtaBreatheClass = "motion-safe:animate-dock-primary-breathe";

  /**
   * Mobile: icon-only primary + More, stacked on the right above BottomNav; sheet unchanged.
   */
  function renderQuickActionDockMobile() {
    const dockClass = cn(
      "pointer-events-auto fixed right-0 z-[140] flex flex-col items-end gap-3 md:hidden",
      "bottom-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom,0px))+3.5rem+0.5rem)]",
      "pr-[max(0.75rem,env(safe-area-inset-right,0px))]",
    );

    const moreMenuCountBadge =
      "absolute -right-1 -top-1 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums text-white bg-red-500 shadow-sm";

    const badgeRow =
      "ml-auto flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[11px] font-black tabular-nums text-white bg-red-500 shadow-sm";

    const fabBase = cn(
      "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white shadow-2xl transition-transform active:scale-[0.96]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-white",
      "dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-zinc-950",
    );

    const workBrowseFabClass = cn(
      fabBase,
      "border border-emerald-500/45 bg-emerald-50 text-emerald-700 shadow-2xl",
      "focus-visible:ring-emerald-500/35 dark:focus-visible:ring-emerald-200/35",
      "dark:border-emerald-400/35 dark:bg-zinc-800/95 dark:text-white dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
      primaryCtaBreatheClass,
    );

    const quickMoreSheet = (
      <Dialog open={quickMoreOpen} onOpenChange={setQuickMoreOpen}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 p-0 shadow-2xl",
            "max-md:fixed max-md:bottom-0 max-md:top-auto max-md:max-h-[min(85vh,22rem)] max-md:w-full max-md:translate-y-0",
            "md:max-w-md",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/30 bg-background/95 px-5 py-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black tracking-tight">More actions</DialogTitle>
              <DialogClose className="rounded-full p-2 text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-5 w-5" strokeWidth={2.5} />
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-1 p-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            {isHire ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    trackEvent("discover_actions_browse_helpers", { mode: homeMode });
                    navigateToHelpersBrowse(navigate);
                  }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                    <Search className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-foreground">Find helpers</span>
                    <span className="text-xs text-muted-foreground">Browse who’s available</span>
                  </span>
                  {hireLiveHelperCount > 0 ? (
                    <span className={badgeRow}>
                      {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    setMyRequestsOpen(true);
                  }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                    <ClipboardList className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-foreground">My requests</span>
                    <span className="text-xs text-muted-foreground">Your open requests</span>
                  </span>
                  {myRequestsCount > 0 ? (
                    <span className={badgeRow}>{myRequestsCount > 9 ? "9+" : myRequestsCount}</span>
                  ) : null}
                </button>
              </>
            ) : (
              <>
                {!isInActive24hGoLiveWindow ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                    onClick={() => {
                      setQuickMoreOpen(false);
                      trackEvent("discover_actions_browse_requests", { mode: homeMode });
                      navigateToWorkBrowseRequests(navigate, profile);
                    }}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      <UsersRound className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-foreground">Find posts</span>
                      <span className="text-xs text-muted-foreground">Live requests near you</span>
                    </span>
                    {workLivePostCount > 0 ? (
                      <span className={badgeRow}>
                        {workLivePostCount > 99 ? "99+" : workLivePostCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    setPendingWorkRequestsOpen(true);
                  }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Clock className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-foreground">Pending</span>
                    <span className="text-xs text-muted-foreground">Responses to confirm</span>
                  </span>
                  {pendingWorkRequestsCount > 0 ? (
                    <span className={badgeRow}>
                      {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
                    </span>
                  ) : null}
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );

    if (isHire) {
      return <>{quickMoreSheet}</>;
    }

    const workFabIsBrowse = isInActive24hGoLiveWindow;

    return (
      <>
        {workFabIsBrowse ? (
          <div className={dockClass}>
            <button
              type="button"
              onClick={() => {
                trackEvent("discover_actions_browse_requests", { mode: homeMode });
                navigateToWorkBrowseRequests(navigate, profile);
              }}
              className={workBrowseFabClass}
              aria-label={`Find posts${
                workLivePostCount > 0 ? ` (${workLivePostCount})` : ""
              }`}
            >
              <UsersRound className="h-7 w-7" strokeWidth={2.5} aria-hidden />
              {workLivePostCount > 0 ? (
                <span className={moreMenuCountBadge}>
                  {workLivePostCount > 99 ? "99+" : workLivePostCount}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
        {quickMoreSheet}
      </>
    );
  }

  /** Desktop hero: three round icon badges + captions (no modal). */
  function renderHeroQuickActionsDesktop() {
    const countBadgeClass =
      "absolute -right-0.5 -top-0.5 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums text-white shadow-md bg-red-500 ring-2 ring-white dark:ring-zinc-900";

    const roundBadgeClass = cn(
      "relative flex aspect-square h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-0 p-0 shadow-2xl transition-all duration-300 active:scale-[0.96] hover:scale-[1.08] group",
      "bg-white/10 text-white backdrop-blur-2xl ring-1 ring-white/20 hover:bg-white/20",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-white/50",
    );

    const badgeCaptionClass =
      "max-w-[6rem] text-center text-[11px] font-black uppercase leading-tight tracking-[0.08em] text-white transition-opacity duration-300 group-hover:opacity-100 opacity-90";

    const desktopQuickWrap = "pointer-events-auto absolute bottom-7 right-8 z-[20] hidden items-end gap-6 md:flex";

    if (isHire) {
      return (
        <div className={desktopQuickWrap}>
          <div className="flex flex-col items-center gap-2.5 group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("discover_actions_browse_helpers", { mode: homeMode });
                navigateToHelpersBrowse(navigate);
              }}
              className={roundBadgeClass}
              aria-label="Find helpers"
            >
              <Search className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
              {hireLiveHelperCount > 0 ? (
                <span className={countBadgeClass}>
                  {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                </span>
              ) : null}
            </button>
            <span className={badgeCaptionClass}>Find helpers</span>
          </div>
          <div className="flex flex-col items-center gap-2.5 group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("discover_actions_post_request", { mode: homeMode });
                writeDiscoverHomeIntent("hire");
                navigate(createRequestPath);
                recordFirstMeaningfulAction("home_primary_create_request");
              }}
              className={cn(
                roundBadgeClass,
                primaryCtaBreatheClass,
                "border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] ring-white/30 hover:brightness-110",
              )}
              aria-label="Request help now"
            >
              <Zap className="h-9 w-9 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" strokeWidth={3} aria-hidden />
            </button>
            <span className={badgeCaptionClass}>Post request</span>
          </div>
          <div className="flex flex-col items-center gap-2.5 group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMyRequestsOpen(true);
              }}
              className={roundBadgeClass}
              aria-label="My requests"
            >
              <ClipboardList className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
              {myRequestsCount > 0 ? (
                <span className={countBadgeClass}>
                  {myRequestsCount > 9 ? "9+" : myRequestsCount}
                </span>
              ) : null}
            </button>
            <span className={badgeCaptionClass}>My requests</span>
          </div>
        </div>
      );
    }

    return (
      <div className={desktopQuickWrap}>
        <div className="flex flex-col items-center gap-2.5 group">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              trackEvent("discover_actions_browse_requests", { mode: homeMode });
              navigateToWorkBrowseRequests(navigate, profile);
            }}
            className={roundBadgeClass}
            aria-label="Find posts"
          >
            <UsersRound className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
            {workLivePostCount > 0 ? (
              <span className={countBadgeClass}>
                {workLivePostCount > 99 ? "99+" : workLivePostCount}
              </span>
            ) : null}
          </button>
          <span className={badgeCaptionClass}>Find posts</span>
        </div>
        {isInActive24hGoLiveWindow ? null : (
          <div className="flex flex-col items-center gap-2.5 group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("discover_actions_go_live", { mode: homeMode });
                writeDiscoverHomeIntent("work");
                navigate(workPrimaryPath);
                recordFirstMeaningfulAction("home_primary_work");
              }}
              className={cn(
                roundBadgeClass,
                primaryCtaBreatheClass,
                "border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] ring-white/30 hover:brightness-110",
              )}
              aria-label="Go live"
            >
              <PlayCircle className="h-9 w-9 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" strokeWidth={3} aria-hidden />
            </button>
            <span className={badgeCaptionClass}>Go live</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-2.5 group">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingWorkRequestsOpen(true);
            }}
            className={roundBadgeClass}
            aria-label="Pending responses"
          >
            <Clock className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
            {pendingWorkRequestsCount > 0 ? (
              <span className={countBadgeClass}>
                {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
              </span>
            ) : null}
          </button>
          <span className={badgeCaptionClass}>Pending</span>
        </div>
      </div>
    );
  }

  function renderDesktopWorkLiveBadge() {
    if (!isInActive24hGoLiveWindow) return null;
    return (
      <div className="pointer-events-none absolute right-6 top-6 z-[21] hidden md:block">
        <div className="inline-flex items-center gap-2 rounded-full border-0 bg-zinc-100 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-800 shadow-none ring-0 backdrop-blur-sm dark:border-transparent dark:bg-black/35 dark:text-white dark:shadow-lg dark:ring-1 dark:ring-inset dark:ring-white/20">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
          </span>
          <span>Live</span>
          {liveRemainingLabel ? (
            <span className="rounded-full bg-zinc-200/80 px-2 py-1 text-[11px] font-black tabular-nums tracking-wide dark:bg-white/15">
              {liveRemainingLabel}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const workTheme = WORK;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-3 md:gap-5",
      )}
    >
      {renderQuickActionDockMobile()}
      {isHire ? (
        <DiscoverHirePostRequestStrip
          onPostRequest={() => {
            trackEvent("discover_actions_post_request", {
              mode: homeMode,
              source: "strip",
            });
            writeDiscoverHomeIntent("hire");
            navigate(createRequestPath);
            recordFirstMeaningfulAction("home_primary_create_request");
          }}
          onMoreClick={() => setQuickMoreOpen(true)}
          moreMenuTotal={hireMoreMenuTotal}
          moreMenuOpen={quickMoreOpen}
        />
      ) : (
        <ExploreHelpOthersLiveStrip
          onGoLive={() => {
            trackEvent("discover_actions_go_live", {
              mode: homeMode,
              source: "strip",
            });
            writeDiscoverHomeIntent("work");
            navigate(workPrimaryPath);
            recordFirstMeaningfulAction("home_primary_work");
          }}
          onMoreClick={() => setQuickMoreOpen(true)}
          moreMenuTotal={workMoreMenuTotal}
          moreMenuOpen={quickMoreOpen}
        />
      )}
      <div className="flex flex-1 md:hidden flex-col gap-0 pb-[5rem]">
        <div className="shrink-0 pt-0 px-0">
          <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
        </div>

        <div className="shrink-0 mt-3 flex flex-col px-0 pb-6">
          {isHire ? (
            <div className="flex flex-col">
              <div className="w-full px-4 pt-2 pb-2">
                <DiscoverHomeMyOpenRequests />
              </div>
              <div className="w-full px-4 pt-4 pb-2">
                <DiscoverHomeSavedProfiles />
              </div>
              <div className="w-full px-4 pt-4 pb-2">
                <DiscoverHomeMyLiveHelpJobs
                  mode="hire"
                  exploreLiveHelpPath={`${explorePath}?mode=hire&tab=live_help`}
                  createRequestPath={createRequestPath}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex flex-col px-4">
                {isInActive24hGoLiveWindow ? (
                  <div className="flex items-center justify-center sm:justify-end">
                    <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border-0 bg-zinc-100 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-800 shadow-none ring-0 backdrop-blur-sm dark:border dark:border-zinc-500/30 dark:bg-zinc-600/90 dark:text-white dark:shadow-lg dark:backdrop-blur-md">
                      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                        <span className="relative block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
                      </span>
                      <span>Live</span>
                      {liveRemainingLabel ? (
                        <span className="rounded-full bg-zinc-200/80 px-1.5 py-0.5 text-[11px] font-black tabular-nums tracking-wide dark:bg-white/15">
                          {liveRemainingLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

              </div>

              <div className="mt-3 w-full px-4">
                <DiscoverHomeMyLiveHelpJobs
                  mode="work"
                  exploreLiveHelpPath={`${explorePath}?mode=work&tab=live_help`}
                />
              </div>
            </div>
          )}
        </div>

        <DiscoverHomePostedHelpRequests
          enabled={!isHire}
          className="w-full px-4 pt-2 pb-2"
        />

        {!isHire ? (
          <DiscoverHomeFavoriteRequests className="w-full px-4 pt-4 pb-2" />
        ) : null}

        <section className="mt-6 px-0 md:px-4 pb-24">
          <h2 className="mb-4 px-4 text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            Our community live
          </h2>
          <ProfilePostsFeed limit={5} appearance="discover" />
          <div className="mt-6 flex justify-center px-4 pb-8">
            <button
              type="button"
              onClick={() => navigate("/community/feed")}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-6 py-3 text-[14px] font-black text-slate-700 transition-all active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-white/5 shadow-sm"
            >
              Show all posts
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
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
            <div className="flex min-h-0 min-w-0 flex-col gap-4 md:h-full">
              <section
                className={cn(
                  "relative mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none group md:min-h-0",
                  "ring-1 ring-white/10 ring-inset shadow-2xl transition-all duration-500",
                )}
              >
                {renderHeroQuickActionsDesktop()}
                <div className={cn(heroInnerClassName, "min-h-0 md:h-full")}>
                  <img
                    src={DISCOVER_PRIMARY_HERO_IMAGES.hire}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    decoding="async"
                    {...{ fetchpriority: "high" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[5]" />

                  <div className={heroStackClassName}>
                    <div className={heroTopBlockClassName}>
                      <div className="min-w-0">
                        {/* Desktop hero actions moved into the bottom Actions menu */}

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
                            className="text-[2.25rem] font-black leading-[1.1] tracking-tight text-white sm:text-[2.75rem]"
                            style={{
                              textShadow: "0 4px 30px rgba(0,0,0,0.5)",
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
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <section
              className={cn(
                "relative mx-auto flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none group md:h-full md:min-h-0",
                "ring-1 ring-white/10 ring-inset shadow-2xl transition-all duration-500",
              )}
            >
              {renderHeroQuickActionsDesktop()}
              {renderDesktopWorkLiveBadge()}
              <div className={cn(heroInnerClassName, "min-h-0 md:h-full")}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.work}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[5]" />

                <div className={heroStackClassName}>
                  <div className={heroTopBlockClassName}>
                    <div className="min-w-0">
                      {/* Desktop hero actions moved into the bottom Actions menu */}

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
                          className="text-[2.25rem] font-black leading-[1.1] tracking-tight text-white sm:text-[2.75rem]"
                          style={{
                            textShadow: "0 4px 30px rgba(0,0,0,0.5)",
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
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          {!isHire ? (
            <DiscoverHomeMyLiveHelpJobs
              mode="work"
              exploreLiveHelpPath={`${explorePath}?mode=work&tab=live_help`}
              className="min-w-0 px-0.5"
            />
          ) : null}
        </div>

        <div className="min-h-0 overflow-hidden pt-2 flex flex-col gap-2">
          <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
          {isHire ? (
            <DiscoverHomeMyOpenRequests className="min-w-0 px-0.5 pt-1" />
          ) : null}
          {isHire ? (
            <DiscoverHomeSavedProfiles className="min-w-0 px-0.5 pt-3" />
          ) : null}
          {isHire ? (
            <DiscoverHomeMyLiveHelpJobs
              mode="hire"
              exploreLiveHelpPath={`${explorePath}?mode=hire&tab=live_help`}
              createRequestPath={createRequestPath}
              className="min-w-0 px-0.5 pt-3"
            />
          ) : null}
        </div>

        {!isHire ? (
          <DiscoverHomePostedHelpRequests enabled className="px-1 pt-2 pb-1" />
        ) : null}

        {!isHire ? (
          <DiscoverHomeFavoriteRequests className="px-1 pt-4 pb-1" />
        ) : null}

        <section className="mt-6 pb-0">
          <h2 className="mb-4 text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            Our community live
          </h2>
          <ProfilePostsFeed limit={5} appearance="discover" />
        </section>

        <DiscoverHomeReviewsDesktopStrip
          limit={10}
          className="mt-10 shrink-0 border-t border-slate-200/80 pt-8 pb-12 dark:border-white/10"
        />
      </div>

      {/* My Requests Modal */}
      <Dialog open={myRequestsOpen} onOpenChange={setMyRequestsOpen}>
        <DialogContent className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 p-0 shadow-2xl",
          "max-md:fixed max-md:bottom-0 max-md:top-auto max-md:h-[85vh] max-md:w-full max-md:translate-y-0",
          "md:max-h-[min(90vh,48rem)] md:max-w-4xl"
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
          "md:max-h-[min(90vh,48rem)] md:max-w-4xl"
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
