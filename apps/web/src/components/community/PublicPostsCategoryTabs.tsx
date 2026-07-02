import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Baby,
  HelpCircle,
  LayoutGrid,
  Sparkles,
  Truck,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_HELP_CATEGORY_ID,
  type DiscoverHomeCategoryId,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";

type TabDef = {
  id: DiscoverHomeCategoryId;
  label: string;
  Icon: LucideIcon;
  /** Active pill (gradient + text) */
  activeClass: string;
  /** Idle: border tint per category */
  idleRing: string;
};

const ICONS: Record<DiscoverHomeCategoryId, LucideIcon> = {
  [ALL_HELP_CATEGORY_ID]: LayoutGrid,
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  technical_help: Wrench,
  other_help: HelpCircle,
};

const TAB_DEFS: TabDef[] = [
  {
    id: ALL_HELP_CATEGORY_ID,
    label: "All help",
    Icon: ICONS[ALL_HELP_CATEGORY_ID],
    activeClass:
      "border-transparent bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-900/20 dark:shadow-orange-950/40",
    idleRing:
      "border-orange-200/60 bg-orange-50/40 text-orange-900/80 hover:bg-orange-50/80 dark:border-orange-500/25 dark:bg-orange-950/20 dark:text-orange-100",
  },
  ...SERVICE_CATEGORIES.map((c) => {
    const base = ((): Omit<TabDef, "id" | "label" | "Icon"> => {
      switch (c.id) {
        case "cleaning":
          return {
            activeClass:
              "border-transparent bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15 dark:shadow-emerald-950/30",
            idleRing:
              "border-emerald-200/70 bg-emerald-50/40 text-emerald-900/85 hover:bg-emerald-50/85 dark:border-emerald-500/25 dark:bg-emerald-950/25 dark:text-emerald-100",
          };
        case "cooking":
          return {
            activeClass:
              "border-transparent bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-900/20",
            idleRing:
              "border-amber-200/70 bg-amber-50/50 text-amber-950/90 hover:bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-100",
          };
        case "pickup_delivery":
          return {
            activeClass:
              "border-transparent bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-900/20",
            idleRing:
              "border-violet-200/60 bg-violet-50/45 text-violet-950/90 hover:bg-violet-50/90 dark:border-violet-500/25 dark:bg-violet-950/25 dark:text-violet-100",
          };
        case "nanny":
          return {
            activeClass:
              "border-transparent bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-900/15",
            idleRing:
              "border-sky-200/70 bg-sky-50/45 text-sky-950/90 hover:bg-sky-50/90 dark:border-sky-500/25 dark:bg-sky-950/25 dark:text-sky-100",
          };
        case "technical_help":
          return {
            activeClass:
              "border-transparent bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-md shadow-black/15",
            idleRing:
              "border-slate-200/80 bg-slate-100/60 text-slate-900 hover:bg-slate-100 dark:border-slate-600/50 dark:bg-slate-800/60 dark:text-slate-100",
          };
        case "other_help":
          return {
            activeClass:
              "border-transparent bg-gradient-to-r from-slate-500 to-zinc-700 text-white shadow-md shadow-black/15 dark:from-slate-600 dark:to-zinc-800",
            idleRing:
              "border-slate-200/80 bg-slate-100/60 text-slate-900 hover:bg-slate-100 dark:border-zinc-600/50 dark:bg-zinc-800/60 dark:text-zinc-100",
          };
        default:
          return {
            activeClass:
              "border-transparent bg-primary text-primary-foreground shadow-md",
            idleRing: "border-border bg-muted/60 text-foreground",
          };
      }
    })();
    return {
      id: c.id,
      label: c.label,
      Icon: ICONS[c.id],
      ...base,
    };
  }),
];

export interface PublicPostsCategoryTabsProps {
  activeId: DiscoverHomeCategoryId;
  onSelect: (id: DiscoverHomeCategoryId) => void;
  className?: string;
}

/** Icon + label chips to filter `/public/posts?category=`. */
export function PublicPostsCategoryTabs({
  activeId,
  onSelect,
  className,
}: PublicPostsCategoryTabsProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:block",
        className,
      )}
      role="tablist"
      aria-label="Availability categories"
    >
      {TAB_DEFS.map((tab) => {
        const selected = tab.id === activeId;
        const Icon = tab.Icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2.5 text-left text-xs font-black transition-all sm:px-3.5 sm:text-[13px] md:gap-2.5 md:py-3",
              selected
                ? tab.activeClass
                : cn("border bg-transparent", tab.idleRing),
              "dark:border-transparent",
            )}
          >
            <Icon
              className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="max-w-[6.25rem] truncate sm:max-w-none">
              {t(`feed.categories.${tab.id}`, tab.label)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
