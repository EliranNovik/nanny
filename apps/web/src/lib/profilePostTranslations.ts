import { supabase } from "@/lib/supabase";
import { normalizeAppLocale, type AppLocale } from "@/i18n";

export type ProfilePostTranslationOverlay = {
  language: AppLocale;
  caption: string | null;
  title: string | null;
  provider: "original" | "google_translate";
};

type OverlayablePost = {
  id: string;
  original_language?: string | null;
  translation_overlay?: ProfilePostTranslationOverlay | null;
};

export async function loadProfilePostTranslationOverlays(
  postIds: string[],
  viewerLocale: string,
): Promise<Map<string, ProfilePostTranslationOverlay>> {
  const ids = [...new Set(postIds.filter(Boolean))];
  const locale = normalizeAppLocale(viewerLocale);
  const overlays = new Map<string, ProfilePostTranslationOverlay>();
  if (ids.length === 0) return overlays;

  const { data, error } = await supabase
    .from("profile_post_translations")
    .select("post_id, language, caption, title, provider")
    .in("post_id", ids)
    .eq("language", locale);

  if (error) {
    console.warn("[profilePostTranslations] overlay load failed", error.message);
    return overlays;
  }

  for (const row of data ?? []) {
    const language = normalizeAppLocale(String(row.language ?? locale));
    const provider =
      row.provider === "google_translate" ? "google_translate" : "original";
    overlays.set(String(row.post_id), {
      language,
      caption: (row.caption as string | null) ?? null,
      title: (row.title as string | null) ?? null,
      provider,
    });
  }

  return overlays;
}

export function attachProfilePostTranslationOverlays<T extends OverlayablePost>(
  posts: T[],
  overlays: Map<string, ProfilePostTranslationOverlay>,
  viewerLocale: string,
): T[] {
  const locale = normalizeAppLocale(viewerLocale);
  return posts.map((post) => {
    const overlay = overlays.get(post.id);
    if (!overlay || overlay.provider !== "google_translate") {
      return { ...post, translation_overlay: null };
    }
    const source = post.original_language
      ? normalizeAppLocale(post.original_language)
      : null;
    if (source && source === locale) {
      return { ...post, translation_overlay: null };
    }
    return { ...post, translation_overlay: overlay };
  });
}

export async function withProfilePostTranslationOverlays<T extends OverlayablePost>(
  posts: T[],
  viewerLocale: string,
): Promise<T[]> {
  const overlays = await loadProfilePostTranslationOverlays(
    posts.map((post) => post.id),
    viewerLocale,
  );
  return attachProfilePostTranslationOverlays(posts, overlays, viewerLocale);
}

export function precomputedFromProfilePostOverlay(
  overlay?: ProfilePostTranslationOverlay | null,
): { translatedTitle: string | null; translatedBody: string | null } | null {
  if (!overlay || overlay.provider !== "google_translate") return null;
  if (!overlay.caption?.trim() && !overlay.title?.trim()) return null;
  return {
    translatedTitle: overlay.title,
    translatedBody: overlay.caption,
  };
}
