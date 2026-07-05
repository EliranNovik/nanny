import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useTheme,
  type ThemePreference,
} from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const OPTIONS: {
  id: ThemePreference;
  icon: typeof Sun;
}[] = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "auto", icon: Monitor },
];

type ThemePreferenceSelectorProps = {
  className?: string;
};

export function ThemePreferenceSelector({ className }: ThemePreferenceSelectorProps) {
  const { t } = useTranslation();
  const { themePreference, setThemePreference } = useTheme();

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-1.5",
        className,
      )}
      role="radiogroup"
      aria-label={t("profile.theme.title")}
    >
      {OPTIONS.map(({ id, icon: Icon }) => {
        const selected = themePreference === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemePreference(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
              selected
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="text-xs font-bold leading-none">
              {t(`profile.theme.${id}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
