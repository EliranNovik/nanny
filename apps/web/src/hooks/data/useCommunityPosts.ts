import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";
import type {
  CommunityFeedPost,
  CommunityPostImage,
  CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";

export function useCommunityPosts(category: string | null) {
  return useQuery<CommunityPostWithMeta[]>({
    queryKey: queryKeys.communityPosts(category),
    staleTime: 90 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc(
        "get_community_feed_public",
        { p_category: category ?? null, p_limit: 160 },
      );
      if (error) throw error;

      const list = (rows || []) as CommunityFeedPost[];
      if (list.length === 0) return [];

      const postIds = list.map((p) => p.id);
      const { data: imgs, error: imgErr } = await supabase
        .from("community_post_images")
        .select("id, post_id, image_url, sort_order")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true });

      if (imgErr) throw imgErr;

      const imagesByPost = new Map<string, CommunityPostImage[]>();
      for (const img of imgs || []) {
        const pid = img.post_id as string;
        if (!imagesByPost.has(pid)) imagesByPost.set(pid, []);
        imagesByPost.get(pid)!.push({
          id: img.id as string,
          image_url: img.image_url as string,
          sort_order: Number(img.sort_order) || 0,
        });
      }

      return list.map((p) => ({
        ...p,
        images: imagesByPost.get(p.id) ?? [],
      }));
    },
  });
}

export function usePostFavorites(
  userId: string | undefined,
  postIds: string[],
) {
  return useQuery<Set<string>>({
    queryKey: queryKeys.postFavorites(userId, postIds),
    enabled: !!userId && postIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_post_favorites")
        .select("post_id")
        .eq("user_id", userId!)
        .in("post_id", postIds);
      if (error) throw error;
      return new Set((data || []).map((r) => r.post_id as string));
    },
  });
}

export function usePendingHireInterests(
  userId: string | undefined,
  role: string | undefined,
  postIds: string[],
) {
  return useQuery<Set<string>>({
    queryKey: queryKeys.pendingHireInterests(userId, postIds),
    enabled: !!userId && role === "client" && postIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_post_hire_interests")
        .select("community_post_id")
        .eq("client_id", userId!)
        .eq("status", "pending")
        .in("community_post_id", postIds);
      if (error) throw error;
      return new Set((data || []).map((r) => r.community_post_id as string));
    },
  });
}
