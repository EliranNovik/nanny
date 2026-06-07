import type { ServiceCategoryId } from "@/lib/serviceCategories";

export type DiscoverHomeCategoryFilter = ServiceCategoryId | "all";

export type DiscoverOpenHelpRequestSort = "newest" | "oldest" | "today" | "now";

export const DISCOVER_OPEN_HELP_REQUEST_SORT_LABELS: Record<
  DiscoverOpenHelpRequestSort,
  string
> = {
  newest: "Newest",
  oldest: "Oldest",
  today: "Today",
  now: "Now",
};

export function filterOpenHelpRequestsByCategory<
  T extends { service_type: string | null },
>(rows: T[], categoryFilter: DiscoverHomeCategoryFilter): T[] {
  if (categoryFilter === "all") return rows;
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
