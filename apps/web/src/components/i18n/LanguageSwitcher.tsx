import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORTED_LOCALES, normalizeAppLocale } from "@/i18n";
import { LOCALE_LABEL_KEYS } from "@/components/i18n/localeLabels";

type Props = {
  className?: string;
  variant?: "header" | "compact" | "profile";
};

export function LanguageSwitcher({ className, variant = "header" }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = normalizeAppLocale(i18n.language ?? "en");

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl transition active:scale-95",
          variant === "profile"
            ? "px-1 py-1 text-[15px] font-semibold text-muted-foreground hover:text-foreground"
            : "text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
          variant === "header" ? "p-2.5 md:p-3" : variant === "compact" ? "px-2.5 py-2" : "",
          open &&
            (variant === "profile"
              ? "text-foreground"
              : "bg-black/5 text-slate-900 dark:bg-white/10 dark:text-white"),
        )}
        aria-label={t("language.label")}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {variant === "compact" ? (
          <Languages
            className="h-5 w-5"
            strokeWidth={2}
          />
        ) : null}
        <span
          className={cn(
            "text-sm font-bold",
            variant === "header" && "hidden lg:inline",
            variant === "profile" && "inline text-[15px] font-semibold",
          )}
        >
          {t(LOCALE_LABEL_KEYS[current] ?? "language.en")}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 opacity-70 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("language.label")}
          className="absolute end-0 top-[calc(100%+0.35rem)] z-[160] min-w-[10.5rem] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-900"
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const selected = current === locale;
            return (
              <button
                key={locale}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  void i18n.changeLanguage(locale);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center px-3.5 py-2.5 text-start text-sm font-semibold transition-colors",
                  selected
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/80",
                )}
              >
                {t(LOCALE_LABEL_KEYS[locale])}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
