import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLocale, normalizeAppLocale } from "@/i18n";

/** Keeps `<html lang dir>` in sync with the active i18n locale (Hebrew → RTL). */
export function DocumentLocaleSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng: string) => {
      const locale = normalizeAppLocale(lng);
      const rtl = isRtlLocale(locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.body.classList.toggle("app-rtl", rtl);
    };

    apply(i18n.language);
    const onChange = (lng: string) => apply(lng);
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, [i18n]);

  return null;
}
