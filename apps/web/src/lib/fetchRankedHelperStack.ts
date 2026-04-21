import { supabase } from "@/lib/supabase";
import { rankHelperRows, type HelperMatchRow } from "@/lib/rankMatchHelpers";
import type { ServiceCategoryId } from "@/lib/serviceCategories";

export type HelperRpcRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  distance_km: number | null;
  freelancer_profiles: {
    hourly_rate_min: number | null;
    hourly_rate_max: number | null;
    bio: string | null;
    available_now: boolean | null;
    live_until?: string | null;
    live_categories?: string[] | null;
  } | null;
};

function normalizeCityLabel(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Helpers near a point, filtered by category preference and ranked for match UX.
 * Same logic as HelpersMatchPage stack load.
 */
export async function fetchRankedHelperStack(opts: {
  category: ServiceCategoryId;
  searchLat: number;
  searchLng: number;
  radiusKm: number;
  viewerCityNorm: string;
  excludeUserId: string;
}): Promise<HelperRpcRow[]> {
  const { data, error } = await supabase.rpc("get_helpers_near_location", {
    search_lat: opts.searchLat,
    search_lng: opts.searchLng,
    radius_km: opts.radiusKm,
    search_query: "",
    viewer_city_norm: normalizeCityLabel(opts.viewerCityNorm),
    geocode_matched_place: false,
  });
  if (error) throw error;
  let rows = (data || []) as HelperRpcRow[];
  rows = rows.filter((r) => r.id !== opts.excludeUserId);

  const ids = rows.map((r) => r.id);
  let catMap = new Map<string, string[]>();
  if (ids.length) {
    const { data: profs, error: pe } = await supabase
      .from("profiles")
      .select("id, categories")
      .in("id", ids);
    if (!pe && profs) {
      catMap = new Map(
        profs.map((p: { id: string; categories: string[] | null }) => [
          p.id,
          p.categories || [],
        ]),
      );
    }
  }

  const catId = opts.category;
  rows = rows.filter((r) => {
    const cats = catMap.get(r.id) || [];
    if (cats.length === 0) return true;
    return cats.includes(catId);
  });

  rows = rows.filter((r) => {
    const fp = r.freelancer_profiles;
    if (!fp?.live_until) return true;
    const t = new Date(fp.live_until).getTime();
    if (Number.isNaN(t) || t <= Date.now()) return true;
    const lc = fp.live_categories;
    if (!lc?.length) return true;
    return lc.includes(catId);
  });

  const ranked = rankHelperRows(
    rows as HelperMatchRow[],
    catId,
    catMap,
  ) as HelperRpcRow[];

  return ranked;
}
