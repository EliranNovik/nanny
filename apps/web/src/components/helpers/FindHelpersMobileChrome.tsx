import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
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

/** Unpicked boxes stay neutral. The picked box uses its category color. */
const CATEGORY_IDLE =
  "bg-zinc-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100";

const CATEGORY_SELECTED: Record<ServiceCategoryId, string> = {
  cleaning: "bg-[#3d8eb8] text-white",
  cooking: "bg-[#e07840] text-white",
  pickup_delivery: "bg-[#8f6fd4] text-white",
  nanny: "bg-[#6a8f5a] text-white",
  home_maintenance: "bg-[#c9955a] text-white",
  other_help: "bg-[#8b6fc7] text-white",
};

const OTHER_SUBCATEGORY_SELECTED: Record<string, string> = {
  beauty_personal_care: "bg-[#d47a72] text-white",
  heavy_lifting_moving: "bg-[#8f6fd4] text-white",
  coaching_lessons: "bg-[#3d8eb8] text-white",
  shopping_errands: "bg-[#d4a06a] text-white",
  pet_help: "bg-[#e07840] text-white",
  elderly_help: "bg-[#6a8f5a] text-white",
  paperwork_bureaucracy: "bg-[#5a7d8f] text-white",
  event_help: "bg-[#8b6fc7] text-white",
  technical_help: "bg-[#5a7d8f] text-white",
  digital_creative: "bg-[#3d8eb8] text-white",
  religious_community: "bg-[#6a8f5a] text-white",
};

type FindHelpersMobileChromeProps = {
  quickFilter: FindHelpersQuickFilter;
  onQuickFilter: (filter: FindHelpersQuickFilter) => void;
  selectedCategories: ReadonlySet<ServiceCategoryId>;
  onToggleCategory: (id: ServiceCategoryId) => void;
  onClearCategories: () => void;
  onReplaceCategories: (
    categories: ServiceCategoryId[],
    otherSubs: string[],
  ) => void;
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
  onReplaceCategories,
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
  const [otherSubsOpen, setOtherSubsOpen] = useState(false);
  const categorySnapshotRef = useRef<{
    categories: ServiceCategoryId[];
    otherSubs: string[];
  } | null>(null);
  const selectedCategoriesRef = useRef(selectedCategories);
  const selectedOtherSubsRef = useRef(selectedOtherSubs);
  selectedCategoriesRef.current = selectedCategories;
  selectedOtherSubsRef.current = selectedOtherSubs;

  useEffect(() => {
    if (panel !== "categories") {
      setOtherSubsOpen(false);
      return;
    }
    categorySnapshotRef.current = {
      categories: [...selectedCategoriesRef.current],
      otherSubs: [...selectedOtherSubsRef.current],
    };
    setOtherSubsOpen(selectedCategoriesRef.current.has("other_help"));
  }, [panel]);

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
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={nameQuery}
                  onChange={(e) => onNameQueryChange(e.target.value)}
                  placeholder={t("findHelpersPage.searchByName")}
                  className="h-11 w-full rounded-2xl bg-zinc-100 pl-10 pr-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
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
                    "shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors md:h-11 md:py-0",
                    on
                      ? "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-zinc-600 dark:text-white dark:ring-0"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
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
            className="relative flex items-center justify-between px-2 pb-2"
            style={{
              paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
            }}
          >
            <button
              type="button"
              onClick={() => onPanelChange("none")}
              className="relative z-[1] inline-flex h-11 w-11 items-center justify-center text-foreground"
              aria-label={t("common.back")}
            >
              <HeaderBackChevron className="h-8 w-8" />
            </button>
            <h2 className="pointer-events-none absolute inset-x-0 bottom-2 flex h-11 items-center justify-center px-28 text-base font-bold text-foreground">
              {t("findHelpersPage.filterCategories")}
            </h2>
            <button
              type="button"
              onClick={onClearCategories}
              className="relative z-[1] mr-1 inline-flex h-11 items-center rounded-full bg-orange-500 px-5 text-[16px] font-bold text-white"
            >
              {t("findHelpersPage.clear")}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-2.5 md:grid-cols-3">
              {SERVICE_CATEGORIES.map((cat) => {
                const selected = selectedCategories.has(cat.id);
                const otherCount =
                  cat.id === "other_help" ? selectedOtherSubs.size : 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (cat.id === "other_help") {
                        setOtherSubsOpen((open) => {
                          const next = !open;
                          if (next && !selected) onToggleCategory("other_help");
                          return next;
                        });
                        return;
                      }
                      onToggleCategory(cat.id);
                    }}
                    className={cn(
                      "relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl p-3 text-center",
                      selected ? CATEGORY_SELECTED[cat.id] : CATEGORY_IDLE,
                    )}
                  >
                    {otherCount > 0 ? (
                      <span className="absolute right-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
                        {otherCount}
                      </span>
                    ) : null}
                    <span className="relative isolate block h-24 w-24 overflow-hidden rounded-full md:h-28 md:w-28">
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
            {otherSubsOpen ? (
              <div className="mx-auto mt-5 max-w-4xl">
                <p className="mb-3 text-center text-base font-black text-foreground">
                  {t("findHelpersPage.otherSubcategoriesTitle")}
                </p>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                  {OTHER_HELP_SUBCATEGORIES.map((sub) => {
                    const subSelected = selectedOtherSubs.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        aria-pressed={subSelected}
                        onClick={() => onToggleOtherSub(sub.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center",
                          subSelected
                            ? (OTHER_SUBCATEGORY_SELECTED[sub.id] ??
                              CATEGORY_SELECTED.other_help)
                            : CATEGORY_IDLE,
                        )}
                      >
                        <span className="relative isolate block h-20 w-20 overflow-hidden rounded-full md:h-24 md:w-24">
                          <img
                            src={categoryIllustrationSrc(sub.id)}
                            alt=""
                            className="absolute inset-0 h-full w-full origin-center scale-[1.22] object-cover"
                          />
                        </span>
                        <span className="text-[14px] font-bold leading-snug">
                          {t(`otherHelpSubcategories.${sub.id}`, {
                            defaultValue: sub.label,
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div
            className="shrink-0 border-t border-border/50 bg-background px-3 pt-3"
            style={{
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mx-auto flex max-w-4xl gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const snap = categorySnapshotRef.current;
                  if (snap) onReplaceCategories(snap.categories, snap.otherSubs);
                  onPanelChange("none");
                }}
                className="h-12 flex-1 rounded-2xl bg-zinc-100 text-[15px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {t("findHelpersPage.cancel")}
              </button>
              <button
                type="button"
                onClick={() => onPanelChange("none")}
                className="h-12 flex-1 rounded-2xl bg-orange-500 text-[15px] font-bold text-white"
              >
                {t("findHelpersPage.done")}
              </button>
            </div>
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
    </>
  );
}
