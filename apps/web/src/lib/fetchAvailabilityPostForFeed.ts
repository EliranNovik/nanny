import { supabase } from "@/lib/supabase";
import type { AvailabilityPayload } from "@/lib/availabilityPosts";
import type { ProfileSnippet } from "@/components/profile/ProfilePostsFeed";

export type FetchedAvailabilityPost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: null;
  storage_path: null;
  tagged_user_ids: string[];
  created_at: string;
  author?: ProfileSnippet;
  like_count: number;
  comment_count: number;
  share_click_count: number;
  share_distinct_user_count: number;
  liked_by_me: boolean;
  tagged_profiles: ProfileSnippet[];
  source: "availability";
  category: string;
  availability_payload: AvailabilityPayload | null;
};

/** Hydrate a single active availability pulse for ProfilePostsFeed realtime inserts. */
export async function fetchAvailabilityPostForFeed(
  postId: string,
): Promise<FetchedAvailabilityPost | null> {
  const { data: row, error } = await supabase
    .from("community_posts")
    .select(
      "id, category, title, note, expires_at, availability_payload, created_at, author_id, status",
    )
    .eq("id", postId)
    .maybeSingle();

  if (error || !row) return null;

  const status = row.status as string;
  const expiresAt = row.expires_at as string;
  if (status !== "active" || new Date(expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const authorId = row.author_id as string;
  const [profRes, fpRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, photo_url, is_verified")
      .eq("id", authorId)
      .maybeSingle(),
    supabase
      .from("freelancer_profiles")
      .select("user_id, live_until")
      .eq("user_id", authorId)
      .maybeSingle(),
  ]);

  const author: ProfileSnippet | undefined = profRes.data
    ? {
        id: profRes.data.id as string,
        full_name: (profRes.data.full_name as string | null) ?? null,
        photo_url: (profRes.data.photo_url as string | null) ?? null,
        is_verified: (profRes.data.is_verified as boolean | null) ?? null,
        live_until:
          (fpRes.data as { live_until: string | null } | null)?.live_until ??
          null,
      }
    : undefined;

  return {
    id: row.id as string,
    author_id: authorId,
    caption: (row.note as string | null) ?? (row.title as string | null),
    media_type: null,
    storage_path: null,
    tagged_user_ids: [],
    created_at: row.created_at as string,
    author,
    like_count: 0,
    comment_count: 0,
    share_click_count: 0,
    share_distinct_user_count: 0,
    liked_by_me: false,
    tagged_profiles: [],
    source: "availability",
    category: row.category as string,
    availability_payload:
      (row.availability_payload as AvailabilityPayload | null) ?? null,
  };
}
