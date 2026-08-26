import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";
import {
  formatOpenHelpRequestBudget,
  formatOpenHelpRequestWhen,
  openHelpRequestDescription,
  serviceCategoryTitle,
} from "@/lib/openHelpRequestDisplay";
import {
  isolatedFeedDetailRows,
  type IsolatedFeedDetailRow,
} from "@/lib/isolatedFeedPostDetails";
import {
  formatAvailabilityLocationLine,
  formatPriceHintFromPayload,
  getAvailabilityStatusOption,
  getDurationPresetLegacy,
  getQuickDetailsOption,
  type AvailabilityPayload,
} from "@/lib/availabilityPosts";
import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";
import { globalJobRequestFeedPath } from "@/lib/jobRequestShare";
import {
  globalProfilePostFeedPath,
} from "@/lib/profilePostShare";
import {
  publicProfileMediaPublicUrl,
} from "@/lib/publicProfileMedia";
import {
  otherHelpSubcategoryLabel,
  postServiceCategoryLabel,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";

function detailString(
  details: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!details) return null;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export type LandingActivityKind = "request" | "offer";

export type LandingActivityItem = {
  id: string;
  kind: LandingActivityKind;
  created_at: string;
  authorName: string;
  authorPhotoUrl: string | null;
  authorInitials: string;
  roleLabel: string;
  description: string;
  rateLabel: string | null;
  href: string;
  feedTarget: "post" | "request";
  categoryId: string | null;
  /** Other-help subcategory (`digital_creative`, `pet_help`, …) when present. */
  customCategory: string | null;
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
  detailPoints: IsolatedFeedDetailRow[];
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

type ProfilePostRow = {
  id: string;
  author_id: string;
  caption: string | null;
  created_at: string;
  post_type_id: string | null;
  post_metadata: Record<string, unknown> | null;
  ai_generated_copy: unknown;
  custom_category: string | null;
  storage_path: string | null;
  media_type: string | null;
};

type CommunityFeedRow = {
  id: string;
  author_id: string;
  category: string | null;
  title: string | null;
  body: string | null;
  note: string | null;
  created_at: string;
  availability_payload: AvailabilityPayload | null;
  author_full_name: string | null;
  author_photo_url: string | null;
};

const ACTIVITY_LIMIT = 16;

function memberInitials(name: string | null | undefined): string {
  const parts = (name || "Member").trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function firstName(name: string | null | undefined): string {
  const t = (name || "Member").trim();
  const i = t.indexOf(" ");
  return i > 0 ? t.slice(0, i) : t;
}

function clampText(text: string | null | undefined, max = 220): string {
  const t = (text || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function profilePostBudgetLabel(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const budget = meta.budget;
  const rateType = meta.rate_type;
  if (typeof budget !== "number" || !Number.isFinite(budget)) return null;
  const suffix =
    rateType === "hourly" || rateType === "per_hour" ? "/hour" : "";
  return `₪${budget}${suffix}`;
}

function profilePostMedia(
  storagePath: string | null | undefined,
  mediaType: string | null | undefined,
): { mediaUrl: string | null; mediaKind: "image" | "video" | null } {
  const path = storagePath?.trim();
  if (!path) return { mediaUrl: null, mediaKind: null };
  return {
    mediaUrl: publicProfileMediaPublicUrl(path),
    mediaKind: mediaType === "video" ? "video" : "image",
  };
}

function metaString(
  meta: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickupRouteFromDetails(
  details: Record<string, unknown> | null | undefined,
): {
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  from_address?: string | null;
  to_address?: string | null;
} | null {
  if (!details) return null;
  const from =
    (typeof details.from_address === "string" && details.from_address.trim()) ||
    (typeof details.fromAddress === "string" && details.fromAddress.trim()) ||
    null;
  const to =
    (typeof details.to_address === "string" && details.to_address.trim()) ||
    (typeof details.toAddress === "string" && details.toAddress.trim()) ||
    null;
  if (!from && !to) return null;
  return {
    from_lat: 0,
    from_lng: 0,
    to_lat: 0,
    to_lng: 0,
    from_address: from,
    to_address: to,
  };
}

function filterDetailPoints(
  rows: IsolatedFeedDetailRow[],
  description: string,
): IsolatedFeedDetailRow[] {
  const desc = description.trim().toLowerCase();
  return rows.filter((row) => {
    if (row.kind === "notes" && row.value.trim().toLowerCase() === desc) {
      return false;
    }
    return true;
  });
}

function availabilityDetailPoints(
  payload: AvailabilityPayload | null,
): IsolatedFeedDetailRow[] {
  if (!payload) return [];
  const rows: IsolatedFeedDetailRow[] = [];
  const location = formatAvailabilityLocationLine(payload, null);
  if (location && location !== "—") {
    rows.push({ key: "location", kind: "location", value: location });
  }
  const statusId =
    typeof payload.availability_status === "string"
      ? payload.availability_status
      : "";
  const status = getAvailabilityStatusOption(statusId);
  if (status) {
    rows.push({ key: "when", kind: "when", value: status.label });
  }
  const quickId =
    typeof payload.quick_details === "string" ? payload.quick_details : "";
  const quick = getQuickDetailsOption(quickId);
  if (quick) {
    rows.push({ key: "duration", kind: "duration", value: quick.label });
  } else if (typeof payload.duration_preset === "string") {
    const preset = getDurationPresetLegacy(payload.duration_preset);
    if (preset) {
      rows.push({ key: "duration", kind: "duration", value: preset.label });
    }
  }
  const rate = formatPriceHintFromPayload(payload);
  if (rate) {
    rows.push({ key: "rate", kind: "rate", value: rate });
  }
  return rows;
}

function mapJobRequest(
  row: DiscoverOpenHelpRequestRow,
  profile?: ProfileRow,
): LandingActivityItem {
  const name = profile?.full_name ?? row.client_display_name ?? "Member";
  const description =
    openHelpRequestDescription(row) ||
    clampText(row.notes) ||
    `Open ${serviceCategoryTitle(row.service_type).toLowerCase()} request.`;
  const budget = formatOpenHelpRequestBudget(row);
  const rateType = row.budget_rate_type === "hourly" ? "/hour" : "";

  const photo = jobAttachmentImageUrls({
    service_details: row.service_details ?? undefined,
  })[0] ?? null;
  const detailPoints = filterDetailPoints(
    isolatedFeedDetailRows({
      source: "job_request",
      postTypeId: "request_help",
      metadata: row.service_details ?? null,
      caption: description,
      row,
      locationLine: row.location_city?.trim() || null,
      whenLabel: formatOpenHelpRequestWhen(row),
      pickupRoute: pickupRouteFromDetails(row.service_details),
      rateTypeLabel: row.budget_rate_type === "hourly" ? "/hour" : null,
    }),
    description,
  );

  return {
    id: row.id,
    kind: "request",
    created_at: row.created_at ?? new Date().toISOString(),
    authorName: firstName(name),
    authorPhotoUrl: profile?.photo_url ?? row.client_photo_url ?? null,
    authorInitials: memberInitials(name),
    roleLabel: postServiceCategoryLabel(
      row.service_type,
      detailString(row.service_details, ["other_type", "custom_category"]),
    ),
    description,
    rateLabel: budget ? `${budget}${rateType}` : null,
    href: globalJobRequestFeedPath(row.id),
    feedTarget: "request",
    categoryId: row.service_type ?? null,
    customCategory: detailString(row.service_details, [
      "other_type",
      "custom_category",
    ]),
    mediaUrl: photo,
    mediaKind: photo ? "image" : null,
    detailPoints,
  };
}

function mapProfilePost(row: ProfilePostRow, profile?: ProfileRow): LandingActivityItem | null {
  const typeId = row.post_type_id;
  if (typeId !== "request_help" && typeId !== "offer_service") return null;

  const kind: LandingActivityKind = typeId === "request_help" ? "request" : "offer";
  const meta = row.post_metadata;
  const generated = parseGeneratedPostCopy(row.ai_generated_copy);
  const categoryId =
    (typeof meta?.category === "string" && meta.category) ||
    (typeof meta?.service === "string" && meta.service) ||
    null;
  const customCategory =
    (typeof meta?.custom_category === "string" && meta.custom_category.trim()) ||
    (typeof meta?.other_type === "string" && meta.other_type.trim()) ||
    detailString(
      meta?.service_details && typeof meta.service_details === "object"
        ? (meta.service_details as Record<string, unknown>)
        : null,
      ["other_type", "custom_category"],
    ) ||
    row.custom_category;
  const name = profile?.full_name ?? "Member";
  const description =
    clampText(generated?.short_text ?? row.caption) ||
    (kind === "request" ? "Looking for help nearby." : "Offering help nearby.");

  const media = profilePostMedia(row.storage_path, row.media_type);
  const rateType =
    typeof meta?.rate_type === "string" &&
    (meta.rate_type === "hourly" || meta.rate_type === "per_hour")
      ? "/hour"
      : null;
  const detailPoints = filterDetailPoints(
    isolatedFeedDetailRows({
      source: "post",
      postTypeId: typeId,
      metadata: meta,
      caption: row.caption,
      locationLine: metaString(meta, ["city", "location", "location_city", "area"]),
      whenLabel: formatOpenHelpRequestWhen({
        when_timeframe:
          typeof meta?.when_timeframe === "string" ? meta.when_timeframe : null,
        custom_when_at:
          typeof meta?.custom_when_at === "string" ? meta.custom_when_at : null,
      }),
      pickupRoute: pickupRouteFromDetails(
        meta?.service_details && typeof meta.service_details === "object"
          ? (meta.service_details as Record<string, unknown>)
          : meta,
      ),
      rateTypeLabel: rateType,
    }),
    description,
  );

  return {
    id: row.id,
    kind,
    created_at: row.created_at,
    authorName: firstName(name),
    authorPhotoUrl: profile?.photo_url ?? null,
    authorInitials: memberInitials(name),
    roleLabel:
      kind === "request"
        ? `${postServiceCategoryLabel(categoryId, customCategory)} request`
        : `${postServiceCategoryLabel(categoryId, customCategory)} offer`,
    description,
    rateLabel: profilePostBudgetLabel(meta),
    href: globalProfilePostFeedPath(row.id),
    feedTarget: "post",
    categoryId,
    customCategory: customCategory?.trim() || null,
    mediaUrl: media.mediaUrl,
    mediaKind: media.mediaKind,
    detailPoints,
  };
}

function mapCommunityOffer(
  row: CommunityFeedRow,
  imageUrl: string | null = null,
): LandingActivityItem {
  const customCategory =
    detailString(
      row.availability_payload as Record<string, unknown> | null,
      ["custom_category", "other_type", "subcategory"],
    ) ||
    (otherHelpSubcategoryLabel(row.category) ? row.category : null);
  const categoryId = otherHelpSubcategoryLabel(row.category)
    ? "other_help"
    : row.category ?? null;
  const name = row.author_full_name ?? "Helper";
  const description =
    clampText(row.note ?? row.body ?? row.title) ||
    `${postServiceCategoryLabel(categoryId, customCategory)} — available now.`;

  return {
    id: row.id,
    kind: "offer",
    created_at: row.created_at,
    authorName: firstName(name),
    authorPhotoUrl: row.author_photo_url ?? null,
    authorInitials: memberInitials(name),
    roleLabel: `${postServiceCategoryLabel(categoryId, customCategory)} offer`,
    description,
    rateLabel: formatPriceHintFromPayload(row.availability_payload),
    href: globalProfilePostFeedPath(row.id),
    feedTarget: "post",
    categoryId,
    customCategory,
    mediaUrl: imageUrl,
    mediaKind: imageUrl ? "image" : null,
    detailPoints: availabilityDetailPoints(row.availability_payload),
  };
}

/** Recent open requests + offers for the marketing landing page (anon-safe). */
export async function fetchLandingRecentActivity(): Promise<LandingActivityItem[]> {
  const [jobsRes, postsRes, communityRes] = await Promise.all([
    supabase.rpc("get_discover_open_help_requests", { p_limit: 12 }),
    supabase
      .from("profile_posts")
      .select(
        "id, author_id, caption, created_at, post_type_id, post_metadata, ai_generated_copy, custom_category, storage_path, media_type",
      )
      .in("post_type_id", ["request_help", "offer_service"])
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.rpc("get_community_feed_public", {
      p_category: null,
      p_limit: 12,
    }),
  ]);

  if (jobsRes.error) {
    console.warn("[fetchLandingRecentActivity] jobs", jobsRes.error);
  }
  if (postsRes.error) {
    console.warn("[fetchLandingRecentActivity] profile_posts", postsRes.error);
  }
  if (communityRes.error) {
    console.warn("[fetchLandingRecentActivity] community", communityRes.error);
  }

  const jobRows = (jobsRes.data ?? []) as DiscoverOpenHelpRequestRow[];
  const postRows = (postsRes.data ?? []) as ProfilePostRow[];
  const communityRows = (communityRes.data ?? []) as CommunityFeedRow[];

  const profileIds = new Set<string>();
  for (const j of jobRows) {
    if (j.client_id) profileIds.add(j.client_id);
  }
  for (const p of postRows) {
    if (p.author_id) profileIds.add(p.author_id);
  }

  let profileMap = new Map<string, ProfileRow>();
  if (profileIds.size > 0) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, photo_url")
      .in("id", [...profileIds]);
    if (error) {
      console.warn("[fetchLandingRecentActivity] profiles", error);
    } else {
      profileMap = new Map(
        ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
      );
    }
  }

  const communityIds = communityRows.map((row) => row.id);
  const communityImageByPost = new Map<string, string>();
  if (communityIds.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from("community_post_images")
      .select("post_id, image_url, sort_order")
      .in("post_id", communityIds)
      .order("sort_order", { ascending: true });
    if (imagesError) {
      console.warn("[fetchLandingRecentActivity] community images", imagesError);
    } else {
      for (const row of images ?? []) {
        if (!communityImageByPost.has(row.post_id) && row.image_url) {
          communityImageByPost.set(row.post_id, row.image_url);
        }
      }
    }
  }

  const items: LandingActivityItem[] = [
    ...jobRows.map((row) =>
      mapJobRequest(row, row.client_id ? profileMap.get(row.client_id) : undefined),
    ),
    ...postRows
      .map((row) => mapProfilePost(row, profileMap.get(row.author_id)))
      .filter((row): row is LandingActivityItem => row != null),
    ...communityRows.map((row) =>
      mapCommunityOffer(row, communityImageByPost.get(row.id) ?? null),
    ),
  ];

  items.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return items.slice(0, ACTIVITY_LIMIT);
}
