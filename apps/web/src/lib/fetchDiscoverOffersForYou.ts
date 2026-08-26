import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { supabase } from "@/lib/supabase";

export type DiscoverOfferForYou = {
  id: string;
  title: string;
  categoryId: string | null;
  customCategory: string | null;
  categoryLabel: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  imageUrl: string | null;
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
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
  media_type: string | null;
  storage_path: string | null;
  created_at: string;
  post_metadata: Record<string, unknown> | null;
  custom_category: string | null;
  ai_generated_copy: unknown;
};

function firstName(name: string | null | undefined): string {
  const t = (name || "").trim();
  if (!t) return "";
  const i = t.indexOf(" ");
  return i > 0 ? t.slice(0, i) : t;
}

function generatedTitle(raw: unknown): string | null {
  const parsed = parseGeneratedPostCopy(raw);
  if (parsed?.title?.trim()) return parsed.title.trim();
  if (raw && typeof raw === "object") {
    const title = (raw as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return null;
}

function categoryFromMeta(
  meta: Record<string, unknown> | null,
  customCategory: string | null,
): { id: string | null; custom: string | null } {
  const id =
    (typeof meta?.service === "string" && meta.service) ||
    (typeof meta?.category === "string" && meta.category) ||
    null;
  const custom =
    (typeof meta?.custom_category === "string" && meta.custom_category.trim()) ||
    customCategory?.trim() ||
    null;
  return { id, custom };
}

export async function fetchDiscoverOffersForYou(
  excludeUserId?: string | null,
  limit = 10,
): Promise<DiscoverOfferForYou[]> {
  let query = supabase
    .from("profile_posts")
    .select(
      "id, author_id, caption, media_type, storage_path, created_at, post_metadata, custom_category, ai_generated_copy",
    )
    .eq("post_type_id", "offer_service")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit + 4, 24)));

  if (excludeUserId) {
    query = query.neq("author_id", excludeUserId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[fetchDiscoverOffersForYou] profile_posts", error);
    return [];
  }

  const rows = (data ?? []) as ProfilePostRow[];
  if (rows.length === 0) return [];

  const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))];
  let profileMap = new Map<string, ProfileRow>();
  if (authorIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, photo_url")
      .in("id", authorIds);
    if (profileError) {
      console.warn("[fetchDiscoverOffersForYou] profiles", profileError);
    } else {
      profileMap = new Map(
        ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
      );
    }
  }

  const offers: DiscoverOfferForYou[] = [];
  for (const row of rows) {
    if (offers.length >= limit) break;
    const { id: categoryId, custom } = categoryFromMeta(
      row.post_metadata,
      row.custom_category,
    );
    const categoryLabel = postServiceCategoryLabel(categoryId, custom);
    const caption = (row.caption ?? "").trim();
    const title =
      generatedTitle(row.ai_generated_copy) ||
      caption ||
      categoryLabel;
    const profile = profileMap.get(row.author_id);
    const authorName = firstName(profile?.full_name) || "Member";
    const hasImage =
      row.media_type === "image" && Boolean(row.storage_path?.trim());
    const imageUrl = hasImage
      ? publicProfileMediaUrl(row.storage_path!, {
          width: 900,
          quality: 82,
          resize: "contain",
        })
      : null;
    const meta = row.post_metadata;
    const locationRaw =
      typeof meta?.location === "string" ? meta.location.trim() : "";
    const locationLabel = locationRaw.split(",")[0]?.trim() || locationRaw || null;
    const latRaw = meta?.location_lat;
    const lngRaw = meta?.location_lng;
    const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
    const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);

    offers.push({
      id: row.id,
      title,
      categoryId,
      customCategory: custom,
      categoryLabel,
      createdAt: row.created_at,
      authorId: row.author_id,
      authorName,
      authorPhotoUrl: profile?.photo_url ?? null,
      imageUrl,
      locationLabel,
      locationLat: Number.isFinite(lat) ? lat : null,
      locationLng: Number.isFinite(lng) ? lng : null,
    });
  }

  return offers;
}
