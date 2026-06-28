export const PROFILE_POST_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export const PUBLIC_PROFILE_MEDIA_BUCKET = "public-profile-media";

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  cleaning: "Cleaning",
  cooking: "Cooking",
  pickup_delivery: "Pick up & delivery",
  nanny: "Nanny",
  technical_help: "Technical Help",
  other_help: "Other help",
};

export function parseShareUuid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(PROFILE_POST_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function encodeStoragePath(storagePath: string): string {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function webAppOrigin(): string {
  const raw = process.env.WEB_APP_ORIGIN || process.env.CORS_ORIGIN || "";
  const first = raw.split(",")[0]?.trim() || "";
  return first.replace(/\/$/, "");
}

export function brandMarkImageUrl(origin: string): string {
  return origin ? `${origin}/brand-mark.png` : "";
}

export function publicProfileMediaObjectUrl(storagePath: string): string {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = encodeStoragePath(storagePath);
  return `${supabaseUrl}/storage/v1/object/public/${PUBLIC_PROFILE_MEDIA_BUCKET}/${encodedPath}`;
}

export function publicProfileMediaRenderUrl(storagePath: string): string {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = encodeStoragePath(storagePath);
  return `${supabaseUrl}/storage/v1/render/image/public/${PUBLIC_PROFILE_MEDIA_BUCKET}/${encodedPath}?width=1200&quality=85`;
}

export function serviceCategoryLabel(categoryId: string | null | undefined): string | null {
  if (!categoryId) return null;
  return SERVICE_CATEGORY_LABELS[categoryId] ?? categoryId.replace(/_/g, " ");
}

type GeneratedCopyLike = {
  title?: string | null;
  short_text?: string | null;
  shortText?: string | null;
  feed_preview?: string | null;
  feedPreview?: string | null;
};

export function parseGeneratedCopy(raw: unknown): GeneratedCopyLike | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    title: typeof o.title === "string" ? o.title : null,
    short_text:
      typeof o.short_text === "string"
        ? o.short_text
        : typeof o.shortText === "string"
          ? o.shortText
          : null,
    feed_preview:
      typeof o.feed_preview === "string"
        ? o.feed_preview
        : typeof o.feedPreview === "string"
          ? o.feedPreview
          : null,
  };
}

export function resolveShareTitle(input: {
  generatedCopy: GeneratedCopyLike | null;
  postTypeId?: string | null;
  postMetadata?: Record<string, unknown> | null;
  serviceType?: string | null;
  caption?: string | null;
}): string {
  const aiTitle = input.generatedCopy?.title?.trim();
  if (aiTitle) return aiTitle;

  if (input.postTypeId === "event") {
    const name = input.postMetadata?.event_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }

  const categoryId =
    (input.postMetadata?.category as string | undefined) ??
    (input.postMetadata?.service as string | undefined) ??
    input.serviceType ??
    null;
  const categoryLabel = serviceCategoryLabel(categoryId);
  if (
    (input.postTypeId === "request_help" || input.serviceType) &&
    categoryLabel
  ) {
    return `Help with ${categoryLabel}`;
  }

  const caption = input.caption?.trim();
  if (caption) return caption;

  const shortText = input.generatedCopy?.short_text?.trim();
  if (shortText) return shortText;

  return "Post on tebnu";
}

export function resolveShareDescription(input: {
  generatedCopy: GeneratedCopyLike | null;
  caption?: string | null;
  title: string;
}): string {
  const text = (
    input.generatedCopy?.short_text?.trim() ||
    input.generatedCopy?.feed_preview?.trim() ||
    input.caption?.trim() ||
    ""
  );
  if (!text) return "";
  if (text.toLowerCase() === input.title.toLowerCase()) return "";
  return text;
}

export type ShareOgMeta = {
  id: string;
  title: string;
  description: string;
  authorName: string;
  imageUrl: string;
  canonicalUrl: string;
};

export function buildShareOgHtml(meta: ShareOgMeta): string {
  const title = escapeHtml(meta.title);
  const authorName = escapeHtml(meta.authorName);
  const descriptionBody = escapeHtml(meta.description);
  const ogDescription = descriptionBody
    ? `by ${authorName} — ${descriptionBody}`
    : `by ${authorName}`;
  const imageUrl = escapeHtml(meta.imageUrl);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${ogDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="tebnu" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <p><a href="${canonicalUrl}">View on tebnu</a></p>
</body>
</html>`;
}
