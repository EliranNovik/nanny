import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { badgeCountForJobsTab, useJobsTabCounts } from "@/hooks/useJobsTabCounts";
import type { JobsPerspective } from "./jobsPerspective";
import { tabsForPerspective } from "./jobsTabConfig";
import { defaultTabForPerspective, isTabValidForPerspective } from "./jobsPerspective";
import { JOBS_STEPPER_STRIP_BASE, jobsMobileStepperThemeForTab } from "./jobsMobileStepperTheme";

interface JobsTabBarProps {
  menuAlign?: "left" | "right" | "center";
  hideMobile?: boolean;
  hideDesktop?: boolean;
}

/** Mobile: neutral, light frame — no primary/orange chip look */
const MOBILE_TAB_SURFACE =
  "rounded-xl border border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-sm transition-colors dark:border-border/50 dark:bg-zinc-900/50";

export function JobsTabBar({
  menuAlign = "right",
  hideMobile = false,
  hideDesktop = false,
}: JobsTabBarProps) {
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

  function select(nextTabId: string) {
    if (!mode) return;
    setSearchParams({ mode, tab: nextTabId }, { replace: true });
  }

  useEffect(() => {
    if (!mode || !tabs) return;
    if (tabFromUrl && isTabValidForPerspective(mode, tabFromUrl)) return;
    setSearchParams({ mode, tab: defaultTabForPerspective(mode) }, { replace: true });
  }, [mode, tabFromUrl, tabs, setSearchParams]);

  if (!tabs || !active || !mode) {
    return null;
  }

  function badgeCountForTab(tabId: string): number {
    if (!mode) return 0;
    return badgeCountForJobsTab(tabId, mode, counts);
  }

  const ActiveIcon = active.icon;
  const stepperTheme = jobsMobileStepperThemeForTab(activeId);

  const n = tabs.length;
  const index = tabs.findIndex((t) => t.id === activeId);
  const gridColsClass = n === 3 ? "grid-cols-3" : "grid-cols-4";
  const thumbGapRem = (n - 1) * 0.125;
  const thumbPad = 0.75;
  const thumbStyle = {
    width: `calc((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n})`,
    left: `calc(0.375rem + ${index} * ((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n} + 0.125rem))`,
  } as const;

  return (
    <div className="relative shrink-0 md:max-w-full">
      {!hideMobile && (
        <div className="flex w-full min-w-0 max-w-[min(13.75rem,calc(100vw-7.5rem))] shrink items-center md:hidden">
          <div className="relative min-w-0 flex-1">
            <div className={cn("relative min-w-0", MOBILE_TAB_SURFACE)}>
              <ActiveIcon
                className="pointer-events-none absolute left-2 top-1/2 z-[3] h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                aria-hidden
              />
              <select
                value={activeId}
                aria-label="Jobs section"
                onChange={(e) => select(e.target.value)}
                className={cn(
                  "relative z-[2] h-9 w-full min-w-0 max-w-full cursor-pointer appearance-none border-0 bg-transparent py-1.5 pl-8 pr-10 text-[12px] font-semibold leading-tight text-slate-900 shadow-none outline-none ring-0 focus:ring-0 dark:text-white"
                )}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-7 top-1/2 z-[3] inline-flex h-4 min-w-[1.125rem] -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-bold leading-none tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                aria-hidden
              >
                {badgeCountForTab(activeId)}
              </span>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 z-[3] h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
                aria-hidden
              />
            </div>
          </div>
        </div>
      )}

      {!hideDesktop && (
        <div
          className={cn(
            "hidden w-full min-w-0 flex-col rounded-2xl px-5 py-4 md:flex",
            menuAlign === "left" && "items-start",
            menuAlign === "right" && "items-end",
            menuAlign === "center" && "items-center",
            JOBS_STEPPER_STRIP_BASE
          )}
        >
          <div
            className={cn(
              "relative w-full max-w-[min(56rem,calc(100vw-2rem))] shrink-0",
              menuAlign === "left" && "mr-auto",
              menuAlign === "right" && "ml-auto",
              menuAlign === "center" && "mx-auto"
            )}
          >
            <div
              className={cn(
                "relative isolate min-h-[72px] w-full min-w-0 overflow-hidden rounded-full p-2 md:min-h-[76px]",
                "border border-slate-200/90 bg-slate-100/85 shadow-sm shadow-black/5 transition-[box-shadow] duration-300",
                "dark:border-border/50 dark:bg-zinc-900/55 dark:shadow-black/25"
              )}
              role="tablist"
              aria-label="Jobs sections"
            >
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-2 bottom-2 z-[5] rounded-full",
                  "shadow-md shadow-black/15 ring-1 ring-white/25 dark:ring-white/10",
                  "transition-[left,width] duration-300 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
                  stepperTheme.pillGradient
                )}
                style={thumbStyle}
              />
              <div
                className={cn(
                  "relative z-10 grid h-full min-h-[58px] w-full gap-0.5 md:min-h-[62px]",
                  gridColsClass
                )}
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = tab.id === activeId;
                  const count = badgeCountForTab(tab.id);
                  const itemTheme = jobsMobileStepperThemeForTab(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={count > 0 ? `${tab.label}, ${count} items` : tab.label}
                      onClick={() => select(tab.id)}
                      className={cn(
                        "relative z-10 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1",
                        "bg-transparent [-webkit-tap-highlight-color:transparent]",
                        "transition-[color,transform] duration-300 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400/55",
                        "active:scale-[0.98] motion-reduce:transition-none",
                        selected
                          ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      )}
                    >
                      <span className="relative inline-flex shrink-0">
                        <Icon
                          className={cn(
                            "h-6 w-6 shrink-0 transition-transform duration-300 md:h-6 md:w-6",
                            selected && "scale-105"
                          )}
                          strokeWidth={2.25}
                          aria-hidden
                        />
                        {count > 0 && (
                          <span
                            className={cn(
                              "absolute -right-0.5 -top-2.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none tabular-nums transition-colors duration-300 md:-top-3 md:h-[18px] md:min-w-[18px] md:text-[10px]",
                              selected ? itemTheme.countBadgeSelected : itemTheme.countBadgeIdle
                            )}
                            aria-hidden
                          >
                            {count > 9 ? "9+" : count}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "max-w-full px-0.5 text-center text-[10px] font-semibold leading-tight tracking-tight md:text-[11px]",
                          "line-clamp-2 break-words [overflow-wrap:anywhere]"
                        )}
                      >
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
