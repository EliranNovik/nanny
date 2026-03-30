import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Mobile: each slide is ~88% of the **track** (scroller inner width). Desktop: grid cell.
 */
export const jobCardCarouselItemClass =
  "min-w-0 w-[88%] max-w-[88%] shrink-0 snap-start md:w-full md:max-w-none md:shrink md:snap-normal";

/**
 * Full-bleed on small screens: `left-1/2 -translate-x-1/2 w-screen` so the track uses the real
 * viewport width. Without this, shell padding boxes the carousel in — the gap looks like a white
 * “mask” and the next card peeks under it. `100vw` math alone cannot fix a narrow parent.
 */
export function JobCardsCarousel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    if (maxScroll <= 4) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < maxScroll - 6);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollHints();
    const onScroll = () => updateScrollHints();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateScrollHints());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [updateScrollHints, children]);

  const scrollStep = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-job-card]");
    const gap = 12;
    const step = card ? card.offsetWidth + gap : Math.min(el.clientWidth * 0.75, 360);
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        className,
        "relative min-w-0 md:mx-auto md:max-w-6xl lg:max-w-7xl",
        /* Break out of app-desktop-shell horizontal padding on mobile */
        "max-md:left-1/2 max-md:w-screen max-md:max-w-[100dvw] max-md:-translate-x-1/2 max-md:px-3",
        "md:translate-x-0 md:px-0 md:w-full"
      )}
    >
      <div
        ref={scrollerRef}
        className={cn(
          "flex min-h-0 min-w-0 w-full touch-pan-x gap-3 overflow-x-auto overflow-y-visible pb-2 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:grid md:grid-cols-2 md:gap-7 md:overflow-visible md:pb-0 md:pt-0 md:snap-none lg:grid-cols-3 lg:gap-8"
        )}
      >
        {children}
      </div>

      {/* Below the strip: no absolute overlay (backdrop-blur / full-height stacking was masking the next card on the right). */}
      {(canScrollLeft || canScrollRight) && (
        <div className="mt-1 flex items-center justify-end gap-2 md:hidden">
          {canScrollLeft && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0 rounded-full border-border/80 bg-card text-foreground shadow-sm dark:bg-zinc-900 dark:text-white"
              onClick={() => scrollStep(-1)}
              aria-label="Previous cards"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {canScrollRight && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0 rounded-full border-border/80 bg-card text-foreground shadow-sm dark:bg-zinc-900 dark:text-white"
              onClick={() => scrollStep(1)}
              aria-label="More cards"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
