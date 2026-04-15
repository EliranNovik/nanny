/**
 * Flying heart + count hint when saving / unsaving a profile from PublicProfilePage.
 * Target: BottomNav Liked tab — requires `[data-nav-liked-anchor]` on that control.
 */

const LIKED_TAB_ANCHOR = "[data-nav-liked-anchor]";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function centerOf(el: DOMRect) {
  return { x: el.left + el.width / 2, y: el.top + el.height / 2 };
}

const FLYING_HEART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#f43f5e" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

/** Top-right point just below the fixed app header (mobile or desktop strip). */
function getHeartSplitAnchorTopRightBelowHeader(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 120, y: 88 };
  const vw = window.innerWidth;
  const HEART = 28;
  const MARGIN_RIGHT = 18;
  const GAP_BELOW = 10;
  const centerX = vw - MARGIN_RIGHT - HEART / 2;

  let headerBottom = 0;
  const mobile = document.querySelector("[data-mobile-header-strip]");
  const desktop = document.querySelector("[data-desktop-header-strip]");
  if (mobile instanceof HTMLElement) {
    const r = mobile.getBoundingClientRect();
    if (r.height > 0 && r.bottom > 0) headerBottom = r.bottom;
  }
  if (headerBottom === 0 && desktop instanceof HTMLElement) {
    const r = desktop.getBoundingClientRect();
    if (r.height > 0 && r.bottom > 0) headerBottom = r.bottom;
  }
  if (headerBottom === 0) {
    const root = document.getElementById("root");
    const pad = root
      ? Number.parseFloat(getComputedStyle(root).paddingTop || "0") || 0
      : 0;
    headerBottom = pad + 56;
  }
  const centerY = headerBottom + GAP_BELOW + HEART / 2;
  return { x: centerX, y: centerY };
}

/** Two clipped halves that peel apart at a fixed screen position. */
function playHeartSplitApart(
  layer: HTMLDivElement,
  centerX: number,
  centerY: number,
  onSplitDone: () => void,
) {
  const wrap = document.createElement("div");
  wrap.className = "absolute flex h-7 w-7";
  wrap.style.left = `${centerX - 14}px`;
  wrap.style.top = `${centerY - 14}px`;

  const makeHalf = (side: "left" | "right") => {
    const half = document.createElement("div");
    half.className = "h-7 overflow-hidden";
    half.style.width = "14px";
    if (side === "left") {
      half.innerHTML = FLYING_HEART_SVG;
    } else {
      half.innerHTML = FLYING_HEART_SVG;
      const svg = half.querySelector("svg");
      if (svg) {
        svg.style.transform = "translateX(-14px)";
      }
    }
    return half;
  };

  const left = makeHalf("left");
  const right = makeHalf("right");
  wrap.appendChild(left);
  wrap.appendChild(right);
  layer.appendChild(wrap);

  const splitEase = "cubic-bezier(0.33, 0.82, 0.45, 1)";
  const leftAnim = left.animate(
    [
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      {
        transform: "translate(-18px, 8px) rotate(-22deg) scale(0.75)",
        opacity: 0,
      },
    ],
    { duration: 420, easing: splitEase },
  );
  const rightAnim = right.animate(
    [
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      {
        transform: "translate(18px, 8px) rotate(22deg) scale(0.75)",
        opacity: 0,
      },
    ],
    { duration: 420, easing: splitEase },
  );

  void Promise.all([leftAnim.finished, rightAnim.finished]).then(() => {
    wrap.remove();
    onSplitDone();
  });
}

function ensureOverlay(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className =
    "pointer-events-none fixed inset-0 z-[200] overflow-visible [&_*]:pointer-events-none";
  document.body.appendChild(layer);
  return layer;
}

