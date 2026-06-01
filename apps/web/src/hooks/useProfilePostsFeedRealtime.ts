import { useCallback, useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  communityPostMatchesFeedFilters,
  hydrateAndUpsertAvailabilityPost,
  hydrateAndUpsertProfilePost,
  profilePostMatchesFeedFilters,
  removeFeedPostFromCache,
  type ProfilePostsFeedFilters,
} from "@/lib/profilePostsFeedLive";

type RealtimePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

type Options = ProfilePostsFeedFilters & {
  queryClient: QueryClient;
  queryKey: readonly unknown[];
  viewerUserId: string | null;
  enabled?: boolean;
};

/**
 * Live profile + availability posts for ProfilePostsFeed.
 * Inserts/updates/deletes mutate React Query cache immediately (before stale refetches).
 */
export function useProfilePostsFeedRealtime({
  queryClient,
  queryKey,
  viewerUserId,
  enabled = true,
  userId,
  filterTaggedUserId,
  filterAuthorId,
  authorNameFilter,
  sortOrder = "newest",
  filterLikedByUserId,
  limit,
}: Options) {
  const filters: ProfilePostsFeedFilters = {
    userId,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    filterLikedByUserId,
    limit,
  };

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const inFlightRef = useRef(new Set<string>());

  const runHydrate = useCallback(
    async (
      key: string,
      hydrate: () => Promise<boolean>,
      fallback?: () => void,
    ) => {
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      try {
        const ok = await hydrate();
        if (!ok) fallback?.();
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [],
  );

  const invalidateFeed = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey, refetchType: "active" });
  }, [queryClient, queryKey]);

  const onProfilePost = useCallback(
    (payload: RealtimePayload) => {
      const eventType = payload.eventType;
      const row = (payload.new ?? payload.old) as
        | {
            id?: string;
            author_id?: string;
            tagged_user_ids?: string[];
          }
        | undefined;
      if (!row?.id || !row.author_id) return;

      if (eventType === "DELETE") {
        removeFeedPostFromCache(queryClient, queryKey, row.id, "post");
        return;
      }

      if (!profilePostMatchesFeedFilters(
        {
          id: row.id,
          author_id: row.author_id,
          tagged_user_ids: row.tagged_user_ids,
        },
        filtersRef.current,
      )) {
        if (eventType === "UPDATE") {
          removeFeedPostFromCache(queryClient, queryKey, row.id, "post");
        }
        return;
      }

      if (filtersRef.current.authorNameFilter?.trim()) {
        invalidateFeed();
        return;
      }

      void runHydrate(
        `post:${row.id}`,
        () =>
          hydrateAndUpsertProfilePost(
            queryClient,
            queryKey,
            row.id!,
            viewerUserId,
            filtersRef.current.sortOrder ?? "newest",
            filtersRef.current.limit,
          ),
        invalidateFeed,
      );
    },
    [invalidateFeed, queryClient, queryKey, runHydrate, viewerUserId],
  );

  const onCommunityPost = useCallback(
    (payload: RealtimePayload) => {
      const eventType = payload.eventType;
      const row = (payload.new ?? payload.old) as
        | {
            id?: string;
            author_id?: string;
            status?: string;
            expires_at?: string;
          }
        | undefined;
      if (!row?.id || !row.author_id) return;

      if (eventType === "DELETE") {
        removeFeedPostFromCache(queryClient, queryKey, row.id, "availability");
        return;
      }

      if (
        !communityPostMatchesFeedFilters(
          {
            id: row.id,
            author_id: row.author_id,
            status: row.status,
            expires_at: row.expires_at,
          },
          filtersRef.current,
        )
      ) {
        if (eventType === "UPDATE") {
          removeFeedPostFromCache(
            queryClient,
            queryKey,
            row.id,
            "availability",
          );
        }
        return;
      }

      if (filtersRef.current.authorNameFilter?.trim()) {
        invalidateFeed();
        return;
      }

      void runHydrate(
        `avail:${row.id}`,
        () =>
          hydrateAndUpsertAvailabilityPost(
            queryClient,
            queryKey,
            row.id!,
            filtersRef.current.sortOrder ?? "newest",
            filtersRef.current.limit,
          ),
        invalidateFeed,
      );
    },
    [invalidateFeed, queryClient, queryKey, runHydrate],
  );

  const onLikedPost = useCallback(
    (payload: RealtimePayload) => {
      const likedUserId = filtersRef.current.filterLikedByUserId;
      if (!likedUserId) return;

      const row = (payload.new ?? payload.old) as
        | { post_id?: string; user_id?: string }
        | undefined;
      if (!row?.post_id || row.user_id !== likedUserId) return;

      if (payload.eventType === "INSERT") {
        void runHydrate(
          `post:${row.post_id}`,
          () =>
            hydrateAndUpsertProfilePost(
              queryClient,
              queryKey,
              row.post_id!,
              viewerUserId,
              filtersRef.current.sortOrder ?? "newest",
              filtersRef.current.limit,
            ),
          invalidateFeed,
        );
        return;
      }

      if (payload.eventType === "DELETE") {
        removeFeedPostFromCache(queryClient, queryKey, row.post_id, "post");
      }
    },
    [invalidateFeed, queryClient, queryKey, runHydrate, viewerUserId],
  );

  useEffect(
    () => () => {
      inFlightRef.current.clear();
    },
    [],
  );

  const profileFilter = userId ? `author_id=eq.${userId}` : undefined;
  const communityFilter = userId ? `author_id=eq.${userId}` : undefined;

  useRealtimeSubscription(
    {
      table: "profile_posts",
      event: "*",
      filter: profileFilter,
      enabled,
    },
    onProfilePost,
  );

  useRealtimeSubscription(
    {
      table: "community_posts",
      event: "*",
      filter: communityFilter,
      enabled,
    },
    onCommunityPost,
  );

  useRealtimeSubscription(
    {
      table: "profile_post_likes",
      event: "*",
      filter: filterLikedByUserId
        ? `user_id=eq.${filterLikedByUserId}`
        : undefined,
      enabled: enabled && Boolean(filterLikedByUserId),
    },
    onLikedPost,
  );
}
