import { useEffect, useRef } from "react";
import { useDiscoverHomeScrollHeader } from "@/context/DiscoverHomeScrollHeaderContext";

/** Pixels scrolled before collapse begins. */
export const MOBILE_SHELL_COLLAPSE_SCROLL_START_PX = 6;
/** Pixels of scroll over which collapse goes 0 → 1 (scroll-linked). */
export const MOBILE_SHELL_COLLAPSE_SCROLL_RANGE_PX = 96;

/** CSS var on `document.documentElement` — shared by discover home + /jobs mobile. */
export const MOBILE_SHELL_COLLAPSE_PROGRESS_VAR = "--mobile-shell-collapse-progress";

export function mobileShellCollapseProgress(scrollY: number): number {
  const y = Math.max(0, scrollY);
  if (y <= MOBILE_SHELL_COLLAPSE_SCROLL_START_PX) return 0;
  const end =
    MOBILE_SHELL_COLLAPSE_SCROLL_START_PX + MOBILE_SHELL_COLLAPSE_SCROLL_RANGE_PX;
  if (y >= end) return 1;
  return (y - MOBILE_SHELL_COLLAPSE_SCROLL_START_PX) / MOBILE_SHELL_COLLAPSE_SCROLL_RANGE_PX;
}

/**
 * Mobile: top shell padding + fixed strips follow scroll (0…1). Only one route should mount this at a time.
 * @param enabled — false clears progress (e.g. route not showing main chrome).
 */
export function useMobileShellScrollCollapse(enabled: boolean) {
  const { setCollapseProgress } = useDiscoverHomeScrollHeader();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCollapseProgress(0);
      document.documentElement.style.setProperty(MOBILE_SHELL_COLLAPSE_PROGRESS_VAR, "0");
      return;
    }

    const mq = window.matchMedia("(max-width: 767.98px)");

    const apply = () => {
      if (!mq.matches) {
        setCollapseProgress(0);
        document.documentElement.style.setProperty(MOBILE_SHELL_COLLAPSE_PROGRESS_VAR, "0");
        return;
      }
      const y = window.scrollY ?? document.documentElement.scrollTop;
      const p = mobileShellCollapseProgress(y);
      setCollapseProgress(p);
      document.documentElement.style.setProperty(
        MOBILE_SHELL_COLLAPSE_PROGRESS_VAR,
        String(p),
      );
    };

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        apply();
      });
    };

    const onMqChange = () => {
      apply();
    };

    apply();
    mq.addEventListener("change", onMqChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("scroll", onScroll);
      setCollapseProgress(0);
      document.documentElement.style.removeProperty(MOBILE_SHELL_COLLAPSE_PROGRESS_VAR);
    };
  }, [enabled, setCollapseProgress]);
}
