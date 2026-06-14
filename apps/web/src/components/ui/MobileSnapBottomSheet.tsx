import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/utils";
import { MOBILE_BOTTOM_SHEET_EDGE } from "@/lib/mobileModalLayout";

const SNAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

type MobileSnapBottomSheetProps = {
  /** When true, sheet is fully expanded; when false, only the peek/collapsed chrome is visible. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Peek row (handle + title) — always visible at the top of the sheet when collapsed. */
  collapsed?: ReactNode;
  /** Full sheet body — scrollable when expanded. */
  children: ReactNode;
  /** Dismiss-only sheets: no peek strip; swipe from body/header to close. */
  hidePeek?: boolean;
  /** `aria-labelledby` target when `hidePeek` (id on the in-body title). */
  titleId?: string;
  /** Fixed offset from viewport bottom (e.g. above bottom nav). */
  bottomOffsetClass?: string;
  className?: string;
  /** Max expanded height as CSS value. */
  maxHeight?: string;
  /** `viewport` fills up to maxHeight; `content` hugs body height (capped). */
  heightMode?: "viewport" | "content";
  /** aria-label for the drag handle region */
  ariaLabel?: string;
  /** Overlay modals: swipe-to-close dismisses entirely instead of snapping to peek. */
  onDismiss?: () => void;
};

