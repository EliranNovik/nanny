import { useEffect, useRef } from "react";
import { useDiscoverHomeScrollHeader } from "@/context/DiscoverHomeScrollHeaderContext";
import { subscribeCommunityFeedOverlay } from "@/lib/communityFeedOverlayState";
import { MOBILE_SHELL_COLLAPSE_PROGRESS_VAR } from "@/hooks/useMobileShellScrollCollapse";

const SCROLL_DELTA_THRESHOLD = 6;
const TOP_ALWAYS_SHOW_PX = 12;

/**
 * Mobile global feed: hide the fixed app header while scrolling down, show again on scroll up.
 * Drives `--mobile-shell-collapse-progress` (0 = visible, 1 = hidden).
 */
export function useMobileScrollDirectionHeaderHide(enabled: boolean) {
  const { setCollapseProgress } = useDiscoverHomeScrollHeader();
  const lastScrollYRef = useRef(0);
  const overlayOpenRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCollapseProgress(0);
      document.documentElement.style.setProperty(MOBILE_SHELL_COLLAPSE_PROGRESS_VAR, "0");
      return;
    }

    const mq = window.matchMedia("(max-width: 767.98px)");

    const setHidden = (hidden: boolean) => {
      const p = hidden && !overlayOpenRef.current ? 1 : 0;
      setCollapseProgress(p);
      document.documentElement.style.setProperty(MOBILE_SHELL_COLLAPSE_PROGRESS_VAR, String(p));
    };

    const applyFromScroll = () => {
      if (!mq.matches) {
        setHidden(false);
        return;
      }
      if (overlayOpenRef.current) {
        setHidden(false);
        lastScrollYRef.current = window.scrollY ?? document.documentElement.scrollTop;
        return;
      }

      const y = window.scrollY ?? document.documentElement.scrollTop;
      if (y <= TOP_ALWAYS_SHOW_PX) {
        setHidden(false);
        lastScrollYRef.current = y;
        return;
      }

      const delta = y - lastScrollYRef.current;
      if (Math.abs(delta) < SCROLL_DELTA_THRESHOLD) return;

      setHidden(delta > 0);
      lastScrollYRef.current = y;
    };

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyFromScroll();
      });
    };

    const unsubOverlay = subscribeCommunityFeedOverlay((open) => {
      overlayOpenRef.current = open;
      if (open) setHidden(false);
    });

    const onMqChange = () => {
      if (!mq.matches) setHidden(false);
      else applyFromScroll();
    };

    lastScrollYRef.current = window.scrollY ?? document.documentElement.scrollTop;
    mq.addEventListener("change", onMqChange);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      unsubOverlay();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("scroll", onScroll);
      setCollapseProgress(0);
      document.documentElement.style.removeProperty(MOBILE_SHELL_COLLAPSE_PROGRESS_VAR);
    };
  }, [enabled, setCollapseProgress]);
}
