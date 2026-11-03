import {
  OTHER_HELP_SUBCATEGORIES,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { helpCategoryIdFromServiceDetails } from "@/lib/discoverCategoryTileIcons";

export type DiscoverHomeCategoryFilter = ServiceCategoryId | "all";

export type DiscoverOpenHelpRequestSort = "newest" | "oldest" | "today" | "now";

const OTHER_SUBCATEGORY_IDS = new Set(
  OTHER_HELP_SUBCATEGORIES.map((s) => s.id),
);

export function isOtherHelpSubcategoryId(
  value: string | null | undefined,
): boolean {
  return !!value && OTHER_SUBCATEGORY_IDS.has(value);
}

export function filterOpenHelpRequestsByCategory<
  T extends {
    service_type: string | null;
    service_details?: Record<string, unknown> | null;
  },
>(
  rows: T[],
  categoryFilter: DiscoverHomeCategoryFilter,
  otherSubFilter: string | null = null,
): T[] {
  if (categoryFilter === "all") return rows;
  if (categoryFilter === "other_help") {
    return rows.filter((row) => {
      if (row.service_type !== "other_help") return false;
      if (!otherSubFilter) return true;
      const sub = helpCategoryIdFromServiceDetails(row.service_details);
      return sub === otherSubFilter;
    });
  }
  return rows.filter((row) => row.service_type === categoryFilter);
}

export function applyOpenHelpRequestDiscoverSort<
  T extends { created_at: string | null; when_timeframe?: string | null },
>(rows: T[], sort: DiscoverOpenHelpRequestSort): T[] {
  let result = [...rows];

  if (sort === "today") {
    result = result.filter((row) => row.when_timeframe === "today");
  } else if (sort === "now") {
    result = result.filter((row) => row.when_timeframe === "now");
  }

  result.sort((a, b) => {
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return sort === "oldest" ? aTime - bTime : bTime - aTime;
  });

  return result;
}
