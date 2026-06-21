import { format } from "date-fns";
import {
  isRequestHelpWhenExpired,
  isRequestHelpWhenUrgent,
  requestHelpWhenLabel,
  type RequestHelpTimeframe,
} from "@/lib/requestHelpWhen";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";

export function prettyDurationLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = String(label).trim();
  if (!trimmed) return null;
  return trimmed.replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
}

export function formatOpenHelpRequestBudget(job: {
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: string | null;
}): string | null {
  const min = job.budget_min;
  const max = job.budget_max;
  if (min == null && max == null) return null;

  const amount = min ?? max;
  if (amount == null) return null;

  if (max != null && min != null && max !== min) {
    return `₪${min}–${max}`;
  }

  return `₪${amount}`;
}

export function formatOpenHelpRequestWhen(job: {
  when_timeframe?: string | null;
  custom_when_at?: string | null;
}): string | null {
  if (!job.when_timeframe) return null;

  if (job.when_timeframe === "custom" && job.custom_when_at) {
    const parsed = new Date(job.custom_when_at);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "EEEE, MMMM d 'at' h:mm a");
    }
  }

  return requestHelpWhenLabel({ timeframe: job.when_timeframe });
}

export function openHelpRequestWhenBadgeLabel(
  timeframe: string | null | undefined,
): string | null {
  if (!timeframe) return null;
  const labels: Record<string, string> = {
    now: "Now",
    today: "Today",
    tomorrow: "Tomorrow",
    this_week: "This week",
    custom: "Custom",
  };
  return labels[timeframe] ?? timeframe.replace(/_/g, " ");
}

export function whenBadgeToneClass(timeframe: string | null | undefined): string {
  switch (timeframe) {
    case "now":
      return "border-0 bg-red-500/5 text-red-700 dark:bg-black/30 dark:text-red-300";
    case "today":
      return "border-0 bg-amber-500/5 text-amber-700 dark:bg-black/30 dark:text-amber-300";
    case "tomorrow":
      return "border-0 bg-sky-500/5 text-sky-700 dark:bg-black/30 dark:text-sky-300";
    case "this_week":
      return "border-0 bg-violet-500/5 text-violet-700 dark:bg-black/30 dark:text-violet-300";
    default:
      return "border-0 bg-zinc-500/5 text-muted-foreground dark:bg-black/30";
  }
}

export const requestHelpExpiredBadgeClass =
  "border-0 bg-neutral-600/90 text-white dark:bg-neutral-700/90";

export function isOpenHelpRequestWhenExpired(
  timeframe: string | null | undefined,
  createdAt: string | null | undefined,
): boolean {
  if (!timeframe || !createdAt) return false;
  return isRequestHelpWhenExpired(timeframe, createdAt);
}

export function categoryIconCircleClass(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").toLowerCase();
  if (k.includes("clean")) return "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25";
  if (k.includes("cook")) return "bg-orange-500 text-white shadow-lg shadow-orange-500/25";
  if (k.includes("nanny") || k.includes("bab")) return "bg-violet-500 text-white shadow-lg shadow-violet-500/25";
  if (k.includes("pickup") || k.includes("deliver")) return "bg-sky-500 text-white shadow-lg shadow-sky-500/25";
  return "bg-zinc-600 text-white shadow-lg shadow-zinc-600/20";
}

export function categoryAccentClass(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").toLowerCase();
  if (k.includes("clean")) return "text-emerald-600 dark:text-emerald-400";
  if (k.includes("cook")) return "text-orange-600 dark:text-orange-400";
  if (k.includes("nanny") || k.includes("bab")) return "text-violet-600 dark:text-violet-400";
  if (k.includes("pickup") || k.includes("deliver")) return "text-sky-600 dark:text-sky-400";
  return "text-zinc-600 dark:text-zinc-300";
}

export function categoryIconWrapClass(serviceType: string | null | undefined): string {
  const k = (serviceType ?? "").toLowerCase();
  if (k.includes("clean")) return "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (k.includes("cook")) return "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
  if (k.includes("nanny") || k.includes("bab")) return "bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
  if (k.includes("pickup") || k.includes("deliver")) return "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
  return "bg-muted text-muted-foreground";
}

