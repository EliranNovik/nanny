import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import type { FeedPickupRoute } from "@/lib/globalFeedPostUi";
import {
  formatOpenHelpRequestBudget,
  formatOpenHelpRequestWhen,
  prettyDurationLabel,
} from "@/lib/openHelpRequestDisplay";

export type IsolatedFeedDetailKind =
  | "location"
  | "from"
  | "to"
  | "when"
  | "schedule"
  | "duration"
  | "shift"
  | "careType"
  | "frequency"
  | "budget"
  | "rate"
  | "people"
  | "kids"
  | "task"
  | "notes";

export type IsolatedFeedDetailRow = {
  key: string;
  kind: IsolatedFeedDetailKind;
  value: string;
  token?: string | null;
  dateIso?: string | null;
};

function humanize(value: string): string {
  return value.trim().replace(/(\d)_+(\d)/g, "$1-$2").replace(/_/g, " ");
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

const SKIP_DETAIL_KEYS = new Set([
  "from_lat",
  "from_lng",
  "to_lat",
  "to_lng",
  "fromlat",
  "fromlng",
  "tolat",
  "tolng",
  "pickup_lat",
  "pickup_lng",
  "dropoff_lat",
  "dropoff_lng",
  "from_address",
  "to_address",
  "fromaddress",
  "toaddress",
  "images",
  "media_items",
  "other_type",
  "renewed_at",
  "renewedat",
]);

const NOTE_KEYS = new Set([
  "custom",
  "note",
  "notes",
  "details",
  "description",
  "message",
  "extra_info",
  "special_requests",
]);

function kindForServiceKey(key: string): IsolatedFeedDetailKind {
  const k = key.toLowerCase();
  if (k.includes("kid") || k.includes("child")) return "kids";
  if (k.includes("people") || k.includes("guest")) return "people";
  if (k.includes("clean") || k.includes("cook") || k.includes("task")) return "task";
  return "task";
}

function serviceDetailRows(
  details: Record<string, unknown> | null | undefined,
): IsolatedFeedDetailRow[] {
  if (!details) return [];
  const rows: IsolatedFeedDetailRow[] = [];
  for (const [rawKey, rawValue] of Object.entries(details)) {
    const key = rawKey.trim();
    if (!key || SKIP_DETAIL_KEYS.has(key.toLowerCase())) continue;
    if (NOTE_KEYS.has(key.toLowerCase())) continue;
    if (rawValue == null || rawValue === "") continue;
    if (Array.isArray(rawValue)) continue;
    if (typeof rawValue === "boolean") {
      rows.push({
        key: `sd-${key}`,
        kind: kindForServiceKey(key),
        value: `${humanize(key)}: ${rawValue ? "Yes" : "No"}`,
      });
      continue;
    }
    const stringVal = asTrimmedString(rawValue);
    if (!stringVal) continue;
    const label = humanize(key).replace(/\bcount\b/gi, "").trim();
    rows.push({
      key: `sd-${key}`,
      kind: kindForServiceKey(key),
      value: label ? `${label}: ${humanize(stringVal)}` : humanize(stringVal),
    });
  }
  return rows;
}

export function isolatedFeedDetailRows(input: {
  source: "post" | "job_request" | "availability";
  postTypeId: string | null;
  metadata?: Record<string, unknown> | null;
  caption?: string | null;
  row?: DiscoverOpenHelpRequestRow;
  locationLine: string | null;
  whenLabel: string | null;
  pickupRoute: FeedPickupRoute | null;
  rateTypeLabel: string | null;
}): IsolatedFeedDetailRow[] {
  const {
    source,
    postTypeId,
    metadata,
    caption,
    row,
    locationLine,
    whenLabel,
    pickupRoute,
    rateTypeLabel,
  } = input;
  const rows: IsolatedFeedDetailRow[] = [];
  const seen = new Set<string>();

  const push = (rowItem: IsolatedFeedDetailRow) => {
    const normalized = rowItem.value.trim().toLowerCase();
    if (!normalized || seen.has(`${rowItem.kind}:${normalized}`)) return;
    seen.add(`${rowItem.kind}:${normalized}`);
    rows.push(rowItem);
  };

  if (locationLine) {
    push({ key: "location", kind: "location", value: locationLine });
  }
  if (pickupRoute?.from_address?.trim()) {
    push({
      key: "from",
      kind: "from",
      value: pickupRoute.from_address.trim(),
    });
  }
  if (pickupRoute?.to_address?.trim()) {
    push({
      key: "to",
      kind: "to",
      value: pickupRoute.to_address.trim(),
    });
  }
  const whenFromRow = row ? formatOpenHelpRequestWhen(row) : null;
  if (whenFromRow) {
    push({
      key: "when",
      kind: "when",
      value: whenFromRow,
      token: row?.when_timeframe ?? null,
      dateIso:
        row?.when_timeframe === "custom" && row.custom_when_at
          ? row.custom_when_at
          : null,
    });
  } else if (whenLabel) {
    const metaWhen =
      typeof metadata?.when_timeframe === "string" ? metadata.when_timeframe : null;
    const metaCustom =
      typeof metadata?.custom_when_at === "string" ? metadata.custom_when_at : null;
    push({
      key: "when",
      kind: "when",
      value: whenLabel,
      token: metaWhen,
      dateIso: metaWhen === "custom" && metaCustom ? metaCustom : null,
    });
  }

  if (row?.start_at) {
    const start = new Date(row.start_at);
    if (!Number.isNaN(start.getTime())) {
      push({
        key: "schedule",
        kind: "schedule",
        value: start.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        dateIso: row.start_at,
      });
    }
  }

  const durationToken =
    asTrimmedString(row?.time_duration) ||
    asTrimmedString(metadata?.time_duration);
  const duration = prettyDurationLabel(durationToken);
  if (duration) {
    push({
      key: "duration",
      kind: "duration",
      value: duration,
      token: durationToken,
    });
  }

  const shiftToken = asTrimmedString(row?.shift_hours);
  const shift = prettyDurationLabel(shiftToken);
  if (shift) {
    push({ key: "shift", kind: "shift", value: shift, token: shiftToken });
  }

  const careType = asTrimmedString(row?.care_type);
  if (careType) {
    push({
      key: "careType",
      kind: "careType",
      value: humanize(careType),
      token: careType,
    });
  }

  const frequency = asTrimmedString(row?.care_frequency);
  if (frequency) {
    push({
      key: "frequency",
      kind: "frequency",
      value: humanize(frequency),
      token: frequency,
    });
  }

  for (const extra of serviceDetailRows(
    row?.service_details ??
      (metadata?.service_details && typeof metadata.service_details === "object"
        ? (metadata.service_details as Record<string, unknown>)
        : null),
  )) {
    push(extra);
  }

  if (source === "job_request" && row) {
    const budget = formatOpenHelpRequestBudget(row);
    if (budget) {
      push({
        key: "budget",
        kind: "budget",
        value: rateTypeLabel ? `${budget} ${rateTypeLabel}` : budget,
      });
    }
  } else if (postTypeId === "request_help" && metadata?.budget != null && metadata.budget !== "") {
    push({
      key: "budget",
      kind: "budget",
      value: rateTypeLabel
        ? `₪${metadata.budget} ${rateTypeLabel}`
        : `₪${metadata.budget}`,
    });
  } else if (postTypeId === "offer_service" && metadata?.rate != null && metadata.rate !== "") {
    push({
      key: "rate",
      kind: "rate",
      value: rateTypeLabel
        ? `₪${metadata.rate} ${rateTypeLabel}`
        : `₪${metadata.rate}`,
    });
  }

  const notes = asTrimmedString(row?.notes);
  const captionText = caption?.trim() ?? "";
  if (notes && notes !== captionText) {
    push({ key: "notes", kind: "notes", value: notes });
  }

  return rows;
}
