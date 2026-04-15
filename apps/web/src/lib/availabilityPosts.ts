/**
 * When the freelancer is available — each option maps to a different expiry window.
 * (Two “expiration families”: short 2h vs day-length 24h vs multi-day 48h.)
 */
export const AVAILABILITY_STATUS_OPTIONS = [
  { id: "now", label: "Available now", hours: 2 },
  { id: "later_today", label: "Available later today", hours: 24 },
  { id: "this_week", label: "Available this week", hours: 48 },
] as const;

export type AvailabilityStatusId =
  (typeof AVAILABILITY_STATUS_OPTIONS)[number]["id"];

export function getAvailabilityStatusOption(id: string) {
  return AVAILABILITY_STATUS_OPTIONS.find((o) => o.id === id) ?? null;
}

/** Hours until expiry for a given status (2, 24, or 48). */
export function getExpiryHoursForStatus(statusId: string): number | null {
  const o = getAvailabilityStatusOption(statusId);
  return o ? o.hours : null;
}

export const QUICK_DETAILS_OPTIONS = [
  { id: "1_2h", label: "1–2 hours" },
  { id: "full_day", label: "Full day" },
  { id: "emergency", label: "Emergency job" },
  { id: "recurring", label: "Recurring" },
] as const;

export type QuickDetailsId = (typeof QUICK_DETAILS_OPTIONS)[number]["id"];

export function getQuickDetailsOption(id: string) {
  return QUICK_DETAILS_OPTIONS.find((o) => o.id === id) ?? null;
}

/** Slider bounds for hourly rate hint (₪/h). */
export const PRICE_RANGE_MIN = 30;
export const PRICE_RANGE_MAX = 150;
export const PRICE_RANGE_STEP = 5;

export type PriceRangePerHour = { min: number; max: number };

export type AvailabilityPayload = {
  availability_status?: AvailabilityStatusId | string;
  quick_details?: QuickDetailsId | string;
  /** Preferred: min–max hourly rate shown to clients */
  price_range_per_hour?: PriceRangePerHour | null;
  /** Legacy single value (older posts) */
  price_hint_per_hour?: number | null;
  duration_preset?: string;
  area_tag?: string | null;
};

export function buildAvailabilityDisplayTitle(parts: {
  categoryLabel: string;
  statusLabel: string;
  quickLabel: string;
  priceRangePerHour: PriceRangePerHour | null;
  legacyPriceHintPerHour?: number | null;
}): string {
  let price = "";
  if (
    parts.priceRangePerHour &&
    parts.priceRangePerHour.min <= parts.priceRangePerHour.max
  ) {
    price = ` · ₪${parts.priceRangePerHour.min}–₪${parts.priceRangePerHour.max}/h`;
  } else if (parts.legacyPriceHintPerHour != null) {
    price = ` · ~₪${parts.legacyPriceHintPerHour}/h`;
  }
  return `${parts.categoryLabel} · ${parts.statusLabel} · ${parts.quickLabel}${price}`;
}

/** Badge / single-line label for feed cards (range, legacy single, or null). */
export function formatPriceHintFromPayload(
  p: AvailabilityPayload | null | undefined,
): string | null {
  if (!p) return null;
  const r = p.price_range_per_hour;
  if (
    r &&
    typeof r.min === "number" &&
    typeof r.max === "number" &&
    r.min <= r.max
  ) {
    return `₪${r.min}–₪${r.max}/h`;
  }
  if (p.price_hint_per_hour != null) return `~₪${p.price_hint_per_hour}/h`;
  return null;
}

/** ISO string for expires_at from status (2h / 24h / 48h). */
export function computeExpiresAtIsoFromStatus(statusId: string): string | null {
  const hours = getExpiryHoursForStatus(statusId);
  if (hours == null) return null;
  return computeExpiresAtIso(hours);
}

/** ISO string for expires_at from preset hours from now */
export function computeExpiresAtIso(hours: number): string {
  const ms = Math.max(1, hours) * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

/** Legacy: old duration preset list (for displaying historic posts). */
export const AVAILABILITY_DURATION_PRESETS_LEGACY = [
  { id: "2h", label: "2 hours", hours: 2 },
  { id: "6h", label: "6 hours", hours: 6 },
  { id: "24h", label: "24 hours", hours: 24 },
  { id: "72h", label: "3 days", hours: 72 },
] as const;

export function getDurationPresetLegacy(id: string) {
  return AVAILABILITY_DURATION_PRESETS_LEGACY.find((p) => p.id === id) ?? null;
}
