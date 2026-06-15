import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { discoverRequestCarouselArrowBtnClass } from "@/components/discover/discoverRequestCarouselCardShared";

export function useDiscoverRequestCarouselScroll() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.floor(el.clientWidth * 0.85)) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  return { scrollerRef, scrollByDir };
}

type CarouselArrowsProps = {
  onScrollLeft: () => void;
  onScrollRight: () => void;
  className?: string;
};

export function DiscoverRequestCarouselArrows({
  onScrollLeft,
  onScrollRight,
  className,
}: CarouselArrowsProps) {
  return (
    <div className={cn("hidden items-center gap-1.5 md:flex", className)}>
      <button
        type="button"
        onClick={onScrollLeft}
        aria-label="Scroll previous"
        className={discoverRequestCarouselArrowBtnClass}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onScrollRight}
        aria-label="Scroll next"
        className={discoverRequestCarouselArrowBtnClass}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
