type ResizeMode = "cover" | "contain";

/**
 * Supabase Storage images are often stored as large originals. For UI thumbnails/avatars,
 * use the Storage image render endpoint to request a resized WebP.
 *
 * Works for URLs like:
 * - https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * Converts to:
 * - https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=..&height=..&resize=..&quality=..&format=webp
 */
export function supabaseImageRenderUrl(
  publicUrl: string | null | undefined,
  opts: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: ResizeMode;
  } = {},
): string | null {
  const raw = (publicUrl || "").trim();
  if (!raw) return null;

  try {
    const u = new URL(raw, typeof window !== "undefined" ? window.location.origin : undefined);
    const marker = "/storage/v1/object/public/";
    const renderMarker = "/storage/v1/render/image/public/";

    if (u.pathname.includes(marker)) {
      u.pathname = u.pathname.replace(marker, renderMarker);
    } else if (!u.pathname.includes(renderMarker)) {
      // Not a Supabase public storage URL; return unchanged.
      return raw;
    }

    const { width, height, quality, resize } = opts;
    if (width && width > 0) u.searchParams.set("width", String(width));
    if (height && height > 0) u.searchParams.set("height", String(height));
    if (quality && quality > 0) u.searchParams.set("quality", String(quality));
    if (resize) u.searchParams.set("resize", resize);

    // Prefer smaller transfer size for UI images.
    if (!u.searchParams.has("format")) u.searchParams.set("format", "webp");

    return u.toString();
  } catch {
    return raw;
  }
}