function floatLabel(
  layer: HTMLDivElement,
  x: number,
  y: number,
  text: string,
  textClass: string,
) {
  const el = document.createElement("div");
  el.textContent = text;
  el.className = `absolute text-sm font-black tabular-nums ${textClass} drop-shadow-sm`;
  el.style.left = `${x - 14}px`;
  el.style.top = `${y - 26}px`;
  layer.appendChild(el);
  el.animate(
    [
      { opacity: 0, transform: "translateY(8px) scale(0.6)" },
      { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.2 },
      { opacity: 0, transform: "translateY(-20px) scale(1.15)" },
    ],
    { duration: 950, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  ).onfinish = () => el.remove();
}

/** Heart flies from profile save button to Liked tab; “+1” appears at tab. */
export function playFavoriteAddedToLikedTabFlight(
  sourceEl: HTMLElement | null,
): void {
  if (typeof document === "undefined" || !sourceEl) return;
  const target = document.querySelector(LIKED_TAB_ANCHOR);
  if (!target || !(target instanceof HTMLElement)) return;

  const sr = sourceEl.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  const sc = centerOf(sr);
  const tc = centerOf(tr);

  if (prefersReducedMotion()) {
    const layer = ensureOverlay();
    floatLabel(
      layer,
      tc.x,
      tc.y,
      "+1",
      "text-emerald-600 dark:text-emerald-400",
    );
    window.setTimeout(() => layer.remove(), 1100);
    return;
  }

  const layer = ensureOverlay();
  const heart = document.createElement("div");
  heart.className =
    "absolute flex h-7 w-7 items-center justify-center drop-shadow-lg";
  heart.style.left = `${sc.x - 14}px`;
  heart.style.top = `${sc.y - 14}px`;
  heart.innerHTML = FLYING_HEART_SVG;
  layer.appendChild(heart);

  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;

  const anim = heart.animate(
    [
      { transform: "translate(0, 0) scale(1.2)", offset: 0 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(1)`,
        offset: 0.5,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(1.08)`, offset: 1 },
    ],
    { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );

  anim.onfinish = () => {
    heart.remove();
    floatLabel(
      layer,
      tc.x,
      tc.y,
      "+1",
      "text-emerald-600 dark:text-emerald-400",
    );
    window.setTimeout(() => {
      layer.remove();
    }, 1000);
  };
}

/** Heart flies from Liked tab to top-right below header, then splits; “-1” there. */
export function playFavoriteRemovedFromLikedTabFlight(
  sourceEl: HTMLElement | null,
): void {
  if (typeof document === "undefined" || !sourceEl) return;
  const target = document.querySelector(LIKED_TAB_ANCHOR);
  if (!target || !(target instanceof HTMLElement)) return;

  const tr = target.getBoundingClientRect();
  const tc = centerOf(tr);

  const anchor = getHeartSplitAnchorTopRightBelowHeader();

  if (prefersReducedMotion()) {
    const layer = ensureOverlay();
    floatLabel(
      layer,
      anchor.x,
      anchor.y,
      "-1",
      "text-red-600 dark:text-red-400",
    );
    window.setTimeout(() => layer.remove(), 1100);
    return;
  }

  const dx = anchor.x - tc.x;
  const dy = anchor.y - tc.y;

  const layer = ensureOverlay();
  const heart = document.createElement("div");
  heart.className =
    "absolute flex h-7 w-7 items-center justify-center drop-shadow-lg";
  heart.style.left = `${tc.x - 14}px`;
  heart.style.top = `${tc.y - 14}px`;
  heart.innerHTML = FLYING_HEART_SVG;
  layer.appendChild(heart);

  const flyToHeaderZone = heart.animate(
    [
      { transform: "translate(0, 0) scale(1.05)" },
      {
        transform: `translate(${dx}px, ${dy}px) scale(1.02)`,
      },
    ],
    { duration: 620, easing: "cubic-bezier(0.33, 1, 0.68, 1)" },
  );

  flyToHeaderZone.onfinish = () => {
    heart.remove();
    playHeartSplitApart(layer, anchor.x, anchor.y, () => {
      floatLabel(
        layer,
        anchor.x,
        anchor.y,
        "-1",
        "text-red-600 dark:text-red-400",
      );
      window.setTimeout(() => {
        layer.remove();
      }, 1000);
    });
  };
}
