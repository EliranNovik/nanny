import type { QueryClient } from "@tanstack/react-query";
import type { FeedPost } from "@/components/profile/ProfilePostsFeed";
import { fetchProfilePostById } from "@/lib/fetchProfilePostById";
import { fetchAvailabilityPostForFeed } from "@/lib/fetchAvailabilityPostForFeed";

import type { CommunityFeedAdvancedFilters } from "@/lib/communityFeedFilters";
import { postMatchesAdvancedFeedFilters } from "@/lib/communityFeedFilters";

export type ProfilePostsFeedFilters = {
  userId?: string;
  filterTaggedUserId?: string;
  filterAuthorId?: string;
  authorNameFilter?: string;
  sortOrder?: "newest" | "oldest";
  filterLikedByUserId?: string;
  filterPostTypeId?: string;
  filterCommentedOwnPosts?: boolean;
  feedAdvancedFilters?: CommunityFeedAdvancedFilters;
  limit?: number;
};

type RawProfilePostRow = {
  id: string;
  author_id: string;
  post_type_id?: string | null;
  tagged_user_ids?: string[];
  post_metadata?: Record<string, unknown> | null;
};

type RawCommunityPostRow = {
  id: string;
  author_id: string;
  status?: string;
  expires_at?: string;
};

export function sortFeedPosts(
  posts: FeedPost[],
  sortOrder: "newest" | "oldest" = "newest",
): FeedPost[] {
  return [...posts].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortOrder === "oldest" ? timeA - timeB : timeB - timeA;
  });
}

function trimFeedToLimit(posts: FeedPost[], limit?: number): FeedPost[] {
  if (!limit || posts.length <= limit) return posts;
  return posts.slice(0, limit);
}

export function profilePostMatchesFeedFilters(
  row: RawProfilePostRow,
  filters: ProfilePostsFeedFilters,
): boolean {
  if (filters.filterLikedByUserId) return false;
  if (filters.filterCommentedOwnPosts) return false;
  if (filters.userId && row.author_id !== filters.userId) return false;
  if (filters.filterAuthorId && row.author_id !== filters.filterAuthorId) {
    return false;
  }
  if (filters.feedAdvancedFilters?.myPostsOnly) return false;
  if (filters.feedAdvancedFilters?.favoriteProfilesOnly) return false;
  if (filters.filterTaggedUserId) {
    const tagged = row.tagged_user_ids ?? [];
    if (!tagged.includes(filters.filterTaggedUserId)) return false;
  }
  if (
    filters.filterPostTypeId &&
    row.post_type_id !== filters.filterPostTypeId
  ) {
    return false;
  }
  if (filters.authorNameFilter?.trim()) return false;
  if (
    filters.feedAdvancedFilters &&
    !postMatchesAdvancedFeedFilters(
      {
        post_type_id: row.post_type_id,
        post_metadata: row.post_metadata as {
          timeframe?: string | null;
          budget?: number | null;
          rate?: number | null;
        } | null,
      },
      filters.feedAdvancedFilters,
    )
  ) {
    return false;
  }
  return true;
}

export function communityPostMatchesFeedFilters(
  row: RawCommunityPostRow,
  filters: ProfilePostsFeedFilters,
): boolean {
  if (filters.filterLikedByUserId) return false;
  if (filters.userId && row.author_id !== filters.userId) return false;
  if (filters.filterAuthorId && row.author_id !== filters.filterAuthorId) {
    return false;
  }
  if (filters.filterTaggedUserId) return false;
  if (filters.filterPostTypeId) return false;
  if (filters.filterCommentedOwnPosts) return false;
  if (filters.feedAdvancedFilters?.myPostsOnly) return false;
  if (filters.feedAdvancedFilters?.favoriteProfilesOnly) return false;
  if (filters.feedAdvancedFilters?.when && filters.feedAdvancedFilters.when !== "any") {
    return false;
  }
  if (
    filters.feedAdvancedFilters?.budgetMin != null ||
    filters.feedAdvancedFilters?.budgetMax != null
  ) {
    return false;
  }
  if (filters.authorNameFilter?.trim()) return false;
  if (row.status && row.status !== "active") return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export function upsertFeedPostInCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  post: FeedPost,
  sortOrder: "newest" | "oldest" = "newest",
  limit?: number,
): void {
  queryClient.setQueryData<FeedPost[]>(queryKey, (prev) => {
    const withoutDup = (prev ?? []).filter(
      (p) => !(p.id === post.id && p.source === post.source),
    );
    const merged = sortFeedPosts([post, ...withoutDup], sortOrder);
    return trimFeedToLimit(merged, limit);
  });
}

export function removeFeedPostFromCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  postId: string,
  source: FeedPost["source"],
): void {
  queryClient.setQueryData<FeedPost[]>(queryKey, (prev) =>
    prev?.filter((p) => !(p.id === postId && p.source === source)) ?? prev,
  );
}

export async function hydrateAndUpsertProfilePost(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  postId: string,
  viewerUserId: string | null,
  sortOrder: "newest" | "oldest" = "newest",
  limit?: number,
): Promise<boolean> {
  const hydrated = await fetchProfilePostById(postId, viewerUserId);
  if (!hydrated) return false;
  upsertFeedPostInCache(queryClient, queryKey, hydrated, sortOrder, limit);
  return true;
}

export async function hydrateAndUpsertAvailabilityPost(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  postId: string,
  sortOrder: "newest" | "oldest" = "newest",
  limit?: number,
): Promise<boolean> {
  const hydrated = await fetchAvailabilityPostForFeed(postId);
  if (!hydrated) return false;
  upsertFeedPostInCache(queryClient, queryKey, hydrated, sortOrder, limit);
  return true;
}
