import { useEffect } from "react";

function readEnvSafeAreaInsets() {
  if (typeof document === "undefined") {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top,0px)",
    "padding-bottom:env(safe-area-inset-bottom,0px)",
    "padding-left:env(safe-area-inset-left,0px)",
    "padding-right:env(safe-area-inset-right,0px)",
  ].join(";");
  document.documentElement.appendChild(probe);
  const style = getComputedStyle(probe);
  const top = parseFloat(style.paddingTop) || 0;
  const bottom = parseFloat(style.paddingBottom) || 0;
  const left = parseFloat(style.paddingLeft) || 0;
  const right = parseFloat(style.paddingRight) || 0;
  probe.remove();
  return { top, bottom, left, right };
}

/** Safari URL bar: gap between large and small viewport when browser chrome is visible. */
function readDynamicViewportBottomGap() {
  if (typeof document === "undefined") return 0;

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;";
  document.documentElement.appendChild(probe);
  probe.style.height = "100lvh";
  const lvh = probe.getBoundingClientRect().height;
  probe.style.height = "100svh";
  const svh = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.max(0, Math.round(lvh - svh));
}

/**
 * iOS Safari: env(safe-area-inset-*) is unreliable while browser chrome shows/hides.
 * Probe env() + visualViewport gaps so fixed chrome and scroll content extend into the
 * notch / home-indicator zones (see --app-safe-top/bottom).
 */
export function useAppSafeAreaSync() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const envInsets = readEnvSafeAreaInsets();
        const vv = window.visualViewport;
        const layoutHeight = document.documentElement.clientHeight;
        let visualTopInset = 0;
        let visualBottomInset = 0;
        if (vv) {
          visualTopInset = Math.max(0, Math.round(vv.offsetTop));
          const vvBottom = vv.offsetTop + vv.height;
          visualBottomInset = Math.max(
            0,
            Math.round(layoutHeight - vvBottom),
            Math.round(window.innerHeight - vvBottom),
          );
        }

        const dynamicBottomGap = readDynamicViewportBottomGap();
        const safeTop = Math.max(envInsets.top, visualTopInset);
        const safeBottom = Math.max(
          envInsets.bottom,
          visualBottomInset,
          dynamicBottomGap,
        );
        const navBottomInset = Math.max(12, safeBottom);

        root.style.setProperty(
          "--visual-viewport-top-inset",
          `${visualTopInset}px`,
        );
        root.style.setProperty(
          "--visual-viewport-bottom-inset",
          `${visualBottomInset}px`,
        );
        root.style.setProperty("--app-safe-top", `${safeTop}px`);
        root.style.setProperty("--app-safe-bottom", `${safeBottom}px`);
        root.style.setProperty("--app-nav-bottom-inset", `${navBottomInset}px`);
        root.style.setProperty(
          "--app-mobile-top-glass-height",
          `${Math.max(8, safeTop)}px`,
        );
        root.style.setProperty(
          "--app-mobile-bottom-glass-height",
          `${Math.max(8, navBottomInset)}px`,
        );
      });
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    vv?.addEventListener("geometrychange", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      vv?.removeEventListener("geometrychange", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update);
      root.style.removeProperty("--visual-viewport-top-inset");
      root.style.removeProperty("--visual-viewport-bottom-inset");
      root.style.removeProperty("--app-safe-top");
      root.style.removeProperty("--app-safe-bottom");
      root.style.removeProperty("--app-nav-bottom-inset");
      root.style.removeProperty("--app-mobile-top-glass-height");
      root.style.removeProperty("--app-mobile-bottom-glass-height");
    };
  }, []);
}
