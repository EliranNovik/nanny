import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Ignore subpixel noise and tiny overflow from bottom-nav padding rounding. */
const OVERFLOW_THRESHOLD_PX = 8;

/**
 * When page content fits in the viewport, disables document scrolling (no rubber-band /
 * empty scroll). When content is taller than the viewport, restores vertical scrolling.
 * Recalculates on route change, resize, and layout changes (ResizeObserver on body).
 */
export function DocumentScrollOverflowGate() {
  const location = useLocation();

  useLayoutEffect(() => {
    const el = document.documentElement;
    const body = document.body;
    let raf = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const delta = el.scrollHeight - el.clientHeight;
        const overflows = delta > OVERFLOW_THRESHOLD_PX;
        el.style.overflowY = overflows ? "auto" : "hidden";
        body.style.overflowY = overflows ? "auto" : "hidden";
      });
    };

    const ro = new ResizeObserver(() => apply());
    ro.observe(body);
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);

    apply();
    for (const ms of [0, 150, 500]) {
      timeouts.push(setTimeout(apply, ms));
    }

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      el.style.overflowY = "";
      body.style.overflowY = "";
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
}
