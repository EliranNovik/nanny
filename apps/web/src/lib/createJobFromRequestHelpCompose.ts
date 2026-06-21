import { apiPost } from "@/lib/api";
import {
  buildCustomWhenAtIso,
  computeJobStartAtFromWhen,
} from "@/lib/createJobWhen";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import type { ProfilePostMediaItem } from "@/lib/profilePostMedia";
import type { RequestHelpTimeframe } from "@/lib/requestHelpWhen";

export type RequestHelpComposeJobInput = {
  category: string;
  customCategory?: string | null;
  locationAddress: string;
  timeframe: RequestHelpTimeframe;
  customWhenDate?: Date | null;
  customWhenTime?: string;
  budgetAmount?: string;
  budgetRateType?: "per_hour" | "fixed";
  caption?: string | null;
  profilePostId: string;
  mediaItems?: ProfilePostMediaItem[];
};

export async function createJobRequestFromRequestHelpCompose(
  input: RequestHelpComposeJobInput,
): Promise<{ jobId: string; confirmEndsAt: string }> {
  const customWhenAtIso =
    input.timeframe === "custom" && input.customWhenDate && input.customWhenTime
      ? buildCustomWhenAtIso(input.customWhenDate, input.customWhenTime)
      : null;

  const startAt = computeJobStartAtFromWhen(input.timeframe, customWhenAtIso);

  const budgetParsed = input.budgetAmount ? Number(input.budgetAmount) : NaN;
  const hasBudget = Number.isFinite(budgetParsed) && budgetParsed > 0;

  const imageUrls =
    input.mediaItems?.map((item) =>
      publicProfileMediaPublicUrl(item.storage_path),
    ) ?? [];

  const jobPayload = {
    service_type: input.category,
    care_frequency: "one_time" as const,
    time_duration: "1_2_hours" as const,
    location_city: input.locationAddress.trim(),
    when_timeframe: input.timeframe,
    custom_when_at: customWhenAtIso ?? undefined,
    start_at: startAt,
    budget_min: hasBudget ? budgetParsed : null,
    budget_max:
      hasBudget && input.budgetRateType === "fixed" ? budgetParsed : null,
    budget_rate_type: hasBudget ? input.budgetRateType ?? "per_hour" : null,
    notes: input.caption?.trim() || null,
    confirm_window_seconds: 90,
    service_details: {
      source: "profile_post_compose",
      profile_post_id: input.profilePostId,
      ...(input.customCategory ? { custom_category: input.customCategory } : {}),
      ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
    },
  };

  const result = await apiPost<{ job_id: string; confirm_ends_at: string }>(
    "/api/jobs",
    jobPayload,
  );

  return { jobId: result.job_id, confirmEndsAt: result.confirm_ends_at };
}

export function linkedJobRequestIdFromPost(post: {
  source: string;
  id: string;
  post_type_id?: string | null;
  post_metadata?: Record<string, unknown> | null;
}): string | null {
  if (post.source === "job_request") return post.id;
  if (post.source !== "post" || post.post_type_id !== "request_help") return null;
  const raw = post.post_metadata?.job_request_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function collectLinkedJobRequestIdsFromProfilePosts(
  posts: Array<{
    source: string;
    post_type_id?: string | null;
    post_metadata?: Record<string, unknown> | null;
  }>,
): Set<string> {
  const ids = new Set<string>();
  for (const post of posts) {
    const id = linkedJobRequestIdFromPost({
      source: post.source,
      id: "",
      post_type_id: post.post_type_id,
      post_metadata: post.post_metadata,
    });
    if (id) ids.add(id);
  }
  return ids;
}
