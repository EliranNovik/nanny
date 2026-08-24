import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { discoverRequestCarouselArrowBtnClass } from "@/components/discover/discoverRequestCarouselCardShared";

export function useDiscoverRequestCarouselScroll(itemCount = 0) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const syncActiveIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    children.forEach((child, i) => {
      const center = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveIndex((prev) => (prev === best ? prev : best));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncActiveIndex();
    el.addEventListener("scroll", syncActiveIndex, { passive: true });
    return () => el.removeEventListener("scroll", syncActiveIndex);
  }, [syncActiveIndex, itemCount]);

  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.floor(el.clientWidth * 0.85)) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollerRef.current;
    const child = el?.children[index] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({
      left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, []);

  return { scrollerRef, scrollByDir, activeIndex, scrollToIndex };
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

type TabIndicatorProps = {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
  activeClassName?: string;
};

export function DiscoverCarouselTabIndicator({
  count,
  activeIndex,
  onSelect,
  ariaLabel,
  activeClassName = "bg-emerald-600",
}: TabIndicatorProps) {
  if (count <= 1) return null;

  return (
    <div
      className="mt-3.5 flex items-center justify-center gap-1.5"
      role="tablist"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${ariaLabel} ${index + 1}`}
            onClick={() => onSelect(index)}
            className="flex h-6 items-center justify-center px-0.5"
          >
            <span
              className={cn(
                "h-1.5 rounded-full transition-all",
                active ? cn("w-6", activeClassName) : "w-1.5 bg-zinc-300 dark:bg-zinc-600",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
