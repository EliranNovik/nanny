import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_LOCALES,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n";
import { LOCALE_LABEL_KEYS } from "@/components/i18n/localeLabels";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { profileMenuListClassName } from "@/components/profile/ProfileMenuRow";

export function ProfileAppLanguagePage() {
  const { t, i18n } = useTranslation();
  const current = normalizeAppLocale(i18n.language ?? "en");

  return (
    <ProfileSubpageLayout
      title={t("language.label")}
      description={t("language.settingsDescription")}
      className="bg-white dark:bg-background"
    >
      <div className={profileMenuListClassName}>
        {SUPPORTED_LOCALES.map((locale) => (
          <LanguageOptionRow
            key={locale}
            locale={locale}
            label={t(LOCALE_LABEL_KEYS[locale])}
            selected={current === locale}
            onSelect={() => {
              void i18n.changeLanguage(locale);
            }}
          />
        ))}
      </div>
    </ProfileSubpageLayout>
  );
}

function LanguageOptionRow({
  locale,
  label,
  selected,
  onSelect,
}: {
  locale: AppLocale;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "profile-menu-row group flex w-full items-stretch text-left",
        "transition-colors hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-zinc-800/80 md:rounded-none",
        selected && "bg-slate-50/80 dark:bg-zinc-800/50",
      )}
    >
      <span className="flex min-w-0 flex-1 items-stretch gap-3.5 px-4 md:gap-5 md:px-5">
        <span className="flex w-10 shrink-0 items-center self-center md:w-11">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 text-[11px] font-bold uppercase tracking-wide text-foreground/80 md:h-11 md:w-11 md:text-xs">
            {locale}
          </span>
        </span>
        <span
          className={cn(
            "profile-menu-row-divider flex min-w-0 flex-1 items-center gap-3 py-3.5 md:py-3.5",
            "border-slate-100 dark:border-white/5",
          )}
        >
          <span className="min-w-0 flex-1 text-[17px] font-medium tracking-tight text-foreground md:text-[17px]">
            {label}
          </span>
          {selected ? (
            <Check
              className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 md:h-6 md:w-6"
              strokeWidth={2.25}
              aria-hidden
            />
          ) : null}
        </span>
      </span>
    </button>
  );
}
