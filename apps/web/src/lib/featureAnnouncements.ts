/** Bump the id to show a new announcement to everyone again. */
export const AI_FEATURES_ANNOUNCEMENT_ID = "ai-features-2026-11";
export const AI_FEATURES_POPUP_ID = "ai-features-popup-2026-11";
export const COMMUNITY_WELCOME_ID = "community-welcome-v1";
export const COMMUNITY_WELCOME_CLOSED_EVENT = "community-welcome-closed";
export const COMMUNITY_SPOTLIGHT_ID = "community-spotlight-v1";
export const COMMUNITY_SPOTLIGHT_CLOSED_EVENT = "community-spotlight-closed";

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

export function isCommunityWelcomePending(userId: string): boolean {
  return isAnnouncementOpen(userId, COMMUNITY_WELCOME_ID);
}

export function closeCommunityWelcome(userId: string): void {
  closeAnnouncement(userId, COMMUNITY_WELCOME_ID);
  try {
    window.dispatchEvent(new CustomEvent(COMMUNITY_WELCOME_CLOSED_EVENT));
  } catch {
    /* ignore */
  }
}

export function isCommunitySpotlightPending(userId: string): boolean {
  return isAnnouncementOpen(userId, COMMUNITY_SPOTLIGHT_ID);
}

export function closeCommunitySpotlight(userId: string): void {
  closeAnnouncement(userId, COMMUNITY_SPOTLIGHT_ID);
  try {
    window.dispatchEvent(new CustomEvent(COMMUNITY_SPOTLIGHT_CLOSED_EVENT));
  } catch {
    /* ignore */
  }
}

export function openAnnouncementCount(userId: string): number {
  return isAnnouncementOpen(userId, AI_FEATURES_ANNOUNCEMENT_ID) ? 1 : 0;
}
