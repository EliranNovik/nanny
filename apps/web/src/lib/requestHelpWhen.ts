export type RequestHelpTimeframe =
  | "now"
  | "today"
  | "tomorrow"
  | "this_week"
  | "custom";

export const REQUEST_HELP_WHEN_OPTIONS: {
  id: RequestHelpTimeframe;
  label: string;
}[] = [
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "This week" },
  { id: "custom", label: "Custom" },
];

export function isRequestHelpWhenUrgent(
  timeframe: string | null | undefined,
): boolean {
  return timeframe === "now";
}

/** Visible window after post creation (hours). */
export const REQUEST_HELP_WHEN_EXPIRY_HOURS: Partial<
  Record<RequestHelpTimeframe, number>
> = {
  now: 24,
  today: 24,
  tomorrow: 48,
};

export function requestHelpWhenHasExpiryWindow(
  timeframe: string | null | undefined,
): timeframe is RequestHelpTimeframe {
  if (!timeframe) return false;
  return timeframe in REQUEST_HELP_WHEN_EXPIRY_HOURS;
}

export function requestHelpWhenExpiresAt(
  timeframe: string | null | undefined,
  createdAt: string | Date,
): Date | null {
  if (!requestHelpWhenHasExpiryWindow(timeframe)) return null;
  const hours = REQUEST_HELP_WHEN_EXPIRY_HOURS[timeframe];
  if (!hours) return null;
  const created =
    typeof createdAt === "string" ? new Date(createdAt) : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + hours * 60 * 60 * 1000);
}

export function isRequestHelpWhenExpired(
  timeframe: string | null | undefined,
  createdAt: string | Date,
  now: Date = new Date(),
): boolean {
  const expiresAt = requestHelpWhenExpiresAt(timeframe, createdAt);
  if (!expiresAt) return false;
  return now.getTime() > expiresAt.getTime();
}

export function requestHelpWhenLabel(metadata: {
  timeframe?: string | null;
  custom_when?: string | null;
}): string | null {
  if (!metadata.timeframe) return null;
  if (metadata.timeframe === "custom" && metadata.custom_when) {
    return metadata.custom_when;
  }
  const labels: Record<string, string> = {
    now: "Now",
    today: "Today",
    tomorrow: "Tomorrow",
    this_week: "This week",
    custom: "Custom",
  };
  return labels[metadata.timeframe] ?? metadata.timeframe.replace(/_/g, " ");
}

import {
  requestPostComposeSelectedClass,
  requestPostComposeUnselectedClass,
} from "@/lib/requestPostTheme";

/** Chip styling for create-request / compose when options. */
export function requestHelpWhenOptionButtonClass(
  selected: boolean,
  option: RequestHelpTimeframe,
): string {
  if (selected) {
    return option === "now"
      ? requestPostComposeSelectedClass
      : "bg-emerald-600 border-transparent text-white dark:bg-emerald-700 shadow-sm";
  }
  if (option === "now") {
    return requestPostComposeUnselectedClass;
  }
  return "bg-muted/40 border-input text-foreground hover:bg-muted/60 dark:bg-zinc-800/60";
}
