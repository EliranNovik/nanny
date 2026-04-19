import { cn } from "@/lib/utils";

/** Shared shell for helper + job swipe cards — white, soft shadow, no grey page tint. */
export const matchSwipeCardShell = cn(
  "overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white",
  "shadow-[0_12px_40px_-16px_rgba(15,23,42,0.12),0_4px_16px_-8px_rgba(15,23,42,0.08)]",
  "dark:border-zinc-700/70 dark:bg-zinc-900",
);

export const matchSwipeSectionLabel = cn(
  "text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400",
);
