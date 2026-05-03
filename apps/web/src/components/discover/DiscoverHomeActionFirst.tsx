import { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInDays, differenceInHours, formatDistanceToNow } from "date-fns";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { DiscoverHomeRecentActivity } from "@/components/discover/DiscoverHomeRecentActivity";
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
  getServiceCategoryImage,
} from "@/lib/serviceCategories";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";
import { DiscoverHomePostedHelpRequests } from "@/components/discover/DiscoverHomePostedHelpRequests";
import { DiscoverHomeLiveHelperCards } from "@/components/discover/DiscoverHomeLiveHelperCards";

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

/** Mobile “my request” / “live help” rows — light card, dark glass in dark mode */
const discoverHomeMobilePromoRowClass = cn(
  "flex w-full items-center gap-4 rounded-[1.25rem] border-0 bg-zinc-100 p-4 text-left shadow-none ring-0 backdrop-blur-sm transition-all active:scale-[0.98]",
  "dark:border dark:border-zinc-500/35 dark:bg-zinc-700/90 dark:shadow-xl dark:ring-0 dark:backdrop-blur-xl dark:shadow-black/25",
);

const discoverHomeMobileEmptyRowClass = cn(
  "flex w-full items-center justify-between gap-3 rounded-[1.25rem] border-0 bg-zinc-100 p-4 text-left shadow-none ring-0 backdrop-blur-sm",
  "dark:border dark:border-zinc-500/35 dark:bg-zinc-700/85 dark:shadow-black/20 dark:ring-0",
);

const discoverHomeMobileThumbClass =
  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-0 bg-zinc-200/70 shadow-none dark:border dark:border-white/10 dark:bg-white/10 dark:shadow-lg";

const discoverHomeMobileMetaPillClass =
  "shrink-0 rounded-full border-0 bg-zinc-200/90 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-zinc-800 ring-0 dark:border dark:border-zinc-500/50 dark:bg-zinc-800/95 dark:text-zinc-100 dark:ring-1 dark:ring-zinc-950/40";

const discoverHomeMobileEmptyCtaClass =
  "shrink-0 rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100 dark:border-white/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 dark:shadow-none";

/** Same stack + padding for both hire/work heroes; modest min-height keeps imagery balanced. */
const heroInnerClassName =
  "relative flex min-h-[10rem] flex-col sm:min-h-[12.5rem] md:min-h-[16rem]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-start px-5 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-5 md:px-7 md:pb-4 md:pt-6";

const heroTopBlockClassName = "flex max-w-xl flex-col gap-3 md:gap-3.5";

const heroTitleBlockClassName = "max-w-[17rem] space-y-1.5 pr-1 sm:max-w-[19rem]";

function formatJobTitle(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Help request";
}

