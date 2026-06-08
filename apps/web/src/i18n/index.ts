import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "@/i18n/locales/en.json";
import he from "@/i18n/locales/he.json";
import ru from "@/i18n/locales/ru.json";
import fr from "@/i18n/locales/fr.json";

export const SUPPORTED_LOCALES = ["en", "he", "ru", "fr"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: AppLocale[] = ["he"];

export function isRtlLocale(locale: string): boolean {
  const base = locale.split("-")[0] as AppLocale;
  return RTL_LOCALES.includes(base);
}

export function normalizeAppLocale(locale: string): AppLocale {
  const base = locale.split("-")[0];
  if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
    return base as AppLocale;
  }
  return "en";
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
      ru: { translation: ru },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "app-locale",
      caches: ["localStorage"],
    },
  });

export default i18n;
