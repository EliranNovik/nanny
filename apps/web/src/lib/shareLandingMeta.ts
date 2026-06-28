import type { GeneratedPostCopy } from "@/lib/generatedPostCopy";
import type { TFunction } from "i18next";
import { serviceCategoryLabel } from "@/lib/serviceCategories";

export function resolveSharedPostTitle(
  t: TFunction,
  input: {
    generatedCopy: GeneratedPostCopy | null;
    postTypeId?: string | null;
    postMetadata?: Record<string, unknown> | null;
    caption?: string | null;
  },
): string {
  if (input.generatedCopy?.title?.trim()) {
    return input.generatedCopy.title.trim();
  }

  if (input.postTypeId === "event") {
    const name = input.postMetadata?.event_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }

  const categoryId =
    (input.postMetadata?.category as string | undefined) ??
    (input.postMetadata?.service as string | undefined) ??
    null;
  if (input.postTypeId === "request_help" && categoryId) {
    const category = serviceCategoryLabel(categoryId);
    return t("feed.global.categoryHelpTitle", { category });
  }

  const caption = input.caption?.trim();
  if (caption) return caption;

  const shortText = input.generatedCopy?.short_text?.trim();
  if (shortText) return shortText;

  return t("feed.share.defaultPostTitle", { defaultValue: "Post on tebnu" });
}

export function resolveSharedPostDescription(input: {
  generatedCopy: GeneratedPostCopy | null;
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

export function resolveSharedRequestTitle(
  t: TFunction,
  input: {
    generatedCopy: GeneratedPostCopy | null;
    serviceType?: string | null;
    notes?: string | null;
  },
): string {
  if (input.generatedCopy?.title?.trim()) {
    return input.generatedCopy.title.trim();
  }

  if (input.serviceType) {
    const category = serviceCategoryLabel(input.serviceType);
    return t("feed.global.categoryHelpTitle", { category });
  }

  const notes = input.notes?.trim();
  if (notes) return notes;

  return t("feed.share.defaultRequestTitle", { defaultValue: "Help request on tebnu" });
}

export function formatShareMessageText(input: {
  title: string;
  authorName: string;
  body?: string | null;
  url: string;
}): string {
  const lines = [`*${input.title}*`, `by ${input.authorName}`];
  const body = input.body?.trim();
  if (body) lines.push(body);
  const displayUrl = input.url.replace(/^https?:\/\//i, "");
  lines.push(`*View on tebnu:* ${displayUrl}`);
  return lines.join("\n");
}
