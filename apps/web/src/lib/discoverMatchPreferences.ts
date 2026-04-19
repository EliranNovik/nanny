import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { isServiceCategoryId } from "@/lib/serviceCategories";

const KEY_HIRE = "discover_last_category_hire_v1";
const KEY_WORK = "discover_last_category_work_v1";

export type DiscoverIntentTab = "hire" | "work";

export function getLastCategory(
  tab: DiscoverIntentTab,
): ServiceCategoryId | null {
  try {
    const key = tab === "hire" ? KEY_HIRE : KEY_WORK;
    const v = localStorage.getItem(key);
    if (v && isServiceCategoryId(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function setLastCategory(
  tab: DiscoverIntentTab,
  categoryId: ServiceCategoryId,
): void {
  try {
    const key = tab === "hire" ? KEY_HIRE : KEY_WORK;
    localStorage.setItem(key, categoryId);
  } catch {
    /* ignore */
  }
}

export function hasProfileCoords(profile: {
  location_lat?: unknown;
  location_lng?: unknown;
} | null): boolean {
  if (!profile) return false;
  const lat =
    profile.location_lat != null ? Number(profile.location_lat) : NaN;
  const lng =
    profile.location_lng != null ? Number(profile.location_lng) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng);
}
