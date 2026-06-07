import { supabase } from "@/lib/supabase";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  mapOpenHelpRequestToFeedPost,
  type JobRequestFeedPost,
} from "@/lib/openHelpRequestFeedPost";

type JobRequestEngagement = {
  job_id: string;
  like_count: number | string;
  share_click_count: number | string;
  comment_count?: number | string;
  liked_by_me: boolean;
};

export async function fetchJobRequestEngagement(
  jobIds: string[],
  viewerUserId: string | null,
): Promise<
  Map<
    string,
    {
      like_count: number;
      share_click_count: number;
      comment_count: number;
      liked_by_me: boolean;
    }
  >
> {
  const map = new Map<
    string,
    {
      like_count: number;
      share_click_count: number;
      comment_count: number;
      liked_by_me: boolean;
    }
  >();
  if (jobIds.length === 0) return map;

  const { data, error } = await supabase.rpc("get_job_request_feed_engagement", {
    p_job_ids: jobIds,
    p_viewer_id: viewerUserId,
  });

  if (error) {
    console.error("[fetchJobRequestEngagement]", error);
    return map;
  }

  for (const row of (data ?? []) as JobRequestEngagement[]) {
    map.set(row.job_id, {
      like_count: Number(row.like_count) || 0,
      share_click_count: Number(row.share_click_count) || 0,
      comment_count: Number(row.comment_count) || 0,
      liked_by_me: Boolean(row.liked_by_me),
    });
  }
  return map;
}

export function applyJobRequestEngagement(
  posts: JobRequestFeedPost[],
  engagement: Map<
    string,
    {
      like_count: number;
      share_click_count: number;
      comment_count: number;
      liked_by_me: boolean;
    }
  >,
): JobRequestFeedPost[] {
  return posts.map((p) => {
    const e = engagement.get(p.id);
    if (!e) return p;
    return {
      ...p,
      like_count: e.like_count,
      share_click_count: e.share_click_count,
      comment_count: e.comment_count,
      liked_by_me: e.liked_by_me,
    };
  });
}

/**
 * Load a single open help request for shared deep links (`/community/feed?request=`).
 */
export async function fetchJobRequestForFeedById(
  jobId: string,
  viewerUserId: string | null,
): Promise<JobRequestFeedPost | null> {
  const { data, error } = await supabase.rpc("get_discover_open_help_request_by_id", {
    p_id: jobId,
  });

  if (error || !data?.length) {
    console.error("[fetchJobRequestForFeedById]", error?.message ?? "not found");
    return null;
  }

  const row = data[0] as DiscoverOpenHelpRequestRow;
  const engagement = await fetchJobRequestEngagement([jobId], viewerUserId);

  const author =
    row.client_id
      ? {
          id: row.client_id,
          full_name: row.client_display_name,
          photo_url: row.client_photo_url,
          is_verified: row.is_verified ?? null,
        }
      : undefined;

  const base = mapOpenHelpRequestToFeedPost(row, author);
  const e = engagement.get(jobId);
  return {
    ...base,
    like_count: e?.like_count ?? 0,
    share_click_count: e?.share_click_count ?? 0,
    comment_count: e?.comment_count ?? 0,
    liked_by_me: e?.liked_by_me ?? false,
  };
}
