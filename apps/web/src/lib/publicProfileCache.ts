/**
 * Session cache for public profile payloads (viewer + profile user pair).
 * Reduces full refetch + loading spinner when returning to the tab or revisiting the route.
 */

const STORAGE_PREFIX = "publicProfileCache:v1:";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export type PublicProfileCachePayload = {
  profile: unknown;
  sharedJobs: unknown;
  reviews: unknown;
  mediaItems: unknown;
  liveCommunityPosts: unknown;
  postedHelpRequests: unknown;
};

type StoredEntry = {
  savedAt: number;
} & PublicProfileCachePayload;

function key(viewerId: string, profileUserId: string): string {
  return `${STORAGE_PREFIX}${viewerId}:${profileUserId}`;
}

export function readPublicProfileCache(
  viewerId: string,
  profileUserId: string,
  ttlMs: number = DEFAULT_TTL_MS
): PublicProfileCachePayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(viewerId, profileUserId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry;
    if (!parsed?.savedAt || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > ttlMs) return null;
    return {
      profile: parsed.profile,
      sharedJobs: parsed.sharedJobs,
      reviews: parsed.reviews,
      mediaItems: parsed.mediaItems,
      liveCommunityPosts: parsed.liveCommunityPosts,
      postedHelpRequests: parsed.postedHelpRequests,
    };
  } catch {
    return null;
  }
}

export function writePublicProfileCache(
  viewerId: string,
  profileUserId: string,
  payload: PublicProfileCachePayload
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: StoredEntry = {
      savedAt: Date.now(),
      ...payload,
    };
    sessionStorage.setItem(key(viewerId, profileUserId), JSON.stringify(entry));
  } catch {
    // quota / private mode
  }
}
