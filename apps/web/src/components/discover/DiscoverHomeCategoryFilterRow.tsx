import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CookingPot, Home, LayoutGrid, Plus, Sparkles, Truck, UsersRound } from "lucide-react";
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

type FilterItem = { kind: "main"; id: ServiceCategoryId };

const MAIN_FILTER_ITEMS: FilterItem[] = DISCOVER_HOME_CATEGORIES.filter(
  (c) => c.id !== ALL_HELP_CATEGORY_ID && c.id !== "other_help",
).map((c) => ({ kind: "main" as const, id: c.id as ServiceCategoryId }));

type Props = {
  variant: "hire" | "work";
  selected: DiscoverHomeCategoryFilter;
  onSelect: (id: DiscoverHomeCategoryFilter) => void;
  otherSubFilter?: string | null;
  onOtherSubFilterChange?: (id: string | null) => void;
  /** Rendered on the same row, immediately after More. */
  afterMore?: ReactNode;
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
  afterMore,
  className,
}: Props) {
  const { t } = useTranslation();
  const filterAccent = accentFor(variant);
  const [moreOpen, setMoreOpen] = useState(Boolean(otherSubFilter));

  useEffect(() => {
    if (otherSubFilter) setMoreOpen(true);
  }, [otherSubFilter]);

  const selectMain = (id: ServiceCategoryId) => {
    if (selected === id) {
      onOtherSubFilterChange?.(null);
      onSelect("all");
      return;
    }
    onOtherSubFilterChange?.(null);
    onSelect(id);
  };

  const selectSub = (id: string) => {
    if (selected === "other_help" && otherSubFilter === id) {
      onOtherSubFilterChange?.(null);
      onSelect("all");
      return;
    }
    onOtherSubFilterChange?.(id);
    onSelect("other_help");
  };

  const moreActive = selected === "other_help" && Boolean(otherSubFilter);

  const renderMainButton = (
    id: ServiceCategoryId,
    label: string,
    active: boolean,
    onClick: () => void,
    visual: ReactNode,
  ) => (
    <button
      key={id}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-[4rem] shrink-0 flex-col items-center gap-1 transition-transform active:scale-95 sm:w-[4.35rem] md:w-[4.6rem]",
        "focus-visible:outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        filterAccent.ring,
      )}
    >
      <div
        className={cn(
          "aspect-square w-full overflow-hidden rounded-full shadow-sm",
          active && filterAccent.selectedRing,
        )}
      >
        {visual}
      </div>
      <span
        className={cn(
          "line-clamp-2 max-w-full text-center text-[8px] font-extrabold uppercase leading-tight tracking-[0.08em] md:text-[10px]",
          active ? filterAccent.activeLabel : "text-slate-500 dark:text-zinc-500",
        )}
      >
        {label}
      </span>
    </button>
  );

  return (
    <div className={cn("min-w-0 w-full", className)}>
      <div
        id="discover-home-category-filters"
        className="flex items-start gap-x-3 gap-y-4 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] md:flex-wrap md:gap-x-5 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {MAIN_FILTER_ITEMS.map((item) => (
          renderMainButton(
            item.id,
            t(`discoverHome.filters.${item.id}`),
            selected === item.id,
            () => selectMain(item.id),
            <CategoryBadgeBox categoryId={item.id} />,
          )
        ))}
        {afterMore ? (
          <div className="flex min-w-[min(100%,24rem)] flex-1 items-start gap-3 md:gap-5">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "flex w-[4rem] shrink-0 flex-col items-center gap-1 transition-transform active:scale-95 sm:w-[4.35rem] md:w-[4.6rem]",
                "focus-visible:outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                filterAccent.ring,
              )}
            >
              <div
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-full shadow-sm",
                  moreActive || moreOpen ? filterAccent.allSelected : filterAccent.allIdle,
                )}
              >
                <Plus
                  className={cn("h-6 w-6 transition-transform md:h-7 md:w-7", moreOpen && "rotate-45")}
                  strokeWidth={2.4}
                  aria-hidden
                />
              </div>
              <span
                className={cn(
                  "max-w-full truncate text-center text-[8px] font-extrabold uppercase tracking-[0.08em] md:text-[10px]",
                  moreActive || moreOpen
                    ? filterAccent.activeLabel
                    : "text-slate-500 dark:text-zinc-500",
                )}
              >
                {t("common.more")}
              </span>
            </button>
            <div className="min-w-0 flex-1 self-start pt-1 md:pt-1">{afterMore}</div>
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "flex w-[4rem] shrink-0 flex-col items-center gap-1 transition-transform active:scale-95 sm:w-[4.35rem] md:w-[4.6rem]",
              "focus-visible:outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              filterAccent.ring,
            )}
          >
            <div
              className={cn(
                "flex aspect-square w-full items-center justify-center rounded-full shadow-sm",
                moreActive || moreOpen ? filterAccent.allSelected : filterAccent.allIdle,
              )}
            >
              <Plus
                className={cn("h-6 w-6 transition-transform md:h-7 md:w-7", moreOpen && "rotate-45")}
                strokeWidth={2.4}
                aria-hidden
              />
            </div>
            <span
              className={cn(
                "max-w-full truncate text-center text-[8px] font-extrabold uppercase tracking-[0.08em] md:text-[10px]",
                moreActive || moreOpen
                  ? filterAccent.activeLabel
                  : "text-slate-500 dark:text-zinc-500",
              )}
            >
              {t("common.more")}
            </span>
          </button>
        )}
      </div>

      {moreOpen ? (
        <div className="mt-4 flex gap-x-3 gap-y-3 overflow-x-auto overscroll-x-contain border-t border-border/40 pt-4 [scrollbar-width:none] md:flex-wrap md:gap-x-4 md:overflow-visible [&::-webkit-scrollbar]:hidden">
          {OTHER_HELP_SUBCATEGORIES.map((sub) => {
            const active = selected === "other_help" && otherSubFilter === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => selectSub(sub.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-[3.4rem] shrink-0 flex-col items-center gap-1 transition-transform active:scale-95 md:w-[3.85rem]",
                  "focus-visible:outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  filterAccent.ring,
                )}
              >
                <div
                  className={cn(
                    "aspect-square w-full overflow-hidden rounded-full shadow-sm",
                    active && filterAccent.selectedRing,
                  )}
                >
                  <CategoryBadgeBox categoryId={sub.id} />
                </div>
                <span
                  className={cn(
                    "line-clamp-2 max-w-full text-center text-[8px] font-extrabold uppercase leading-tight tracking-[0.06em] md:text-[9px]",
                    active
                      ? filterAccent.activeLabel
                      : "text-slate-500 dark:text-zinc-500",
                  )}
                >
                  {t(`otherHelpSubcategories.${sub.id}`)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
