import type { UnifiedJobsTabId } from "./jobsPerspective";

/**
 * Mobile jobs stepper — full pill gradient + strip tint; frosted thumb in JobsMobileTabStepper.
 * Aligned with JobsTabContent status badges.
 */
export type JobsMobileStepperTheme = {
  strip: string;
  /** Full-bleed gradient inside the rounded pill */
  pillGradient: string;
  pillShadow: string;
  countBadgeSelected: string;
  countBadgeIdle: string;
};

const THEMES: Record<UnifiedJobsTabId, JobsMobileStepperTheme> = {
  requests: {
    strip:
      "bg-gradient-to-b from-orange-500/20 via-background/92 to-background/95 dark:from-orange-500/14 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-orange-500 to-red-600",
    pillShadow: "shadow-orange-900/25 dark:shadow-orange-950/45",
    countBadgeSelected: "ring-orange-600/90 bg-white text-orange-700",
    countBadgeIdle: "ring-orange-600/75 bg-white/90 text-orange-800 shadow-sm",
  },
  pending: {
    strip:
      "bg-gradient-to-b from-amber-500/20 via-background/92 to-background/95 dark:from-amber-500/14 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-amber-500 to-orange-600",
    pillShadow: "shadow-amber-900/25 dark:shadow-amber-950/40",
    countBadgeSelected: "ring-amber-600/90 bg-white text-amber-800",
    countBadgeIdle: "ring-amber-600/75 bg-white/90 text-amber-900 shadow-sm",
  },
  jobs: {
    strip:
      "bg-gradient-to-b from-emerald-500/18 via-background/92 to-background/95 dark:from-emerald-500/12 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-500 dark:to-teal-600",
    pillShadow: "shadow-emerald-900/25 dark:shadow-emerald-950/45",
    countBadgeSelected: "ring-emerald-600/90 bg-white text-emerald-800",
    countBadgeIdle: "ring-emerald-600/75 bg-white/90 text-emerald-900 shadow-sm",
  },
  past: {
    strip:
      "bg-gradient-to-b from-blue-500/22 via-background/92 to-background/95 dark:from-blue-400/14 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600",
    pillShadow: "shadow-blue-900/30 dark:shadow-blue-950/50",
    countBadgeSelected: "ring-blue-600/90 bg-white text-blue-700 dark:text-blue-800",
    countBadgeIdle: "ring-blue-600/75 bg-white/90 text-blue-800 shadow-sm dark:text-blue-900",
  },
  my_requests: {
    strip:
      "bg-gradient-to-b from-violet-500/18 via-background/92 to-background/95 dark:from-violet-500/12 dark:via-background/90",
    pillGradient: "bg-gradient-to-r from-violet-500 to-purple-700 dark:from-violet-500 dark:to-purple-700",
    pillShadow: "shadow-violet-900/25 dark:shadow-violet-950/45",
    countBadgeSelected: "ring-violet-600/90 bg-white text-violet-800",
    countBadgeIdle: "ring-violet-600/75 bg-white/90 text-violet-900 shadow-sm",
  },
};

export function jobsMobileStepperThemeForTab(tabId: string): JobsMobileStepperTheme {
  if (tabId in THEMES) return THEMES[tabId as UnifiedJobsTabId];
  return THEMES.requests;
}
