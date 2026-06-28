import {
  getCachedTranslations,
  upsertCachedTranslations,
  type ContentKind,
  type TranslateField,
} from "./cache";
import { resolveContentForTranslation } from "./contentResolver";
import {
  isTranslateConfigured,
  translateTextsWithGoogle,
} from "./googleTranslateClient";
import { localesMatch, normalizeAppLocale, type AppLocale } from "./localeMap";

export type TranslateContentResult = {
  fields: Partial<Record<TranslateField, string>>;
  sourceLocale: string | null;
  targetLocale: AppLocale;
  cached: boolean;
  alreadyInTargetLanguage: boolean;
  skipped?: boolean;
  skipReason?: string;
};

export async function translateContent(
  contentKind: ContentKind,
  contentId: string,
  targetLocaleInput: string | undefined,
  userId: string | null,
): Promise<TranslateContentResult> {
  const targetLocale = normalizeAppLocale(targetLocaleInput);

  if (!isTranslateConfigured()) {
    throw new Error("Translation service is not configured");
  }

  const resolved = await resolveContentForTranslation(
    contentKind,
    contentId,
    userId,
  );

  if (resolved.skipped) {
    return {
      fields: {},
      sourceLocale: null,
      targetLocale,
      cached: false,
      alreadyInTargetLanguage: false,
      skipped: true,
      skipReason: resolved.skipReason,
    };
  }

  const sourceFields = resolved.fields;
  const cached = await getCachedTranslations(
    contentKind,
    contentId,
    targetLocale,
    sourceFields,
  );

  const fieldOrder = (Object.keys(sourceFields) as TranslateField[]).filter(
    (key) => sourceFields[key]?.trim(),
  );

  const missingFields = fieldOrder.filter((field) => !cached[field]);
  let sourceLocale: string | null =
    fieldOrder.map((field) => cached[field]?.source_locale).find(Boolean) ?? null;

  if (missingFields.length === 0) {
    const translatedFields: Partial<Record<TranslateField, string>> = {};
    for (const field of fieldOrder) {
      translatedFields[field] = cached[field]!.translated_text;
    }

    return {
      fields: translatedFields,
      sourceLocale,
      targetLocale,
      cached: true,
      alreadyInTargetLanguage: localesMatch(sourceLocale, targetLocale),
    };
  }

  const textsToTranslate = missingFields.map((field) => sourceFields[field]!.trim());
  const googleResult = await translateTextsWithGoogle(textsToTranslate, targetLocale);
  sourceLocale = googleResult.detectedSourceLanguage ?? sourceLocale;

  if (localesMatch(sourceLocale, targetLocale)) {
    return {
      fields: sourceFields,
      sourceLocale,
      targetLocale,
      cached: false,
      alreadyInTargetLanguage: true,
    };
  }

  const newEntries: Array<{
    fieldName: TranslateField;
    sourceText: string;
    translatedText: string;
  }> = [];

  const translatedFields: Partial<Record<TranslateField, string>> = {};
  for (const field of fieldOrder) {
    const cachedRow = cached[field];
    if (cachedRow) {
      translatedFields[field] = cachedRow.translated_text;
      continue;
    }

    const missingIndex = missingFields.indexOf(field);
    const translatedText = googleResult.translatedTexts[missingIndex] ?? sourceFields[field]!;
    translatedFields[field] = translatedText;
    newEntries.push({
      fieldName: field,
      sourceText: sourceFields[field]!,
      translatedText,
    });
  }

  await upsertCachedTranslations(
    contentKind,
    contentId,
    targetLocale,
    sourceLocale,
    newEntries,
  );

  return {
    fields: translatedFields,
    sourceLocale,
    targetLocale,
    cached: false,
    alreadyInTargetLanguage: false,
  };
}
