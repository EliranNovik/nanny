import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMinMd } from "@/hooks/useIsMinMd";

const REVEAL_PX = 88;
const HIDE_THRESHOLD = -56;

type Props = {
  children: React.ReactNode;
  onHide: () => void;
  className?: string;
};

export function InboxChatSwipeRow({ children, onHide, className }: Props) {
  const isMinMd = useIsMinMd();
  const [offset, setOffset] = useState(0);
  const [touching, setTouching] = useState(false);
  const startX = useRef(0);
  const startOff = useRef(0);
  const offsetRef = useRef(0);

  if (isMinMd) {
    return <div className={className}>{children}</div>;
  }

  const px = Math.min(0, Math.max(-REVEAL_PX, offset));

  const endDrag = () => {
    setTouching(false);
    const o = offsetRef.current;
    if (o <= HIDE_THRESHOLD) {
      onHide();
      setOffset(0);
      offsetRef.current = 0;
      return;
    }
    if (o < -16) {
      setOffset(-REVEAL_PX);
      offsetRef.current = -REVEAL_PX;
    } else {
      setOffset(0);
      offsetRef.current = 0;
    }
  };

  return (
    <div
      className={cn(
        "relative w-full min-w-0 max-w-full overflow-hidden [touch-action:pan-y]",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-destructive text-destructive-foreground text-sm font-semibold"
        role="button"
        tabIndex={0}
        onClick={() => {
          onHide();
          setOffset(0);
          offsetRef.current = 0;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onHide();
            setOffset(0);
            offsetRef.current = 0;
          }
        }}
      >
        Hide
      </div>
      <div
        className={cn(
          "relative w-full min-w-0 max-w-full bg-background will-change-transform",
          !touching && "transition-transform duration-200 ease-out",
        )}
        style={{ transform: `translateX(${px}px)` }}
        onTouchStart={(e) => {
          setTouching(true);
          startX.current = e.touches[0].clientX;
          startOff.current = offsetRef.current;
        }}
        onTouchMove={(e) => {
          const dx = e.touches[0].clientX - startX.current;
          const next = Math.min(0, Math.max(-REVEAL_PX, startOff.current + dx));
          offsetRef.current = next;
          setOffset(next);
        }}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
      >
        {children}
      </div>
    </div>
  );
}
