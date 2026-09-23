export const SUPPORTED_APP_LOCALES = ["en", "he", "ru", "fr"] as const;
export type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number];

/** Google may return `iw` for Hebrew; persist `he` only. */
export function canonicalizeLocaleCode(locale: string | undefined | null): string {
  const base = (locale ?? "").split("-")[0]?.toLowerCase() ?? "";
  return base === "iw" ? "he" : base;
}

export function parseAppLocale(locale: string | undefined | null): AppLocale | null {
  const base = canonicalizeLocaleCode(locale);
  if ((SUPPORTED_APP_LOCALES as readonly string[]).includes(base)) {
    return base as AppLocale;
  }
  return null;
}

export function normalizeAppLocale(locale: string | undefined | null): AppLocale {
  return parseAppLocale(locale) ?? "en";
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
