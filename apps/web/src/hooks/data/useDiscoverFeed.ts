import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";
import { ALL_HELP_CATEGORY_ID, DISCOVER_HOME_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import { formatAvailabilityLocationLine } from "@/lib/availabilityPosts";

export function useDiscoverFeed() {
  return useQuery({
    queryKey: queryKeys.discoverFeed(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_community_feed_public", {
        p_category: null,
      });

      if (error) throw error;

      const rows = (data || []) as { category: string | null }[];
      const next: Record<string, number> = Object.fromEntries(
        DISCOVER_HOME_CATEGORIES.map((c) => [c.id, 0]),
      );

      for (const row of rows) {
        const cat = row.category?.trim();
        if (cat && cat !== ALL_HELP_CATEGORY_ID && cat in next) {
          next[cat] += 1;
        }
      }
      next[ALL_HELP_CATEGORY_ID] = rows.length;

      return next;
    },
  });
}

/** Live helper avatars by category; pass excludeUserId to omit the viewer’s own availability. */
export function useDiscoverLiveAvatars(excludeUserId?: string | null) {
  return useQuery({
    queryKey: queryKeys.discoverLiveAvatars(excludeUserId ?? undefined),
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const categoryIds = Array.from(
        new Set([
          ...DISCOVER_HOME_CATEGORIES.map((c) => c.id),
          ...SERVICE_CATEGORIES.map((c) => c.id),
        ]),
      ).filter((id) => id && id !== ALL_HELP_CATEGORY_ID);

      const { data, error } = await supabase
        .from("community_posts")
        .select(`
          id,
          category,
          author_id,
          created_at,
          availability_payload,
          author:profiles!author_id (
            id,
            full_name,
            photo_url,
            average_rating,
            total_ratings,
            city
          )
        `)
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .in("category", categoryIds)
        .order("created_at", { ascending: false })
        .limit(220);

      if (error) throw error;

      const next: Record<
        string,
        {
          /** `community_posts.id` — deep link to this availability post */
          post_id: string;
          full_name: string | null;
          photo_url: string | null;
          average_rating: number | null;
          /** Area from availability payload or author city */
          location_line: string;
        }[]
      > = {};

      for (const id of categoryIds) next[id] = [];
      const seen = new Map<string, Set<string>>();

      for (const row of (data || []) as any[]) {
        const cat = String(row?.category ?? "").trim();
        if (!cat || !(cat in next)) continue;

        const author = row?.author;
        const authorId = String(author?.id ?? row?.author_id ?? "").trim();
        const postId = String(row?.id ?? "").trim();
        const authorCity =
          author && typeof author === "object" && "city" in author
            ? ((author as { city?: string | null }).city ?? null)
            : null;

        if (!authorId || !postId) continue;
        if (excludeUserId && authorId === excludeUserId) continue;
        if (!seen.has(cat)) seen.set(cat, new Set());

        const set = seen.get(cat)!;
        if (set.has(authorId)) continue;
        if (next[cat].length >= 3) continue;

        set.add(authorId);
        next[cat].push({
          post_id: postId,
          full_name: (author?.full_name as string | null) ?? null,
          photo_url: (author?.photo_url as string | null) ?? null,
          average_rating:
            author?.average_rating != null
              ? Number(author.average_rating)
              : null,
          location_line: formatAvailabilityLocationLine(
            row?.availability_payload,
            authorCity,
          ),
        });
      }

      // Ensure keys exist for tiles even if empty.
      const allTileIds = Array.from(
        new Set([
          ...DISCOVER_HOME_CATEGORIES.map((c) => c.id),
          ...SERVICE_CATEGORIES.map((c) => c.id),
        ]),
      );
      for (const id of allTileIds) {
        if (!next[id]) next[id] = [];
      }

      return next;
    },
  });
}
