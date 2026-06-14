import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { cn } from "@/lib/utils";
import {
  MOBILE_BOTTOM_SHEET_EDGE,
  mobileSheetSafePaddingBottom,
} from "@/lib/mobileModalLayout";

/** Sit above the mobile bottom tab bar (legacy export). */
export const discoverMobileSheetBottomOffset = MOBILE_BOTTOM_SHEET_EDGE;

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

type DiscoverOverlaySnapSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  bottomOffsetClass?: string;
};

/** Mobile: native swipe snap sheet. Desktop: centered bottom sheet dialog. */
export function DiscoverOverlaySnapSheet({
  open,
  onOpenChange,
  title,
  children,
  bottomOffsetClass = discoverMobileSheetBottomOffset,
}: DiscoverOverlaySnapSheetProps) {
  const isMobile = useIsMobileViewport();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (open) setExpanded(true);
  }, [open]);

  const dismiss = () => onOpenChange(false);

  if (isMobile) {
    if (!open) return null;
    return (
      <MobileSnapBottomSheet
        expanded={expanded}
        onExpandedChange={(next) => {
          setExpanded(next);
          if (!next) dismiss();
        }}
        onDismiss={dismiss}
        bottomOffsetClass={bottomOffsetClass}
        ariaLabel="Drag down to close"
        collapsed={
          <div className="flex w-full flex-col items-center bg-card px-4 pb-2 pt-2">
            <div
              aria-hidden
              className="h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/35"
            />
            <p className="sr-only">{title}</p>
          </div>
        }
      >
        <div className={cn("bg-card", mobileSheetSafePaddingBottom)}>
          {children}
        </div>
      </MobileSnapBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={discoverSheetDialogContentClassName}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className={discoverSheetInnerCardClassName}>
          <DiscoverSheetTopHandle />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Outer Radix content: bottom sheet on all breakpoints (slides up from bottom, not from the side). */
export const discoverSheetDialogContentClassName = cn(
  /** Mobile: min height so short posts still feel like a proper sheet (not a stub). */
  "flex max-h-[min(92dvh,860px)] max-md:min-h-[68dvh] w-full max-w-[min(100vw-1rem,26rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none",
  "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "fixed left-1/2 top-auto z-[130] -translate-x-1/2 translate-y-0",
  "max-md:bottom-0 md:bottom-0",
  // Override default DialogContent (centered) slide/zoom — otherwise open animation reads as from the side.
  "!data-[state=open]:slide-in-from-left-0 !data-[state=open]:slide-in-from-top-0",
  "!data-[state=closed]:slide-out-to-left-0 !data-[state=closed]:slide-out-to-top-0",
  "!data-[state=open]:zoom-in-100 !data-[state=closed]:zoom-out-100",
  "!data-[state=open]:slide-in-from-bottom !data-[state=closed]:slide-out-to-bottom",
);

/** Single white/card surface from the top (handle closes sheet). */
export const discoverSheetInnerCardClassName = cn(
  "relative flex h-full min-h-0 w-full max-h-[min(92dvh,860px)] max-md:min-h-[68dvh] flex-1 flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-sm sm:rounded-t-2xl",
);

/** Pill “stick” at top of sheet — tap to close (DialogClose). */
export function DiscoverSheetTopHandle() {
  return (
    <div className="flex shrink-0 justify-center bg-card px-4 pb-1 pt-3">
      <DialogClose asChild>
        <button
          type="button"
          className="flex w-full max-w-[5rem] flex-col items-center rounded-xl py-1.5 outline-none transition-opacity hover:opacity-75 active:opacity-60 focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-label="Close"
        >
          <span className="h-1.5 w-11 rounded-full bg-muted-foreground/35" />
        </button>
      </DialogClose>
    </div>
  );
}
