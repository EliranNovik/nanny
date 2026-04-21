import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Radio,
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
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import { DISCOVER_PRIMARY_HERO_IMAGES } from "@/components/discover/discoverHomeHeroImages";
import { recordFirstMeaningfulAction } from "@/lib/sessionConversionAnalytics";

type HomeMode = "hire" | "work";

type Props = {
  homeMode: HomeMode;
  explorePath: string;
  workPrimaryPath: string;
  createRequestPath: string;
};

const HIRE = {
  badge: "FAST & EASY",
  title: "Get help, fast.",
  sub: "Post a request and connect\nwith available helpers near you.",
  primary: "Start a request",
} as const;

const WORK = {
  badge: "JOBS NEAR YOU",
  title: "Get hired today.",
  sub: "Find people who need help right now in your area.",
  primary: "Go live now",
} as const;

/** Same stack + padding for both hire/work heroes; modest min-height keeps imagery balanced. */
const heroInnerClassName =
  "relative flex min-h-[12.75rem] flex-col sm:min-h-[15.5rem] md:min-h-[16rem]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-between px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-6 md:px-7 md:pb-7 md:pt-7";

const heroTopBlockClassName = "flex max-w-xl flex-col gap-3 md:gap-3.5";

const heroPrimaryCtaRowClassName =
  "mt-auto flex w-full shrink-0 justify-start pr-[6.75rem] pt-5 sm:pr-[7.25rem] sm:pt-6";

/** Primary hero CTAs — calm, product-grade (avoid loud “SaaS gradient” chrome). */
const heroCtaBaseClassName = cn(
  "group inline-flex h-11 w-fit min-w-[10.5rem] max-w-[min(100%,17rem)] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold tracking-normal sm:h-12 sm:min-w-[11.5rem] sm:px-6 sm:text-[15px]",
  "border shadow-sm transition-[transform,box-shadow,background-color,border-color] motion-reduce:transition-none",
  "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
);

/** Hire: deep violet solid — mirrors “Go live” weight; pairs with purple hero. */
const heroCtaStartRequestClassName = cn(
  heroCtaBaseClassName,
  "border-violet-900/45 bg-violet-950 text-white",
  "hover:border-violet-700/55 hover:bg-violet-900 hover:shadow-md",
  "focus-visible:ring-violet-300/70",
);

/** Work: deep emerald solid — distinct from hire, still native to the green hero. */
const heroCtaGoLiveClassName = cn(
  heroCtaBaseClassName,
  "border-emerald-800/40 bg-emerald-950 text-white",
  "hover:border-emerald-700/50 hover:bg-emerald-900 hover:shadow-md",
  "focus-visible:ring-emerald-300/70",
);

const heroTitleBlockClassName = "max-w-[17rem] space-y-1.5 pr-1 sm:max-w-[19rem]";

export function DiscoverHomeActionFirst({
  homeMode,
  explorePath,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isHire = homeMode === "hire";
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

  function renderHeroBrowseShortcut(hire: boolean) {
    const label = hire ? "Browse helpers" : "Find people in need";
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onBrowseRow();
        }}
        className={cn(
          "absolute bottom-3 right-3 z-20 flex max-w-[8.5rem] flex-col items-center gap-1.5 bg-transparent p-0 shadow-none sm:bottom-4 sm:right-4",
          "transition active:scale-[0.97] motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        )}
        aria-label={label}
      >
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg ring-2 ring-white/60",
            hire
              ? "bg-white text-[#5B3DD9]"
              : "bg-emerald-50 text-emerald-900 ring-emerald-100",
          )}
        >
          {hire ? (
            <Search className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          ) : (
            <UsersRound className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          )}
        </span>
        <span
          className={cn(
            "max-w-[7.5rem] text-center text-[11px] font-extrabold leading-snug tracking-tight text-white sm:max-w-[8rem] sm:text-[12px]",
            "[text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_14px_rgba(0,0,0,0.75)]",
          )}
        >
          {label}
        </span>
      </button>
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

  function onBrowseRow() {
    trackEvent("discover_browse_row", { mode: homeMode });
    if (isHire) {
      navigateToHelpersBrowse(navigate);
      return;
    }
    navigateToWorkBrowseRequests(navigate, profile);
  }

  const workTheme = WORK;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden md:gap-5",
      )}
    >
      {isHire ? (
        <section
          className={cn(
            "relative shrink-0 overflow-hidden rounded-[28px] text-left",
            "shadow-[0_12px_40px_-12px_rgba(91,61,232,0.35),0_2px_8px_rgba(15,23,42,0.08)]",
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

            {renderHeroBrowseShortcut(true)}

            <div className={heroStackClassName}>
              <div className={heroTopBlockClassName}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7B61FF] shadow-sm sm:px-3 sm:py-1.5">
                      <Zap
                        className={cn(discoverIcon.sm, "shrink-0")}
                        strokeWidth={DISCOVER_STROKE}
                        aria-hidden
                      />
                      {HIRE.badge}
                    </div>
                  </div>
                  <div className={cn(heroTitleBlockClassName, "mt-2")}>
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
              <div className={heroPrimaryCtaRowClassName}>
                <div className="flex w-full items-end justify-start gap-3">
                  <button
                    type="button"
                    onClick={onStartRequest}
                    className={heroCtaStartRequestClassName}
                  >
                    <ClipboardList
                      className="h-[1.05rem] w-[1.05rem] shrink-0 text-violet-100/95 sm:h-[1.125rem] sm:w-[1.125rem]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>{HIRE.primary}</span>
                    <ChevronRight
                      className={cn(
                        discoverIcon.sm,
                        "shrink-0 text-violet-100/70 transition group-hover:translate-x-px group-hover:text-violet-50",
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section
          className={cn(
            "relative shrink-0 overflow-hidden rounded-[28px] text-left",
            "shadow-[0_12px_40px_-12px_rgba(5,95,72,0.35),0_2px_8px_rgba(15,23,42,0.08)]",
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

            {renderHeroBrowseShortcut(false)}

            <div className={heroStackClassName}>
              <div className={heroTopBlockClassName}>
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#059669] shadow-sm sm:px-3 sm:py-1.5">
                  <Wifi
                    className={cn(discoverIcon.sm, "shrink-0")}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                  {workTheme.badge}
                </div>
                <div className={heroTitleBlockClassName}>
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
              <div className={heroPrimaryCtaRowClassName}>
                {isWorkLive ? (
                  <div className="flex w-full max-w-[min(100%,24rem)] items-center gap-3">
                    <div
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-full",
                        "bg-black/25 px-3 py-2 text-white shadow-lg backdrop-blur-xl",
                        "ring-1 ring-inset ring-white/15",
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
                    className={heroCtaGoLiveClassName}
                  >
                    <Radio
                      className="h-[1.05rem] w-[1.05rem] shrink-0 text-emerald-100/95 sm:h-[1.125rem] sm:w-[1.125rem]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>{workTheme.primary}</span>
                    <ChevronRight
                      className={cn(
                        discoverIcon.sm,
                        "shrink-0 text-emerald-100/70 transition group-hover:translate-x-px group-hover:text-emerald-50",
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-hidden pt-0.5">
        <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />
      </div>
    </div>
  );
}
