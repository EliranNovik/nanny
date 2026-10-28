import { supabaseAdmin } from "../supabase";
import {
  brandMarkImageUrl,
  buildShareOgHtml,
  parseShareUuid,
  serviceCategoryLabel,
  type ShareOgMeta,
  webAppOrigin,
} from "./shareOgCommon";

function profileImageUrl(rawUrl: string | null): string {
  if (!rawUrl) return "";
  if (!rawUrl.includes("/storage/v1/object/public/")) return rawUrl;
  return rawUrl.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  ) + (rawUrl.includes("?") ? "&" : "?") + "width=1200&height=630&quality=88&resize=cover";
}

export async function fetchPublicProfileOgMeta(
  userId: string,
): Promise<ShareOgMeta | null> {
  const cleanId = parseShareUuid(userId);
  if (!cleanId) return null;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, photo_url, bio, categories")
    .eq("id", cleanId)
    .maybeSingle();

  if (error || !profile) return null;

  const origin = webAppOrigin();
  const name = (profile.full_name as string | null)?.trim() || "Tebnu member";
  const bio = (profile.bio as string | null)?.trim() || "";
  const categories = Array.isArray(profile.categories)
    ? profile.categories
        .map((category) => serviceCategoryLabel(String(category)))
        .filter(Boolean)
        .join(" · ")
    : "";
  const description = [bio, categories].filter(Boolean).join(" — ");
  const photoUrl = profileImageUrl((profile.photo_url as string | null) ?? null);

  return {
    id: cleanId,
    title: `${name} on Tebnu`,
    description,
    authorName: name,
    imageUrl: photoUrl || brandMarkImageUrl(origin),
    canonicalUrl: origin
      ? `${origin}/profile/${encodeURIComponent(cleanId)}`
      : `/profile/${encodeURIComponent(cleanId)}`,
  };
}

export function buildPublicProfileOgHtml(meta: ShareOgMeta): string {
  return buildShareOgHtml(meta);
}
