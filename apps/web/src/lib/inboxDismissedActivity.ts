const MAX_IDS = 400;

function storageKey(userId: string) {
  return `inbox_dismissed_activity_v1_${userId}`;
}

export function loadDismissedActivityIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    const strings = arr.filter((x): x is string => typeof x === "string");
    return new Set(strings.slice(-MAX_IDS));
  } catch {
    return new Set();
  }
}

export function persistDismissedActivityIds(userId: string, ids: Set<string>): void {
  try {
    const arr = [...ids].slice(-MAX_IDS);
    localStorage.setItem(storageKey(userId), JSON.stringify(arr));
  } catch {
    /* ignore quota */
  }
}

/** Merge one id (e.g. dismissed from the bell modal) into stored dismissed set. */
export function rememberDismissedActivity(userId: string, activityId: string): void {
  const s = loadDismissedActivityIds(userId);
  s.add(activityId);
  persistDismissedActivityIds(userId, s);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("activity-inbox-dismiss"));
    }
  } catch {
    /* ignore */
  }
}
