import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  PlayCircle,
  PlusCircle,
  Search,
  UsersRound,
  Wifi,
  Zap,
} from "lucide-react";
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
  const { data: frData } = useFreelancerRequests(
    !isHire && user?.id ? user.id : undefined,
  );
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

  function renderFixedBottomBrowseDock() {
    const bottomOffset = "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]";
    const pillBtn = cn(
      "group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4",
      "border shadow-md transition-[transform,box-shadow,background-color,border-color] active:scale-[0.99] motion-reduce:transition-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    );

    return (
      <>
        {/* Mobile: full-width dock bar */}
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 z-[140] md:hidden",
            bottomOffset,
          )}
          aria-hidden
        >
          <div
            className={cn(
              "pointer-events-auto border-t border-slate-200/80 bg-background/95 px-4 pb-2 pt-3",
              "shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.1)] backdrop-blur-md dark:border-white/10",
            )}
          >
            <div className="mx-auto w-full max-w-lg">
              {isHire ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackEvent("discover_bottom_browse_helpers", { mode: homeMode });
                    navigateToHelpersBrowse(navigate);
                  }}
                  className={cn(
                    pillBtn,
                    "h-12 w-full justify-between",
                    "border-slate-200/80 bg-slate-100 text-slate-800",
                    "hover:bg-slate-100/80 hover:shadow-lg",
                    "focus-visible:ring-[#7B61FF]/35",
                  )}
                  aria-label="Browse helpers"
                >
                  <Search className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                  <span className="inline-flex min-w-0 max-w-[min(100%,12rem)] flex-1 items-center justify-center gap-1.5">
                    <span className="truncate text-[14px] font-extrabold tracking-tight">
                      Browse helpers
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums",
                        hireLiveHelperCount > 0
                          ? "bg-[#7B61FF]/15 text-[#4c1d95] dark:bg-[#7B61FF]/25 dark:text-violet-100"
                          : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-400",
                      )}
                      aria-label={`${hireLiveHelperCount} live helpers`}
                    >
                      {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      discoverIcon.sm,
                      "shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600",
                      "group-hover:animate-bounce motion-reduce:group-hover:animate-none",
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </button>
              ) : (
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
                    pillBtn,
                    "h-12 w-full justify-between",
                    "border-slate-200/80 bg-slate-100 text-slate-800",
                    "hover:bg-slate-100/80 hover:shadow-lg",
                    "focus-visible:ring-emerald-400/35",
                  )}
                  aria-label="Browse users requests"
                >
                  <UsersRound className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                  <span className="inline-flex min-w-0 max-w-[min(100%,14rem)] flex-1 items-center justify-center gap-1.5">
                    <span className="truncate text-[14px] font-extrabold tracking-tight">
                      Browse users requests
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums",
                        workLivePostCount > 0
                          ? "bg-emerald-600/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100"
                          : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-400",
                      )}
                      aria-label={`${workLivePostCount} live posts`}
                    >
                      {workLivePostCount > 99 ? "99+" : workLivePostCount}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      discoverIcon.sm,
                      "shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600",
                      "group-hover:animate-bounce motion-reduce:group-hover:animate-none",
                    )}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop: single pill, bottom-right — aligned with bottom nav row, no backing bar */}
        <div
          className={cn(
            "pointer-events-auto fixed z-[140] hidden md:block",
            bottomOffset,
            "right-[max(1rem,env(safe-area-inset-right,0px))]",
          )}
        >
          {isHire ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("discover_bottom_browse_helpers", { mode: homeMode });
                navigateToHelpersBrowse(navigate);
              }}
              className={cn(
                pillBtn,
                "border-[#5b49c4]/90 bg-[#7B61FF] text-white shadow-sm",
                "hover:bg-[#6d56ea] hover:border-[#4f3eb0] hover:shadow-md",
                "dark:border-violet-300/35 dark:bg-[#7B61FF] dark:text-white dark:hover:bg-[#6d56ea]",
                "focus-visible:ring-[#7B61FF]/55",
              )}
              aria-label="Browse helpers"
            >
              <Search className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
              <span className="inline-flex min-w-0 max-w-[10rem] items-center gap-1.5 sm:max-w-none">
                <span className="truncate text-[13px] font-extrabold tracking-tight text-white sm:text-[14px]">
                  Browse helpers
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums text-white",
                    hireLiveHelperCount > 0 ? "bg-white/25" : "bg-white/15 text-white/80",
                  )}
                  aria-label={`${hireLiveHelperCount} live helpers`}
                >
                  {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  discoverIcon.sm,
                  "shrink-0 text-white/85 transition group-hover:translate-x-0.5 group-hover:text-white",
                )}
                strokeWidth={2.25}
                aria-hidden
              />
            </button>
          ) : (
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
                pillBtn,
                "border-emerald-700/60 bg-emerald-600 text-white shadow-sm",
                "hover:bg-emerald-500 hover:border-emerald-600 hover:shadow-md",
                "dark:border-emerald-400/35 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500",
                "focus-visible:ring-emerald-400/55",
              )}
              aria-label="Browse users requests"
            >
              <UsersRound className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
              <span className="inline-flex min-w-0 max-w-[14rem] items-center gap-1.5 sm:max-w-none">
                <span className="truncate text-[13px] font-extrabold tracking-tight text-white sm:text-[14px]">
                  Browse users requests
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums text-white",
                    workLivePostCount > 0 ? "bg-emerald-950/30" : "bg-emerald-950/20 text-emerald-100/90",
                  )}
                  aria-label={`${workLivePostCount} live posts`}
                >
                  {workLivePostCount > 99 ? "99+" : workLivePostCount}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  discoverIcon.sm,
                  "shrink-0 text-emerald-100/90 transition group-hover:translate-x-0.5 group-hover:text-white",
                )}
                strokeWidth={2.25}
                aria-hidden
              />
            </button>
          )}
        </div>
      </>
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

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden md:gap-5",
      )}
    >
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
            {renderFixedBottomBrowseDock()}

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
                        // Solid white (no glass blur)
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

                  {/* Trust chips removed per UX direction (keep hero focused). */}
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

            {renderFixedBottomBrowseDock()}

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
                          // White badge-style CTA (to match request)
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

      <div className="min-h-0 flex-1 overflow-hidden pt-0.5">
        <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
      </div>
    </div>
  );
}
