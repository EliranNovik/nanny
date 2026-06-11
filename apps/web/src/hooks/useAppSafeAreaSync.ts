import { useEffect } from "react";

/**
 * iOS Safari: env(safe-area-inset-*) is unreliable while browser chrome shows/hides.
 * Track visualViewport gaps so fixed chrome offsets correctly and scroll content can
 * extend under glass nav + the notch/status-bar zone (see --app-safe-top/bottom).
 */
export function useAppSafeAreaSync() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        let visualTopInset = 0;
        let visualBottomInset = 0;
        if (vv) {
          visualTopInset = Math.max(0, Math.round(vv.offsetTop));
          visualBottomInset = Math.max(
            0,
            Math.round(window.innerHeight - (vv.height + vv.offsetTop)),
          );
        }
        root.style.setProperty(
          "--visual-viewport-top-inset",
          `${visualTopInset}px`,
        );
        root.style.setProperty(
          "--visual-viewport-bottom-inset",
          `${visualBottomInset}px`,
        );
      });
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--visual-viewport-top-inset");
      root.style.removeProperty("--visual-viewport-bottom-inset");
    };
  }, []);
}
