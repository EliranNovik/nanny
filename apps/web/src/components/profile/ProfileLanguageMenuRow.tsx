import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { normalizeAppLocale } from "@/i18n";
import { LOCALE_LABEL_KEYS } from "@/components/i18n/localeLabels";
import { ProfileMenuRow } from "@/components/profile/ProfileMenuRow";

export function ProfileLanguageMenuRow({ to }: { to: string }) {
  const { t, i18n } = useTranslation();
  const current = normalizeAppLocale(i18n.language ?? "en");

  return (
    <ProfileMenuRow
      to={to}
      icon={Languages}
      label={t("language.label")}
      trailing={
        <span className="text-[15px] font-semibold text-muted-foreground">
          {t(LOCALE_LABEL_KEYS[current])}
        </span>
      }
    />
  );
}
