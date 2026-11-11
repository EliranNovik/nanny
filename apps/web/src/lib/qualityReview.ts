import { apiPost } from "@/lib/api";

export type QualityReason = {
  category: string;
  confidence: number;
  detail: string;
};

export type QualityReviewResult = {
  reviewId: string;
  decision: "allow" | "flag" | "block";
  note: string;
  reasons: QualityReason[];
};

export type PostScreen = {
  blockedNote: string | null;
  reviewId: string | null;
};

/** Shrink a photo so the review can see it. Video is skipped by the caller. */
export async function imageFileForReview(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 768;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

export async function reviewImages(
  sources: Array<File | string | null | undefined>,
): Promise<string[]> {
  const images: string[] = [];
  for (const source of sources) {
    if (images.length >= 3 || !source) continue;
    if (typeof source === "string") {
      if (source.startsWith("data:image/") || source.startsWith("https://")) {
        images.push(source);
      }
      continue;
    }
    const data = await imageFileForReview(source);
    if (data) images.push(data);
  }
  return images;
}

/** Returns null when the review service is down, so posting can continue. */
export async function reviewPostQuality(input: {
  postType: string;
  title: string;
  text: string;
  images: string[];
}): Promise<QualityReviewResult | null> {
  try {
    return await apiPost<QualityReviewResult>("/api/quality/review", input);
  } catch (err) {
    console.warn("[quality] review skipped", err);
    return null;
  }
}

export async function screenPost(input: {
  postType: string;
  title: string;
  text: string;
  images: string[];
}): Promise<PostScreen> {
  const review = await reviewPostQuality(input);
  if (!review || review.decision === "allow") {
    return { blockedNote: null, reviewId: null };
  }
  if (review.decision === "block") {
    return {
      blockedNote: review.note.trim() || "Please adjust the wording or the photo, then try again.",
      reviewId: null,
    };
  }
  return { blockedNote: null, reviewId: review.reviewId };
}

export async function saveQualityFlag(
  reviewId: string,
  post: { profilePostId?: string; communityPostId?: string },
): Promise<void> {
  try {
    await apiPost("/api/quality/flag", { reviewId, ...post });
  } catch (err) {
    console.warn("[quality] flag was not saved", err);
  }
}
