import { cn } from "@/lib/utils";
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
  labelId?: string;
  hintId?: string;
};

const CLEAR_BY_THEME: Record<MatchSearchCategoryPickerTheme, string> = {
  orange: "text-orange-600 dark:text-orange-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
};

const CHIP_BY_THEME: Record<
  MatchSearchCategoryPickerTheme,
  { on: string; off: string }
> = {
  orange: {
    on: "border-orange-500 bg-orange-500 text-white shadow-sm dark:border-orange-400 dark:bg-orange-500",
    off: "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/80 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-200 dark:hover:border-orange-900/50",
  },
  emerald: {
    on: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    off: "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-200 dark:hover:border-emerald-900/50",
  },
};

const FOCUS_RING_BY_THEME: Record<MatchSearchCategoryPickerTheme, string> = {
  orange: "focus-visible:ring-orange-400/60",
  emerald: "focus-visible:ring-emerald-400/60",
};

export function MatchSearchCategoryPicker({
  selectedCategories,
  onToggle,
  onClearAll,
  theme = "orange",
  labelId = "match-search-category-label",
  hintId,
}: MatchSearchCategoryPickerProps) {
  const chips = CHIP_BY_THEME[theme];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span
          id={labelId}
          className="text-sm font-bold text-slate-800 dark:text-slate-100"
        >
          Categories
        </span>
        {selectedCategories.size > 0 ? (
          <button
            type="button"
            className={cn(
              "text-xs font-semibold underline-offset-4 hover:underline",
              CLEAR_BY_THEME[theme],
            )}
            onClick={onClearAll}
          >
            Clear all
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "flex flex-nowrap gap-2.5 overflow-x-auto pb-1",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          "md:[scrollbar-width:thin]",
        )}
        role="group"
        aria-labelledby={labelId}
        {...(hintId ? { "aria-describedby": hintId } : {})}
      >
        {SERVICE_CATEGORIES.map((cat) => {
          const on = selectedCategories.has(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggle(cat.id)}
              aria-pressed={on}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                FOCUS_RING_BY_THEME[theme],
                on ? chips.on : chips.off,
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
