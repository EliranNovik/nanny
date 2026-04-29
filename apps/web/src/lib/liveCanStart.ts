/** Saved on `freelancer_profiles.live_can_start_in` (24h go-live flow). */

export type LiveCanStartId =
  | "immediate"
  | "in_15_min"
  | "in_30_min"
  | "in_1_hour"
  | "later_today";

export const LIVE_CAN_START_OPTIONS: { id: LiveCanStartId; label: string }[] = [
  { id: "immediate", label: "Immediately" },
  { id: "in_15_min", label: "15 min" },
  { id: "in_30_min", label: "30 min" },
  { id: "in_1_hour", label: "1 hour" },
  { id: "later_today", label: "Later today" },
];

export function isLiveCanStartId(s: string): s is LiveCanStartId {
  return LIVE_CAN_START_OPTIONS.some((o) => o.id === s);
}

/** Short label for cards: "Can start in …" */
export function canStartInCardLabel(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const o = LIVE_CAN_START_OPTIONS.find((x) => x.id === raw);
  return o ? o.label : null;
}

/**
 * Avg seconds for replying after the other side messaged; show only if under 1 hour.
 * `sampleCount` is advisory (we still show with small samples so the badge appears during testing).
 */
export function respondsWithinCardLabel(
  avgSeconds: number | null | undefined,
  sampleCount: number | null | undefined,
): string | null {
  void sampleCount;
  if (avgSeconds == null || !Number.isFinite(avgSeconds)) return null;
  if (avgSeconds <= 0) return null;
  if (avgSeconds >= 3600) return null;
  if (avgSeconds < 90) return `~${Math.max(1, Math.round(avgSeconds))}s`;
  const mins = avgSeconds / 60;
  if (mins < 60) {
    const s = mins < 10 ? mins.toFixed(1) : String(Math.round(mins));
    return `~${s.replace(/\.0$/, "")}m`;
  }
  return null;
}

