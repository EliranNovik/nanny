const LOG_PREFIX = "[ProfilePostDeepLink]";

/** Enabled in dev, or when URL has `?debugPost=1` (works with `?post=` too). */
export function isProfilePostDeepLinkDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  return new URLSearchParams(window.location.search).get("debugPost") === "1";
}

export function debugProfilePostDeepLink(
  label: string,
  data?: Record<string, unknown>,
): void {
  if (!isProfilePostDeepLinkDebugEnabled()) return;
  if (data !== undefined) {
    console.log(LOG_PREFIX, label, data);
  } else {
    console.log(LOG_PREFIX, label);
  }
}

export function warnProfilePostDeepLink(
  label: string,
  data?: Record<string, unknown>,
): void {
  if (!isProfilePostDeepLinkDebugEnabled()) return;
  if (data !== undefined) {
    console.warn(LOG_PREFIX, label, data);
  } else {
    console.warn(LOG_PREFIX, label);
  }
}

export function scrollMetrics() {
  if (typeof window === "undefined") return {};
  return {
    windowScrollY: window.scrollY,
    bodyScrollTop: document.body.scrollTop,
    docElScrollTop: document.documentElement.scrollTop,
    scrollingElement: document.scrollingElement?.tagName ?? null,
    scrollingElementScrollTop: document.scrollingElement?.scrollTop ?? null,
    innerHeight: window.innerHeight,
  };
}

export function listProfilePostDomIds(): string[] {
  return Array.from(document.querySelectorAll('[id^="profile-post-"]')).map(
    (n) => n.id,
  );
}
