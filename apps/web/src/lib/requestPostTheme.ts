/** Shared orange theme for request / help-request posts across the app. */

export const requestPostAccentTextClass =
  "text-orange-600 dark:text-orange-400";

export const requestPostAccentTextStrongClass =
  "text-orange-500 dark:text-orange-400";

export const requestPostBadgeClass =
  "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400";

export const requestPostBadgeOnDarkClass =
  "bg-orange-500/25 text-orange-200";

export const requestPostBadgeMobileClass =
  "max-md:bg-orange-100 max-md:text-orange-700 dark:max-md:bg-orange-500/25 dark:max-md:text-orange-200";

export const requestPostTextOnlySurfaceClass =
  "bg-zinc-50/90 dark:bg-orange-950/25";

export const requestPostTextOnlySurfaceMobileClass =
  "max-md:bg-orange-50 dark:max-md:bg-orange-950/25";

export const requestPostCtaClass =
  "bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-700 dark:hover:bg-orange-600";

export const requestPostCtaPendingClass =
  "bg-orange-500/15 text-orange-700 ring-1 ring-orange-300/80 dark:bg-orange-950/30 dark:text-orange-200 dark:ring-orange-800/80";

export const requestPostComposeSelectedClass =
  "bg-orange-600 border-transparent text-white dark:bg-orange-700 shadow-sm shadow-orange-900/25";

export const requestPostComposeUnselectedClass =
  "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:border-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-950/45";

export const requestPostUrgentBadgeClass =
  "inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-orange-900/35 ring-2 ring-orange-400/40 backdrop-blur-sm";

export const requestPostWhenNowBadgeClass =
  "border-0 bg-orange-500/5 text-orange-700 dark:bg-black/30 dark:text-orange-300";

export const requestPostBudgetTextClass =
  "text-orange-600 dark:text-orange-400";

export const requestPostReelTextOnlyMobileClass =
  "max-md:bg-orange-950/40 md:bg-orange-400/45";

export const requestPostReelTextOnlyDesktopClass = "bg-orange-400/45";

export const requestPostThemeMeta = {
  themeColor: requestPostAccentTextStrongClass,
  iconBg: "bg-orange-500/10 dark:bg-orange-500/20",
  iconColor: requestPostAccentTextStrongClass,
  activeBorder:
    "border-orange-500 dark:border-orange-500/80 ring-orange-500/15",
  activeBg: "bg-orange-50/20 dark:bg-orange-950/10",
  textClass: requestPostAccentTextClass,
} as const;
