import { cn } from "@/lib/utils";

/** Full-width shell for carousel cards — content fills the card width. */
export const discoverRequestCardCarouselShellClass =
  "flex h-full w-full min-w-0 flex-col text-left";

/** Stretch carousel cards to a common row height. */
export const discoverRequestCardsCarouselContainerClass = cn(
  "flex items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1",
  "scroll-smooth overscroll-x-contain [-webkit-overflow-scrolling:touch]",
  "-mx-4 px-4 sm:-mx-0 sm:px-0",
);

/** Fixed-width snap item for open-request / my-request cards. */
export const discoverRequestCardCarouselItemClass = cn(
  "flex h-auto min-h-[12.5rem] w-[min(calc(100vw-2rem),22rem)] shrink-0 snap-start self-stretch",
  "md:min-h-[13rem] md:w-[26rem] lg:w-[28rem]",
);

export const discoverRequestCardCarouselBodyClass = "flex min-h-0 flex-1 flex-col";

export const discoverRequestCardCarouselTitleClass =
  "line-clamp-2 text-lg font-bold leading-snug text-foreground";

export const discoverRequestCardCarouselMetaRowClass =
  "mt-1 flex min-h-[1.375rem] w-full flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground";

export const discoverRequestCardCarouselPosterRowClass =
  "mt-2 flex min-h-[2.25rem] w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1";

export const discoverRequestCardCarouselFooterClass = cn(
  "mt-auto flex w-full min-h-[3.5rem] items-center justify-between gap-3",
  "border-t border-zinc-200/70 pt-3 dark:border-zinc-700/50",
);

export const discoverRequestCardCarouselFooterBudgetClass =
  "flex min-h-[2.25rem] min-w-0 flex-1 flex-col justify-center text-left";

export const discoverRequestCardCarouselFooterActionClass = "flex shrink-0 items-center self-center";

export const discoverRequestCarouselArrowBtnClass = cn(
  "hidden md:inline-flex h-8 w-8 items-center justify-center rounded-full",
  "border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all",
  "hover:bg-zinc-100 hover:shadow active:scale-95",
  "dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
);

/** Plain posted-time text for request cards. */
export const discoverRequestPostedTimeBadgeBaseClass = cn(
  "inline-flex max-w-[85%] items-center",
  "text-[13px] font-semibold leading-snug text-muted-foreground",
  "sm:text-[11px] lg:text-[12.5px] xl:text-[13.5px]",
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