export function MobileSnapBottomSheet({
  expanded,
  onExpandedChange,
  collapsed,
  children,
  bottomOffsetClass = MOBILE_BOTTOM_SHEET_EDGE,
  className,
  maxHeight = "min(92dvh, 860px)",
  heightMode = "viewport",
  ariaLabel = "Drag to expand or collapse",
  onDismiss,
  hidePeek = false,
  titleId,
}: MobileSnapBottomSheetProps) {
  const sheetId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [expandedHeightPx, setExpandedHeightPx] = useState(0);
  const [peekHeightPx, setPeekHeightPx] = useState(88);
  const [dragTranslatePx, setDragTranslatePx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const dragRef = useRef({
    active: false,
    startY: 0,
    startTranslate: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
  });
  const scrollTouchRef = useRef({
    tracking: false,
    startY: 0,
  });

  const fitContent = heightMode === "content";

  const effectivePeekHeightPx = hidePeek ? 0 : peekHeightPx;

  const collapsedOffsetPx = fitContent
    ? 0
    : Math.max(0, expandedHeightPx - effectivePeekHeightPx);

  const settledTranslatePx = fitContent ? 0 : expanded ? 0 : collapsedOffsetPx;
  const translatePx = dragTranslatePx ?? settledTranslatePx;

  useLayoutEffect(() => {
    const vhCap = Math.min(window.innerHeight * 0.92, 860);
    if (fitContent && sheetRef.current) {
      const measured = sheetRef.current.scrollHeight;
      setExpandedHeightPx(Math.min(measured, vhCap));
    } else {
      setExpandedHeightPx(vhCap);
    }
    if (hidePeek) setPeekHeightPx(0);
    else if (peekRef.current) setPeekHeightPx(peekRef.current.offsetHeight || 88);
  }, [expanded, children, fitContent, hidePeek]);

  useEffect(() => {
    const onResize = () => {
      const vhCap = Math.min(window.innerHeight * 0.92, 860);
      if (fitContent && sheetRef.current) {
        const measured = sheetRef.current.scrollHeight;
        setExpandedHeightPx(Math.min(measured, vhCap));
      } else {
        setExpandedHeightPx(vhCap);
      }
      if (hidePeek) setPeekHeightPx(0);
      else if (peekRef.current) setPeekHeightPx(peekRef.current.offsetHeight || 88);
    };
    const ro = new ResizeObserver(onResize);
    if (sheetRef.current) ro.observe(sheetRef.current);
    if (!hidePeek && peekRef.current) ro.observe(peekRef.current);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [fitContent, hidePeek]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const dismissDragCapPx = fitContent
    ? Math.max(expandedHeightPx, effectivePeekHeightPx, 240)
    : collapsedOffsetPx;

  const clampTranslate = (value: number) => {
    if (fitContent) {
      return Math.min(Math.max(value, 0), dismissDragCapPx);
    }
    if (collapsedOffsetPx <= 0) return 0;
    return Math.min(Math.max(value, 0), collapsedOffsetPx);
  };

  const finishDrag = () => {
    const { velocityY, startTranslate, startY, lastY } = dragRef.current;
    const current =
      dragTranslatePx ?? startTranslate + (lastY - startY);
    const clamped = clampTranslate(current);

    const flickDown = velocityY > 0.55;
    const flickUp = velocityY < -0.55;
    const mid = collapsedOffsetPx * 0.42;

    setDragTranslatePx(null);
    setDragging(false);
    dragRef.current.active = false;

    if (fitContent && onDismiss) {
      if (flickDown || clamped > dismissDragCapPx * 0.22) {
        onDismiss();
        return;
      }
      onExpandedChange(true);
      return;
    }

    let nextExpanded = expanded;
    if (flickDown) nextExpanded = false;
    else if (flickUp) nextExpanded = true;
    else nextExpanded = clamped < mid;

    if (!nextExpanded && onDismiss) {
      onDismiss();
      return;
    }

    onExpandedChange(nextExpanded);
  };

  const onHandleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const base = dragTranslatePx ?? settledTranslatePx;
    dragRef.current = {
      active: true,
      startY: touch.clientY,
      startTranslate: base,
      lastY: touch.clientY,
      lastTime: performance.now(),
      velocityY: 0,
    };
    setDragging(true);
  };

  const onHandleTouchMove = (e: TouchEvent) => {
    if (!dragRef.current.active) return;
    const touch = e.touches[0];
    if (!touch) return;

    const now = performance.now();
    const dy = touch.clientY - dragRef.current.lastY;
    const dt = Math.max(now - dragRef.current.lastTime, 1);
    dragRef.current.velocityY = dy / dt;
    dragRef.current.lastY = touch.clientY;
    dragRef.current.lastTime = now;

    const delta = touch.clientY - dragRef.current.startY;
    setDragTranslatePx(
      clampTranslate(dragRef.current.startTranslate + delta),
    );

    if (Math.abs(delta) > 6) e.preventDefault();
  };

  const onHandleTouchEnd = () => {
    if (!dragRef.current.active) return;
    finishDrag();
  };

  const onScrollAreaTouchStart = (e: TouchEvent) => {
    if (!expanded) return;
    const touch = e.touches[0];
    if (!touch) return;
    scrollTouchRef.current = {
      tracking: true,
      startY: touch.clientY,
    };
  };

  const onScrollAreaTouchMove = (e: TouchEvent) => {
    const el = scrollRef.current;
    const touch = e.touches[0];
    if (!touch || !el) return;

    if (dragRef.current.active) {
      onHandleTouchMove(e);
      return;
    }

    if (!scrollTouchRef.current.tracking) return;

    const dy = touch.clientY - scrollTouchRef.current.startY;

    // Scrolling up into content — let the browser handle it.
    if (dy < 0) return;

    // Only pull the sheet down when scrolled to the top.
    if (el.scrollTop > 0) return;

    if (dy <= 10) return;

    const base = dragTranslatePx ?? settledTranslatePx;
    dragRef.current = {
      active: true,
      startY: scrollTouchRef.current.startY,
      startTranslate: base,
      lastY: touch.clientY,
      lastTime: performance.now(),
      velocityY: 0,
    };
    setDragging(true);
    onHandleTouchMove(e);
  };

  const onScrollAreaTouchEnd = () => {
    scrollTouchRef.current.tracking = false;
    if (dragRef.current.active) {
      finishDrag();
    }
  };

  const backdropOpacity =
    fitContent && dismissDragCapPx > 0
      ? Math.max(0, Math.min(1, 1 - translatePx / dismissDragCapPx))
      : collapsedOffsetPx > 0
        ? Math.max(0, Math.min(1, 1 - translatePx / collapsedOffsetPx))
        : expanded
          ? 1
          : 0;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[130] md:hidden",
        bottomOffsetClass,
        className,
      )}
    >
      <button
        type="button"
        aria-hidden={!expanded}
        tabIndex={expanded ? 0 : -1}
        className={cn(
          "pointer-events-auto fixed inset-0 bg-black/45 transition-opacity duration-300",
          expanded ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={
          dragging
            ? { opacity: backdropOpacity * 0.45, transition: "none" }
            : undefined
        }
        onClick={() => (onDismiss ? onDismiss() : onExpandedChange(false))}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={expanded}
        aria-labelledby={hidePeek && titleId ? titleId : `${sheetId}-peek`}
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[1.75rem] border border-border/60 border-b-0 bg-background shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-[0_-12px_48px_-16px_rgba(0,0,0,0.55)] dark:ring-white/[0.05]",
          fitContent && "h-auto",
          !dragging && "will-change-transform",
        )}
        style={
          fitContent
            ? {
                maxHeight,
                transform: `translate3d(0, ${translatePx}px, 0)`,
                transition: dragging
                  ? "none"
                  : `transform 0.38s ${SNAP_EASING}`,
              }
            : {
                height: expandedHeightPx > 0 ? `${expandedHeightPx}px` : maxHeight,
                maxHeight,
                transform: `translate3d(0, ${translatePx}px, 0)`,
                transition: dragging
                  ? "none"
                  : `transform 0.38s ${SNAP_EASING}`,
              }
        }
      >
        {!hidePeek ? (
          <div
            ref={peekRef}
            id={`${sheetId}-peek`}
            className="shrink-0 touch-none select-none"
            onTouchStart={onHandleTouchStart}
            onTouchMove={onHandleTouchMove}
            onTouchEnd={onHandleTouchEnd}
            onTouchCancel={onHandleTouchEnd}
            aria-label={ariaLabel}
          >
            {collapsed}
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className={cn(
            "min-h-0 flex-1 overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y",
            fitContent ? "overflow-visible" : "overflow-y-auto",
          )}
          onTouchStart={onScrollAreaTouchStart}
          onTouchMove={onScrollAreaTouchMove}
          onTouchEnd={onScrollAreaTouchEnd}
          onTouchCancel={onScrollAreaTouchEnd}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
