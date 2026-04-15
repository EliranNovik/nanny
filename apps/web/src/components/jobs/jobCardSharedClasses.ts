import { cn } from "@/lib/utils";

/**
 * Flat chrome on every breakpoint. Overrides `Card` defaults (`sm:bg-card`, `sm:border`, shadows)
 * so job rows stay transparent on desktop — no grey panel.
 */
export const JOB_CARD_SHELL =
  "group relative flex min-h-[380px] w-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-white/5 dark:bg-zinc-900";

/** Thumb + profile row: scales up on desktop */
export const JOB_CARD_COMPACT_ROW = "flex gap-3 p-3 md:gap-5 md:p-6";

/** Service image / map thumbnail — wrap in a button with onClick; keep overlays/map `pointer-events-none` so clicks open the preview modal */
export const JOB_CARD_THUMB =
  "relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-border/40 dark:bg-muted dark:ring-white/10 md:h-32 md:w-32 md:rounded-3xl";

/** Classes for `<button type="button">` wrapping the thumb (keep JOB_CARD_THUMB border; reset padding + focus ring) */
export const JOB_CARD_THUMB_BUTTON =
  "inline-flex cursor-pointer bg-transparent p-0 text-left outline-none transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background";

/** Dashed empty-state panel — consistent with flat job cards */
export const JOB_CARD_EMPTY_PANEL = cn(
  "rounded-[20px] border border-dashed border-slate-300/45 bg-transparent shadow-none",
  "dark:border-zinc-600/40",
);
