export const DISCOVER_HOME_INTENT_STORAGE_KEY =
  "mamalama_discover_home_intent_v1";

export type DiscoverHomeIntent = "hire" | "work";

const CHANGE_EVENT = "discover-home-intent-change";

export function readDiscoverHomeIntent(): DiscoverHomeIntent {
  try {
    const v = localStorage.getItem(DISCOVER_HOME_INTENT_STORAGE_KEY);
    return v === "work" ? "work" : "hire";
  } catch {
    return "hire";
  }
}

/** Persist and notify same-tab listeners (e.g. header toggle ↔ discover page). */
export function writeDiscoverHomeIntent(mode: DiscoverHomeIntent): boolean {
  try {
    localStorage.setItem(DISCOVER_HOME_INTENT_STORAGE_KEY, mode);
  } catch {
    return false;
  }
  window.dispatchEvent(
    new CustomEvent<DiscoverHomeIntent>(CHANGE_EVENT, { detail: mode }),
  );
  return true;
}

export function subscribeDiscoverHomeIntent(
  cb: (mode: DiscoverHomeIntent) => void,
): () => void {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<DiscoverHomeIntent>;
    const m = ce.detail;
    if (m === "hire" || m === "work") cb(m);
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
