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

const SNAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

type MobileSnapBottomSheetProps = {
  /** When true, sheet is fully expanded; when false, only the peek/collapsed chrome is visible. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Peek row (handle + title) — always visible at the top of the sheet when collapsed. */
  collapsed: ReactNode;
  /** Full sheet body — scrollable when expanded. */
  children: ReactNode;
  /** Fixed offset from viewport bottom (e.g. above bottom nav). */
  bottomOffsetClass?: string;
  className?: string;
  /** Max expanded height as CSS value. */
  maxHeight?: string;
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
  bottomOffsetClass = "bottom-0",
  className,
  maxHeight = "min(92dvh, 860px)",
  ariaLabel = "Drag to expand or collapse",
  onDismiss,
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

  const collapsedOffsetPx = Math.max(0, expandedHeightPx - peekHeightPx);

  const settledTranslatePx = expanded ? 0 : collapsedOffsetPx;
  const translatePx = dragTranslatePx ?? settledTranslatePx;

  useLayoutEffect(() => {
    const vhCap = Math.min(window.innerHeight * 0.92, 860);
    setExpandedHeightPx(vhCap);
    if (peekRef.current) setPeekHeightPx(peekRef.current.offsetHeight || 88);
  }, [expanded, children]);

  useEffect(() => {
    const onResize = () => {
      const vhCap = Math.min(window.innerHeight * 0.92, 860);
      setExpandedHeightPx(vhCap);
      if (peekRef.current) setPeekHeightPx(peekRef.current.offsetHeight || 88);
    };
    const ro = new ResizeObserver(onResize);
    if (peekRef.current) ro.observe(peekRef.current);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const clampTranslate = (value: number) => {
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

    let nextExpanded = expanded;
    if (flickDown) nextExpanded = false;
    else if (flickUp) nextExpanded = true;
    else nextExpanded = clamped < mid;

    setDragTranslatePx(null);
    setDragging(false);
    dragRef.current.active = false;

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
    collapsedOffsetPx > 0
      ? Math.max(0, Math.min(1, 1 - translatePx / collapsedOffsetPx))
      : expanded
        ? 1
        : 0;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[125] md:hidden",
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
        aria-labelledby={`${sheetId}-peek`}
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[1.75rem] border border-border/60 border-b-0 bg-background shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:shadow-[0_-12px_48px_-16px_rgba(0,0,0,0.55)] dark:ring-white/[0.05]",
          !dragging && "will-change-transform",
        )}
        style={{
          height: expandedHeightPx > 0 ? `${expandedHeightPx}px` : maxHeight,
          maxHeight,
          transform: `translate3d(0, ${translatePx}px, 0)`,
          transition: dragging
            ? "none"
            : `transform 0.38s ${SNAP_EASING}`,
        }}
      >
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

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y"
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
