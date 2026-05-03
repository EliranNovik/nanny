import { cn } from "@/lib/utils";

/**
 * Shared hover for tappable cards (jobs tabs, discover tiles, etc.):
 * subtle lift, layered shadow, border brighten, crisp active state.
 */
export const INTERACTIVE_CARD_HOVER =
  "transition-[transform,box-shadow,border-color] duration-300 ease-out " +
  "hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-lg hover:shadow-slate-900/[0.09] " +
  "active:translate-y-0 active:shadow-md active:duration-150 " +
  "dark:hover:border-white/[0.14] dark:hover:shadow-xl dark:hover:shadow-black/40";

/** Outer corner radius — shared by incoming job rows and open-request match cards. */
export const JOB_CARD_OUTER_CORNER = "rounded-[20px]";

/**
 * Flat chrome on every breakpoint. Overrides `Card` defaults (`sm:bg-card`, `sm:border`, shadows)
 * so job rows stay transparent on desktop — no grey panel.
 */
export const JOB_CARD_SHELL = cn(
  "group relative flex min-h-0 w-full min-w-0 flex-col overflow-hidden",
  JOB_CARD_OUTER_CORNER,
  "border border-slate-200/80 bg-white shadow-sm",
  "dark:border-white/5 dark:bg-zinc-900",
  INTERACTIVE_CARD_HOVER,
);

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
  JOB_CARD_OUTER_CORNER,
  "border border-dashed border-slate-300/45 bg-transparent shadow-none",
  "dark:border-zinc-600/40",
);

/**
 * Explore tab cards — light: zinc slab, no outline (matches discover home list rows).
 * Dark: filled panel + light shadow.
 */
export const EXPLORE_PAGE_CARD_SURFACE = cn(
  "border-0 bg-zinc-100 shadow-none ring-0",
  "dark:border-0 dark:bg-zinc-800 dark:shadow-sm",
);

/** Hover for explore cards only — no border brightening (surface stays outline-free in light mode). */
export const EXPLORE_PAGE_CARD_HOVER = cn(
  "transition-[transform,box-shadow] duration-300 ease-out",
  "hover:-translate-y-0.5 hover:shadow-md hover:shadow-zinc-900/[0.06]",
  "active:translate-y-0 active:shadow-sm active:duration-150",
  "dark:hover:shadow-xl dark:hover:shadow-black/35",
);

/** Image / map tile on explore job cards — light: inset grey, no ring; dark: subtle border. */
export const EXPLORE_PAGE_CARD_THUMB = cn(
  "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-0 bg-zinc-200/70 shadow-none ring-0",
  "dark:border dark:border-white/10 dark:bg-muted/40 dark:shadow-sm dark:ring-1 dark:ring-white/10",
);

/** Stacked avatars on Explore cards — separation on grey card */
export const EXPLORE_PAGE_AVATAR_RING =
  "border-2 border-white shadow-sm dark:border-zinc-800";
