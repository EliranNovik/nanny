import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { categoryIllustrationSrc } from "@/lib/discoverCategoryTileIcons";
import {
  OTHER_HELP_SUBCATEGORIES,
  SERVICE_CATEGORIES,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";

export type FindHelpersQuickFilter =
  | "all"
  | "nearby"
  | "high_rated"
  | "available";

export type FindHelpersMobilePanel = "none" | "categories" | "location";

const CATEGORY_TILE: Record<
  ServiceCategoryId,
  { idle: string; selected: string }
> = {
  cleaning: {
    idle: "bg-sky-50 text-sky-950 dark:bg-sky-500/10 dark:text-sky-50",
    selected: "bg-sky-600 text-white",
  },
  cooking: {
    idle: "bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-50",
    selected: "bg-amber-500 text-white",
  },
  pickup_delivery: {
    idle: "bg-indigo-50 text-indigo-950 dark:bg-indigo-500/10 dark:text-indigo-50",
    selected: "bg-indigo-600 text-white",
  },
  nanny: {
    idle: "bg-rose-50 text-rose-950 dark:bg-rose-500/10 dark:text-rose-50",
    selected: "bg-rose-500 text-white",
  },
  technical_help: {
    idle: "bg-slate-100 text-slate-900 dark:bg-slate-500/10 dark:text-slate-50",
    selected: "bg-slate-700 text-white",
  },
  other_help: {
    idle: "bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-50",
    selected: "bg-emerald-600 text-white",
  },
};

type FindHelpersMobileChromeProps = {
  quickFilter: FindHelpersQuickFilter;
  onQuickFilter: (filter: FindHelpersQuickFilter) => void;
  selectedCategories: ReadonlySet<ServiceCategoryId>;
  onToggleCategory: (id: ServiceCategoryId) => void;
  onClearCategories: () => void;
  selectedOtherSubs: ReadonlySet<string>;
  onToggleOtherSub: (id: string) => void;
  nameQuery: string;
  onNameQueryChange: (value: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  filterMenuOpen: boolean;
  onFilterMenuOpenChange: (open: boolean) => void;
  panel: FindHelpersMobilePanel;
  onPanelChange: (panel: FindHelpersMobilePanel) => void;
  onBack: () => void;
  locationPanel: ReactNode;
};

const QUICK_FILTERS: FindHelpersQuickFilter[] = [
  "all",
  "nearby",
  "high_rated",
  "available",
];

export function FindHelpersMobileChrome({
  quickFilter,
  onQuickFilter,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  selectedOtherSubs,
  onToggleOtherSub,
  nameQuery,
  onNameQueryChange,
  searchOpen,
  onSearchOpenChange,
  filterMenuOpen,
  onFilterMenuOpenChange,
  panel,
  onPanelChange,
  onBack,
  locationPanel,
}: FindHelpersMobileChromeProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [otherSheetOpen, setOtherSheetOpen] = useState(false);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const onPointer = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) {
        onFilterMenuOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [filterMenuOpen, onFilterMenuOpenChange]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  return (
    <>
      <header
        className="shrink-0 bg-background pt-[max(0.25rem,env(safe-area-inset-top,0px))] dark:bg-background md:pt-3 md:pb-4"
      >
        <div className="flex flex-col px-2 md:flex-row md:items-center md:gap-3 md:px-0">
          <div className="flex items-center justify-between md:contents">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 w-11 items-center justify-center text-foreground md:hidden"
              aria-label={t("common.back")}
            >
              <HeaderBackChevron className="h-8 w-8" />
            </button>
            <div className="flex items-center gap-0.5 md:order-3 md:shrink-0">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-expanded={filterMenuOpen}
                  aria-haspopup="menu"
                  aria-label={t("findHelpersPage.filter")}
                  onClick={() => onFilterMenuOpenChange(!filterMenuOpen)}
                  className="inline-flex h-11 w-11 items-center justify-center text-foreground"
                >
                  <SlidersHorizontal className="h-6 w-6" strokeWidth={2.1} />
                </button>
                {filterMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 min-w-[12.5rem] overflow-hidden rounded-2xl bg-zinc-800 py-1.5 shadow-xl shadow-black/40"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[15px] font-semibold text-white"
                      onClick={() => {
                        onFilterMenuOpenChange(false);
                        onPanelChange("categories");
                      }}
                    >
                      <LayoutGrid className="h-4 w-4 text-white/70" aria-hidden />
                      {t("findHelpersPage.filterCategories")}
                      {selectedCategories.size > 0 ? (
                        <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">
                          {selectedCategories.size}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[15px] font-semibold text-white"
                      onClick={() => {
                        onFilterMenuOpenChange(false);
                        onPanelChange("location");
                      }}
                    >
                      <MapPin className="h-4 w-4 text-white/70" aria-hidden />
                      {t("findHelpersPage.filterLocation")}
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={
                  searchOpen ? t("common.closeSearch") : t("common.openSearch")
                }
                onClick={() => onSearchOpenChange(!searchOpen)}
                className="inline-flex h-11 w-11 items-center justify-center text-foreground"
              >
                {searchOpen ? (
                  <X className="h-6 w-6" strokeWidth={2.1} />
                ) : (
                  <Search className="h-6 w-6" strokeWidth={2.1} />
                )}
              </button>
            </div>
          </div>

          {searchOpen ? (
            <div className="px-1 pb-2 md:order-2 md:w-72 md:shrink-0 md:px-0 md:pb-0">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={nameQuery}
                  onChange={(e) => onNameQueryChange(e.target.value)}
                  placeholder={t("findHelpersPage.searchByName")}
                  className="h-11 w-full rounded-2xl bg-zinc-800 pl-10 pr-3 text-[15px] text-white placeholder:text-zinc-500 outline-none"
                />
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "flex gap-2 overflow-x-auto px-1 pb-3",
              "md:order-1 md:min-w-0 md:flex-1 md:px-0 md:pb-0",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            )}
            role="tablist"
            aria-label={t("findHelpersPage.filter")}
          >
            {QUICK_FILTERS.map((id) => {
              const on = quickFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => onQuickFilter(id)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold md:h-11 md:py-0",
                    on
                      ? "bg-zinc-600 text-white"
                      : "bg-zinc-800/80 text-zinc-300",
                  )}
                >
                  {t(`findHelpersPage.pills.${id}`)}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {panel === "categories" ? (
        <div className="fixed inset-0 z-[220] flex flex-col bg-background">
          <div
            className="flex items-center justify-between px-2 pb-2"
            style={{
              paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
            }}
          >
            <button
              type="button"
              onClick={() => onPanelChange("none")}
              className="inline-flex h-11 w-11 items-center justify-center text-foreground"
              aria-label={t("common.back")}
            >
              <HeaderBackChevron className="h-8 w-8" />
            </button>
            <h2 className="text-base font-bold text-foreground">
              {t("findHelpersPage.filterCategories")}
            </h2>
            <button
              type="button"
              onClick={onClearCategories}
              className="px-3 text-[13px] font-semibold text-zinc-400"
            >
              {t("findHelpersPage.clear")}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-2.5 md:grid-cols-3">
              {SERVICE_CATEGORIES.map((cat) => {
                const selected = selectedCategories.has(cat.id);
                const meta = CATEGORY_TILE[cat.id];
                const otherCount =
                  cat.id === "other_help" ? selectedOtherSubs.size : 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (cat.id === "other_help") {
                        if (!selected) onToggleCategory("other_help");
                        setOtherSheetOpen(true);
                        return;
                      }
                      onToggleCategory(cat.id);
                    }}
                    className={cn(
                      "relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl p-3 text-center",
                      selected ? meta.selected : meta.idle,
                    )}
                  >
                    {otherCount > 0 ? (
                      <span className="absolute right-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
                        {otherCount}
                      </span>
                    ) : null}
                    <span className="relative isolate block h-16 w-16 overflow-hidden rounded-full">
                      <img
                        src={categoryIllustrationSrc(cat.id)}
                        alt=""
                        className="absolute inset-0 h-full w-full origin-center scale-[1.22] object-cover"
                      />
                    </span>
                    <span className="text-base font-black leading-tight">
                      {t(`feed.categories.${cat.id}`, { defaultValue: cat.label })}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] font-semibold leading-snug",
                        selected ? "text-white/85" : "opacity-70",
                      )}
                    >
                      {t(`createJob.serviceDescriptions.${cat.id}`, {
                        defaultValue: cat.description,
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onPanelChange("none")}
              className="mt-5 h-12 w-full rounded-2xl bg-orange-500 text-[15px] font-bold text-white"
            >
              {t("findHelpersPage.done")}
            </button>
          </div>
        </div>
      ) : null}

      {panel === "location" ? (
        <div className="fixed inset-0 z-[220] flex flex-col bg-background">
          <div
            className="flex items-center justify-between px-2 pb-2"
            style={{
              paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
            }}
          >
            <button
              type="button"
              onClick={() => onPanelChange("none")}
              className="inline-flex h-11 w-11 items-center justify-center text-foreground"
              aria-label={t("common.back")}
            >
              <HeaderBackChevron className="h-8 w-8" />
            </button>
            <h2 className="text-base font-bold text-foreground">
              {t("findHelpersPage.filterLocation")}
            </h2>
            <span className="w-11" aria-hidden />
          </div>
          <div className="min-h-0 flex-1 overflow-visible">{locationPanel}</div>
        </div>
      ) : null}

      {otherSheetOpen ? (
        <MobileSnapBottomSheet
          expanded
          presented
          hidePeek
          heightMode="viewport"
          maxHeight="min(88dvh, 760px)"
          className="z-[230] md:block md:left-1/2 md:right-auto md:w-full md:max-w-xl md:-translate-x-1/2"
          bottomOffsetClass="bottom-0"
          ariaLabel={t("findHelpersPage.otherSubcategoriesTitle")}
          onExpandedChange={(next) => {
            if (!next) setOtherSheetOpen(false);
          }}
          onDismiss={() => setOtherSheetOpen(false)}
        >
          <div className="px-4 pb-6 pt-2">
            <div className="mb-4 text-center">
              <p className="text-base font-black text-foreground">
                {t("findHelpersPage.otherSubcategoriesTitle")}
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-400">
                {t("otherHelpSubcategories.selectLabel")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {OTHER_HELP_SUBCATEGORIES.map((sub) => {
                const selected = selectedOtherSubs.has(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggleOtherSub(sub.id)}
                    className={cn(
                      "flex flex-col items-center justify-start gap-2 rounded-2xl p-3.5 text-center",
                      selected
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-zinc-100",
                    )}
                  >
                    <span className="relative isolate block h-14 w-14 overflow-hidden rounded-full">
                      <img
                        src={categoryIllustrationSrc(sub.id)}
                        alt=""
                        className="absolute inset-0 h-full w-full origin-center scale-[1.22] object-cover"
                      />
                    </span>
                    <span className="text-[13px] font-bold leading-snug">
                      {t(`otherHelpSubcategories.${sub.id}`, {
                        defaultValue: sub.label,
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOtherSheetOpen(false)}
              className="mt-5 h-12 w-full rounded-2xl bg-orange-500 text-[15px] font-bold text-white"
            >
              {t("findHelpersPage.done")}
            </button>
          </div>
        </MobileSnapBottomSheet>
      ) : null}
    </>
  );
}
