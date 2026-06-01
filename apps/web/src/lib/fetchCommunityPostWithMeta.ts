import { supabase } from "@/lib/supabase";
import type { AvailabilityPayload } from "@/lib/availabilityPosts";
import type {
  CommunityFeedPost,
  CommunityPostImage,
  CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";

/** Hydrate one public community board post (with images) for live feed inserts. */
export async function fetchCommunityPostWithMetaById(
  postId: string,
): Promise<CommunityPostWithMeta | null> {
  const { data: row, error } = await supabase
    .from("community_posts")
    .select(
      "id, author_id, category, title, body, note, created_at, expires_at, status, availability_payload",
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
  const [authorRes, imgsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, photo_url, city, role, is_verified, average_rating, total_ratings",
      )
      .eq("id", authorId)
      .maybeSingle(),
    supabase
      .from("community_post_images")
      .select("id, post_id, image_url, sort_order")
      .eq("post_id", postId)
      .order("sort_order", { ascending: true }),
  ]);

  const author = authorRes.data;

  const feedPost: CommunityFeedPost = {
    id: row.id as string,
    author_id: authorId,
    category: row.category as string,
    title: (row.title as string) ?? "",
    body: (row.body as string) ?? "",
    note: (row.note as string | null) ?? null,
    created_at: row.created_at as string,
    expires_at: expiresAt,
    availability_payload:
      (row.availability_payload as AvailabilityPayload | null) ?? null,
    author_full_name: (author?.full_name as string | null) ?? null,
    author_photo_url: (author?.photo_url as string | null) ?? null,
    author_city: (author?.city as string | null) ?? null,
    author_role: (author?.role as string | null) ?? null,
    author_is_verified: (author?.is_verified as boolean | null) ?? null,
    author_average_rating: author?.average_rating ?? null,
    author_total_ratings: author?.total_ratings ?? null,
  };

  const images: CommunityPostImage[] = (imgsRes.data ?? []).map((img) => ({
    id: img.id as string,
    image_url: img.image_url as string,
    sort_order: Number(img.sort_order) || 0,
  }));

  return { ...feedPost, images };
}
