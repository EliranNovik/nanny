import type { GeneratedPostCopy } from "@/utils/postTextTemplates";

export type { GeneratedPostCopy };

/** Parse stored generated copy (supports legacy camelCase AI keys). */
export function parseGeneratedPostCopy(raw: unknown): GeneratedPostCopy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title : null;
  const short_text =
    typeof o.short_text === "string"
      ? o.short_text
      : typeof o.shortText === "string"
        ? o.shortText
        : null;
  const feed_preview =
    typeof o.feed_preview === "string"
      ? o.feed_preview
      : typeof o.feedPreview === "string"
        ? o.feedPreview
        : null;

  if (!title || !short_text || !feed_preview || !Array.isArray(o.tags)) {
    return null;
  }

  return {
    title,
    short_text,
    feed_preview,
    tags: o.tags.filter((t): t is string => typeof t === "string"),
  };
}
