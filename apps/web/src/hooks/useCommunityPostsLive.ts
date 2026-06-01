import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/data/keys";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { fetchCommunityPostWithMetaById } from "@/lib/fetchCommunityPostWithMeta";
import type { CommunityPostWithMeta } from "@/components/community/CommunityPostCard";

type RealtimePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

function postMatchesCategory(
  postCategory: string,
  feedCategory: string | null,
): boolean {
  if (feedCategory == null || feedCategory.trim() === "") return true;
  return postCategory === feedCategory;
}

function upsertCommunityPostInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  post: CommunityPostWithMeta,
) {
  const entries = queryClient.getQueriesData<CommunityPostWithMeta[]>({
    queryKey: [...queryKeys.community, "posts"],
  });
  for (const [key, prev] of entries) {
    const feedCategory = key[2] as string | null | undefined;
    if (
      feedCategory !== undefined &&
      !postMatchesCategory(post.category, feedCategory ?? null)
    ) {
      continue;
    }
    const withoutDup = (prev ?? []).filter((p) => p.id !== post.id);
    queryClient.setQueryData<CommunityPostWithMeta[]>(key, [
      post,
      ...withoutDup,
    ]);
  }
}

function removeCommunityPostFromCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
) {
  const entries = queryClient.getQueriesData<CommunityPostWithMeta[]>({
    queryKey: [...queryKeys.community, "posts"],
  });
  for (const [key, prev] of entries) {
    if (!prev?.some((p) => p.id === postId)) continue;
    queryClient.setQueryData<CommunityPostWithMeta[]>(
      key,
      prev.filter((p) => p.id !== postId),
    );
  }
}

/** Live inserts/updates/deletes for public community board (`useCommunityPosts`). */
export function useCommunityPostsLive(category: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(new Set<string>());

  const onChange = useCallback(
    (payload: RealtimePayload) => {
      const eventType = payload.eventType;
      const row = (payload.new ?? payload.old) as { id?: string } | undefined;
      if (!row?.id) return;

      if (eventType === "DELETE") {
        removeCommunityPostFromCaches(queryClient, row.id);
        return;
      }

      const postId = row.id;
      if (inFlightRef.current.has(postId)) return;
      inFlightRef.current.add(postId);

      void (async () => {
        try {
          const hydrated = await fetchCommunityPostWithMetaById(postId);
          if (!hydrated) {
            removeCommunityPostFromCaches(queryClient, postId);
            return;
          }
          if (!postMatchesCategory(hydrated.category, category)) {
            removeCommunityPostFromCaches(queryClient, postId);
            return;
          }
          upsertCommunityPostInCaches(queryClient, hydrated);
        } finally {
          inFlightRef.current.delete(postId);
        }
      })();
    },
    [category, queryClient],
  );

  useRealtimeSubscription(
    { table: "community_posts", event: "*", enabled },
    onChange,
  );
}

/** Live profile posts on Discover home side panels + board previews. */
export function useDiscoverSidePostsLive(userId: string | undefined) {
  const queryClient = useQueryClient();

  useRealtimeSubscription(
    { table: "profile_posts", event: "INSERT" },
    () => {
      void queryClient.invalidateQueries({
        queryKey: ["discover-favorites-side-posts", userId ?? null],
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: ["discover-most-liked-side-posts"],
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: ["discover-most-commented-side-posts"],
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: ["discover-my-own-side-posts", userId ?? null],
        refetchType: "active",
      });
    },
  );

  useRealtimeSubscription({ table: "profile_post_likes", event: "INSERT" }, () => {
    void queryClient.invalidateQueries({
      queryKey: ["discover-most-liked-side-posts"],
      refetchType: "active",
    });
  });

  useRealtimeSubscription(
    { table: "profile_post_comments", event: "INSERT" },
    () => {
      void queryClient.invalidateQueries({
        queryKey: ["discover-most-commented-side-posts"],
        refetchType: "active",
      });
    },
  );
}

/** @deprecated Use useDiscoverSidePostsLive */
export function useDiscoverFavoritesPostsLive(userId: string | undefined) {
  useDiscoverSidePostsLive(userId);
}

/** Live community posts authored by the current user (CommunityPostsPage). */
export function useAuthorCommunityPostsLive(
  authorId: string | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useRealtimeSubscription(
    {
      table: "community_posts",
      event: "*",
      filter: authorId ? `author_id=eq.${authorId}` : undefined,
      enabled: enabled && Boolean(authorId),
    },
    onRefresh,
  );
}

/** Live active board preview rows (DiscoverHomeLatestPosts). */
export function useCommunityBoardPreviewLive(
  onInsert: (postId: string) => void,
  enabled = true,
) {
  useRealtimeSubscription(
    { table: "community_posts", event: "INSERT", enabled },
    (payload: RealtimePayload) => {
      const id = payload.new?.id as string | undefined;
      if (id) onInsert(id);
    },
  );
}
