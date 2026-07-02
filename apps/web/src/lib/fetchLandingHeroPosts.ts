import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { supabase } from "@/lib/supabase";

export type LandingHeroPost = {
  id: string;
  imageUrl: string;
  postTypeId: string | null;
  authorName: string;
  authorPhotoUrl: string | null;
  authorInitials: string;
};

type ProfilePostRow = {
  id: string;
  storage_path: string | null;
  media_type: string | null;
  post_type_id: string | null;
  profiles: { full_name: string | null; photo_url: string | null } | { full_name: string | null; photo_url: string | null }[] | null;
};

type CommunityFeedRow = {
  id: string;
  author_full_name: string | null;
  author_photo_url: string | null;
};

type CommunityImageRow = {
  post_id: string;
  image_url: string;
  sort_order: number;
};

function memberInitials(name: string | null | undefined): string {
  const parts = (name || "M").trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function firstName(name: string | null | undefined): string {
  const t = (name || "Member").trim();
  const i = t.indexOf(" ");
  return i > 0 ? t.slice(0, i) : t;
}

function resolveProfile(
  profiles: ProfilePostRow["profiles"],
): { full_name: string | null; photo_url: string | null } | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}

export async function fetchLandingHeroPosts(
  limit = 3,
): Promise<LandingHeroPost[]> {
  const { data: postRows, error: postsError } = await supabase
    .from("profile_posts")
    .select(
      "id, storage_path, media_type, post_type_id, profiles!author_id(full_name, photo_url)",
    )
    .eq("media_type", "image")
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(24);

  if (postsError) {
    console.warn("[fetchLandingHeroPosts] profile_posts", postsError);
  }

  const fromProfilePosts: LandingHeroPost[] = ((postRows ?? []) as ProfilePostRow[])
    .filter((row) => row.storage_path?.trim())
    .map((row) => {
      const profile = resolveProfile(row.profiles);
      return {
        id: row.id,
        imageUrl: publicProfileMediaUrl(row.storage_path!, {
          width: 900,
          quality: 82,
        }),
        postTypeId: row.post_type_id,
        authorName: firstName(profile?.full_name),
        authorPhotoUrl: profile?.photo_url ?? null,
        authorInitials: memberInitials(profile?.full_name),
      };
    });

  if (fromProfilePosts.length >= limit) {
    return fromProfilePosts.slice(0, limit);
  }

  const { data: communityRows, error: communityError } = await supabase.rpc(
    "get_community_feed_public",
    { p_category: null, p_limit: 24 },
  );

  if (communityError) {
    console.warn("[fetchLandingHeroPosts] community", communityError);
    return fromProfilePosts.slice(0, limit);
  }

  const communityIds = (communityRows ?? []).map(
    (row: { id: string }) => row.id as string,
  );

  if (communityIds.length === 0) {
    return fromProfilePosts.slice(0, limit);
  }

  const { data: images, error: imagesError } = await supabase
    .from("community_post_images")
    .select("post_id, image_url, sort_order")
    .in("post_id", communityIds)
    .order("sort_order", { ascending: true });

  if (imagesError) {
    console.warn("[fetchLandingHeroPosts] images", imagesError);
    return fromProfilePosts.slice(0, limit);
  }

  const imageByPost = new Map<string, string>();
  for (const img of (images ?? []) as CommunityImageRow[]) {
    if (!imageByPost.has(img.post_id) && img.image_url?.trim()) {
      imageByPost.set(img.post_id, img.image_url.trim());
    }
  }

  const communityById = new Map<string, CommunityFeedRow>(
    ((communityRows ?? []) as CommunityFeedRow[]).map((row) => [row.id, row]),
  );

  const fromCommunity: LandingHeroPost[] = [];
  for (const [postId, imageUrl] of imageByPost) {
    const row = communityById.get(postId);
    if (!row) continue;
    fromCommunity.push({
      id: postId,
      imageUrl,
      postTypeId: "offer_service",
      authorName: firstName(row.author_full_name),
      authorPhotoUrl: row.author_photo_url ?? null,
      authorInitials: memberInitials(row.author_full_name),
    });
  }

  const merged = [...fromProfilePosts];
  for (const item of fromCommunity) {
    if (merged.length >= limit) break;
    if (!merged.some((p) => p.imageUrl === item.imageUrl)) {
      merged.push(item);
    }
  }

  return merged.slice(0, limit);
}
