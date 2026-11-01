import { useEffect, useState } from "react";

export const TABLET_MIN_SHORT_SIDE = 600;

function readViewport() {
  if (typeof window === "undefined") {
    return { isTablet: false, isLandscape: false };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    isTablet: Math.min(width, height) >= TABLET_MIN_SHORT_SIDE,
    isLandscape: width > height,
  };
}

/**
 * Mirrors the native app breakpoint: tablet mode starts when the viewport's
 * shortest side is at least 600px, regardless of orientation.
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
