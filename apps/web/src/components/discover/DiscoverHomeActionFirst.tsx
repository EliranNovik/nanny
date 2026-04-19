import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Search,
  Wifi,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import {
  navigateToHelpersBrowse,
  navigateToHelpersMatch,
  navigateToWorkBrowseRequests,
} from "@/lib/discoverBrowseNavigate";
import { DiscoverHomeRealtimeStrip } from "@/components/discover/DiscoverHomeRealtimeStrip";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import { DISCOVER_PRIMARY_HERO_IMAGES } from "@/components/discover/discoverHomeHeroImages";

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
  instant: "Instant match",
  instantSub: "Get matched with an available helper now",
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

export function DiscoverHomeActionFirst({
  homeMode,
  explorePath,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isHire = homeMode === "hire";

  function onStartRequest() {
    trackEvent("discover_primary_cta", { mode: homeMode });
    if (isHire) {
      navigate(createRequestPath);
      return;
    }
    navigate(workPrimaryPath);
  }

  function onMatchInstant() {
    trackEvent("discover_hero_secondary_cta", { mode: homeMode });
    navigateToHelpersMatch(navigate, profile);
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
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7B61FF] shadow-sm sm:px-3 sm:py-1.5">
                  <Zap
                    className={cn(discoverIcon.sm, "shrink-0")}
                    strokeWidth={DISCOVER_STROKE}
                    aria-hidden
                  />
                  {HIRE.badge}
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
              <div className={heroPrimaryCtaRowClassName}>
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
                    />
                  </span>
                </Button>
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
          className="flex w-full items-center gap-4 rounded-[1.15rem] bg-white p-4 text-left shadow-md ring-1 ring-black/[0.06] transition hover:ring-[#065f46]/25 active:scale-[0.99] dark:bg-zinc-900/90"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#065f46]/10 text-[#065f46] shadow-inner dark:bg-emerald-950/50 dark:text-emerald-300">
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

      {isHire && (
        <button
          type="button"
          onClick={onMatchInstant}
          className={cn(
            "flex w-full items-center gap-4 rounded-2xl bg-white p-[1.125rem] text-left",
            "shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.08)]",
            "ring-1 ring-slate-200/90 transition-[box-shadow,transform] hover:shadow-[0_4px_16px_-4px_rgba(123,97,255,0.18)]",
            "hover:ring-[#7B61FF]/20 active:scale-[0.99] dark:bg-zinc-900/90 dark:ring-zinc-700/80",
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7B61FF]/10 text-[#7B61FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-[#7B61FF]/15">
            <Zap
              className={discoverIcon.hero}
              strokeWidth={DISCOVER_STROKE}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-foreground">
              {HIRE.instant}
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              {HIRE.instantSub}
            </span>
          </span>
          <ChevronRight
            className={cn(discoverIcon.md, "shrink-0 text-slate-400")}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
