import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import type { ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";
import type { ProfilePostMediaItem } from "@/lib/profilePostMedia";

/** Public image URLs stored on job_requests.service_details.images (and aliases). */
export function jobRequestImageUrls(
  serviceDetails: Record<string, unknown> | null | undefined,
): string[] {
  if (!serviceDetails || typeof serviceDetails !== "object") return [];
  const raw =
    serviceDetails.images ?? serviceDetails.photos ?? serviceDetails.media;
  if (!Array.isArray(raw)) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    let candidate: string | null = null;
    if (typeof entry === "string" && entry.trim()) {
      candidate = entry.trim();
    } else if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      for (const key of ["url", "src", "image", "path"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
          candidate = value.trim();
          break;
        }
      }
    }
    if (!candidate || seen.has(candidate)) continue;
    // Prefer absolute URLs (job-images / profile-media public URLs).
    if (!/^https?:\/\//i.test(candidate) && !candidate.includes("/")) continue;
    seen.add(candidate);
    urls.push(candidate);
  }
  return urls;
}

export function jobRequestMediaItems(
  serviceDetails: Record<string, unknown> | null | undefined,
): ProfilePostMediaItem[] {
  return jobRequestImageUrls(serviceDetails).map((storage_path) => ({
    storage_path,
    media_type: "image" as const,
  }));
}

export type JobRequestFeedPost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  tagged_user_ids: string[];
  created_at: string;
  author?: ProfileSnippet;
  like_count: number;
  comment_count: number;
  share_click_count: number;
  share_distinct_user_count: number;
  liked_by_me: boolean;
  tagged_profiles: ProfileSnippet[];
  source: "job_request";
  post_type_id: "request_help";
  post_types: {
    id: string;
    name: string;
    emoji: string;
    color: string;
  };
  post_metadata: {
    category?: string | null;
    other_type?: string | null;
    location?: string | null;
    timeframe?: string | null;
    time_duration?: string | null;
    budget?: number | null;
    rate_type?: string | null;
    media_items?: ProfilePostMediaItem[];
  };
  row: DiscoverOpenHelpRequestRow;
  ai_generated_copy: ReturnType<typeof parseGeneratedPostCopy>;
};

export function mapOpenHelpRequestToFeedPost(
  row: DiscoverOpenHelpRequestRow,
  author?: ProfileSnippet,
): JobRequestFeedPost {
  const generatedCopy = parseGeneratedPostCopy(row.ai_generated_copy);
  const caption = row.notes?.trim() || null;
  const imageUrls = jobRequestImageUrls(
    (row.service_details as Record<string, unknown> | null | undefined) ?? null,
  );
  const primaryImage = imageUrls[0] ?? null;

  return {
    id: row.id,
    author_id: row.client_id ?? "",
    caption,
    media_type: primaryImage ? "image" : null,
    storage_path: primaryImage,
    tagged_user_ids: [],
    created_at: row.created_at ?? new Date().toISOString(),
    author:
      author ??
      (row.client_id
        ? {
            id: row.client_id,
            full_name: row.client_display_name,
            photo_url: row.client_photo_url,
            is_verified: row.is_verified ?? null,
          }
        : undefined),
    like_count: 0,
    comment_count: 0,
    share_click_count: 0,
    share_distinct_user_count: 0,
    liked_by_me: false,
    tagged_profiles: [],
    source: "job_request",
    post_type_id: "request_help",
    post_types: {
      id: "request_help",
      name: "Request Help",
      emoji: "🆘",
      color: "#dc2626",
    },
    post_metadata: {
      category: row.service_type,
      other_type:
        typeof (row.service_details as { other_type?: unknown } | null | undefined)
          ?.other_type === "string"
          ? ((row.service_details as { other_type?: string }).other_type ?? null)
          : null,
      location: row.location_city,
      timeframe: row.when_timeframe,
      time_duration: row.time_duration,
      budget: row.budget_min ?? row.budget_max ?? null,
      rate_type: row.budget_rate_type === "per_hour" ? "per_hour" : "fixed",
      ...(imageUrls.length > 1
        ? {
            media_items: imageUrls.slice(1).map((storage_path) => ({
              storage_path,
              media_type: "image" as const,
            })),
          }
        : {}),
    },
    row,
    ai_generated_copy: generatedCopy,
  };
}

export function jobRequestMatchesFeedFilters(
  row: DiscoverOpenHelpRequestRow,
  filters: {
    when?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    authorId?: string | null;
    favoriteAuthorIds?: string[] | null;
  },
): boolean {
  if (filters.authorId && row.client_id !== filters.authorId) return false;
  if (
    filters.favoriteAuthorIds &&
    row.client_id &&
    !filters.favoriteAuthorIds.includes(row.client_id)
  ) {
    return false;
  }

  if (filters.when && filters.when !== "any" && row.when_timeframe !== filters.when) {
    return false;
  }

  const amount = row.budget_min ?? row.budget_max;
  if (filters.budgetMin != null && (amount == null || amount < filters.budgetMin)) {
    return false;
  }
  if (filters.budgetMax != null && (amount == null || amount > filters.budgetMax)) {
    return false;
  }

  return true;
}
