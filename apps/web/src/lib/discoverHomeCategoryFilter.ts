import {
  OTHER_HELP_SUBCATEGORIES,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { helpCategoryIdFromServiceDetails } from "@/lib/discoverCategoryTileIcons";

export type DiscoverHomeCategoryFilter = ServiceCategoryId | "all";

export type DiscoverOpenHelpRequestSort = "newest" | "oldest" | "today" | "now";

export type DiscoverHomeListingSort =
  | "newest"
  | "oldest"
  | "when"
  | "reviews"
  | "category"
  | "nearest";

export const DISCOVER_HOME_LISTING_SORTS: {
  id: DiscoverHomeListingSort;
  label: string;
}[] = [
  { id: "newest", label: "Date posted" },
  { id: "oldest", label: "Oldest" },
  { id: "when", label: "When" },
  { id: "reviews", label: "Reviews" },
  { id: "category", label: "Category" },
  { id: "nearest", label: "Location" },
];

export type DiscoverHomeWhenFilter = "" | "now" | "today" | "tomorrow" | "this_week";

export type DiscoverHomeListingFilters = {
  dateFrom: string;
  dateTo: string;
  when: DiscoverHomeWhenFilter;
  categories: string[];
  reviewMin: string;
  reviewMax: string;
  distanceMaxKm: string;
};

export const EMPTY_LISTING_FILTERS: DiscoverHomeListingFilters = {
  dateFrom: "",
  dateTo: "",
  when: "",
  categories: [],
  reviewMin: "",
  reviewMax: "",
  distanceMaxKm: "",
};

export function listingFiltersAreActive(filters: DiscoverHomeListingFilters): boolean {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.when ||
      filters.categories.length ||
      filters.reviewMin ||
      filters.reviewMax ||
      filters.distanceMaxKm,
  );
}

export type ListingFilterFields = {
  createdAt: string | null;
  when: string | null;
  categoryId: string | null;
  customCategory?: string | null;
  rating: number | null;
  distanceKm: number | null;
};

function dayBound(value: string, end: boolean): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function matchesWhen(createdAt: string | null, when: string | null, selected: DiscoverHomeWhenFilter): boolean {
  if (!selected) return true;
  if (when) return when === selected;
  const created = new Date(createdAt ?? 0);
  if (Number.isNaN(created.getTime())) return false;
  const now = new Date();
  if (selected === "now") return now.getTime() - created.getTime() <= 24 * 60 * 60 * 1000;
  if (selected === "today") return created.toDateString() === now.toDateString();
  if (selected === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return created.toDateString() === tomorrow.toDateString();
  }
  return now.getTime() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

export function matchesListingFilters(
  item: ListingFilterFields,
  filters: DiscoverHomeListingFilters,
): boolean {
  const created = new Date(item.createdAt ?? 0).getTime();
  const from = dayBound(filters.dateFrom, false);
  const to = dayBound(filters.dateTo, true);
  if (from != null && (!Number.isFinite(created) || created < from)) return false;
  if (to != null && (!Number.isFinite(created) || created > to)) return false;
  if (!matchesWhen(item.createdAt, item.when, filters.when)) return false;
  if (filters.categories.length > 0) {
    const id = (item.categoryId ?? "").toLowerCase();
    const custom = (item.customCategory ?? "").toLowerCase();
    const selected = filters.categories.map((category) => category.toLowerCase());
    if (!selected.includes(id) && !selected.includes(custom)) return false;
  }
  const minRating = filters.reviewMin.trim() === "" ? null : Number(filters.reviewMin);
  const maxRating = filters.reviewMax.trim() === "" ? null : Number(filters.reviewMax);
  if (minRating != null && Number.isFinite(minRating)) {
    if (item.rating == null || item.rating < minRating) return false;
  }
  if (maxRating != null && Number.isFinite(maxRating)) {
    if (item.rating == null || item.rating > maxRating) return false;
  }
  const maxKm = filters.distanceMaxKm.trim() === "" ? null : Number(filters.distanceMaxKm);
  if (maxKm != null && Number.isFinite(maxKm)) {
    if (item.distanceKm == null || item.distanceKm > maxKm) return false;
  }
  return true;
}

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
  return rows.filter(
    (row) => (row.service_type ?? "").toLowerCase() === categoryFilter,
  );
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
