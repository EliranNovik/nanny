import { supabaseAdmin } from "../supabase";
import {
  brandMarkImageUrl,
  buildShareOgHtml,
  parseGeneratedCopy,
  parseShareUuid,
  publicProfileMediaRenderUrl,
  resolveShareDescription,
  resolveShareTitle,
  type ShareOgMeta,
  webAppOrigin,
} from "./shareOgCommon";

export {
  buildShareOgHtml,
  parseShareUuid as parseProfilePostShareId,
} from "./shareOgCommon";

type MediaItem = {
  storage_path?: string;
  media_type?: string;
};

function firstOgImagePath(post: {
  media_type: string | null;
  storage_path: string | null;
  post_metadata: unknown;
}): string | null {
  if (post.media_type === "image" && post.storage_path) {
    return post.storage_path;
  }

  const meta = post.post_metadata as Record<string, unknown> | null;
  const items = meta?.media_items;
  if (Array.isArray(items)) {
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as MediaItem;
      if (item.media_type === "image" && item.storage_path) {
        return item.storage_path;
      }
    }
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as MediaItem;
      if (item.storage_path) return item.storage_path;
    }
  }

  if (post.storage_path) return post.storage_path;
  return null;
}

export async function fetchProfilePostOgMeta(
  postId: string,
): Promise<ShareOgMeta | null> {
  const cleanId = parseShareUuid(postId);
  if (!cleanId) return null;

  const { data: post, error } = await supabaseAdmin
    .from("profile_posts")
    .select(
      "id, author_id, caption, created_at, post_type_id, post_metadata, ai_generated_copy, media_type, storage_path",
    )
    .eq("id", cleanId)
    .maybeSingle();

  if (error || !post) return null;

  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", post.author_id as string)
    .maybeSingle();

  const authorName = (author?.full_name as string | null)?.trim() || "Member";
  const generatedCopy = parseGeneratedCopy(post.ai_generated_copy);
  const postMetadata = (post.post_metadata as Record<string, unknown> | null) ?? null;
  const title = resolveShareTitle({
    generatedCopy,
    postTypeId: post.post_type_id as string | null,
    postMetadata,
    caption: post.caption as string | null,
  });
  const description = resolveShareDescription({
    generatedCopy,
    caption: post.caption as string | null,
    title,
  });

  const origin = webAppOrigin();
  const imagePath = firstOgImagePath({
    media_type: post.media_type as string | null,
    storage_path: post.storage_path as string | null,
    post_metadata: post.post_metadata,
  });
  const imageUrl = imagePath
    ? publicProfileMediaRenderUrl(imagePath)
    : brandMarkImageUrl(origin);

  const canonicalUrl = origin
    ? `${origin}/posts/${encodeURIComponent(cleanId)}`
    : `/posts/${encodeURIComponent(cleanId)}`;

  return {
    id: cleanId,
    title,
    description,
    authorName,
    imageUrl,
    canonicalUrl,
  };
}

export function buildProfilePostOgHtml(meta: ShareOgMeta): string {
  return buildShareOgHtml(meta);
}
