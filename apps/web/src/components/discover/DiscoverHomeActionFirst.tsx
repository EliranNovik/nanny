import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Clock,
  PlayCircle,
  PenLine,
  Radio,
  Search,
  UsersRound,
  Wifi,
  Zap,
  BadgeCheck,
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
  badge: "POSTS NEAR YOU",
  title: "People need help right now.",
  sub: "Go live and get requests instantly in your area.",
  primary: "Go live now",
} as const;

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

  const acceptedRequests = useMemo(() => {
    const jobs = frData?.myOpenRequests ?? [];
    return jobs.filter((j: any) => (j.acceptedCount || 0) > 0).slice(0, 1);
  }, [frData]);

  const [liveHelpingJobs, setLiveHelpingJobs] = useState<any[]>([]);
  const [liveHelpingProfiles, setLiveHelpingProfiles] = useState<Map<string, any>>(new Map());
  const [dismissedLiveJobIds, setDismissedLiveJobIds] = useState<string[]>([]);

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

  /** Smooth shadow pulse on the colored tiles (`box-shadow`, no ::before layering). */
  const postLivePulseClass = "";
  const goLivePulseClass = "";

  /** Mobile: three equal shortcut tiles above BottomNav — same destinations as the old actions dialog. */
  function renderQuickActionDockMobile() {
    const bottomOffset =
      "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)]";
    const badgeClass =
      "absolute -right-1 -top-1 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums text-white shadow-md bg-red-500 ring-2 ring-white";

    const boxClass = cn(
      "relative flex min-h-[6.5rem] flex-1 min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2.5",
      "bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.14)] transition-transform active:scale-[0.96]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "dark:border-white/10 dark:bg-zinc-800/95 dark:text-zinc-100",
      "border-slate-200/90",
    );

    if (isHire) {
      return (
        <div
          className={cn(
            "pointer-events-auto fixed inset-x-0 z-[140] md:hidden",
            bottomOffset,
          )}
        >
          <div className="mx-auto flex w-full max-w-lg gap-2 px-3">
            <button
              type="button"
              onClick={() => {
                trackEvent("discover_actions_browse_helpers", { mode: homeMode });
                navigateToHelpersBrowse(navigate);
              }}
              className={boxClass}
              aria-label={`Find helpers${
                hireLiveHelperCount > 0 ? ` (${hireLiveHelperCount} live)` : ""
              }`}
            >
              <Search
                className="h-8 w-8 text-[#7B61FF]"
                strokeWidth={2.6}
                aria-hidden
              />
              <span className="text-center text-[13px] font-black uppercase leading-none tracking-[0.09em]">
                Find helpers
              </span>
              {hireLiveHelperCount > 0 ? (
                <span className={badgeClass}>
                  {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                trackEvent("discover_actions_post_request", { mode: homeMode });
                writeDiscoverHomeIntent("hire");
                navigate(createRequestPath);
                recordFirstMeaningfulAction("home_primary_create_request");
              }}
              className={cn(
                boxClass,
                postLivePulseClass,
                "border-transparent bg-[#7B61FF] text-white",
              )}
              aria-label="Post live"
            >
              <PenLine
                className="h-8 w-8 text-white"
                strokeWidth={2.6}
                aria-hidden
              />
              <span className="text-center text-[13px] font-black uppercase leading-snug tracking-[0.08em]">
                Post live
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMyRequestsOpen(true)}
              className={boxClass}
              aria-label={`My requests${
                myRequestsCount > 0 ? ` (${myRequestsCount})` : ""
              }`}
            >
              <ClipboardList
                className="h-8 w-8 text-[#7B61FF]"
                strokeWidth={2.6}
                aria-hidden
              />
              <span className="text-center text-[13px] font-black uppercase leading-none tracking-[0.09em]">
                Requests
              </span>
              {myRequestsCount > 0 ? (
                <span className={badgeClass}>
                  {myRequestsCount > 9 ? "9+" : myRequestsCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "pointer-events-auto fixed inset-x-0 z-[140] md:hidden",
          bottomOffset,
        )}
      >
        <div className="mx-auto flex w-full max-w-lg gap-2 px-3">
          <button
            type="button"
            onClick={() => {
              trackEvent("discover_actions_browse_requests", { mode: homeMode });
              navigateToWorkBrowseRequests(navigate, profile);
            }}
            className={boxClass}
            aria-label={`Find posts${
              workLivePostCount > 0 ? ` (${workLivePostCount})` : ""
            }`}
          >
            <UsersRound
              className="h-8 w-8 text-emerald-600"
              strokeWidth={2.6}
              aria-hidden
            />
            <span className="text-center text-[13px] font-black uppercase leading-none tracking-[0.09em]">
              Find posts
            </span>
            {workLivePostCount > 0 ? (
              <span className={badgeClass}>
                {workLivePostCount > 99 ? "99+" : workLivePostCount}
              </span>
            ) : null}
          </button>
          {isInActive24hGoLiveWindow ? null : (
            <button
              type="button"
              onClick={() => {
                trackEvent("discover_actions_go_live", { mode: homeMode });
                writeDiscoverHomeIntent("work");
                navigate(workPrimaryPath);
                recordFirstMeaningfulAction("home_primary_work");
              }}
              className={cn(
                boxClass,
                goLivePulseClass,
                "border-transparent bg-emerald-600 text-white",
              )}
              aria-label="Go live"
            >
              <PlayCircle
                className="h-8 w-8 text-white"
                strokeWidth={2.6}
                aria-hidden
              />
              <span className="text-center text-[13px] font-black uppercase leading-none tracking-[0.09em]">
                Go live
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setPendingWorkRequestsOpen(true)}
            className={boxClass}
            aria-label={`Pending${
              pendingWorkRequestsCount > 0 ? ` (${pendingWorkRequestsCount})` : ""
            }`}
          >
            <Clock
              className="h-8 w-8 text-emerald-600"
              strokeWidth={2.6}
              aria-hidden
            />
            <span className="text-center text-[13px] font-black uppercase leading-none tracking-[0.09em]">
              Pending
            </span>
            {pendingWorkRequestsCount > 0 ? (
              <span className={badgeClass}>
                {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
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
              postLivePulseClass,
              "border-transparent bg-[#7B61FF]/95 text-white ring-[#7B61FF]/35 hover:bg-[#7B61FF]",
            )}
            aria-label="Post live"
          >
            <PenLine className="h-6 w-6 text-white" strokeWidth={2.6} aria-hidden />
            <span className="text-[12px] font-black uppercase leading-snug tracking-wide">
              Post live
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
              Requests
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
              goLivePulseClass,
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
        <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
          </span>
          <span>Live</span>
          {liveRemainingLabel ? (
            <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-black tabular-nums tracking-wide">
              {liveRemainingLabel}
            </span>
          ) : null}
        </div>
      </div>
    );
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
      {renderQuickActionDockMobile()}
      {/* ===== MOBILE ONLY LAYOUT ===== */}
      <div className="flex flex-1 md:hidden flex-col gap-0 pb-[5rem]">
        <div className="shrink-0 pt-0 px-1">
          <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
        </div>

        <div className="shrink-0 mt-3 flex flex-col px-2 pb-6">
          {isHire ? (
            <div className="flex flex-col">
              <section className="relative flex flex-col w-full shrink-0 overflow-hidden rounded-[24px] ring-1 ring-black/10 shadow-md min-h-[12rem]">
                <img
                  src="/pexels-rdne-6646861.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  loading="eager"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/60" />
                
                {/* Badge — Back INSIDE at the top left */}
                <div className="absolute left-3 top-3 z-[10] inline-flex items-center gap-1.5 rounded-full bg-white/25 backdrop-blur-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm ring-1 ring-inset ring-white/10">
                  <Zap className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
                  <span className="truncate">{HIRE.badge}</span>
                </div>
                
                {/* Active cards - Back INSIDE the image box at the bottom */}
                {acceptedRequests.length > 0 ? (
                  <div className="absolute inset-x-0 bottom-0 z-[5] p-3">
                    {acceptedRequests.slice(0, 1).map((job: any) => {
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
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-black/45 p-3 text-left shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20 transition-all active:scale-[0.98]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-bold text-white truncate">{title}</span>
                              <span className="text-[11px] font-medium text-white/60">•</span>
                              <span className="text-[12px] font-semibold text-white/80 truncate">{loc}</span>
                            </div>
                            
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                {job.acceptedCount} accepted
                              </span>
                              
                              {avatars.length > 0 && (
                                <div className="flex -space-x-1.5 overflow-hidden">
                                  {avatars.slice(0, 3).map((avatar: any, idx: number) => (
                                    <Avatar key={avatar.id || idx} className="h-5 w-5 border-none shadow-sm">
                                      {avatar.photo_url ? (
                                        <AvatarImage src={avatar.photo_url} alt={avatar.full_name || ""} />
                                      ) : null}
                                      <AvatarFallback className="bg-zinc-800 text-[9px] font-bold text-white">
                                        {(avatar.full_name || "H").charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="absolute inset-x-0 bottom-0 z-[5] p-3">
                    <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-black/45 p-3 text-left shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-white">No active requests</p>
                        <p className="text-[11px] font-medium text-white/70">Need help with something?</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(createRequestPath);
                        }}
                        className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white hover:bg-white/30 transition-colors"
                      >
                        Post now
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Text phrase — BELOW the image */}
              <div className="w-full px-1 pt-4">
                <div className="min-w-0">
                  <h2 className="text-[1.375rem] font-black leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                    {HIRE.title}
                  </h2>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <section className="relative flex flex-col w-full shrink-0 overflow-hidden rounded-[24px] ring-1 ring-black/10 shadow-md min-h-[12rem]">
                <img
                  src="/pexels-tima-miroshnichenko-6197046.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  loading="eager"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/60" />

                {/* Badge — Back INSIDE at the top left */}
                <div className="absolute left-3 top-3 z-[10] inline-flex items-center gap-1.5 rounded-full bg-white/25 backdrop-blur-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm ring-1 ring-inset ring-white/10">
                  <Wifi className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
                  <span className="truncate">{workTheme.badge}</span>
                </div>

                {/* Primary action (middle button) — top right */}
                <div className="pointer-events-auto absolute right-3 top-3 z-[10] flex flex-col items-center gap-1.5">
                  {isInActive24hGoLiveWindow ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                        <span className="relative block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
                      </span>
                      <span>Live</span>
                      {liveRemainingLabel ? (
                        <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-black tabular-nums tracking-wide">
                          {liveRemainingLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackEvent("discover_hero_go_live_corner", { mode: homeMode });
                        writeDiscoverHomeIntent("work");
                        navigate(workPrimaryPath);
                        recordFirstMeaningfulAction("home_primary_work");
                      }}
                      className={cn(
                        "group flex h-10 w-10 items-center justify-center rounded-full border shadow-2xl transition-all duration-300",
                        "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                        "border-white/45 bg-white/25 text-white backdrop-blur-2xl ring-1 ring-inset ring-white/30",
                        "hover:bg-white/30",
                      )}
                      aria-label="Go live"
                    >
                      <PlayCircle className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
                    </button>
                  )}
                </div>

                {/* Active cards - Back INSIDE at the bottom */}
                {liveHelpingJobs.filter(j => !dismissedLiveJobIds.includes(j.id)).length > 0 ? (
                  <div className="absolute inset-x-0 bottom-0 z-[5] p-3">
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
                            className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl bg-black/45 p-3 shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20 text-left"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`${explorePath}?mode=work&tab=live_help`);
                              }}
                              className="min-w-0 flex-1 flex items-center justify-between gap-3 text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-bold text-white truncate">{title}</span>
                                  <span className="text-[11px] font-medium text-white/60">•</span>
                                  <span className="text-[12px] font-semibold text-white/80 truncate">{loc}</span>
                                </div>
                                
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                    Helping {clientName}
                                  </span>
                                  
                                  {client?.photo_url && (
                                    <Avatar className="h-5 w-5 border-none shadow-sm">
                                      <AvatarImage src={client.photo_url} alt={clientName} />
                                      <AvatarFallback className="bg-zinc-800 text-[9px] font-bold text-white">
                                        {clientName.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                            </button>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDismissedLiveJobIds(prev => [...prev, job.id]);
                              }}
                              className="p-1 rounded-full hover:bg-white/10 text-white/60"
                              aria-label="Dismiss"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="absolute inset-x-0 bottom-0 z-[5] p-3">
                    <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-black/45 p-3 text-left shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-white">No live help</p>
                        <p className="text-[11px] font-medium text-white/70">Find people who need help nearby</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToWorkBrowseRequests(navigate, profile);
                        }}
                        className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white hover:bg-white/30 transition-colors"
                      >
                        Find posts
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Text phrase — BELOW the image */}
              <div className="w-full px-1 pt-4">
                <div className="min-w-0">
                  <h2 className="text-[1.375rem] font-black leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                    {workTheme.title}
                  </h2>
                </div>
              </div>
            </div>
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
            acceptedRequests.length > 0 ? (
              <div className="flex flex-col gap-3">
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
            )
          ) : (
            liveHelpingJobs.filter(j => !dismissedLiveJobIds.includes(j.id)).length > 0 ? (
              <div className="flex flex-col gap-3">
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
                              matched {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-zinc-200/50 dark:border-zinc-800/50 pt-3">
                          <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Helping {clientName}
                          </span>
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
            )
          )}
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