/** Live-help “matched … ago”: full hours if under 24h, else whole days. */
function formatMatchedAgoDaysOrHours(iso: string | number | Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const hours = differenceInHours(now, then);
  if (hours < 0) return "";
  if (hours < 24) {
    if (hours < 1) return "less than 1 hour ago";
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = differenceInDays(now, then);
  const d = Math.max(1, days);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function DiscoverHomeActionFirst({
  homeMode,
  explorePath,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isHire = homeMode === "hire";
  const { data: liveAvatarsPayload, isPending: liveAvatarsPending } =
    useDiscoverLiveAvatars(user?.id);
  const categoryAvatars = liveAvatarsPayload?.byCategory ?? {};
  const liveHelpersForCards = liveAvatarsPayload?.helpersForCards ?? [];
  const { data: frData } = useFreelancerRequests(user?.id);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);

  const acceptedRequests = useMemo(() => {
    const jobs = frData?.myOpenRequests ?? [];
    return jobs.filter((j: any) => (j.acceptedCount || 0) > 0).slice(0, 1);
  }, [frData]);

  const [liveHelpingJobs, setLiveHelpingJobs] = useState<any[]>([]);
  const [liveHelpingProfiles, setLiveHelpingProfiles] = useState<Map<string, any>>(new Map());
  const [dismissedLiveJobIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id || isHire) {
      setLiveHelpingJobs([]);
      setLiveHelpingProfiles(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("job_requests")
        .select("id, created_at, service_type, location_city, client_id, selected_freelancer_id, status")
        .in("status", ["locked", "active"])
        .eq("selected_freelancer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(2);
      
      if (cancelled) return;
      if (error) {
        console.warn("[DiscoverHomeActionFirst] live helping jobs:", error);
        return;
      }
      
      const rows = data || [];
      setLiveHelpingJobs(rows);
      
      const clientIds = rows.map((r: any) => r.client_id).filter(Boolean);
      if (clientIds.length > 0) {
        const { data: profs, error: profError } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, is_verified")
          .in("id", clientIds);
        
        if (cancelled) return;
        if (profError) {
          console.warn("[DiscoverHomeActionFirst] live helping profiles:", profError);
          return;
        }
        
        const m = new Map<string, any>();
        for (const p of profs || []) {
          m.set(p.id, p);
        }
        setLiveHelpingProfiles(m);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isHire]);
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

  const pendingWorkRequestsCount = useMemo(() => {
    return (frData?.inboundNotifications ?? []).filter((n) =>
      Boolean(n.isConfirmed),
    ).length;
  }, [frData]);

  /** Smooth shadow pulse on dock FABs (`box-shadow` keyframes; respects `motion-safe`). */
  const primaryCtaBreatheClass = "motion-safe:animate-dock-primary-breathe";

  /**
   * Mobile: icon-only primary + More, stacked on the right above BottomNav; sheet unchanged.
   */
  function renderQuickActionDockMobile() {
    const dockClass = cn(
      "pointer-events-auto fixed right-0 z-[140] flex flex-col items-end gap-3 md:hidden",
      "bottom-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom,0px))+2.875rem+0.5rem)]",
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

  /** Desktop hero: matching three shortcuts (no modal). */
  function renderHeroQuickActionsDesktop() {
    const badgeSm =
      "absolute -right-1.5 -top-1.5 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums text-white shadow-md bg-red-500 ring-2 ring-white";
    const boxClass = cn(
      "relative flex min-h-[4.35rem] w-full min-w-0 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center shadow-lg transition-transform active:scale-[0.98]",
      "bg-white/90 text-slate-900 backdrop-blur-xl ring-1 ring-black/10 hover:bg-white",
      "dark:border-white/10 dark:bg-zinc-800/85 dark:text-zinc-100 dark:hover:bg-zinc-800",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    );

    if (isHire) {
      return (
        <div className="pointer-events-auto absolute bottom-6 right-6 z-[20] hidden w-[min(100%-2rem,28rem)] grid grid-cols-3 gap-2 md:grid">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              trackEvent("discover_actions_browse_helpers", { mode: homeMode });
              navigateToHelpersBrowse(navigate);
            }}
            className={boxClass}
            aria-label="Find helpers"
          >
            <Search className="h-6 w-6 text-[#7B61FF]" strokeWidth={2.6} aria-hidden />
            <span className="text-[12px] font-black uppercase tracking-wide">
              Find helpers
            </span>
            {hireLiveHelperCount > 0 ? (
              <span className={badgeSm}>
                {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
              </span>
            ) : null}
          </button>
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
              boxClass,
              primaryCtaBreatheClass,
              "border-transparent bg-gradient-to-br from-indigo-600 to-purple-800 text-white shadow-indigo-500/25 ring-indigo-500/20 hover:brightness-110",
            )}
            aria-label="Request help now"
          >
            <Zap className="h-6 w-6 text-white" strokeWidth={2.6} aria-hidden />
            <span className="text-[12px] font-black uppercase leading-snug tracking-wide">
              Request help now
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMyRequestsOpen(true);
            }}
            className={boxClass}
            aria-label="My requests"
          >
            <ClipboardList className="h-6 w-6 text-[#7B61FF]" strokeWidth={2.6} aria-hidden />
            <span className="text-[12px] font-black uppercase tracking-wide">
              My requests
            </span>
            {myRequestsCount > 0 ? (
              <span className={badgeSm}>
                {myRequestsCount > 9 ? "9+" : myRequestsCount}
              </span>
            ) : null}
          </button>
        </div>
      );
    }

    return (
      <div className="pointer-events-auto absolute bottom-6 right-6 z-[20] hidden w-[min(100%-2rem,28rem)] grid grid-cols-3 gap-2 md:grid">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            trackEvent("discover_actions_browse_requests", { mode: homeMode });
            navigateToWorkBrowseRequests(navigate, profile);
          }}
          className={boxClass}
          aria-label="Find posts"
        >
          <UsersRound className="h-6 w-6 text-emerald-600" strokeWidth={2.6} aria-hidden />
          <span className="text-[12px] font-black uppercase tracking-wide">
            Find posts
          </span>
          {workLivePostCount > 0 ? (
            <span className={badgeSm}>
              {workLivePostCount > 99 ? "99+" : workLivePostCount}
            </span>
          ) : null}
        </button>
        {isInActive24hGoLiveWindow ? null : (
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
              boxClass,
              primaryCtaBreatheClass,
              "border-transparent bg-emerald-600 text-white hover:bg-emerald-600",
            )}
            aria-label="Go live"
          >
            <PlayCircle className="h-6 w-6 text-white" strokeWidth={2.6} aria-hidden />
            <span className="text-[12px] font-black uppercase tracking-wide">
              Go live
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingWorkRequestsOpen(true);
          }}
          className={boxClass}
          aria-label="Pending responses"
        >
          <Clock className="h-6 w-6 text-emerald-600" strokeWidth={2.6} aria-hidden />
          <span className="text-[12px] font-black uppercase tracking-wide">
            Pending
          </span>
          {pendingWorkRequestsCount > 0 ? (
            <span className={badgeSm}>
              {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
            </span>
          ) : null}
        </button>
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
              <h3 className="px-4 pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                My requests
              </h3>
              <div className="flex justify-center px-4">
                <div className="mt-1 w-full max-w-md">
                  {acceptedRequests.length > 0 ? (
                    acceptedRequests.slice(0, 1).map((job: any) => {
                      const avatars = frData?.confirmedHelperAvatarsByJobId?.[job.id] ?? [];
                      const title = formatJobTitle(job);
                      const loc = (job.location_city ?? "").trim() || "Location not set";

                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/client/jobs/${job.id}/live`);
                          }}
                          className={discoverHomeMobilePromoRowClass}
                        >
                          <div className={discoverHomeMobileThumbClass}>
                            <img
                              src={getServiceCategoryImage(job.service_type)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-black/5 dark:bg-black/10" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[18px] font-black leading-tight text-zinc-900 dark:text-white">{title}</span>
                              <span className={discoverHomeMobileMetaPillClass}>
                                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[16px] font-bold leading-tight text-zinc-600 dark:text-white/80">{loc}</p>

                            <div className="mt-1.5 flex items-center gap-2.5">
                              <span className="text-[14px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                                {job.acceptedCount} accepted
                              </span>

                              {avatars.length > 0 && (
                                <div className="flex -space-x-2 overflow-hidden">
                                  {avatars.slice(0, 3).map((avatar: any, idx: number) => (
                                    <Avatar key={avatar.id || idx} className="h-7 w-7 border-none shadow-md ring-2 ring-zinc-200/90 dark:ring-black/20">
                                      {avatar.photo_url ? (
                                        <AvatarImage src={avatar.photo_url} alt={avatar.full_name || ""} />
                                      ) : null}
                                      <AvatarFallback className="bg-zinc-200 text-[10px] font-black text-zinc-700 dark:bg-zinc-800 dark:text-white">
                                        {(avatar.full_name || "H").charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-white/70" aria-hidden />
                        </button>
                      );
                    })
                  ) : (
                    <div className={discoverHomeMobileEmptyRowClass}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-zinc-900 dark:text-white">No active requests</p>
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-white/70">Need help with something?</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(createRequestPath);
                        }}
                        className={discoverHomeMobileEmptyCtaClass}
                      >
                        Post now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Text phrase — below the my-requests card; extra top padding for breathing room */}
              <div className="w-full px-4 pt-8">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[1.375rem] font-black leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                      {HIRE.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      writeDiscoverHomeIntent("work");
                    }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-all active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-white/5 shadow-sm"
                  >
                    Help others?
                    <ChevronRight className="-mr-0.5 h-4 w-4 opacity-70" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mx-auto mt-5 w-full max-w-md px-4 pb-2">
                <DiscoverHomeLiveHelperCards
                  helpers={liveHelpersForCards}
                  loading={liveAvatarsPending}
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

                <h3 className="mt-3 px-4 pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  Live help
                </h3>
                <div className="mt-0 flex justify-center">
                  <div className="w-full max-w-md">
                  {liveHelpingJobs.filter((j) => !dismissedLiveJobIds.includes(j.id)).length > 0 ? (
                    liveHelpingJobs
                      .filter((j) => !dismissedLiveJobIds.includes(j.id))
                      .slice(0, 1)
                      .map((job: any) => {
                        const client = liveHelpingProfiles.get(job.client_id);
                        const title = formatJobTitle(job);
                        const loc = (job.location_city ?? "").trim() || "Location not set";
                        const clientName = client?.full_name || "Client";

                        return (
                          <button
                            key={job.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${explorePath}?mode=work&tab=live_help`);
                            }}
                            className={cn(discoverHomeMobilePromoRowClass, "pointer-events-auto")}
                          >
                            <div className={discoverHomeMobileThumbClass}>
                              <img
                                src={getServiceCategoryImage(job.service_type)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-black/5 dark:bg-black/10" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[18px] font-black leading-tight text-zinc-900 dark:text-white">{title}</span>
                                <span className={discoverHomeMobileMetaPillClass}>
                                  matched {formatMatchedAgoDaysOrHours(job.created_at)}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-[16px] font-bold leading-tight text-zinc-600 dark:text-white/80">{loc}</p>

                              <div className="mt-2 flex items-center gap-3">
                                <span className="flex items-center gap-1 text-[14px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                                  Helping {clientName}
                                </span>

                                {client?.photo_url && (
                                  <Avatar className="h-7 w-7 border-none shadow-md ring-2 ring-zinc-200/90 dark:ring-black/20">
                                    <AvatarImage src={client.photo_url} alt={clientName} />
                                    <AvatarFallback className="bg-zinc-200 text-[10px] font-black text-zinc-700 dark:bg-zinc-800 dark:text-white">
                                      {clientName.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-white/70" aria-hidden />
                          </button>
                        );
                      })
                  ) : (
                    <div className={discoverHomeMobileEmptyRowClass}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-zinc-900 dark:text-white">No live help</p>
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-white/70">Find people who need help nearby</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToWorkBrowseRequests(navigate, profile);
                        }}
                        className={discoverHomeMobileEmptyCtaClass}
                      >
                        Find posts
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Text phrase — below the live-help card; extra top padding for breathing room */}
              <div className="w-full px-4 pt-8">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[1.375rem] font-black leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                      {workTheme.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      writeDiscoverHomeIntent("hire");
                    }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-all active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-white/5 shadow-sm"
                  >
                    Need help?
                    <ChevronRight className="-mr-0.5 h-4 w-4 opacity-70" aria-hidden />
                  </button>
                </div>
              </div>

              <DiscoverHomePostedHelpRequests enabled={!isHire} className="w-full px-4 pt-6" />
            </div>
          )}
        </div>

        <section className="mt-10 px-0 md:px-4 pb-24">
          <h2 className="mb-4 px-4 text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            Our community live
          </h2>
          <ProfilePostsFeed limit={5} />
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
            <div className="flex min-h-0 min-w-0 flex-col gap-4">
              <section
                className={cn(
                  "relative mx-auto w-full max-w-full shrink-0 overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none",
                  "ring-1 ring-black/[0.06] ring-inset",
                )}
              >
                {renderHeroQuickActionsDesktop()}
                <div className={cn(heroInnerClassName, "md:h-full")}>
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
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <DiscoverHomeLiveHelperCards
                helpers={liveHelpersForCards}
                loading={liveAvatarsPending}
                className="min-w-0 px-0.5"
              />
            </div>
          ) : (
            <section
              className={cn(
                "relative mx-auto w-full max-w-full shrink-0 overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none",
                "ring-1 ring-black/[0.06] ring-inset",
              )}
            >
              {renderHeroQuickActionsDesktop()}
              {renderDesktopWorkLiveBadge()}
              <div className={cn(heroInnerClassName, "md:h-full")}>
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
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          {isHire ? (
            <div className="flex min-h-0 min-w-0 flex-col gap-2">
              <h3 className="shrink-0 px-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                My requests
              </h3>
            {acceptedRequests.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                {acceptedRequests.map((job: any) => {
                  const avatars = frData?.confirmedHelperAvatarsByJobId?.[job.id] ?? [];
                  const title = formatJobTitle(job);
                  const loc = (job.location_city ?? "").trim() || "Location not set";
                  
                  return (
                    <div
                      key={job.id}
                      className="flex flex-col gap-4 rounded-[24px] bg-zinc-50 border border-zinc-200/80 dark:bg-zinc-900 dark:border-zinc-800 p-5 shadow-sm text-left transition-all hover:shadow-md h-full justify-between"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
                          Your posted request
                        </span>
                      </div>

                      <div className="flex gap-5">
                        {/* Desktop Category Image */}
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 ring-1 ring-black/5 dark:ring-white/10">
                          <img
                            src={getServiceCategoryImage(job.service_type)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1">
                            <span className="text-[17px] font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{title}</span>
                            <span className="text-[13px] font-medium text-muted-foreground">{loc}</span>
                            <span className="text-[11px] font-medium text-muted-foreground/80 mt-1">
                              posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          
                          <div className="mt-4 flex items-center gap-3 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              {job.acceptedCount} accepted
                            </span>
                            
                            {avatars.length > 0 && (
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {avatars.slice(0, 3).map((avatar: any, idx: number) => (
                                  <Avatar key={avatar.id || idx} className="h-7 w-7 border-2 border-white dark:border-zinc-900 shadow-sm">
                                    {avatar.photo_url ? (
                                      <AvatarImage src={avatar.photo_url} alt={avatar.full_name || ""} />
                                    ) : null}
                                    <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                      {(avatar.full_name || "H").charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/client/jobs/${job.id}/live`)}
                        className="w-full h-11 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
                      >
                        Open Live Job
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-200/80 bg-zinc-50/50 px-4 py-10 text-center text-sm text-muted-foreground shadow-sm dark:border-zinc-800 dark:bg-zinc-900/30 flex items-center justify-center">
                No active requests.
              </div>
            )}
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-col gap-2">
              <h3 className="shrink-0 px-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Live help
              </h3>
            {liveHelpingJobs.filter(j => !dismissedLiveJobIds.includes(j.id)).length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                {liveHelpingJobs
                  .filter(j => !dismissedLiveJobIds.includes(j.id))
                  .slice(0, 1)
                  .map((job: any) => {
                    const client = liveHelpingProfiles.get(job.client_id);
                    const title = formatJobTitle(job);
                    const loc = (job.location_city ?? "").trim() || "Location not set";
                    const clientName = client?.full_name || "Client";
                    
                    return (
                      <div
                        key={job.id}
                        className="flex flex-col gap-4 rounded-[24px] bg-zinc-50 border border-zinc-200/80 dark:bg-zinc-900 dark:border-zinc-800 p-5 shadow-sm text-left transition-all hover:shadow-md h-full justify-between"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
                            Live
                          </span>
                        </div>

                        <div className="flex gap-5">
                          {/* Desktop Category Image */}
                          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 ring-1 ring-black/5 dark:ring-white/10">
                            <img
                              src={getServiceCategoryImage(job.service_type)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="flex flex-1 flex-col gap-4">
                            <div className="flex items-center gap-3">
                              {client?.photo_url ? (
                                <Avatar className="h-12 w-12 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
                                  <AvatarImage src={client.photo_url} alt={clientName} />
                                  <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-sm font-bold">
                                    {clientName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold">
                                  {clientName.charAt(0)}
                                </div>
                              )}
                              
                              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                <span className="text-[17px] font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                                  {title}
                                </span>
                                <span className="text-[13px] font-medium text-muted-foreground truncate">
                                  {loc}
                                </span>
                                <span className="text-[11px] font-medium text-muted-foreground/80 mt-1">
                                  matched {formatMatchedAgoDaysOrHours(job.created_at)}
                                </span>
                              </div>
                            </div>

                            <div className="border-t border-zinc-200/50 dark:border-zinc-800/50 pt-3">
                              <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Helping {clientName}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`${explorePath}?mode=work&tab=live_help`)}
                          className="w-full h-11 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
                        >
                          Open live job
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-200/80 bg-zinc-50/50 px-4 py-10 text-center text-sm text-muted-foreground shadow-sm dark:border-zinc-800 dark:bg-zinc-900/30 flex items-center justify-center">
                No live jobs right now.
              </div>
            )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden pt-2 flex flex-col gap-2">
          <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
          {!isHire ? <DiscoverHomePostedHelpRequests enabled className="px-1 pt-1" /> : null}
          <DiscoverHomeRecentActivity viewerRole={isHire ? "client" : "freelancer"} />
        </div>

        <section className="mt-8 pb-12">
          <h2 className="mb-4 text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            Our community live
          </h2>
          <ProfilePostsFeed limit={5} />
        </section>
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
