import { cn } from "@/lib/utils";

/** Signed-in app header — solid on mobile; full-width frosted bar on desktop. */
export const signedInAppHeaderBgClass =
  "bg-white dark:bg-background md:bg-transparent md:dark:bg-transparent";

/** Frosted fill for the signed-in desktop header (edge to edge). */
export const signedInDesktopHeaderGlassClass =
  "bg-white/70 shadow-none backdrop-blur-xl backdrop-saturate-150 dark:bg-background dark:backdrop-blur-none";

/** Plain icon control — signed-in fixed header (no glass pill). */
export const signedInHeaderIconBtnClass = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300",
  "outline-none focus-visible:opacity-100",
);

/** Frosted circular badge for header icons sitting on a photo. */
export const publicProfileHeaderGlassIconBtnClass = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0",
  "bg-white/55 text-slate-900 shadow-none ring-0",
  "backdrop-blur-xl backdrop-saturate-150",
  "transition-all hover:bg-white/70 active:scale-95",
  "outline-none focus-visible:outline-none",
);

/** Plain location label — signed-in fixed header (no glass pill). */
export const signedInHeaderLocationBtnClass = cn(
  "flex min-h-11 min-w-0 items-center gap-1.5 py-1 pl-1 pr-2 text-left text-slate-900 transition-all active:scale-[0.98] dark:text-white",
);

/** @deprecated Use signedInHeaderIconBtnClass in the fixed app header. */
export const discoverHeaderGlassIconBtnClass = signedInHeaderIconBtnClass;
