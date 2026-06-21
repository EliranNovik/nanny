import { cn } from "@/lib/utils";

/** Snap-sheet wrapper only (component is `md:hidden`). */
export const MOBILE_BOTTOM_SHEET_EDGE = "bottom-0";

export const MOBILE_MODAL_Z_CLASS = "max-md:z-[130]";

/** Mobile dark mode: no border/ring outline on sheet surfaces. */
export const mobileModalDarkNoOutlineClass = cn(
  "max-md:dark:border-0 max-md:dark:ring-0 max-md:dark:outline-none",
);

/**
 * Radix Dialog → native bottom sheet on mobile.
 * Uses !important overrides to beat DialogContent's centered top/translate defaults.
 */
export const mobileBottomSheetDialogClass = cn(
  MOBILE_MODAL_Z_CLASS,
  mobileModalDarkNoOutlineClass,
  "!max-md:bottom-0",
  "!max-md:fixed !max-md:inset-x-0 !max-md:top-auto !max-md:left-0 !max-md:right-0",
  "!max-md:w-full !max-md:max-w-none !max-md:translate-x-0 !max-md:translate-y-0",
  "!max-md:grid-none !max-md:flex !max-md:flex-col",
  "max-md:rounded-t-[1.75rem] max-md:rounded-b-none max-md:border-b-0",
  "max-md:shadow-[0_-12px_48px_-16px_rgba(0,0,0,0.35)]",
  "md:bottom-auto",
);

export const mobileBottomSheetSlideAnimationClass = cn(
  "!max-md:data-[state=open]:slide-in-from-left-0 !max-md:data-[state=open]:slide-in-from-top-0",
  "!max-md:data-[state=closed]:slide-out-to-left-0 !max-md:data-[state=closed]:slide-out-to-top-0",
  "!max-md:data-[state=open]:zoom-in-100 !max-md:data-[state=closed]:zoom-out-100",
  "!max-md:data-[state=open]:slide-in-from-bottom !max-md:data-[state=closed]:slide-out-to-bottom",
);

/** Compact picker sheets (post type, quick actions). */
export const mobileCompactBottomSheetDialogClass = cn(
  mobileBottomSheetDialogClass,
  "max-md:h-auto max-md:max-h-[min(85dvh,640px)]",
);

/** Tall compose / detail sheets. */
export const mobileTallBottomSheetDialogClass = cn(
  mobileBottomSheetDialogClass,
  "max-md:h-[min(92dvh,860px)] max-md:max-h-[min(92dvh,860px)]",
);

export const mobileSheetSafePaddingBottom =
  "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]";

export const mobileBottomSheetDragHandleClass =
  "mx-auto h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/35";

/** @deprecated Use MOBILE_BOTTOM_SHEET_EDGE — sheets anchor to screen bottom, not above nav. */
export const MOBILE_SHEET_ABOVE_NAV_BOTTOM = MOBILE_BOTTOM_SHEET_EDGE;

/** @deprecated */
export const MOBILE_SHEET_MAX_HEIGHT = mobileTallBottomSheetDialogClass;

/** @deprecated */
export const mobileBottomSheetDialogMobileClass = mobileBottomSheetDialogClass;

/** @deprecated */
export const mobileSheetBodyPaddingBottom = mobileSheetSafePaddingBottom;
