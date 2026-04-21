import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Search,
  Wifi,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { supabase } from "@/lib/supabase";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { LiveTimer } from "@/components/LiveTimer";
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
import {
} from "@/lib/discoverMatchPreferences";
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
  "relative flex min-h-[14.5rem] flex-col sm:min-h-[15.5rem] md:min-h-[16rem]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-between px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-6 md:px-7 md:pb-7 md:pt-7";

const heroTopBlockClassName = "flex max-w-xl flex-col gap-3 md:gap-3.5";

const heroPrimaryCtaRowClassName =
  "mt-auto flex w-full shrink-0 justify-start pt-5 sm:pt-6";

/** Primary CTA: intentionally narrower than the card; sits toward the bottom via heroPrimaryCtaRowClassName. */
const heroPrimaryButtonClassName = cn(
  "h-11 w-fit max-w-[min(100%,15rem)] rounded-xl border-0 px-5 text-[14px] font-bold sm:h-12 sm:max-w-[min(100%,16rem)] sm:rounded-2xl sm:px-6 sm:text-[15px]",
  "shadow-md transition-[transform,box-shadow] hover:bg-white hover:shadow-lg active:scale-[0.99]",
);

const heroTitleBlockClassName = "max-w-[17rem] space-y-1.5 pr-1 sm:max-w-[19rem]";

function formatRequestTitle(serviceType: string | null | undefined): string {
  const st = String(serviceType ?? "").trim();
  if (!st) return "Help request";
  if (st === "cleaning") return "Cleaning";
  if (st === "cooking") return "Cooking";
  if (st === "pickup_delivery") return "Pickup & Delivery";
  if (st === "nanny") return "Nanny";
  if (st === "other_help") return "Other Help";
  return st.replace(/_/g, " ");
}

export function DiscoverHomeActionFirst({
  homeMode,
  explorePath,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const isHire = homeMode === "hire";
  const viewerId = profile?.id ?? null;
  const { data: requestsData } = useFreelancerRequests(user?.id);
  const myOpenRequests = (requestsData?.myOpenRequests ?? []) as {
    id: string;
    service_type?: string | null;
    location_city?: string | null;
    created_at: string;
  }[];
  const latestRequest = myOpenRequests[0] ?? null;
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
        "flex w-full flex-col gap-5",
      )}
    >
      {isHire ? (
        <section
          className={cn(
            "relative overflow-hidden rounded-[28px] text-left",
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
                  <div className={heroTitleBlockClassName}>
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
                <div className="flex w-full items-end justify-between gap-3">
                  <Button
                    type="button"
                    onClick={onStartRequest}
                    className={cn(heroPrimaryButtonClassName, "bg-white text-[#7B61FF]")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {HIRE.primary}
                      <ChevronRight
                        className={cn(discoverIcon.md, "opacity-90")}
                        strokeWidth={DISCOVER_STROKE}
                      />
                    </span>
                  </Button>

                  {latestRequest ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/client/jobs/${encodeURIComponent(latestRequest.id)}/live`,
                        )
                      }
                      className={cn(
                        "group shrink-0 rounded-2xl px-2.5 py-2 text-left",
                        "w-[10.75rem] sm:w-[12rem]",
                        "bg-white/40 text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/55",
                        "transition hover:bg-white/50 active:scale-[0.99]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      )}
                      aria-label="Open your latest request"
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-black tracking-tight text-white">
                            {formatRequestTitle(latestRequest.service_type)}
                            <span className="mx-1 text-white/70">·</span>
                            <span className="font-semibold text-white/85">
                              {(latestRequest.location_city || "").trim() || "—"}
                            </span>
                          </p>
                        </div>
                        <ChevronRight
                          className={cn(
                            "h-5 w-5 shrink-0 text-white/75 transition group-hover:text-white/90",
                          )}
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-white/85">
                        <Clock className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        <LiveTimer
                          createdAt={latestRequest.created_at}
                          render={({ time }) => (
                            <span className="text-[12px] font-semibold tabular-nums">
                              {time}
                            </span>
                          )}
                        />
                      </div>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section
          className={cn(
            "relative overflow-hidden rounded-[28px] text-left",
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
                      <button
                        type="button"
                        onClick={onBrowseRow}
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 text-[12px] font-bold tracking-tight text-white/95",
                          "underline decoration-white/35 underline-offset-[3px] transition hover:text-white hover:decoration-white/70",
                        )}
                      >
                        Find people in need
                        <ChevronRight
                          className={cn(discoverIcon.sm, "opacity-90")}
                          strokeWidth={DISCOVER_STROKE}
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={onStartRequest}
                    className={cn(heroPrimaryButtonClassName, "bg-white text-[#047857]")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {workTheme.primary}
                      <ChevronRight
                        className={cn(discoverIcon.md, "opacity-90")}
                        strokeWidth={DISCOVER_STROKE}
                        aria-hidden
                      />
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <DiscoverHomeRealtimeStrip variant={homeMode} explorePath={explorePath} />

      {isHire ? (
        <button
          type="button"
          onClick={onBrowseRow}
          className={cn(
            "flex w-full items-center gap-4 rounded-2xl bg-white p-[1.125rem] text-left",
            "shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.08)]",
            "ring-1 ring-slate-200/90 transition-[box-shadow,transform] hover:shadow-[0_4px_16px_-4px_rgba(123,97,255,0.18)]",
            "hover:ring-[#7B61FF]/20 active:scale-[0.99] dark:bg-zinc-900/90 dark:ring-zinc-700/80",
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7B61FF]/10 text-[#7B61FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-[#7B61FF]/15">
            <Search
              className={discoverIcon.hero}
              strokeWidth={DISCOVER_STROKE}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-foreground">
              Browse helpers
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              See profiles, availability & reviews
            </span>
          </span>
          <ChevronRight
            className={cn(discoverIcon.md, "shrink-0 text-slate-400")}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={onBrowseRow}
          className={cn(
            "flex w-full items-center gap-4 rounded-2xl bg-white p-[1.125rem] text-left",
            "shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.08)]",
            "ring-1 ring-slate-200/90 transition-[box-shadow,transform] hover:shadow-[0_4px_16px_-4px_rgba(5,95,70,0.18)]",
            "hover:ring-[#065f46]/20 active:scale-[0.99] dark:bg-zinc-900/90 dark:ring-zinc-700/80",
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#065f46]/10 text-[#065f46] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-emerald-950/50 dark:text-emerald-300">
            <Search
              className={discoverIcon.hero}
              strokeWidth={DISCOVER_STROKE}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight text-foreground">
              Find people in need
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Open requests near you, filtered for you
            </span>
          </span>
          <ChevronRight
            className={cn(discoverIcon.md, "shrink-0 text-muted-foreground")}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
