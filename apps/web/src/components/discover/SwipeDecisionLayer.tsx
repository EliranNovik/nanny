import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent,
} from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SwipeDecisionVariant = "incoming" | "availability";

type Props = {
  children: React.ReactNode;
  disabled?: boolean;
  /** Finger moves left (card exits left) — typically decline / pass. */
  onSwipeLeft: () => void | Promise<void>;
  /** Finger moves right — typically accept / hire. */
  onSwipeRight: () => void | Promise<void>;
  variant?: SwipeDecisionVariant;
  className?: string;
  /** Left edge stamp (green, accept direction). Defaults: ACCEPT / HIRE. */
  leftStamp?: string;
  /** Right edge stamp (red, decline direction). Defaults: DECLINE / PASS. */
  rightStamp?: string;
};

const THRESHOLD_RATIO = 0.2;
const MAX_ROTATE = 10;

/**
 * Horizontal swipe with Tinder-style overlays. Uses pointer events; vertical scroll wins
 * if the first meaningful move is mostly vertical.
 */
export function SwipeDecisionLayer({
  children,
  disabled,
  onSwipeLeft,
  onSwipeRight,
  variant = "incoming",
  className,
  leftStamp,
  rightStamp,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [fling, setFling] = useState<"left" | "right" | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const modeRef = useRef<null | "swipe" | "scroll">(null);
  const pointerIdRef = useRef<number | null>(null);

  /** Left edge = accept (green), shown when dragging right. Right edge = decline (red), when dragging left. */
  const acceptLabel =
    leftStamp ?? (variant === "incoming" ? "ACCEPT" : "HIRE");
  const declineLabel =
    rightStamp ?? (variant === "incoming" ? "DECLINE" : "PASS");

  const finishFling = useCallback(
    async (side: "left" | "right") => {
      try {
        if (side === "left") await Promise.resolve(onSwipeLeft());
        else await Promise.resolve(onSwipeRight());
      } finally {
        setFling(null);
        setDragX(0);
      }
    },
    [onSwipeLeft, onSwipeRight]
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || fling) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    modeRef.current = null;
    pointerIdRef.current = e.pointerId;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || fling || !startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;

    if (!modeRef.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx) * 1.05) {
        modeRef.current = "scroll";
        return;
      }
      modeRef.current = "swipe";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    if (modeRef.current === "swipe") {
      e.preventDefault();
      setDragX(dx);
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    startRef.current = null;

    if (modeRef.current !== "swipe") {
      modeRef.current = null;
      setDragX(0);
      return;
    }
    modeRef.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const w = rootRef.current?.offsetWidth ?? 320;
    const threshold = Math.max(72, w * THRESHOLD_RATIO);

    if (dragX <= -threshold) {
      setFling("left");
      return;
    }
    if (dragX >= threshold) {
      setFling("right");
      return;
    }
    setDragX(0);
  };

  const onInnerTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (!fling) return;
    const side = fling;
    setDragX(0);
    void finishFling(side);
  };

  const w = typeof window !== "undefined" ? window.innerWidth : 400;
  const rotate = fling ? (fling === "left" ? -MAX_ROTATE : MAX_ROTATE) : Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dragX * 0.06));
  const tx = fling === "left" ? -w * 1.2 : fling === "right" ? w * 1.2 : dragX;

  let acceptEdgeOpacity = 0;
  let declineEdgeOpacity = 0;
  if (fling === "right") {
    acceptEdgeOpacity = 1;
  } else if (fling === "left") {
    declineEdgeOpacity = 1;
  } else {
    acceptEdgeOpacity = Math.min(1, Math.max(0, dragX / (w * 0.35)));
    declineEdgeOpacity = Math.min(1, Math.max(0, -dragX / (w * 0.35)));
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative touch-pan-y", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {/* Left = accept (green); right = decline (red) — matches swipe direction feedback */}
      <div
        className="pointer-events-none absolute inset-y-3 left-2 z-[5] flex w-[min(28%,7rem)] items-center justify-center rounded-2xl border-2 border-emerald-500/55 bg-gradient-to-br from-emerald-500/25 to-teal-600/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[2px] dark:from-emerald-500/20 dark:to-emerald-950/30"
        style={{
          opacity: acceptEdgeOpacity > 0 ? 0.12 + acceptEdgeOpacity * 0.88 : 0,
        }}
        aria-hidden
      >
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          <span className="text-[10px] font-black tracking-[0.2em] text-emerald-800 dark:text-emerald-200">{acceptLabel}</span>
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-y-3 right-2 z-[5] flex w-[min(28%,7rem)] items-center justify-center rounded-2xl border-2 border-red-500/55 bg-gradient-to-br from-red-500/25 to-rose-600/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[2px] dark:from-red-500/20 dark:to-rose-950/30"
        style={{
          opacity: declineEdgeOpacity > 0 ? 0.12 + declineEdgeOpacity * 0.88 : 0,
        }}
        aria-hidden
      >
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <X className="h-7 w-7 text-red-600 dark:text-red-400" strokeWidth={2.5} />
          <span className="text-[10px] font-black tracking-[0.2em] text-red-700 dark:text-red-300">{declineLabel}</span>
        </div>
      </div>

      <div
        className={cn(
          /** Opaque surface so idle edge hints (z-[5]) never show through plain/transparent cards */
          "relative z-[6] flex min-h-0 flex-1 flex-col overflow-hidden bg-card will-change-transform",
          fling && "transition-[transform] duration-300 ease-out"
        )}
        style={{
          transform: `translateX(${tx}px) rotate(${rotate}deg)`,
        }}
        onTransitionEnd={onInnerTransitionEnd}
      >
        {children}
      </div>
    </div>
  );
}
