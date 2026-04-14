import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { badgeCountForJobsTab, useJobsTabCounts } from "@/hooks/useJobsTabCounts";
import type { JobsPerspective } from "./jobsPerspective";
import { tabsForPerspective } from "./jobsTabConfig";
import { defaultTabForPerspective, isTabValidForPerspective } from "./jobsPerspective";
import { JOBS_STEPPER_STRIP_BASE, jobsMobileStepperThemeForTab } from "./jobsMobileStepperTheme";

/** Base strip; theme adds tinted gradient (`jobsMobileStepperTheme.strip`) */
const STRIP_BASE = JOBS_STEPPER_STRIP_BASE;

const HEADER_OFFSET = "calc(env(safe-area-inset-top, 0px) + 3.5rem)";

/**
 * Fixed under the app header on /jobs: Discover-style segmented pill (mobile only).
 * Desktop uses JobsTabBar in the sticky row.
 */
export function JobsMobileTabStepper() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const counts = useJobsTabCounts(user);

  const mode = searchParams.get("mode") as JobsPerspective | null;
  const tabFromUrl = searchParams.get("tab");

  const tabs = mode === "freelancer" || mode === "client" ? tabsForPerspective(mode) : null;

  const activeId =
    tabs && tabFromUrl && isTabValidForPerspective(mode!, tabFromUrl)
      ? tabFromUrl
      : tabs
        ? defaultTabForPerspective(mode!)
        : "requests";

  const active = tabs?.find((t) => t.id === activeId) ?? tabs?.[0];

  function badgeFor(tabId: string): number {
    if (!mode) return 0;
    return badgeCountForJobsTab(tabId, mode, counts);
  }

  function selectTab(tabId: string) {
    if (!mode) return;
    setSearchParams({ mode, tab: tabId }, { replace: true });
  }

  if (!tabs || !active || !mode) {
    return null;
  }

  const index = tabs.findIndex((t) => t.id === active.id);
  const n = tabs.length;

  const gridColsClass = n === 3 ? "grid-cols-3" : "grid-cols-4";

  const thumbGapRem = (n - 1) * 0.125;
  /** p-1.5 → 0.375rem inset; gap between segments 0.125rem */
  const thumbPad = 0.75;
  const thumbStyle = {
    width: `calc((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n})`,
    left: `calc(0.375rem + ${index} * ((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n} + 0.125rem))`,
  } as const;

  const theme = jobsMobileStepperThemeForTab(active.id);

  return (
    <div
      className={cn(
        "md:hidden pointer-events-none fixed inset-x-0 z-[59] transition-[background,box-shadow] duration-300",
        STRIP_BASE,
        theme.strip
      )}
      style={{ top: HEADER_OFFSET }}
    >
      <div className="pointer-events-auto app-desktop-shell px-3 py-2.5 sm:px-4">
        <div className="mx-auto w-full max-w-[min(42rem,calc(100vw-1.25rem))]">
          {/** Full-width gradient pill + frosted sliding thumb */}
          <div
            className={cn(
              "relative isolate min-h-[54px] w-full min-w-0 overflow-hidden rounded-full p-1.5 sm:min-h-[58px]",
              "border border-white/20 shadow-lg shadow-black/12 transition-[box-shadow] duration-300",
              "dark:shadow-black/35"
            )}
            role="tablist"
            aria-label="Jobs sections"
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-[background] duration-300",
                theme.pillGradient
              )}
              aria-hidden
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1.5 bottom-1.5 z-[5] rounded-full",
                /** Solid overlay only — backdrop-blur + ring bled past bounds and looked like extra halos on neighbouring tabs */
                "bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
                "transition-[left,width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
              )}
              style={thumbStyle}
            />
            <div className={cn("relative z-10 grid h-full min-h-[44px] w-full gap-0.5 sm:min-h-[48px]", gridColsClass)}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = tab.id === active.id;
                const count = badgeFor(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={count > 0 ? `${tab.label}, ${count} items` : tab.label}
                    onClick={() => selectTab(tab.id)}
                    className={cn(
                      "relative flex min-w-0 items-center justify-center rounded-full px-0.5 py-1",
                      "bg-transparent [-webkit-tap-highlight-color:transparent]",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/55",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      selected ? "text-white" : "text-white/65 hover:text-white/85"
                    )}
                  >
                    <span className="relative inline-flex">
                      <Icon
                        className={cn(
                          "h-6 w-6 shrink-0 transition-transform duration-300 sm:h-7 sm:w-7",
                          selected && "scale-105"
                        )}
                        strokeWidth={2.25}
                        aria-hidden
                      />
                      {count > 0 && (
                        <span
                          className={cn(
                            "absolute -right-0.5 -top-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none tabular-nums transition-colors duration-300 sm:-top-3",
                            selected ? theme.countBadgeSelected : theme.countBadgeIdle
                          )}
                          aria-hidden
                        >
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
