import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import type { CommunityFeedPostTypeFilter } from "@/components/community/CommunityFeedHeader";

const FEED_TYPE_FILTERS = new Set<CommunityFeedPostTypeFilter>([
  "all",
  "request_help",
  "offer_service",
  "community",
  "event",
]);

export function parseCommunityFeedTypeFilter(
  raw: string | null | undefined,
): CommunityFeedPostTypeFilter | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase() as CommunityFeedPostTypeFilter;
  return FEED_TYPE_FILTERS.has(normalized) ? normalized : null;
}

export function globalCommunityFeedPath(opts?: {
  type?: CommunityFeedPostTypeFilter;
  post?: string;
  request?: string;
}): string {
  const params = new URLSearchParams();
  if (opts?.type && opts.type !== "all") {
    params.set("type", opts.type);
  }
  if (opts?.post) params.set("post", opts.post);
  if (opts?.request) params.set("request", opts.request);
  const qs = params.toString();
  return qs ? `${GLOBAL_POSTS_PATH}?${qs}` : GLOBAL_POSTS_PATH;
}
