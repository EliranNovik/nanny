import { useEffect, useState } from "react";

export const TABLET_MIN_SHORT_SIDE = 600;
/** Matches Tailwind `md` — use for web header/sidebar chrome so it never falls through gaps. */
export const DESKTOP_MIN_WIDTH = 768;

function readViewport() {
  if (typeof window === "undefined") {
    return { isTablet: false, isLandscape: false, isMdUp: false };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    isTablet: Math.min(width, height) >= TABLET_MIN_SHORT_SIDE,
    isLandscape: width > height,
    isMdUp: width >= DESKTOP_MIN_WIDTH,
  };
}

/**
 * Mirrors the native app breakpoint: tablet mode starts when the viewport's
 * shortest side is at least 600px, regardless of orientation.
 * `isMdUp` follows CSS `md` (768px width) for web header/sidebar visibility.
 */
export function useTabletViewport() {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return viewport;
}
