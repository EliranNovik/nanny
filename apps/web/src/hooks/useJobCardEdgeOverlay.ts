import { useCallback, useEffect, useState } from "react";

/** Overlay when at least this fraction of the card sits above the viewport top (scrolled off the top). */
const MIN_TOP_HIDDEN_FRACTION_FOR_OVERLAY = 0.6;

/**
 * Tracks `[data-job-card]` elements that are mostly scrolled away **upward** (off the top).
 * Bottom clipping / bottom nav does **not** trigger the overlay.
 * Recomputes on scroll/resize; `listKey` should change when cards mount/unmount.
 */
export function useJobCardEdgeOverlay(listKey: string | number) {
  const [clippedIds, setClippedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const compute = useCallback(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    const viewportTop = vv?.offsetTop ?? 0;

    const next = new Set<string>();
    document.querySelectorAll<HTMLElement>("[data-job-card]").forEach((el) => {
      const id = el.id;
      if (!id) return;
      const r = el.getBoundingClientRect();
      if (r.height <= 0) return;

      // Portion of the card that lies above the visual viewport top edge (hidden by scrolling up)
      const hiddenTopPx = Math.min(r.height, Math.max(0, viewportTop - r.top));
      const hiddenTopFraction = hiddenTopPx / r.height;

      if (hiddenTopFraction >= MIN_TOP_HIDDEN_FRACTION_FOR_OVERLAY) {
        next.add(id);
      }
    });

    setClippedIds((prev) => {
      if (prev.size === next.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    tick();
    const scrollOpts: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", tick, scrollOpts);
    window.addEventListener("resize", tick);
    const vv = window.visualViewport;
    vv?.addEventListener("scroll", tick, scrollOpts);
    vv?.addEventListener("resize", tick);

    const ro = new ResizeObserver(() => tick());
    ro.observe(document.documentElement);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", tick, scrollOpts);
      window.removeEventListener("resize", tick);
      vv?.removeEventListener("scroll", tick, scrollOpts);
      vv?.removeEventListener("resize", tick);
      ro.disconnect();
    };
  }, [compute, listKey]);

  return clippedIds;
}
