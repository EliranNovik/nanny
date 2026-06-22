import type { LucideIcon } from "lucide-react";
import {
  Baby,
  HelpCircle,
  Sparkles,
  Truck,
  UtensilsCrossed,
  Wrench,
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
    /** Icon on light frosted post badges (always saturated — no dark: variants). */
    badgeIconClass: string;
  }
> = {
  cleaning: {
    Icon: Sparkles,
    tileClass:
      "bg-emerald-500/[0.08] ring-emerald-500/20 dark:bg-emerald-500/10 dark:ring-emerald-400/25",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeIconClass: "text-emerald-700",
  },
  cooking: {
    Icon: UtensilsCrossed,
    tileClass:
      "bg-amber-500/[0.08] ring-amber-500/20 dark:bg-amber-500/10 dark:ring-amber-400/25",
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeIconClass: "text-amber-700",
  },
  pickup_delivery: {
    Icon: Truck,
    tileClass:
      "bg-violet-500/[0.08] ring-violet-500/20 dark:bg-violet-500/10 dark:ring-violet-400/25",
    iconClass: "text-violet-600 dark:text-violet-400",
    badgeIconClass: "text-violet-700",
  },
  nanny: {
    Icon: Baby,
    tileClass:
      "bg-sky-500/[0.08] ring-sky-500/20 dark:bg-sky-500/10 dark:ring-sky-400/25",
    iconClass: "text-sky-600 dark:text-sky-400",
    badgeIconClass: "text-sky-700",
  },
  technical_help: {
    Icon: Wrench,
    tileClass:
      "bg-slate-500/[0.08] ring-slate-400/25 dark:bg-slate-500/15 dark:ring-slate-500/30",
    iconClass: "text-slate-700 dark:text-slate-300",
    badgeIconClass: "text-slate-700",
  },
  other_help: {
    Icon: HelpCircle,
    tileClass:
      "bg-zinc-500/[0.08] ring-zinc-400/25 dark:bg-zinc-500/15 dark:ring-zinc-500/30",
    iconClass: "text-zinc-700 dark:text-zinc-300",
    badgeIconClass: "text-zinc-700",
  },
};
