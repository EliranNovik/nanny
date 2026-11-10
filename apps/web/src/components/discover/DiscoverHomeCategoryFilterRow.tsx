import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Compass,
  CookingPot,
  Home,
  LayoutGrid,
  Sparkles,
  Truck,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  OTHER_HELP_SUBCATEGORIES,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import type { DiscoverHomeCategoryFilter } from "@/lib/discoverHomeCategoryFilter";
import { categoryIllustrationSrc } from "@/lib/discoverCategoryTileIcons";

export function categoryIconNode(
  serviceType: string | null | undefined,
  className = "h-4 w-4 shrink-0",
): ReactNode {
  if (serviceType === "cleaning") return <Sparkles className={className} aria-hidden />;
  if (serviceType === "cooking") return <CookingPot className={className} aria-hidden />;
  if (serviceType === "pickup_delivery") return <Truck className={className} aria-hidden />;
  if (serviceType === "nanny") return <UsersRound className={className} aria-hidden />;
  if (serviceType === "home_maintenance") return <Home className={className} aria-hidden />;
  if (serviceType === "other_help") return <LayoutGrid className={className} aria-hidden />;
  return <Home className={className} aria-hidden />;
}

function accentFor(variant: "hire" | "work") {
  return variant === "work"
    ? {
        ring: "focus-visible:ring-emerald-400/70",
        allIdle: "bg-zinc-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-200",
        allSelected:
          "bg-emerald-600 text-white ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background",
        activeLabel: "text-emerald-700 dark:text-emerald-300",
        selectedRing:
          "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background",
      }
    : {
        ring: "focus-visible:ring-orange-400/70",
        allIdle: "bg-zinc-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-200",
        allSelected:
          "bg-orange-500 text-white ring-2 ring-orange-400/40 ring-offset-2 ring-offset-background",
        activeLabel: "text-orange-700 dark:text-orange-300",
        selectedRing:
          "ring-2 ring-orange-500/50 ring-offset-2 ring-offset-background",
      };
}

function CategoryBadgeBox({
  categoryId,
  className,
}: {
  categoryId: string;
  className?: string;
}) {
  return (
    <img
      src={categoryIllustrationSrc(categoryId)}
      alt=""
      className={cn("h-full w-full object-cover object-center", className)}
      loading="lazy"
      decoding="async"
      aria-hidden
    />
  );
}

type FilterItem =
  | { kind: "main"; id: ServiceCategoryId }
  | { kind: "sub"; id: string };

/** Main service types minus Other, then every Other subcategory as its own badge. */
function buildFlatFilterItems(): FilterItem[] {
  const mains = DISCOVER_HOME_CATEGORIES.filter(
    (c) => c.id !== ALL_HELP_CATEGORY_ID && c.id !== "other_help",
  ).map((c) => ({ kind: "main" as const, id: c.id as ServiceCategoryId }));
  const subs = OTHER_HELP_SUBCATEGORIES.map((s) => ({
    kind: "sub" as const,
    id: s.id,
  }));
  return [...mains, ...subs];
}

const FLAT_FILTER_ITEMS = buildFlatFilterItems();

type Props = {
  variant: "hire" | "work";
  selected: DiscoverHomeCategoryFilter;
  onSelect: (id: DiscoverHomeCategoryFilter) => void;
  otherSubFilter?: string | null;
  onOtherSubFilterChange?: (id: string | null) => void;
  className?: string;
  /** Kept for callers; both layouts render badge boxes. */
  layout?: "circles" | "pills";
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

  const selectAll = () => {
    onOtherSubFilterChange?.(null);
    onSelect("all");
  };

  const selectMain = (id: ServiceCategoryId) => {
    onOtherSubFilterChange?.(null);
    onSelect(id);
  };

  const selectSub = (id: string) => {
    onOtherSubFilterChange?.(id);
    onSelect("other_help");
  };

  const allItems: Array<
    | { kind: "all"; id: "all" }
    | FilterItem
  > = [{ kind: "all", id: "all" }, ...FLAT_FILTER_ITEMS];

  const renderFilterButton = (
    item: (typeof allItems)[number],
  ) => {
    if (item.kind === "all") {
      return (
        <button
          key="all"
          type="button"
          onClick={selectAll}
          className={cn(
            "flex w-[4.85rem] shrink-0 snap-start flex-col items-center gap-1.5 transition-transform active:scale-95 md:w-[6.1rem] md:gap-2",
            "focus-visible:outline-none focus-visible:rounded-2xl md:focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            filterAccent.ring,
          )}
        >
          <div
            className={cn(
              "flex aspect-square w-full items-center justify-center rounded-[1.2rem] shadow-sm md:rounded-full",
              selected === "all" && !otherSubFilter
                ? filterAccent.allSelected
                : filterAccent.allIdle,
            )}
          >
            <Compass className="h-8 w-8 md:h-10 md:w-10" strokeWidth={2.4} aria-hidden />
          </div>
          <span
            className={cn(
              "max-w-full truncate text-center text-[10px] font-extrabold uppercase md:text-[11px] tracking-[0.12em]",
              selected === "all" && !otherSubFilter
                ? filterAccent.activeLabel
                : "text-slate-500 dark:text-zinc-500",
            )}
          >
            {t("discoverHome.filters.all")}
          </span>
        </button>
      );
    }

    const active =
      item.kind === "main"
        ? selected === item.id
        : selected === "other_help" && otherSubFilter === item.id;
    const label =
      item.kind === "main"
        ? t(`discoverHome.filters.${item.id}`)
        : t(`otherHelpSubcategories.${item.id}`);

    return (
      <button
        key={item.id}
        type="button"
        onClick={() =>
          item.kind === "main" ? selectMain(item.id) : selectSub(item.id)
        }
        className={cn(
          "flex w-[4.85rem] shrink-0 snap-start flex-col items-center gap-1.5 transition-transform active:scale-95 md:w-[6.1rem] md:gap-2",
          "focus-visible:outline-none focus-visible:rounded-2xl md:focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          filterAccent.ring,
        )}
      >
        <div
          className={cn(
            "aspect-square w-full overflow-hidden rounded-[1.2rem] shadow-sm md:rounded-full transition-[box-shadow,transform]",
            active && filterAccent.selectedRing,
          )}
        >
          <CategoryBadgeBox categoryId={item.id} />
        </div>
        <span
          className={cn(
            "line-clamp-2 max-w-full text-center text-[10px] font-extrabold uppercase md:text-[11px] leading-tight tracking-[0.08em]",
            active
              ? filterAccent.activeLabel
              : "text-slate-500 dark:text-zinc-500",
          )}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className={className}>
      {/* Mobile: single horizontal scroll row */}
      <div
        id="discover-home-category-filters"
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden"
      >
        {allItems.map((item) => renderFilterButton(item))}
      </div>

      {/* Desktop: fill width first, wrap to a second row only when needed */}
      <div
        id="discover-home-category-filters-desktop"
        className="hidden flex-wrap justify-start gap-x-4 gap-y-4 md:flex"
      >
        {allItems.map((item) => renderFilterButton(item))}
      </div>
    </div>
  );
}
