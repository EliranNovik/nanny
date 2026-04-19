/**
 * Lightweight product analytics — extend with GTM/PostHog later.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", name, props ?? {});
  }
  try {
    window.dispatchEvent(
      new CustomEvent("app-analytics", {
        detail: { name, props: props ?? {}, t: Date.now() },
      }),
    );
  } catch {
    /* ignore */
  }
}
