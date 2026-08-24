import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Compass,
  CookingPot,
  LayoutGrid,
  Sparkles,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  OTHER_HELP_SUBCATEGORIES,
} from "@/lib/serviceCategories";
import type { DiscoverHomeCategoryFilter } from "@/lib/discoverHomeCategoryFilter";

const stripCategoryCircleClass =
  "relative flex max-md:h-[4.25rem] max-md:w-[4.25rem] md:h-[4.25rem] md:w-[4.25rem] items-center justify-center rounded-full border transition-all bg-white/85 shadow-sm backdrop-blur-md dark:border-0 dark:bg-zinc-800/75 dark:shadow-none md:dark:bg-zinc-900/55";

const stripCategoryLabelClass =
  "font-extrabold uppercase tracking-[0.14em] max-md:text-[10.5px] md:text-[10.5px]";

const stripCategoryCompassClass = "max-md:h-10 max-md:w-10 md:h-10 md:w-10";

const stripCategoryIconShellClass =
  "flex max-md:h-10 max-md:w-10 md:h-10 md:w-10 items-center justify-center";

const stripCategoryIconSizeClass = "max-md:h-7 max-md:w-7 md:h-7 md:w-7";

export function categoryIconNode(
  serviceType: string | null | undefined,
  className = "h-4 w-4 shrink-0",
): ReactNode {
  if (serviceType === "cleaning") return <Sparkles className={className} aria-hidden />;
  if (serviceType === "cooking") return <CookingPot className={className} aria-hidden />;
  if (serviceType === "pickup_delivery") return <Truck className={className} aria-hidden />;
  if (serviceType === "nanny") return <UsersRound className={className} aria-hidden />;
  if (serviceType === "other_help") return <LayoutGrid className={className} aria-hidden />;
  return <Wrench className={className} aria-hidden />;
}

function accentFor(variant: "hire" | "work") {
  return variant === "work"
    ? {
        ring: "focus-visible:ring-emerald-400/70",
        activeCircle:
          "border-emerald-500/70 text-emerald-700 shadow-[0_10px_25px_-16px_rgba(16,185,129,0.7)] dark:border-0 dark:text-emerald-300 dark:shadow-none",
        activeLabel: "text-emerald-700 dark:text-emerald-300",
      }
    : {
        ring: "focus-visible:ring-orange-400/70",
        activeCircle:
          "border-orange-500/70 text-orange-700 shadow-[0_10px_25px_-16px_rgba(249,115,22,0.7)] dark:border-0 dark:text-orange-300 dark:shadow-none",
        activeLabel: "text-orange-700 dark:text-orange-300",
      };
}

type Props = {
  variant: "hire" | "work";
  selected: DiscoverHomeCategoryFilter;
  onSelect: (id: DiscoverHomeCategoryFilter) => void;
  otherSubFilter?: string | null;
  onOtherSubFilterChange?: (id: string | null) => void;
  className?: string;
};

export function DiscoverHomeCategoryFilterRow({
  variant,
  selected,
  onSelect,
  otherSubFilter = null,
  onOtherSubFilterChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const filterAccent = accentFor(variant);
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(
    selected === "other_help",
  );

  useEffect(() => {
    if (selected !== "other_help") setOtherDropdownOpen(false);
  }, [selected]);

  const selectCategory = (id: DiscoverHomeCategoryFilter) => {
    if (id === "other_help") {
      setOtherDropdownOpen((open) => (selected === "other_help" ? !open : true));
    } else {
      setOtherDropdownOpen(false);
      onOtherSubFilterChange?.(null);
    }
    onSelect(id);
  };

  return (
    <div className={className}>
      <div
        id="discover-home-category-filters"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4"
      >
        <button
          type="button"
          onClick={() => selectCategory("all")}
          className={cn(
            "flex shrink-0 flex-col items-center gap-2 transition-transform active:scale-95 md:gap-2.5",
            "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            filterAccent.ring,
          )}
        >
          <div
            className={cn(
              stripCategoryCircleClass,
              selected === "all"
                ? filterAccent.activeCircle
                : "border-slate-200/80 text-slate-500 dark:border-0 dark:text-zinc-400",
            )}
          >
            <Compass className={stripCategoryCompassClass} strokeWidth={2.5} />
          </div>
          <span
            className={cn(
              stripCategoryLabelClass,
              selected === "all"
                ? filterAccent.activeLabel
                : "text-slate-500 dark:text-zinc-500",
            )}
          >
            {t("discoverHome.filters.all")}
          </span>
        </button>

        {DISCOVER_HOME_CATEGORIES.filter((c) => c.id !== ALL_HELP_CATEGORY_ID).map((cat) => {
          const isOther = cat.id === "other_help";
          const active = selected === cat.id;
          const subLabel =
            isOther && otherSubFilter ? t(`otherHelpSubcategories.${otherSubFilter}`) : null;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectCategory(cat.id as DiscoverHomeCategoryFilter)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-2 transition-transform active:scale-95 md:gap-2.5",
                "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                filterAccent.ring,
              )}
            >
              <div
                className={cn(
                  stripCategoryCircleClass,
                  active
                    ? filterAccent.activeCircle
                    : "border-slate-200/80 text-slate-500 dark:border-0 dark:text-zinc-400",
                )}
              >
                <span className={stripCategoryIconShellClass}>
                  {categoryIconNode(cat.id, stripCategoryIconSizeClass)}
                </span>
              </div>
              <span
                className={cn(
                  stripCategoryLabelClass,
                  "inline-flex max-w-[5.5rem] items-center gap-0.5 truncate",
                  active ? filterAccent.activeLabel : "text-slate-500 dark:text-zinc-500",
                )}
              >
                <span className="truncate">
                  {subLabel ?? t(`discoverHome.filters.${cat.id}`)}
                </span>
                {isOther ? <ChevronDown className="h-3 w-3 shrink-0" strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {selected === "other_help" && otherDropdownOpen ? (
        <div className="mt-2 rounded-2xl border border-zinc-200/70 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-black uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {t("discoverHome.filters.pickSubcategory")}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                onOtherSubFilterChange?.(null);
                setOtherDropdownOpen(false);
              }}
              className={cn(
                "rounded-xl px-3 py-2 text-left text-[13px] font-bold transition-colors",
                otherSubFilter === null
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
              )}
            >
              {t("discoverHome.filters.allOther")}
            </button>
            {OTHER_HELP_SUBCATEGORIES.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  onOtherSubFilterChange?.(sub.id);
                  setOtherDropdownOpen(false);
                }}
                className={cn(
                  "rounded-xl px-3 py-2 text-left text-[13px] font-bold transition-colors",
                  otherSubFilter === sub.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
                )}
              >
                {t(`otherHelpSubcategories.${sub.id}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
