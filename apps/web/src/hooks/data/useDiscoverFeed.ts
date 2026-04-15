import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";
import { ALL_HELP_CATEGORY_ID, DISCOVER_HOME_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/serviceCategories";

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

export function useDiscoverLiveAvatars() {
  return useQuery({
    queryKey: queryKeys.discoverLiveAvatars(),
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
          author:profiles!author_id (
            id,
            full_name,
            photo_url
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
        { id: string; full_name: string | null; photo_url: string | null }[]
      > = {};

      for (const id of categoryIds) next[id] = [];
      const seen = new Map<string, Set<string>>();

      for (const row of (data || []) as any[]) {
        const cat = String(row?.category ?? "").trim();
        if (!cat || !(cat in next)) continue;

        const author = row?.author;
        const authorId = String(author?.id ?? row?.author_id ?? "").trim();

        if (!authorId) continue;
        if (!seen.has(cat)) seen.set(cat, new Set());

        const set = seen.get(cat)!;
        if (set.has(authorId)) continue;
        if (next[cat].length >= 3) continue;

        set.add(authorId);
        next[cat].push({
          id: authorId,
          full_name: (author?.full_name as string | null) ?? null,
          photo_url: (author?.photo_url as string | null) ?? null,
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
