import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Outer Radix content: bottom sheet on all breakpoints (slides up from bottom, not from the side). */
export const discoverSheetDialogContentClassName = cn(
  "flex max-h-[min(92dvh,860px)] w-full max-w-[min(100vw-1rem,26rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none",
  "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "fixed bottom-0 left-1/2 top-auto z-50 -translate-x-1/2 translate-y-0",
  "!data-[state=open]:zoom-in-100 !data-[state=closed]:zoom-out-100",
  "!data-[state=open]:slide-in-from-bottom-8 !data-[state=closed]:slide-out-to-bottom-8"
);

/** Single white/card surface from the top (handle closes sheet). */
export const discoverSheetInnerCardClassName = cn(
  "relative flex h-full min-h-0 w-full max-h-[min(92dvh,860px)] flex-1 flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-sm sm:rounded-t-2xl"
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
