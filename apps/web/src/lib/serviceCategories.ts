/** Canonical job / request service types — align with job_requests.service_type and the create flow. */

export const SERVICE_CATEGORY_IDS = [
  "cleaning",
  "cooking",
  "pickup_delivery",
  "nanny",
  "technical_help",
  "other_help",
] as const;

export type ServiceCategoryId = (typeof SERVICE_CATEGORY_IDS)[number];

export const SERVICE_CATEGORIES: {
  id: ServiceCategoryId;
  label: string;
  description: string;
  imageSrc: string;
}[] = [
  {
    id: "cleaning",
    label: "Cleaning",
    description: "Professional home care",
    imageSrc: "/cleaning-mar22.png",
  },
  {
    id: "cooking",
    label: "Cooking",
    description: "Meals at home",
    imageSrc: "/cooking-mar22.png",
  },
  {
    id: "pickup_delivery",
    label: "Pick up & delivery",
    description: "Errands & courier",
    imageSrc: "/pexels-roman-odintsov-12725452.jpg",
  },
  {
    id: "nanny",
    label: "Nanny",
    description: "Trusted childcare",
    imageSrc: "/nanny-mar22.png",
  },
  {
    id: "technical_help",
    label: "Technical Help",
    description: "Repairs & tech support",
    imageSrc: "/pexels-tima-miroshnichenko-6197046.jpg",
  },
  {
    id: "other_help",
    label: "Other help",
    description: "Anything else",
    imageSrc: "/other-mar22.png",
  },
];

/** Not a DB category — Discover-only tile that loads all posts (RPC with no filter). */
export const ALL_HELP_CATEGORY_ID = "all_help" as const;

export type DiscoverHomeCategoryId =
  | ServiceCategoryId
  | typeof ALL_HELP_CATEGORY_ID;

/** Discover home category grid: service types plus “All help”. */
export const DISCOVER_HOME_CATEGORIES: {
  id: DiscoverHomeCategoryId;
  label: string;
  description: string;
  imageSrc: string;
}[] = [
  ...SERVICE_CATEGORIES,
  {
    id: ALL_HELP_CATEGORY_ID,
    label: "All help",
    description: "Browse every category",
    imageSrc: "/pexels-rdne-6646861.jpg",
  },
];

export function isAllHelpCategory(value: string | null | undefined): boolean {
  return value === ALL_HELP_CATEGORY_ID;
}

export function isServiceCategoryId(
  value: string | null | undefined,
): value is ServiceCategoryId {
  return !!value && (SERVICE_CATEGORY_IDS as readonly string[]).includes(value);
}

export function getServiceCategoryImage(id?: string | null): string {
  if (!id) return "/pexels-rdne-6646861.jpg";
  return (
    SERVICE_CATEGORIES.find((c) => c.id === id)?.imageSrc ??
    "/pexels-rdne-6646861.jpg"
  );
}

export function serviceCategoryLabel(id?: string | null): string {
  if (!id) return "Help request";
  return (
    SERVICE_CATEGORIES.find((c) => c.id === id)?.label ??
    id.replace(/_/g, " ")
  );
}

/**
 * Subcategories shown when the user picks the `other_help` category.
 * These are a fixed list — when "Other" is chosen the user selects one of these
 * rather than typing a free-form category.
 */
export const OTHER_HELP_SUBCATEGORIES: { id: string; label: string }[] = [
  { id: "beauty_personal_care", label: "Beauty & Personal Care" },
  { id: "heavy_lifting_moving", label: "Heavy Lifting & Moving Help" },
  { id: "coaching_lessons", label: "Coaching & Lessons" },
  { id: "shopping_errands", label: "Shopping & Errands" },
  { id: "pet_help", label: "Pet Help" },
  { id: "elderly_help", label: "Elderly Help" },
  { id: "paperwork_bureaucracy", label: "Paperwork & Bureaucracy Help" },
  { id: "event_help", label: "Event Help" },
  { id: "home_maintenance", label: "Home Maintenance" },
  { id: "digital_creative", label: "Digital & Creative Help" },
  { id: "religious_community", label: "Religious / Community Help" },
];

/** Resolve an `other_help` subcategory id to its display label (null if unknown). */
export function otherHelpSubcategoryLabel(
  id?: string | null,
): string | null {
  if (!id) return null;
  return OTHER_HELP_SUBCATEGORIES.find((s) => s.id === id)?.label ?? null;
}

/**
 * When category is `other_help`, show the chosen subcategory label.
 * Accepts both new subcategory ids and legacy free-text values (shown as-is).
 */
export function postServiceCategoryLabel(
  categoryId?: string | null,
  customCategory?: string | null,
): string {
  if (categoryId === "other_help" && customCategory?.trim()) {
    const trimmed = customCategory.trim();
    return otherHelpSubcategoryLabel(trimmed) ?? trimmed;
  }
  return serviceCategoryLabel(categoryId);
}

export const CUSTOM_POST_CATEGORY_MAX_LEN = 15;
