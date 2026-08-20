import { cn } from "@/lib/utils";

/** Signed-in app header — solid on mobile; desktop is frosted so content can show through. */
export const signedInAppHeaderBgClass =
  "bg-white dark:bg-zinc-800 md:bg-transparent md:dark:bg-transparent";

/** Frosted fill for the desktop header’s content column (sidebar slot stays clear). */
export const signedInDesktopHeaderGlassClass =
  "bg-white/70 shadow-none backdrop-blur-xl backdrop-saturate-150 dark:bg-zinc-950/55";

/** Plain icon control — signed-in fixed header (no glass pill). */
export const signedInHeaderIconBtnClass = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300",
  "outline-none focus-visible:opacity-100",
);

/** Plain location label — signed-in fixed header (no glass pill). */
export const signedInHeaderLocationBtnClass = cn(
  "flex min-h-11 min-w-0 items-center gap-1.5 py-1 pl-1 pr-2 text-left text-slate-900 transition-all active:scale-[0.98] dark:text-white",
);

/** @deprecated Use signedInHeaderIconBtnClass in the fixed app header. */
export const discoverHeaderGlassIconBtnClass = signedInHeaderIconBtnClass;
