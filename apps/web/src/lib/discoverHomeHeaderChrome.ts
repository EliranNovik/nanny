import { cn } from "@/lib/utils";

/** Plain icon control — signed-in fixed header (no glass pill). */
export const signedInHeaderIconBtnClass = cn(
  "flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300",
  "outline-none focus-visible:opacity-100",
);

/** Plain location label — signed-in fixed header (no glass pill). */
export const signedInHeaderLocationBtnClass = cn(
  "flex min-h-10 min-w-0 items-center gap-1 py-1 pl-1 pr-2 text-left text-slate-900 transition-all active:scale-[0.98] dark:text-white",
);

/** @deprecated Use signedInHeaderIconBtnClass in the fixed app header. */
export const discoverHeaderGlassIconBtnClass = signedInHeaderIconBtnClass;
