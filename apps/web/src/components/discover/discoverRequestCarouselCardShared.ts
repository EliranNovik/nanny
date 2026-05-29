import { cn } from "@/lib/utils";

/** White posted-time pill — matches My Requests carousel. */
export const discoverRequestPostedTimeBadgeBaseClass = cn(
  "inline-flex max-w-[85%] min-h-[1.75rem] items-center rounded-full bg-white px-2 py-1",
  "text-[13px] font-bold uppercase leading-none tracking-wide text-zinc-900 shadow-md",
  "sm:min-h-[1.5rem] sm:px-1.5 sm:py-0.5 sm:text-[11px]",
  "lg:min-h-[1.75rem] lg:px-2 lg:py-1 lg:text-[12.5px] xl:text-[13.5px]",
);

export const discoverRequestPostedTimeBadgeClass = cn(
  "absolute top-2 right-2 z-10",
  discoverRequestPostedTimeBadgeBaseClass,
  "sm:top-1.5 sm:right-1.5 lg:top-2 lg:right-2",
);

/** White pill overlay for round favorite circles (Help others time + I need help Available). */
export const discoverFavoriteCircleBadgeClass = cn(
  "pointer-events-none absolute bottom-[8%] left-0 z-10",
  "inline-flex max-w-[82%] min-h-[1.25rem] items-center rounded-full bg-white px-2.5 py-0.5",
  "text-[11px] font-bold uppercase leading-none tracking-wide text-zinc-900 shadow-md",
  "sm:bottom-[8%] sm:left-0 sm:min-h-[1.125rem] sm:px-2 sm:py-0.5 sm:text-[10.5px]",
);

/** Compact posted-time pill for round favorite circles (Help others — Your favorites). */
export const discoverRequestPostedTimeBadgeCircleClass =
  discoverFavoriteCircleBadgeClass;

export const discoverRequestClientOverlayClass = cn(
  "absolute left-2 top-2 z-10 flex max-w-[58%] flex-col gap-0.5",
  "sm:left-1.5 sm:top-1.5 lg:left-2 lg:top-2 lg:gap-1",
);

export const discoverRequestClientNameRowClass =
  "flex min-w-0 items-center gap-1.5 sm:gap-1";

export const discoverRequestRatingRowClass = cn(
  "inline-flex w-fit items-center gap-0.5 text-[12px] font-semibold leading-tight text-white",
  "sm:text-[10.5px] lg:text-[12px] xl:text-[13px]",
);

export const discoverRequestTopGradientClass =
  "pointer-events-none absolute inset-x-0 top-0 h-[4.5rem] bg-gradient-to-b from-black/65 via-black/35 to-transparent sm:h-16";

export function stripAboutFromDistance(when: string): string {
  return when.replace(/^about\s+/i, "");
}
