/** Canonical job / request service types — align with job_requests.service_type and the create flow. */

export const SERVICE_CATEGORY_IDS = [
  "cleaning",
  "cooking",
  "pickup_delivery",
  "nanny",
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
    id: "other_help",
    label: "Other help",
    description: "Repairs & more",
    imageSrc: "/other-mar22.png",
  },
];

export function isServiceCategoryId(value: string | null | undefined): value is ServiceCategoryId {
  return !!value && (SERVICE_CATEGORY_IDS as readonly string[]).includes(value);
}

export function serviceCategoryLabel(id: ServiceCategoryId): string {
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
