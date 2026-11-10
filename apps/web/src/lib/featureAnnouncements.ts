/** Bump the id to show a new announcement to everyone again. */
export const AI_FEATURES_ANNOUNCEMENT_ID = "ai-features-2026-11";
export const AI_FEATURES_POPUP_ID = "ai-features-popup-2026-11";

function storageKey(userId: string) {
  return `feature_announcements_closed_v1_${userId}`;
}

function loadClosed(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function isAnnouncementOpen(userId: string, id: string): boolean {
  return !loadClosed(userId).has(id);
}

export function closeAnnouncement(userId: string, id: string): void {
  const closed = loadClosed(userId);
  closed.add(id);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...closed]));
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new CustomEvent("activity-inbox-dismiss"));
  } catch {
    /* ignore */
  }
}

export function openAnnouncementCount(userId: string): number {
  return isAnnouncementOpen(userId, AI_FEATURES_ANNOUNCEMENT_ID) ? 1 : 0;
}
