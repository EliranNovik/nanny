import type { UnifiedJobsTabId } from "./jobsPerspective";

/** Shared with desktop tab dropdown — frosted strip under header */
export const JOBS_STEPPER_STRIP_BASE =
  "border-b border-border/30 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70 dark:border-border/40 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] dark:supports-[backdrop-filter]:bg-background/75";

/**
 * Mobile jobs stepper — strip + gradient; count chips use light shadow only (no border halo).
 */
export type JobsMobileStepperTheme = {
  strip: string;
  /** Full-bleed gradient inside the rounded pill */
  pillGradient: string;
  countBadgeSelected: string;
  countBadgeIdle: string;
};

/** Surfaces only — pair with explicit `text-*` / `dark:text-*` (fixes light text on white pills in dark mode). */
const BADGE_IDLE_SURFACE =
  "bg-white/95 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/15";
const BADGE_SELECTED_SURFACE =
  "bg-white shadow-sm ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/20";

const THEMES: Record<UnifiedJobsTabId, JobsMobileStepperTheme> = {
  requests: {
    strip:
      "bg-gradient-to-b from-orange-500/20 via-background/92 to-background/95 dark:from-orange-500/14 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-orange-500 to-red-600",
    countBadgeSelected: `${BADGE_SELECTED_SURFACE} text-orange-800 dark:text-orange-100`,
    countBadgeIdle: `${BADGE_IDLE_SURFACE} text-orange-950 dark:text-orange-200`,
  },
  pending: {
    strip:
      "bg-gradient-to-b from-amber-500/20 via-background/92 to-background/95 dark:from-amber-500/14 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-amber-500 to-orange-600",
    countBadgeSelected: `${BADGE_SELECTED_SURFACE} text-amber-900 dark:text-amber-100`,
    countBadgeIdle: `${BADGE_IDLE_SURFACE} text-amber-950 dark:text-amber-200`,
  },
  jobs: {
    strip:
      "bg-gradient-to-b from-emerald-500/18 via-background/92 to-background/95 dark:from-emerald-500/12 dark:via-background/90",
    pillGradient:
      "bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-500 dark:to-teal-600",
    countBadgeSelected: `${BADGE_SELECTED_SURFACE} text-emerald-900 dark:text-emerald-100`,
    countBadgeIdle: `${BADGE_IDLE_SURFACE} text-emerald-950 dark:text-emerald-200`,
  },
  past: {
    strip:
      "bg-gradient-to-b from-blue-500/22 via-background/92 to-background/95 dark:from-blue-400/14 dark:via-background/90",
    pillGradient:
      "bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600",
    countBadgeSelected: `${BADGE_SELECTED_SURFACE} text-blue-900 dark:text-blue-100`,
    countBadgeIdle: `${BADGE_IDLE_SURFACE} text-blue-950 dark:text-blue-200`,
  },
  my_requests: {
    strip:
      "bg-gradient-to-b from-orange-500/20 via-background/92 to-background/95 dark:from-orange-500/14 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-orange-500 to-red-600",
    countBadgeSelected: `${BADGE_SELECTED_SURFACE} text-orange-800 dark:text-orange-100`,
    countBadgeIdle: `${BADGE_IDLE_SURFACE} text-orange-950 dark:text-orange-200`,
  },
};

export function jobsMobileStepperThemeForTab(
  tabId: string,
): JobsMobileStepperTheme {
  if (tabId in THEMES) return THEMES[tabId as UnifiedJobsTabId];
  return THEMES.requests;
}
