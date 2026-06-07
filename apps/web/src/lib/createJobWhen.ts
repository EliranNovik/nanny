import { format } from "date-fns";
import { parseCustomWhenDateTime } from "@/lib/communityFeedFilters";
import type { RequestHelpTimeframe } from "@/lib/requestHelpWhen";

export function buildCustomWhenAtIso(
  date: Date,
  time: string,
): string | null {
  const parsed = parseCustomWhenDateTime(format(date, "yyyy-MM-dd"), time);
  return parsed?.toISOString() ?? null;
}

export function computeJobStartAtFromWhen(
  timeframe: RequestHelpTimeframe,
  customWhenAtIso: string | null,
): string {
  const now = new Date();

  switch (timeframe) {
    case "now":
      return now.toISOString();
    case "today": {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      return d.toISOString();
    }
    case "tomorrow": {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }
    case "this_week": {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }
    case "custom":
      return customWhenAtIso ?? now.toISOString();
    default:
      return now.toISOString();
  }
}
