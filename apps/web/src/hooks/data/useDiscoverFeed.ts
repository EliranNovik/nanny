import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";
import { ALL_HELP_CATEGORY_ID, DISCOVER_HOME_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import { formatAvailabilityLocationLine } from "@/lib/availabilityPosts";

/** Discover “Helpers available now” strip — one entry per helper per category (from `freelancer_profiles` live window). */
export type DiscoverLiveAvatarEntry = {
  helper_user_id: string;
  full_name: string | null;
  photo_url: string | null;
  average_rating: number | null;
  total_ratings: number | null;
  location_line: string;
};

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

/** Live helper avatars by category from `freelancer_profiles.live_until` + `live_categories` (24h go-live). */
export function useDiscoverLiveAvatars(excludeUserId?: string | null) {
  const queryClient = useQueryClient();
  const qk = queryKeys.discoverLiveAvatars(excludeUserId ?? undefined);

  useRealtimeSubscription(
    { table: "freelancer_profiles", event: "*" },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    }
  );

  return useQuery({
    queryKey: qk,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const categoryIds = Array.from(
        new Set([
          ...DISCOVER_HOME_CATEGORIES.map((c) => c.id),
          ...SERVICE_CATEGORIES.map((c) => c.id),
        ]),
      ).filter((id) => id && id !== ALL_HELP_CATEGORY_ID);

      const { data, error } = await supabase
        .from("freelancer_profiles")
        .select(
          `
          user_id,
          live_until,
          live_categories,
          profiles!inner (
            id,
            full_name,
            photo_url,
            city,
            average_rating,
            total_ratings
          )
        `,
        )
        .not("live_until", "is", null)
        .gt("live_until", nowIso)
        .limit(300);

      if (error) throw error;

      const next: Record<string, DiscoverLiveAvatarEntry[]> = {};

      for (const id of categoryIds) next[id] = [];
      const seen = new Map<string, Set<string>>();

      for (const row of (data || []) as {
        user_id?: string;
        live_categories?: string[] | null;
        profiles?:
          | {
              id: string;
              full_name: string | null;
              photo_url: string | null;
              city: string | null;
              average_rating?: number | null;
              total_ratings?: number | null;
            }[]
          | {
              id: string;
              full_name: string | null;
              photo_url: string | null;
              city: string | null;
              average_rating?: number | null;
              total_ratings?: number | null;
            }
          | null;
      }[]) {
        const profRaw = row.profiles;
        const prof = Array.isArray(profRaw) ? profRaw[0] : profRaw;
        const authorId = String(prof?.id ?? row.user_id ?? "").trim();
        if (!authorId) continue;
        if (excludeUserId && authorId === excludeUserId) continue;

        const authorCity = prof?.city ?? null;
        const location_line = formatAvailabilityLocationLine(
          null,
          authorCity,
        );

        const cats = Array.isArray(row.live_categories)
          ? row.live_categories
          : [];
        for (const cat of cats) {
          const c = String(cat ?? "").trim();
          if (!c || !(c in next)) continue;
          if (!seen.has(c)) seen.set(c, new Set());
          const set = seen.get(c)!;
          if (set.has(authorId)) continue;
          if (next[c].length >= 3) continue;
          set.add(authorId);
          next[c].push({
            helper_user_id: authorId,
            full_name: prof?.full_name ?? null,
            photo_url: prof?.photo_url ?? null,
            average_rating:
              prof?.average_rating != null
                ? Number(prof.average_rating)
                : null,
            total_ratings:
              prof?.total_ratings != null ? Number(prof.total_ratings) : null,
            location_line,
          });
        }
      }

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
