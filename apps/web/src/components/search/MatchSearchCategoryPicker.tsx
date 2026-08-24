import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { categoryIconNode } from "@/components/discover/DiscoverHomeCategoryFilterRow";
import {
  SERVICE_CATEGORIES,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";

type MatchSearchCategoryPickerTheme = "orange" | "emerald";

type MatchSearchCategoryPickerProps = {
  selectedCategories: ReadonlySet<ServiceCategoryId>;
  onToggle: (id: ServiceCategoryId) => void;
  onClearAll: () => void;
  theme?: MatchSearchCategoryPickerTheme;
  hintId?: string;
};

const CIRCLE_CLASS =
  "relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full border bg-white/85 shadow-sm backdrop-blur-md transition-all dark:border-0 dark:bg-zinc-800/75 dark:shadow-none";

const LABEL_CLASS =
  "max-w-[5.5rem] truncate text-center font-extrabold uppercase tracking-[0.14em] text-[10.5px]";

const ICON_CLASS = "h-7 w-7";

const ACCENT: Record<
  MatchSearchCategoryPickerTheme,
  { ring: string; activeCircle: string; activeLabel: string }
> = {
  orange: {
    ring: "focus-visible:ring-orange-400/70",
    activeCircle:
      "border-orange-500/70 text-orange-700 shadow-[0_10px_25px_-16px_rgba(249,115,22,0.7)] dark:border-0 dark:text-orange-300 dark:shadow-none",
    activeLabel: "text-orange-700 dark:text-orange-300",
  },
  emerald: {
    ring: "focus-visible:ring-emerald-400/70",
    activeCircle:
      "border-emerald-500/70 text-emerald-700 shadow-[0_10px_25px_-16px_rgba(16,185,129,0.7)] dark:border-0 dark:text-emerald-300 dark:shadow-none",
    activeLabel: "text-emerald-700 dark:text-emerald-300",
  },
};

export function MatchSearchCategoryPicker({
  selectedCategories,
  onToggle,
  onClearAll,
  theme = "orange",
  hintId,
}: MatchSearchCategoryPickerProps) {
  const { t } = useTranslation();
  const accent = ACCENT[theme];
  const allActive = selectedCategories.size === 0;

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden",
          "touch-pan-x overscroll-x-contain pb-1",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        )}
        role="group"
        aria-label="Categories"
        {...(hintId ? { "aria-describedby": hintId } : {})}
      >
        <button
          type="button"
          onClick={onClearAll}
          aria-pressed={allActive}
          className={cn(
            "flex shrink-0 snap-start flex-col items-center gap-2 transition-transform active:scale-95",
            "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            accent.ring,
          )}
        >
          <div
            className={cn(
              CIRCLE_CLASS,
              allActive
                ? accent.activeCircle
                : "border-slate-200/80 text-slate-500 dark:text-zinc-400",
            )}
          >
            <Compass className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <span
            className={cn(
              LABEL_CLASS,
              allActive ? accent.activeLabel : "text-slate-500 dark:text-zinc-500",
            )}
          >
            {t("discoverHome.filters.all")}
          </span>
        </button>

        {SERVICE_CATEGORIES.map((cat) => {
          const on = selectedCategories.has(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggle(cat.id)}
              aria-pressed={on}
              className={cn(
                "flex shrink-0 snap-start flex-col items-center gap-2 transition-transform active:scale-95",
                "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                accent.ring,
              )}
            >
              <div
                className={cn(
                  CIRCLE_CLASS,
                  on
                    ? accent.activeCircle
                    : "border-slate-200/80 text-slate-500 dark:text-zinc-400",
                )}
              >
                {categoryIconNode(cat.id, ICON_CLASS)}
              </div>
              <span
                className={cn(
                  LABEL_CLASS,
                  on ? accent.activeLabel : "text-slate-500 dark:text-zinc-500",
                )}
              >
                {t(`feed.categories.${cat.id}`, cat.label)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
