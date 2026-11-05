import { supabase } from "@/lib/supabase";
import { storageImageUrl, type ImageTransformOptions } from "@/lib/imageTransform";

export const PUBLIC_PROFILE_MEDIA_BUCKET = "public-profile-media";

/**
 * Returns the raw public URL for a file in the `public-profile-media` bucket.
 * Prefer `publicProfileMediaUrl()` (with transform) for rendering — this is
 * kept for cases where you need the original unmodified URL (e.g. downloads, video src).
 */
export function publicProfileMediaPublicUrl(storagePath: string): string {
  // Job-request (and other) media may already be absolute public URLs
  // (e.g. job-images bucket). Pass those through unchanged.
  if (/^https?:\/\//i.test(storagePath) || storagePath.startsWith("data:")) {
    return storagePath;
  }
  const { data } = supabase.storage
    .from(PUBLIC_PROFILE_MEDIA_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Returns a resized + WebP-optimised CDN URL for a `public-profile-media` file.
 * Uses Supabase's built-in image transform API — no extra infrastructure needed.
 *
 * @example
 * // Card thumbnail (480px wide WebP)
 * <img src={publicProfileMediaUrl(row.storage_path, { width: 480 })} />
 *
 * // Fullscreen lightbox (1200px, higher quality)
 * <img src={publicProfileMediaUrl(row.storage_path, { width: 1200, quality: 88 })} />
 */
export function publicProfileMediaUrl(
  storagePath: string,
  options: ImageTransformOptions = { width: 480, quality: 80 },
): string {
  const raw = publicProfileMediaPublicUrl(storagePath);
  return storageImageUrl(raw, options);
}
