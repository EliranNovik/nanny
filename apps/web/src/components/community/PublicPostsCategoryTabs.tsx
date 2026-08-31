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
import {
  communityFeedFilterActiveBadgeClass,
  communityFeedFilterIdleBadgeClass,
} from "@/components/community/communityFeedBadgeClasses";

const ICONS: Record<DiscoverHomeCategoryId, LucideIcon> = {
  [ALL_HELP_CATEGORY_ID]: LayoutGrid,
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  technical_help: Wrench,
  other_help: HelpCircle,
};

const TAB_DEFS: { id: DiscoverHomeCategoryId; label: string; Icon: LucideIcon }[] = [
  { id: ALL_HELP_CATEGORY_ID, label: "All help", Icon: ICONS[ALL_HELP_CATEGORY_ID] },
  ...SERVICE_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    Icon: ICONS[c.id],
  })),
];

export interface PublicPostsCategoryTabsProps {
  activeId: DiscoverHomeCategoryId;
  onSelect: (id: DiscoverHomeCategoryId) => void;
  className?: string;
  /** Compact chips for a top header bar. */
  dense?: boolean;
  /** Left-align chips so a horizontal scroller can show every item. */
  startAligned?: boolean;
  /** Light grey chips (guest feed header) matching profile cards. */
  lightGrey?: boolean;
}

/** Icon + label chips to filter `/public/posts?category=`. */
export function PublicPostsCategoryTabs({
  activeId,
  onSelect,
  className,
  dense = false,
  startAligned = false,
}: PublicPostsCategoryTabsProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-nowrap",
        startAligned
          ? "w-max justify-start gap-2"
          : "gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        !startAligned &&
          (dense
            ? "justify-center gap-1.5 pb-0 pt-0"
            : "-mx-1 pb-1 pt-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:block"),
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
              "inline-flex shrink-0 snap-start items-center text-left transition-all",
              dense
                ? "gap-2 rounded-full border-0 px-3.5 py-2.5 text-[13px] font-bold sm:px-3.5 sm:text-[13px]"
                : "gap-2 rounded-full px-3 py-2.5 text-xs font-black sm:px-3.5 sm:text-[13px] md:gap-2.5 md:py-3",
              selected
                ? communityFeedFilterActiveBadgeClass
                : communityFeedFilterIdleBadgeClass,
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                dense ? "h-5 w-5" : "h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]",
                selected
                  ? "text-zinc-800 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
            <span className={cn(dense ? "whitespace-nowrap" : "max-w-[6.25rem] truncate sm:max-w-none")}>
              {t(`feed.categories.${tab.id}`, tab.label)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
