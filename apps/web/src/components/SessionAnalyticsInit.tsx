import { useEffect } from "react";
import { recordSessionStart } from "@/lib/sessionConversionAnalytics";

/** Marks session start for time-to-first-action (Section 8). */
export function SessionAnalyticsInit() {
  useEffect(() => {
    recordSessionStart();
  }, []);
  return null;
}
