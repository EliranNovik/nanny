import { supabaseAdmin } from "../../supabase";
import { textFingerprint } from "./fingerprint";
import type { AppLocale } from "./localeMap";

export type ContentKind =
  | "profile_post"
  | "job_request"
  | "profile_post_comment"
  | "job_request_comment"
  | "chat_message";

export type TranslateField = "title" | "body";

export type CachedTranslationRow = {
  field_name: TranslateField;
  translated_text: string;
  source_locale: string | null;
};

export async function getCachedTranslations(
  contentKind: ContentKind,
  contentId: string,
  targetLocale: AppLocale,
  fields: Partial<Record<TranslateField, string>>,
): Promise<Partial<Record<TranslateField, CachedTranslationRow>>> {
  const fingerprints = Object.entries(fields)
    .filter(([, text]) => text?.trim())
    .map(([fieldName, text]) => ({
      fieldName: fieldName as TranslateField,
      fingerprint: textFingerprint(text!),
    }));

  if (fingerprints.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("content_translations")
    .select("field_name, translated_text, source_locale, source_fingerprint")
    .eq("content_kind", contentKind)
    .eq("content_id", contentId)
    .eq("target_locale", targetLocale)
    .in(
      "source_fingerprint",
      fingerprints.map((f) => f.fingerprint),
    );

  if (error) {
    console.error("[TranslateCache] read failed:", error);
    return {};
  }

  const byFingerprint = new Map(
    fingerprints.map((f) => [f.fieldName, f.fingerprint]),
  );

  const result: Partial<Record<TranslateField, CachedTranslationRow>> = {};
  for (const row of data ?? []) {
    const fieldName = row.field_name as TranslateField;
    if (byFingerprint.get(fieldName) !== row.source_fingerprint) continue;
    result[fieldName] = {
      field_name: fieldName,
      translated_text: row.translated_text,
      source_locale: row.source_locale,
    };
  }
  return result;
}

export async function upsertCachedTranslations(
  contentKind: ContentKind,
  contentId: string,
  targetLocale: AppLocale,
  sourceLocale: string | null,
  entries: Array<{
    fieldName: TranslateField;
    sourceText: string;
    translatedText: string;
  }>,
): Promise<void> {
  if (entries.length === 0) return;

  const rows = entries.map((entry) => ({
    content_kind: contentKind,
    content_id: contentId,
    field_name: entry.fieldName,
    target_locale: targetLocale,
    source_locale: sourceLocale,
    source_fingerprint: textFingerprint(entry.sourceText),
    translated_text: entry.translatedText,
    provider: "google",
  }));

  const { error } = await supabaseAdmin
    .from("content_translations")
    .upsert(rows, {
      onConflict: "content_kind,content_id,field_name,target_locale,source_fingerprint",
    });

  if (error) {
    console.error("[TranslateCache] upsert failed:", error);
  }
}
