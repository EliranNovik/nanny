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

/** Chip styling for create-request / compose when options. */
export function requestHelpWhenOptionButtonClass(
  selected: boolean,
  option: RequestHelpTimeframe,
): string {
  if (selected) {
    return option === "now"
      ? "bg-red-600 border-transparent text-white dark:bg-red-700 shadow-sm shadow-red-900/25"
      : "bg-emerald-600 border-transparent text-white dark:bg-emerald-700 shadow-sm";
  }
  if (option === "now") {
    return "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/45";
  }
  return "bg-muted/40 border-input text-foreground hover:bg-muted/60 dark:bg-zinc-800/60";
}
