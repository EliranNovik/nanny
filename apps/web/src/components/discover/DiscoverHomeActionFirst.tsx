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
          .select("id, full_name, photo_url")
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

  const liveRemainingLabel = useMemo(() => {
    if (!isWorkLive || liveUntilMs == null) return null;
    const liveRemainingMs = Math.max(0, liveUntilMs - nowMs);
    const totalSeconds = Math.floor(liveRemainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    if (hours > 0) return `${hours}:${mm}:${ss}`;
    return `${minutes}:${ss}`;
  }, [isWorkLive, liveUntilMs, nowMs]);

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

  const liveCategoriesLabel = useMemo(() => {
    if (!isWorkLive) return null;
    const ids = (profile as { categories?: unknown } | null)?.categories;
    if (!Array.isArray(ids)) return null;
    const labels = ids
      .map((v) => String(v))
      .filter((id) => isServiceCategoryId(id))
      .map((id) => DISCOVER_HOME_CATEGORIES.find((c) => c.id === id)?.label || id.replace(/_/g, " "))
      .filter((s) => Boolean(String(s).trim()));
    if (labels.length === 0) return null;
    return labels.slice(0, 3).join(" · ");
  }, [isWorkLive, profile]);

  const myRequestsCount = useMemo(() => {
    return (frData?.myOpenRequests ?? []).length;
  }, [frData]);

  const pendingWorkRequestsCount = useMemo(() => {
    return (frData?.inboundNotifications ?? []).filter((n) =>
      Boolean(n.isConfirmed),
    ).length;
  }, [frData]);

  function renderFixedBottomBrowseDock() {
    const bottomOffset =
      "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]";

    const cardBtnBase = cn(
      "group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all duration-300",
      "w-[9rem] h-[4.75rem]",
      "active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "shadow-[0_12px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl",
    );

    const hireCard = cn(
      "border-[#7B61FF]/30 bg-white/90 text-slate-900",
      "dark:border-transparent dark:bg-zinc-800/80 dark:text-zinc-100",
      "hover:border-[#7B61FF]/60 dark:hover:border-transparent",
    );

    const workCard = cn(
      "border-emerald-500/30 bg-white/90 text-slate-900",
      "dark:border-transparent dark:bg-zinc-800/80 dark:text-zinc-100",
      "hover:border-emerald-500/60 dark:hover:border-transparent",
    );

    const countBadge = cn(
      "absolute -right-1.5 -top-1.5 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums text-white shadow-sm",
      "bg-red-500",
    );

    return (
      <div
        className={cn(
          "pointer-events-auto fixed inset-x-0 z-[140] md:hidden",
          bottomOffset,
          "flex justify-center",
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
                className={cn(cardBtnBase, hireCard)}
                aria-label="Browse helpers"
              >
                <Search className="h-6 w-6 text-[#7B61FF] dark:text-[#A78BFA]" strokeWidth={2.5} aria-hidden />
                <span className="text-[13px] font-bold tracking-tight">Browse Helpers</span>
                {hireLiveHelperCount > 0 && (
                  <span className={countBadge}>
                    {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                  </span>
                )}
              </button>

              {/* My Requests */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMyRequestsOpen(true);
                }}
                className={cn(cardBtnBase, hireCard)}
                aria-label="My Requests"
              >
                <ClipboardList className="h-6 w-6 text-[#7B61FF] dark:text-[#A78BFA]" strokeWidth={2.5} aria-hidden />
                <span className="text-[13px] font-bold tracking-tight">My Requests</span>
                {myRequestsCount > 0 && (
                  <span className={countBadge}>
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
                className={cn(cardBtnBase, workCard)}
                aria-label="Browse user requests"
              >
                <UsersRound className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
                <span className="text-[13px] font-bold tracking-tight">Browse Posts</span>
                {workLivePostCount > 0 && (
                  <span className={countBadge}>
                    {workLivePostCount > 99 ? "99+" : workLivePostCount}
                  </span>
                )}
              </button>

              {/* Pending Requests */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingWorkRequestsOpen(true);
                }}
                className={cn(cardBtnBase, workCard)}
                aria-label="Pending Requests"
              >
                <Clock className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
                <span className="text-[13px] font-bold tracking-tight">Pending</span>
                {pendingWorkRequestsCount > 0 && (
                  <span className={countBadge}>
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
            <section className="relative flex flex-col w-full flex-1 overflow-hidden ring-1 ring-black/10 shadow-sm min-h-[24rem]">
              <img
                src="/pexels-rdne-6646861.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-top"
                loading="eager"
                decoding="async"
                {...{ fetchpriority: "high" }}
              />
              {/* Dark overlay on top for badge + title */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />

              {/* Primary action (middle button) — top right */}
              <div className="pointer-events-auto absolute right-4 top-4 z-[10] flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackEvent("discover_hero_post_request_corner", { mode: homeMode });
                    writeDiscoverHomeIntent("hire");
                    navigate(createRequestPath);
                    recordFirstMeaningfulAction("home_primary_create_request");
                  }}
                  className={cn(
                    "group flex h-12 w-12 items-center justify-center rounded-full border shadow-2xl transition-all duration-300",
                    "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "border-white/45 bg-white/25 text-white backdrop-blur-2xl ring-1 ring-inset ring-white/30",
                    "hover:bg-white/30",
                  )}
                  aria-label="Post a request"
                >
                  <PlusCircle className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
                </button>
              </div>

              {/* Badge + title — pinned to the top of the image */}
              <div className="relative z-[2] w-full p-6 pt-6">
                <div className="min-w-0">
                  <div className={cn(mobileHeroBadgeClass, "mb-3")}>
                    <Zap className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                    <span className="truncate">{HIRE.badge}</span>
                  </div>
                  <h2 className={mobileHeroTitleClass}>{HIRE.title}</h2>
                  
                  {acceptedRequests.length > 0 && (
                    <div className="mt-10 flex flex-col gap-2">
                      {acceptedRequests.map((job: any) => {
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
                            className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-black/40 p-3 shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20 text-left transition-all hover:bg-black/50 active:scale-[0.98]"
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
                                
                                {/* Avatars */}
                                {avatars.length > 0 && (
                                  <div className="flex -space-x-1.5 overflow-hidden">
                                    {avatars.slice(0, 3).map((avatar: any, idx: number) => (
                                      <Avatar key={avatar.id || idx} className="h-6 w-6 border-none shadow-sm">
                                        {avatar.photo_url ? (
                                          <AvatarImage src={avatar.photo_url} alt={avatar.full_name || ""} />
                                        ) : null}
                                        <AvatarFallback className="bg-zinc-800 text-[10px] font-bold text-white">
                                          {(avatar.full_name || "H").charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <ChevronRight className="h-5 w-5 shrink-0 text-white/60" aria-hidden />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </section>
          ) : (
            <section className="relative flex flex-col w-full flex-1 overflow-hidden ring-1 ring-black/10 shadow-sm min-h-[24rem]">
              <img
                src="/pexels-tima-miroshnichenko-6197046.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-top"
                loading="eager"
                decoding="async"
                {...{ fetchpriority: "high" }}
              />
              {/* Dark overlay on top for badge + title */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />

              {/* Primary action (middle button) — top right */}
              <div className="pointer-events-auto absolute right-4 top-4 z-[10] flex flex-col items-center gap-1.5">
                {isWorkLive ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-[12px] font-black uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                      <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
                    </span>
                    <span>Live</span>
                    {liveRemainingLabel ? (
                      <span className="rounded-full bg-white/15 px-2 py-1 text-[12px] font-black tabular-nums tracking-wide">
                        {liveRemainingLabel}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <>
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
                      "group flex h-12 w-12 items-center justify-center rounded-full border shadow-2xl transition-all duration-300",
                      "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "border-white/45 bg-white/25 text-white backdrop-blur-2xl ring-1 ring-inset ring-white/30",
                      "hover:bg-white/30",
                    )}
                    aria-label="Go live"
                  >
                    <PlayCircle className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
                  </button>
                  </>
                )}
              </div>

              {/* Badge + title — pinned to the top of the image */}
              <div className="relative z-[2] w-full p-6 pt-6">
                <div className="min-w-0">
                  <div className={cn(mobileHeroBadgeClass, "mb-3")}>
                    <Wifi className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                    <span className="truncate">{workTheme.badge}</span>
                  </div>
                  <h2 className={mobileHeroTitleClass}>{workTheme.title}</h2>

                  
                  {liveHelpingJobs.filter(j => !dismissedLiveJobIds.includes(j.id)).length > 0 && (
                    <div className="mt-10 flex flex-col gap-2">
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
                              className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-black/40 p-3 shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20 text-left"
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
                                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                      Helping {clientName}
                                    </span>
                                    
                                    {client?.photo_url && (
                                      <Avatar className="h-6 w-6 border-none shadow-sm">
                                        <AvatarImage src={client.photo_url} alt={clientName} />
                                        <AvatarFallback className="bg-zinc-800 text-[10px] font-bold text-white">
                                          {clientName.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                                
                                <ChevronRight className="h-5 w-5 shrink-0 text-white/60" aria-hidden />
                              </button>
                              
                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDismissedLiveJobIds(prev => [...prev, job.id]);
                                }}
                                className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                aria-label="Dismiss"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
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
                      {/* Desktop — 3 round icon actions inside the hero image */}
                      <div className="absolute right-6 top-6 z-[12] flex items-start gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[12px] font-black tracking-tight text-white drop-shadow-sm">
                            Browse
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackEvent("discover_desktop_hero_browse_helpers", { mode: homeMode });
                              navigateToHelpersBrowse(navigate);
                            }}
                            className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/25 transition-all hover:bg-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="Browse helpers"
                          >
                            <Search className="h-7 w-7" strokeWidth={2.5} aria-hidden />
                            {hireLiveHelperCount > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 text-[11px] font-black tabular-nums text-white shadow-sm">
                                {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                              </span>
                            ) : null}
                          </button>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[12px] font-black tracking-tight text-white drop-shadow-sm">
                            Post
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackEvent("discover_desktop_hero_post_request_icon", { mode: homeMode });
                              writeDiscoverHomeIntent("hire");
                              navigate(createRequestPath);
                              recordFirstMeaningfulAction("home_primary_create_request");
                            }}
                            className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/25 transition-all hover:bg-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="Post a request"
                          >
                            <PlusCircle className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
                          </button>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[12px] font-black tracking-tight text-white drop-shadow-sm">
                            My
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMyRequestsOpen(true);
                            }}
                            className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/25 transition-all hover:bg-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="My Requests"
                          >
                            <ClipboardList className="h-7 w-7" strokeWidth={2.25} aria-hidden />
                            {myRequestsCount > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 text-[11px] font-black tabular-nums text-white shadow-sm">
                                {myRequestsCount > 9 ? "9+" : myRequestsCount}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </div>

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
                      {/* Desktop — 3 round icon actions inside the hero image */}
                      <div className="absolute right-6 top-6 z-[12] flex items-start gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[12px] font-black tracking-tight text-white drop-shadow-sm">
                            Browse
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackEvent("discover_desktop_hero_browse_requests", { mode: homeMode });
                              navigateToWorkBrowseRequests(navigate, profile);
                            }}
                            className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/25 transition-all hover:bg-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="Browse user requests"
                          >
                            <UsersRound className="h-7 w-7" strokeWidth={2.5} aria-hidden />
                            {workLivePostCount > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 text-[11px] font-black tabular-nums text-white shadow-sm">
                                {workLivePostCount > 99 ? "99+" : workLivePostCount}
                              </span>
                            ) : null}
                          </button>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[12px] font-black tracking-tight text-white drop-shadow-sm">
                            Live
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackEvent("discover_desktop_hero_go_live_icon", { mode: homeMode });
                              writeDiscoverHomeIntent("work");
                              navigate(workPrimaryPath);
                              recordFirstMeaningfulAction("home_primary_work");
                            }}
                            className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/25 transition-all hover:bg-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="Go live"
                          >
                            <PlayCircle className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
                          </button>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[12px] font-black tracking-tight text-white drop-shadow-sm">
                            Pending
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingWorkRequestsOpen(true);
                            }}
                            className="group flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-white/25 transition-all hover:bg-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="Pending requests"
                          >
                            <Clock className="h-7 w-7" strokeWidth={2.5} aria-hidden />
                            {pendingWorkRequestsCount > 0 ? (
                              <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 text-[11px] font-black tabular-nums text-white shadow-sm">
                                {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </div>

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
