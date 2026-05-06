/**
 * Image transformation utilities for Supabase Storage.
 *
 * Supabase serves images from its global CDN (Cloudflare) and supports on-the-fly
 * resizing + WebP conversion via the `render/image/authenticated` or public transform path.
 *
 * Usage:
 *   storageImageUrl(rawUrl, { width: 96, height: 96, quality: 80 })
 *   → returns a resized, WebP-converted CDN URL
 *
 * The transformed URL is cached at the Supabase CDN edge so subsequent requests
 * for the same (url + size) are served from cache without hitting origin.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

export type ImageTransformOptions = {
  /** Target width in pixels. The image is resized to fit within this width. */
  width?: number;
  /** Target height in pixels. */
  height?: number;
  /**
   * Output quality 1–100. Defaults to 80.
   * 80 is the sweet spot: indistinguishable from lossless at ~40% the file size.
   */
  quality?: number;
  /**
   * Resize mode:
   *  - "cover"   (default) — crop to fill, no whitespace
   *  - "contain" — letterbox, preserves aspect ratio
   *  - "fill"    — stretch to exact dimensions
   */
  resize?: "cover" | "contain" | "fill";
  /**
   * Output format. "webp" is best for photos (lossy, ~25-35% smaller than JPEG).
   * "origin" keeps the original format (use for PNGs with transparency you need to preserve).
   */
  format?: "webp" | "origin";
};

/**
 * Convert a raw Supabase Storage public URL into a resized + WebP-optimised CDN URL.
 *
 * Works with any public bucket URL from your Supabase project.
 * Falls back to the original URL if the input is empty or not a Supabase storage URL.
 *
 * @example
 * // Avatar at 96×96 WebP
 * storageImageUrl(user.photo_url, { width: 96, height: 96 })
 *
 * // Card thumbnail at 320px wide WebP
 * storageImageUrl(post.cover_url, { width: 320, quality: 75 })
 *
 * // Full-width hero — 800px cap
 * storageImageUrl(hero.url, { width: 800, quality: 85 })
 */
export function storageImageUrl(
  rawUrl: string | null | undefined,
  options: ImageTransformOptions = {},
): string {
  if (!rawUrl) return "";

  const {
    width,
    height,
    quality = 80,
    resize = "cover",
    format = "webp",
  } = options;

  // Only transform Supabase storage URLs. Pass-through everything else (external CDNs, data: URIs, etc.)
  if (!rawUrl.includes("/storage/v1/object/public/")) {
    return rawUrl;
  }

  // Supabase image transform path: /storage/v1/render/image/public/<bucket>/<path>
  // Reference: https://supabase.com/docs/guides/storage/serving/image-transformations
  const transformUrl = rawUrl.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );

  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  if (height) params.set("height", String(height));
  params.set("quality", String(quality));
  params.set("resize", resize);
  if (format !== "origin") params.set("format", format);

  return `${transformUrl}?${params.toString()}`;
}

// ─── Pre-baked size presets ───────────────────────────────────────────────────

/**
 * Avatar sizes — profile pictures shown as small circles.
 * Sizes match common UI breakpoints (Radix Avatar component sizes).
 */
export const avatarUrl = {
  /** 40px — message lists, comment threads, small list items (using 120px for 3x sharpness) */
  xs: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 120, height: 120, quality: 85 }),

  /** 64px — card thumbnails, search results, notification items (using 240px) */
  sm: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 240, height: 240, quality: 85 }),

  /** 96px — profile cards, helper cards, job request cards (using 480px) */
  md: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 480, height: 480, quality: 85 }),

  /** 128px+ — profile hero, large card header (using 800px for hero quality) */
  lg: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 800, height: 800, quality: 88 }),
};

/**
 * Media / gallery image sizes — non-avatar content images.
 */
export const mediaUrl = {
  /** 240px — card thumbnails, story strip */
  thumb: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 240, height: 240, quality: 75 }),

  /** 480px — grid cards, post previews */
  card: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 480, quality: 80 }),

  /** 800px — hero images, full-width mobile */
  hero: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 800, quality: 85 }),

  /** 1200px — lightbox / modal full-screen view */
  full: (url: string | null | undefined) =>
    storageImageUrl(url, { width: 1200, quality: 88, format: "webp" }),
};
