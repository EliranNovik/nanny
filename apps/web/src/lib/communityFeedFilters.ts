export type CommunityFeedWhenFilter =
  | "any"
  | "now"
  | "today"
  | "tomorrow"
  | "this_week"
  | "custom";

export type CommunityFeedAdvancedFilters = {
  when: CommunityFeedWhenFilter;
  customWhenFromDate: string | null;
  customWhenFromTime: string | null;
  customWhenToDate: string | null;
  customWhenToTime: string | null;
  myPostsOnly: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  favoriteProfilesOnly: boolean;
};

export const DEFAULT_COMMUNITY_FEED_ADVANCED_FILTERS: CommunityFeedAdvancedFilters =
  {
    when: "any",
    customWhenFromDate: null,
    customWhenFromTime: null,
    customWhenToDate: null,
    customWhenToTime: null,
    myPostsOnly: false,
    budgetMin: null,
    budgetMax: null,
    favoriteProfilesOnly: false,
  };

export const COMMUNITY_FEED_WHEN_OPTIONS: {
  id: CommunityFeedWhenFilter;
  label: string;
}[] = [
  { id: "any", label: "Any time" },
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "This week" },
  { id: "custom", label: "Custom" },
];

export function countActiveAdvancedFilters(
  filters: CommunityFeedAdvancedFilters,
): number {
  let n = 0;
  if (filters.when !== "any") n += 1;
  if (filters.myPostsOnly) n += 1;
  if (filters.budgetMin != null) n += 1;
  if (filters.budgetMax != null) n += 1;
  if (filters.favoriteProfilesOnly) n += 1;
  return n;
}

export function hasActiveAdvancedFilters(
  filters: CommunityFeedAdvancedFilters,
): boolean {
  return countActiveAdvancedFilters(filters) > 0;
}

type PostLike = {
  post_type_id?: string | null;
  post_metadata?: {
    timeframe?: string | null;
    custom_when_date?: string | null;
    custom_when_time?: string | null;
    budget?: number | null;
    rate?: number | null;
  } | null;
};

export function parseCustomWhenDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
  endOfDay = false,
): Date | null {
  if (!date?.trim()) return null;
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  let hours = endOfDay ? 23 : 0;
  let minutes = endOfDay ? 59 : 0;
  if (time?.trim()) {
    const [rawHours, rawMinutes] = time.split(":").map((part) => parseInt(part, 10));
    if (Number.isFinite(rawHours)) hours = rawHours;
    if (Number.isFinite(rawMinutes)) minutes = rawMinutes;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timeframeMatchesWhenFilter(
  metadata: PostLike["post_metadata"],
  when: CommunityFeedWhenFilter,
  customRange: Pick<
    CommunityFeedAdvancedFilters,
    | "customWhenFromDate"
    | "customWhenFromTime"
    | "customWhenToDate"
    | "customWhenToTime"
  >,
): boolean {
  const timeframe = metadata?.timeframe ?? null;
  if (!timeframe) return false;

  if (when === "today") {
    return timeframe === "today" || timeframe === "now";
  }

  if (when === "custom") {
    if (timeframe !== "custom") return false;

    const hasRange =
      Boolean(customRange.customWhenFromDate) ||
      Boolean(customRange.customWhenToDate);
    if (!hasRange) return true;

    const postWhen = parseCustomWhenDateTime(
      metadata?.custom_when_date,
      metadata?.custom_when_time,
    );
    if (!postWhen) return false;

    const fromWhen = parseCustomWhenDateTime(
      customRange.customWhenFromDate,
      customRange.customWhenFromTime ?? "00:00",
    );
    const toWhen = parseCustomWhenDateTime(
      customRange.customWhenToDate,
      customRange.customWhenToTime ?? "23:59",
      !customRange.customWhenToTime,
    );

    if (fromWhen && postWhen.getTime() < fromWhen.getTime()) return false;
    if (toWhen && postWhen.getTime() > toWhen.getTime()) return false;
    return true;
  }

  return timeframe === when;
}

/** Client-side filters for when / budget (JSON metadata). */
export function postMatchesAdvancedFeedFilters(
  post: PostLike,
  filters: CommunityFeedAdvancedFilters,
): boolean {
  if (filters.when !== "any") {
    if (post.post_type_id !== "request_help") return false;
    if (
      !timeframeMatchesWhenFilter(post.post_metadata, filters.when, filters)
    ) {
      return false;
    }
  }

  if (filters.budgetMin != null || filters.budgetMax != null) {
    const raw =
      post.post_type_id === "request_help"
        ? post.post_metadata?.budget
        : post.post_type_id === "offer_service"
          ? post.post_metadata?.rate
          : null;
    if (raw == null || Number.isNaN(Number(raw))) return false;
    const amount = Number(raw);
    if (filters.budgetMin != null && amount < filters.budgetMin) return false;
    if (filters.budgetMax != null && amount > filters.budgetMax) return false;
  }

  return true;
}
