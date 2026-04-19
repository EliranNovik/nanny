import type { ServiceCategoryId } from "@/lib/serviceCategories";

/** Row shape from get_helpers_near_location RPC (subset). */
export type HelperMatchRow = {
  id: string;
  distance_km: number | null;
  freelancer_profiles: {
    available_now?: boolean | null;
    hourly_rate_min?: number | null;
    hourly_rate_max?: number | null;
    bio?: string | null;
  } | null;
};

/**
 * Ranking: (1) category in profile.categories, (2) distance asc, (3) available_now.
 * No random shuffle.
 */
export function rankHelperRows(
  rows: HelperMatchRow[],
  categoryId: ServiceCategoryId,
  categoriesByUserId: Map<string, string[] | null | undefined>,
): HelperMatchRow[] {
  const scored = rows.map((r) => {
    const cats = categoriesByUserId.get(r.id);
    const categoryMatch = cats?.includes(categoryId) ? 0 : 1;
    const dist = r.distance_km ?? 1e9;
    const avail =
      r.freelancer_profiles?.available_now === true ? 0 : 1;
    return { r, categoryMatch, dist, avail };
  });
  scored.sort((a, b) => {
    if (a.categoryMatch !== b.categoryMatch)
      return a.categoryMatch - b.categoryMatch;
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.avail - b.avail;
  });
  return scored.map((s) => s.r);
}
