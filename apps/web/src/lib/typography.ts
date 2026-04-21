import { cn } from "@/lib/utils";

/**
 * Shared type scale for mobile-first UI.
 * Goal: keep titles/subtitles/meta consistent across Discover/Explore/cards.
 */
export const T = {
  /** Large section titles (e.g. page title) */
  h1: "text-[26px] leading-tight font-black tracking-tight md:text-3xl",
  /** Card / section titles */
  h2: "text-[16px] leading-tight font-bold tracking-tight sm:text-[17px]",
  /** Secondary line under titles */
  sub: "text-[14px] leading-snug text-muted-foreground sm:text-[15px]",
  /** Compact meta line */
  meta: "text-[12px] leading-snug text-muted-foreground sm:text-[13px]",
  /** Small uppercase label */
  label:
    "text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground",
  /** Tiny chip text */
  chip: "text-[11px] font-black uppercase tracking-[0.14em]",
} as const;

export function chipBadgeClassName(active: boolean) {
  return cn(
    "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 tabular-nums",
    T.chip,
    active ? "bg-primary/12 text-foreground" : "bg-muted text-muted-foreground",
  );
}

