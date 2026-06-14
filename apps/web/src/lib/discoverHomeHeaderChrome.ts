import { cn } from "@/lib/utils";

/** Glass pill icon button — matches location chip + header actions on Discover home. */
export const discoverHeaderGlassIconBtnClass = cn(
  "discover-header-location-glass relative flex h-10 w-10 shrink-0 items-center justify-center text-slate-900 transition-all active:scale-95 dark:text-white",
  "outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60",
);
