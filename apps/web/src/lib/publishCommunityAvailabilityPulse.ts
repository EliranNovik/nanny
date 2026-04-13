import { supabase } from "@/lib/supabase";
import {
  buildAvailabilityDisplayTitle,
  computeExpiresAtIsoFromStatus,
  getAvailabilityStatusOption,
  getQuickDetailsOption,
  type AvailabilityPayload,
} from "@/lib/availabilityPosts";
import { isServiceCategoryId, serviceCategoryLabel, type ServiceCategoryId } from "@/lib/serviceCategories";

const BUCKET = "community-posts";

export type PublishAvailabilityPulseInput = {
  userId: string;
  category: string;
  availabilityStatusId: string;
  quickDetailsId: string;
  priceRange: { min: number; max: number } | null;
  areaTag: string;
  note: string;
  imageFile: File | null;
};

export type PublishAvailabilityPulseResult =
  | { ok: true; postId: string }
  | { ok: false; error: Error };

/**
 * Creates a community availability post (same payload shape as CommunityPostsPage dialog).
 */
export async function publishCommunityAvailabilityPulse(
  input: PublishAvailabilityPulseInput
): Promise<PublishAvailabilityPulseResult> {
  if (!isServiceCategoryId(input.category)) {
    return { ok: false, error: new Error("Invalid service category") };
  }
  const category = input.category as ServiceCategoryId;

  const statusOpt = getAvailabilityStatusOption(input.availabilityStatusId);
  if (!statusOpt) {
    return { ok: false, error: new Error("Choose when you’re available") };
  }
  const quickOpt = getQuickDetailsOption(input.quickDetailsId);
  if (!quickOpt) {
    return { ok: false, error: new Error("Choose quick details") };
  }

  const noteTrim = input.note.trim();
  if (noteTrim.length > 120) {
    return { ok: false, error: new Error("Note is too long (max 120 characters)") };
  }

  const area = input.areaTag.trim().slice(0, 40);
  const catLabel = serviceCategoryLabel(category);
  const expiresAt = computeExpiresAtIsoFromStatus(statusOpt.id);
  if (!expiresAt) {
    return { ok: false, error: new Error("Invalid availability status") };
  }

  const rangePayload =
    input.priceRange && input.priceRange.min <= input.priceRange.max
      ? {
          min: Math.min(input.priceRange.min, input.priceRange.max),
          max: Math.max(input.priceRange.min, input.priceRange.max),
        }
      : null;

  const title = buildAvailabilityDisplayTitle({
    categoryLabel: catLabel,
    statusLabel: statusOpt.label,
    quickLabel: quickOpt.label,
    priceRangePerHour: rangePayload,
  });

  const payload: AvailabilityPayload = {
    availability_status: statusOpt.id,
    quick_details: quickOpt.id,
    price_range_per_hour: rangePayload,
    area_tag: area || null,
  };

  const { data: post, error: insErr } = await supabase
    .from("community_posts")
    .insert({
      author_id: input.userId,
      category,
      title,
      body: "",
      note: noteTrim || null,
      expires_at: expiresAt,
      availability_payload: payload,
      status: "active",
    })
    .select("id")
    .single();

  if (insErr) return { ok: false, error: insErr };
  const postId = post.id as string;

  const file = input.imageFile;
  if (file) {
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: new Error("Only image files are allowed") };
    }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${input.userId}/${postId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (upErr) return { ok: false, error: upErr };
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: imgErr } = await supabase.from("community_post_images").insert({
      post_id: postId,
      image_url: pub.publicUrl,
      sort_order: 0,
    });
    if (imgErr) console.error("[publishCommunityAvailabilityPulse] image row", imgErr);
  }

  return { ok: true, postId };
}
