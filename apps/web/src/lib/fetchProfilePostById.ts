import { supabase } from "@/lib/supabase";
import { debugProfilePostDeepLink } from "@/lib/profilePostDeepLinkDebug";

type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  is_verified?: boolean;
  live_until?: string | null;
};

export type FetchedProfilePost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  tagged_user_ids: string[];
  created_at: string;
  author?: ProfileSnippet;
  like_count: number;
  comment_count: number;
  share_click_count: number;
  share_distinct_user_count: number;
  liked_by_me: boolean;
  tagged_profiles: ProfileSnippet[];
  source: "post";
};

/**
 * Load a single profile post by id with author, counts, and like state.
 * Used for shared deep links (`/community/feed?post=`).
 */
export async function fetchProfilePostById(
  postId: string,
  viewerUserId: string | null,
): Promise<FetchedProfilePost | null> {
  const { data: row, error } = await supabase
    .from("profile_posts")
    .select(
      "id, author_id, caption, media_type, storage_path, tagged_user_ids, created_at",
    )
    .eq("id", postId)
    .maybeSingle();

  if (error || !row) {
    debugProfilePostDeepLink("fetchProfilePostById: not found", {
      postId,
      error: error?.message ?? null,
    });
    return null;
  }

  debugProfilePostDeepLink("fetchProfilePostById: found", {
    postId,
    authorId: row.author_id,
    mediaType: row.media_type,
  });

  const taggedIds = (row.tagged_user_ids as string[]) ?? [];
  const authorId = row.author_id as string;
  const idList = [...new Set([authorId, ...taggedIds])].slice(0, 200);

  const [profRes, likedRes, engRes, shareRes, fpRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, photo_url, is_verified")
      .in("id", idList),
    viewerUserId
      ? supabase
          .from("profile_post_likes")
          .select("post_id")
          .eq("user_id", viewerUserId)
          .eq("post_id", postId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.rpc("get_profile_post_engagement_counts", {
      p_post_ids: [postId],
    }),
    supabase.rpc("get_profile_post_share_stats", {
      p_post_ids: [postId],
    }),
    supabase
      .from("freelancer_profiles")
      .select("user_id, live_until")
      .eq("user_id", authorId)
      .maybeSingle(),
  ]);

  const liveUntil =
    (fpRes.data as { live_until: string | null } | null)?.live_until ?? null;

  const profileMap = new Map<string, ProfileSnippet>(
    (profRes.data ?? []).map((p) => [
      p.id as string,
      {
        ...(p as ProfileSnippet),
        live_until: p.id === authorId ? liveUntil : null,
      },
    ]),
  );

  const engRow = (engRes.data ?? [])[0] as
    | {
        post_id: string;
        like_count: number | string;
        comment_count: number | string;
      }
    | undefined;
  const shareRow = (shareRes.data ?? [])[0] as
    | {
        post_id: string;
        click_count: number | string;
        distinct_user_count: number | string;
      }
    | undefined;

  return {
    id: row.id as string,
    author_id: authorId,
    caption: row.caption as string | null,
    media_type: row.media_type as "image" | "video" | null,
    storage_path: row.storage_path as string | null,
    tagged_user_ids: taggedIds,
    created_at: row.created_at as string,
    author: profileMap.get(authorId),
    like_count: Number(engRow?.like_count ?? 0),
    comment_count: Number(engRow?.comment_count ?? 0),
    share_click_count: Number(shareRow?.click_count ?? 0),
    share_distinct_user_count: Number(shareRow?.distinct_user_count ?? 0),
    liked_by_me: Boolean(likedRes.data),
    tagged_profiles: taggedIds
      .map((id) => profileMap.get(id))
      .filter(Boolean) as ProfileSnippet[],
    source: "post",
  };
}