function humanizeSnake(value: string): string {
  return value.trim().replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
}

export function serviceCategoryTitle(serviceType: string | null | undefined): string {
  if (serviceType && isServiceCategoryId(serviceType)) {
    return serviceCategoryLabel(serviceType as ServiceCategoryId);
  }
  const s = (serviceType || "").replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Help request";
}

export function openHelpRequestTitle(job: {
  service_type?: string | null;
  location_city?: string | null;
  when_timeframe?: string | null;
  ai_generated_copy?: unknown;
  notes?: string | null;
}): string {
  const generated = parseGeneratedPostCopy(job.ai_generated_copy);
  if (generated?.title) return generated.title;

  const service = serviceCategoryTitle(job.service_type ?? null).toLowerCase();
  const city = (job.location_city || "").trim();
  const when = job.when_timeframe as RequestHelpTimeframe | null | undefined;

  if (when === "now" && city) return `Need ${service} now in ${city}`;
  if (when === "today" && city) return `Need ${service} help today in ${city}`;
  if (when === "tomorrow" && city) return `Need ${service} help tomorrow in ${city}`;
  if (when === "this_week" && city) return `Need ${service} this week in ${city}`;
  if (city) return `Need ${service} in ${city}`;
  return serviceCategoryTitle(job.service_type ?? null);
}

export function openHelpRequestDescription(job: {
  notes?: string | null;
  service_details?: Record<string, unknown> | null;
  ai_generated_copy?: unknown;
}): string | null {
  const generated = parseGeneratedPostCopy(job.ai_generated_copy);
  if (generated?.short_text) return generated.short_text;

  const notes = job.notes?.trim();
  if (notes) return notes;

  const sd = job.service_details;
  if (!sd || typeof sd !== "object") return null;

  for (const key of ["description", "custom", "message", "details"]) {
    const val = sd[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }

  return null;
}

export function openHelpRequestDetailLine(job: {
  service_type?: string | null;
  service_details?: Record<string, unknown> | null;
}): string | null {
  const sd = job.service_details;
  if (!sd || typeof sd !== "object") return null;
  const type = (job.service_type ?? "").toLowerCase();

  if (type === "nanny" && typeof sd.kids_count === "string") {
    return `${humanizeSnake(sd.kids_count)} kids`;
  }
  if (type === "cooking" && typeof sd.people_count === "string") {
    return `${humanizeSnake(sd.people_count)} people`;
  }
  if (type === "cleaning" && typeof sd.cleaning_type === "string") {
    return humanizeSnake(sd.cleaning_type);
  }
  if (type === "pickup_delivery" && typeof sd.from_address === "string") {
    return "Pickup & delivery";
  }
  if (type === "other_help" && typeof sd.other_type === "string") {
    return humanizeSnake(sd.other_type);
  }

  return null;
}

export function openHelpRequestScheduleLine(job: {
  time_duration?: string | null;
  when_timeframe?: string | null;
  custom_when_at?: string | null;
}): string | null {
  const duration = prettyDurationLabel(job.time_duration);
  if (job.when_timeframe === "custom" && job.custom_when_at) {
    const parsed = new Date(job.custom_when_at);
    if (!Number.isNaN(parsed.getTime())) {
      const timePart = format(parsed, "HH:mm");
      return duration ? `${duration} · ${timePart}` : format(parsed, "h:mm a");
    }
  }

  if (duration) {
    if (job.when_timeframe === "today") return `${duration} · Today`;
    if (job.when_timeframe === "tomorrow") return `${duration} · Tomorrow`;
    if (job.when_timeframe === "this_week") return `${duration} · This week`;
    if (job.when_timeframe === "now") return `${duration} · Now`;
    return duration;
  }

  return formatOpenHelpRequestWhen(job);
}

export function isUrgentWhen(timeframe: string | null | undefined): boolean {
  return isRequestHelpWhenUrgent(timeframe);
}
