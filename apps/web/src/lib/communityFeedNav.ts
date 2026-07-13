import { GLOBAL_POSTS_PATH, parseProfilePostShareId } from "@/lib/profilePostShare";
import type { CommunityFeedPostTypeFilter } from "@/components/community/CommunityFeedHeader";
import {
  ALL_HELP_CATEGORY_ID,
  isServiceCategoryId,
  type DiscoverHomeCategoryId,
} from "@/lib/serviceCategories";
import type { DiscoverHomeCategoryFilter } from "@/lib/discoverHomeCategoryFilter";

const FEED_TYPE_FILTERS = new Set<CommunityFeedPostTypeFilter>([
  "all",
  "request_help",
  "offer_service",
  "community",
  "event",
]);

const FEED_TYPE_ID_FILTERS = new Set([
  "request_help",
  "offer_service",
  "community",
  "event",
]);

/** Request + offer posts (Get help category deep links). */
export const COMMUNITY_FEED_HELP_TYPE_IDS = ["request_help", "offer_service"] as const;

export function parseCommunityFeedTypeFilter(
  raw: string | null | undefined,
): CommunityFeedPostTypeFilter | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase() as CommunityFeedPostTypeFilter;
  return FEED_TYPE_FILTERS.has(normalized) ? normalized : null;
}

export function parseCommunityFeedTypeIds(
  raw: string | null | undefined,
): string[] | null {
  if (!raw?.trim()) return null;
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => FEED_TYPE_ID_FILTERS.has(part));
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique : null;
}

export function parseCommunityFeedCategory(
  raw: string | null | undefined,
): DiscoverHomeCategoryId | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "all" || normalized === ALL_HELP_CATEGORY_ID) {
    return ALL_HELP_CATEGORY_ID;
  }
  return isServiceCategoryId(normalized) ? normalized : null;
}

/** Router location state: scroll to a post or request after opening the community feed. */
export type CommunityFeedLocationState = {
  scrollToPostId?: string;
  scrollToRequestId?: string;
};

export function communityFeedScrollState(postId: string): CommunityFeedLocationState {
  const cleanId = parseProfilePostShareId(postId) ?? postId.trim();
  return { scrollToPostId: cleanId };
}

export function communityFeedRequestScrollState(requestId: string): CommunityFeedLocationState {
  const cleanId = parseProfilePostShareId(requestId) ?? requestId.trim();
  return { scrollToRequestId: cleanId };
}

export function globalCommunityFeedPath(opts?: {
  type?: CommunityFeedPostTypeFilter;
  /** Prefer over `type` when filtering to multiple post types (e.g. request + offer). */
  types?: readonly string[];
  post?: string;
  request?: string;
  category?: DiscoverHomeCategoryId | DiscoverHomeCategoryFilter;
}): string {
  const params = new URLSearchParams();
  if (opts?.types?.length) {
    params.set("types", opts.types.join(","));
  } else if (opts?.type && opts.type !== "all") {
    params.set("type", opts.type);
  }
  if (opts?.post) params.set("post", opts.post);
  if (opts?.request) params.set("request", opts.request);
  if (opts?.category) {
    const category =
      opts.category === "all" ? ALL_HELP_CATEGORY_ID : opts.category;
    if (category !== ALL_HELP_CATEGORY_ID) {
      params.set("category", category);
    }
  }
  const qs = params.toString();
  return qs ? `${GLOBAL_POSTS_PATH}?${qs}` : GLOBAL_POSTS_PATH;
}
