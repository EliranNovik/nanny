import type { LucideIcon } from "lucide-react";
import {
  Baby,
  FileText,
  GraduationCap,
  Heart,
  HeartHandshake,
  HelpCircle,
  Home,
  Palette,
  PartyPopper,
  PawPrint,
  Scissors,
  ShoppingCart,
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

/** Icons for `other_help` subcategories (feed titles, compose, create-job). */
export const OTHER_HELP_SUBCATEGORY_UI: Record<
  string,
  { Icon: LucideIcon; iconClass: string; badgeIconClass: string }
> = {
  beauty_personal_care: {
    Icon: Scissors,
    iconClass: "text-pink-600 dark:text-pink-400",
    badgeIconClass: "text-pink-700",
  },
  heavy_lifting_moving: {
    Icon: Truck,
    iconClass: "text-slate-700 dark:text-slate-300",
    badgeIconClass: "text-slate-700",
  },
  coaching_lessons: {
    Icon: GraduationCap,
    iconClass: "text-indigo-600 dark:text-indigo-400",
    badgeIconClass: "text-indigo-700",
  },
  shopping_errands: {
    Icon: ShoppingCart,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeIconClass: "text-emerald-700",
  },
  pet_help: {
    Icon: PawPrint,
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeIconClass: "text-amber-700",
  },
  elderly_help: {
    Icon: Heart,
    iconClass: "text-red-600 dark:text-red-400",
    badgeIconClass: "text-red-700",
  },
  paperwork_bureaucracy: {
    Icon: FileText,
    iconClass: "text-blue-600 dark:text-blue-400",
    badgeIconClass: "text-blue-700",
  },
  event_help: {
    Icon: PartyPopper,
    iconClass: "text-fuchsia-600 dark:text-fuchsia-400",
    badgeIconClass: "text-fuchsia-700",
  },
  home_maintenance: {
    Icon: Home,
    iconClass: "text-orange-600 dark:text-orange-400",
    badgeIconClass: "text-orange-700",
  },
  digital_creative: {
    Icon: Palette,
    iconClass: "text-violet-600 dark:text-violet-400",
    badgeIconClass: "text-violet-700",
  },
  religious_community: {
    Icon: HeartHandshake,
    iconClass: "text-teal-600 dark:text-teal-400",
    badgeIconClass: "text-teal-700",
  },
};

/**
 * Prefer an Other-help subcategory id (`digital_creative`, `pet_help`, …)
 * when present, otherwise the main hire category.
 */
export function resolveHelpCategoryIconId(
  categoryId?: string | null,
  ...candidates: Array<string | null | undefined>
): string | null {
  const extras = candidates
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter(Boolean);
  const main = (categoryId || "").trim().toLowerCase();
  for (const id of extras) {
    if (OTHER_HELP_SUBCATEGORY_UI[id]) return id;
  }
  if (main && OTHER_HELP_SUBCATEGORY_UI[main]) return main;
  return main || extras[0] || null;
}

const CATEGORY_ILLUSTRATION_IDS = new Set([
  "cleaning",
  "cooking",
  "pickup_delivery",
  "nanny",
  "technical_help",
  "other_help",
  "beauty_personal_care",
  "heavy_lifting_moving",
  "coaching_lessons",
  "shopping_errands",
  "pet_help",
  "elderly_help",
  "paperwork_bureaucracy",
  "event_help",
  "home_maintenance",
  "digital_creative",
  "religious_community",
]);

export function helpCategoryIdFromServiceDetails(
  details?: Record<string, unknown> | null,
): string | null {
  if (!details) return null;
  for (const key of ["other_type", "custom_category", "subcategory"]) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** 3D category illustrations for text-only request cards. */
export function categoryIllustrationSrc(
  categoryId?: string | null,
  ...candidates: Array<string | null | undefined>
): string {
  const id = resolveHelpCategoryIconId(categoryId, ...candidates);
  if (id && CATEGORY_ILLUSTRATION_IDS.has(id)) {
    return `/category-icons/${id}.png`;
  }
  return "/category-icons/other_help.png";
}
