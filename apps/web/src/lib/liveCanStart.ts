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

/**
 * Short reply-time fragment for tight UI (e.g. `respond 7m`) — no `~`, lowercase units
 * so `uppercase` CSS does not turn minutes into “M”.
 */
export function replyTimeCompactFragment(
  avgSeconds: number | null | undefined,
  sampleCount: number | null | undefined,
): string | null {
  void sampleCount;
  if (avgSeconds == null || !Number.isFinite(avgSeconds)) return null;
  if (avgSeconds <= 0) return null;
  if (avgSeconds >= 3600) return null;
  if (avgSeconds < 90) return `${Math.max(1, Math.round(avgSeconds))}s`;
  const mins = avgSeconds / 60;
  if (mins < 60) {
    const s = mins < 10 ? mins.toFixed(1) : String(Math.round(mins));
    return `${s.replace(/\.0$/, "")}m`;
  }
  return null;
}

/**
 * Compact reply-time for **client** cards (open requests, match preview).
 * Clients often reply slower than helpers; show up to ~48h like `respondsWithinFreelancerMatchCardLabel`, no `~` prefix.
 */
export function replyTimeCompactFragmentForClient(
  avgSeconds: number | null | undefined,
  sampleCount: number | null | undefined,
): string | null {
  void sampleCount;
  if (avgSeconds == null || !Number.isFinite(avgSeconds)) return null;
  if (avgSeconds <= 0) return null;
  const cap = 48 * 3600;
  if (avgSeconds >= cap) return null;
  if (avgSeconds < 90) return `${Math.max(1, Math.round(avgSeconds))}s`;
  if (avgSeconds < 3600) {
    const mins = avgSeconds / 60;
    const s = mins < 10 ? mins.toFixed(1) : String(Math.round(mins));
    return `${s.replace(/\.0$/, "")}m`;
  }
  const hrs = avgSeconds / 3600;
  if (hrs < 24) {
    const s = hrs < 10 ? hrs.toFixed(1) : String(Math.round(hrs));
    return `${s.replace(/\.0$/, "")}h`;
  }
  const days = avgSeconds / 86400;
  const s = days < 7 ? days.toFixed(1) : String(Math.round(days));
  return `${s.replace(/\.0$/, "")}d`;
}

/** Short “ready in …” fragment for badges, e.g. `ready 30m`. */
export function readyTimeCompactFragment(
  raw: string | null | undefined,
): string | null {
  if (!raw || !isLiveCanStartId(raw)) return null;
  const byId: Record<LiveCanStartId, string> = {
    immediate: "now",
    in_15_min: "15m",
    in_30_min: "30m",
    in_1_hour: "1h",
    later_today: "later",
  };
  return byId[raw];
}

/**
 * Same intent as `respondsWithinCardLabel`, but for freelancer job match when previewing
 * **clients**: clients often reply slower than helpers, so we show up to ~48h instead of hiding past 1h.
 */
export function respondsWithinFreelancerMatchCardLabel(
  avgSeconds: number | null | undefined,
  sampleCount: number | null | undefined,
): string | null {
  void sampleCount;
  if (avgSeconds == null || !Number.isFinite(avgSeconds)) return null;
  if (avgSeconds <= 0) return null;
  const cap = 48 * 3600;
  if (avgSeconds >= cap) return null;
  if (avgSeconds < 90) return `~${Math.max(1, Math.round(avgSeconds))}s`;
  if (avgSeconds < 3600) {
    const mins = avgSeconds / 60;
    const s = mins < 10 ? mins.toFixed(1) : String(Math.round(mins));
    return `~${s.replace(/\.0$/, "")}m`;
  }
  const hrs = avgSeconds / 3600;
  if (hrs < 24) {
    const s = hrs < 10 ? hrs.toFixed(1) : String(Math.round(hrs));
    return `~${s.replace(/\.0$/, "")}h`;
  }
  const days = avgSeconds / 86400;
  const s = days < 7 ? days.toFixed(1) : String(Math.round(days));
  return `~${s.replace(/\.0$/, "")}d`;
}

