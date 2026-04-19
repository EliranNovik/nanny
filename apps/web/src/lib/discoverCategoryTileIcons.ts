import type { LucideIcon } from "lucide-react";
import {
  Baby,
  HelpCircle,
  Sparkles,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import type { ServiceCategoryId } from "@/lib/serviceCategories";

/** Lucide + tile chrome for Discover “What do you need?” (no photos). */
export const HIRE_CATEGORY_TILE_UI: Record<
  ServiceCategoryId,
  {
    Icon: LucideIcon;
    /** Outer tile: light panel + ring */
    tileClass: string;
    /** Icon glyph color */
    iconClass: string;
  }
> = {
  cleaning: {
    Icon: Sparkles,
    tileClass:
      "bg-emerald-500/[0.08] ring-emerald-500/20 dark:bg-emerald-500/10 dark:ring-emerald-400/25",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  cooking: {
    Icon: UtensilsCrossed,
    tileClass:
      "bg-amber-500/[0.08] ring-amber-500/20 dark:bg-amber-500/10 dark:ring-amber-400/25",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  pickup_delivery: {
    Icon: Truck,
    tileClass:
      "bg-violet-500/[0.08] ring-violet-500/20 dark:bg-violet-500/10 dark:ring-violet-400/25",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  nanny: {
    Icon: Baby,
    tileClass:
      "bg-sky-500/[0.08] ring-sky-500/20 dark:bg-sky-500/10 dark:ring-sky-400/25",
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  other_help: {
    Icon: HelpCircle,
    tileClass:
      "bg-zinc-500/[0.08] ring-zinc-400/25 dark:bg-zinc-500/15 dark:ring-zinc-500/30",
    iconClass: "text-zinc-700 dark:text-zinc-300",
  },
};
