import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  formatPriceHintFromPayload,
  type AvailabilityPayload,
} from "@/lib/availabilityPosts";
import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";
import { globalJobRequestSharePath } from "@/lib/jobRequestShare";
import {
  formatOpenHelpRequestBudget,
  openHelpRequestDescription,
  serviceCategoryTitle,
} from "@/lib/openHelpRequestDisplay";
import { globalProfilePostSharePath } from "@/lib/profilePostShare";
import {
  postServiceCategoryLabel,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";

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
  categoryId: string | null;
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

  return {
    id: row.id,
    kind: "request",
    created_at: row.created_at ?? new Date().toISOString(),
    authorName: firstName(name),
    authorPhotoUrl: profile?.photo_url ?? row.client_photo_url ?? null,
    authorInitials: memberInitials(name),
    roleLabel: serviceCategoryTitle(row.service_type),
    description,
    rateLabel: budget ? `${budget}${rateType}` : null,
    href: globalJobRequestSharePath(row.id),
    categoryId: row.service_type ?? null,
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
    row.custom_category;
  const name = profile?.full_name ?? "Member";
  const description =
    clampText(generated?.short_text ?? row.caption) ||
    (kind === "request" ? "Looking for help nearby." : "Offering help nearby.");

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
    href: globalProfilePostSharePath(row.id),
    categoryId,
  };
}

function mapCommunityOffer(row: CommunityFeedRow): LandingActivityItem {
  const name = row.author_full_name ?? "Helper";
  const description =
    clampText(row.note ?? row.body ?? row.title) ||
    `${serviceCategoryLabel(row.category)} — available now.`;

  return {
    id: row.id,
    kind: "offer",
    created_at: row.created_at,
    authorName: firstName(name),
    authorPhotoUrl: row.author_photo_url ?? null,
    authorInitials: memberInitials(name),
    roleLabel: `${serviceCategoryLabel(row.category)} offer`,
    description,
    rateLabel: formatPriceHintFromPayload(row.availability_payload),
    href: globalProfilePostSharePath(row.id),
    categoryId: row.category ?? null,
  };
}

/** Recent open requests + offers for the marketing landing page (anon-safe). */
export async function fetchLandingRecentActivity(): Promise<LandingActivityItem[]> {
  const [jobsRes, postsRes, communityRes] = await Promise.all([
    supabase.rpc("get_discover_open_help_requests", { p_limit: 12 }),
    supabase
      .from("profile_posts")
      .select(
        "id, author_id, caption, created_at, post_type_id, post_metadata, ai_generated_copy, custom_category",
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

  const items: LandingActivityItem[] = [
    ...jobRows.map((row) =>
      mapJobRequest(row, row.client_id ? profileMap.get(row.client_id) : undefined),
    ),
    ...postRows
      .map((row) => mapProfilePost(row, profileMap.get(row.author_id)))
      .filter((row): row is LandingActivityItem => row != null),
    ...communityRows.map(mapCommunityOffer),
  ];

  items.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return items.slice(0, ACTIVITY_LIMIT);
}
