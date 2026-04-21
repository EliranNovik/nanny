/**
 * True when the helper should show as “available now” for matching / maps / Discover.
 *
 * - If `live_until` is set (go-live flow): only active while `live_until` is in the future.
 * - If `live_until` is null: fall back to manual `available_now` (profile toggle).
 */
export function isFreelancerLiveWindowActive(
  fp:
    | {
        live_until?: string | null;
        available_now?: boolean | null;
      }
    | null
    | undefined,
): boolean {
  if (!fp) return false;
  const until = fp.live_until;
  if (until != null && String(until).trim() !== "") {
    const t = new Date(until).getTime();
    if (Number.isNaN(t)) return fp.available_now === true;
    return t > Date.now();
  }
  return fp.available_now === true;
}

/**
 * Find helpers / strict “go live”: only users who used the 24h flow and `live_until` is still in the future.
 * Ignores manual `available_now` without a timed window.
 */
export function isFreelancerInActive24hLiveWindow(
  fp:
    | {
        live_until?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!fp) return false;
  const until = fp.live_until;
  if (until == null || String(until).trim() === "") return false;
  const t = new Date(until).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}
