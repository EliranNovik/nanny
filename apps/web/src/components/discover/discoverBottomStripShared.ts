import { cn } from "@/lib/utils";

/** Higher above mobile BottomNav — extra gap from nav bar. */
export const stripBottomFlushClass =
  "bottom-[calc(4.75rem+max(0.75rem,env(safe-area-inset-bottom,0px)))]";

/** Wrapper positions the pill on the right edge. */
export const stripFabPillClusterClass = cn(
  "md:hidden pointer-events-auto fixed right-3 z-[125]",
  stripBottomFlushClass,
);

/** Single combined pill for primary action + ⋮. */
export const stripFabPillClass = cn(
  "strip-fab-pill relative flex items-center gap-0 rounded-full shadow-xl border border-black/10 [-webkit-tap-highlight-color:transparent] outline-none focus:outline-none focus-within:outline-none",
  "bg-white text-zinc-900 dark:bg-zinc-900/95 dark:text-zinc-50 dark:border-white/10",
);

export const stripFabPillMainBtnClass = cn(
  "strip-fab-pill-main-btn flex h-16 w-16 shrink-0 items-center justify-center rounded-l-full transition-transform active:scale-[0.96] [-webkit-tap-highlight-color:transparent]",
  "outline-none focus:outline-none focus-visible:outline-none",
);

export const stripFabPillIconBtnClass = cn(
  "strip-fab-pill-icon-btn flex h-16 w-16 shrink-0 items-center justify-center rounded-r-full text-zinc-600 transition-transform active:scale-[0.96] [-webkit-tap-highlight-color:transparent]",
  "hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/5",
  "outline-none focus:outline-none focus-visible:outline-none",
);

export const stripFabPillDividerClass = "h-10 w-px shrink-0 bg-zinc-200 dark:bg-white/10";

export const stripLiveTimerClass = cn(
  "flex h-16 shrink-0 items-center px-3.5 text-[15px] font-bold tabular-nums text-emerald-800",
  "dark:text-emerald-100",
);

/** Count badge anchored to top-right of the combined pill. */
export const stripMoreBadgeClass = cn(
  "pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1",
  "text-[10px] font-black tabular-nums leading-none text-white bg-red-500 shadow-md",
);
