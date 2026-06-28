export const SUPPORTED_APP_LOCALES = ["en", "he", "ru", "fr"] as const;
export type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number];

export function normalizeAppLocale(locale: string | undefined | null): AppLocale {
  const base = (locale ?? "en").split("-")[0]?.toLowerCase();
  if ((SUPPORTED_APP_LOCALES as readonly string[]).includes(base)) {
    return base as AppLocale;
  }
  return "en";
}

/** Google Cloud Translation uses ISO 639-1 codes matching our app locales. */
export function toGoogleTargetLanguage(locale: AppLocale): string {
  return locale;
}

export function localesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return normalizeAppLocale(a) === normalizeAppLocale(b);
}
