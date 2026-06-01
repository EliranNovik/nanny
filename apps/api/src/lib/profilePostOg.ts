import { supabaseAdmin } from "../supabase";

const PROFILE_POST_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const PUBLIC_PROFILE_MEDIA_BUCKET = "public-profile-media";
const DEFAULT_CAPTION_MAX = 140;

export function parseProfilePostShareId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const match = raw.trim().match(PROFILE_POST_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

function shortenPostCaption(
  caption: string | null | undefined,
  maxLen = DEFAULT_CAPTION_MAX,
): string {
  const trimmed = caption?.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\s+/g, " ");
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function encodeStoragePath(storagePath: string): string {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function publicProfileMediaOgImageUrl(storagePath: string): string {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = encodeStoragePath(storagePath);
  return `${supabaseUrl}/storage/v1/render/image/public/${PUBLIC_PROFILE_MEDIA_BUCKET}/${encodedPath}?width=1200&quality=85`;
}

function webAppOrigin(): string {
  return (process.env.WEB_APP_ORIGIN || process.env.CORS_ORIGIN || "")
    .replace(/\/$/, "");
}

export type ProfilePostOgMeta = {
  postId: string;
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
};

export async function fetchProfilePostOgMeta(
  postId: string,
): Promise<ProfilePostOgMeta | null> {
  const cleanId = parseProfilePostShareId(postId);
  if (!cleanId) return null;

  const { data: post, error } = await supabaseAdmin
    .from("profile_posts")
    .select("id, author_id, caption, media_type, storage_path")
    .eq("id", cleanId)
    .maybeSingle();

  if (error || !post) return null;

  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", post.author_id as string)
    .maybeSingle();

  const authorName =
    (author?.full_name as string | null)?.trim() || "User";
  const caption = shortenPostCaption(post.caption as string | null);
  const title = caption
    ? `${authorName} on tebnu`
    : `${authorName} shared a post on tebnu`;
  const description =
    caption || `See ${authorName}'s post on tebnu`;

  const origin = webAppOrigin();
  const fallbackImage = origin ? `${origin}/brand-mark.png` : "";

  let imageUrl = fallbackImage;
  const storagePath = post.storage_path as string | null;
  const mediaType = post.media_type as "image" | "video" | null;

  if (storagePath && mediaType === "image") {
    imageUrl = publicProfileMediaOgImageUrl(storagePath);
  }

  const canonicalUrl = origin
    ? `${origin}/community/feed?post=${encodeURIComponent(cleanId)}`
    : `/community/feed?post=${encodeURIComponent(cleanId)}`;

  return {
    postId: cleanId,
    title,
    description,
    imageUrl,
    canonicalUrl,
  };
}

export function buildProfilePostOgHtml(meta: ProfilePostOgMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const imageUrl = escapeHtml(meta.imageUrl);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="tebnu" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <p><a href="${canonicalUrl}">View post on tebnu</a></p>
</body>
</html>`;
}
