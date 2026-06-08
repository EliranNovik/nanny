import type { Locale } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { fr } from "date-fns/locale/fr";
import { he } from "date-fns/locale/he";
import { ru } from "date-fns/locale/ru";
import { normalizeAppLocale, type AppLocale } from "@/i18n";

const DATE_FNS_LOCALES: Record<AppLocale, Locale> = {
  en: enUS,
  he,
  ru,
  fr,
};

export function dateFnsLocaleFor(language: string): Locale {
  return DATE_FNS_LOCALES[normalizeAppLocale(language)] ?? enUS;
}
