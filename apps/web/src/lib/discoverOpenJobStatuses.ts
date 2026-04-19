/** Job is still in the “open request” phase (matches client dashboard / jobs counts). */
export const DISCOVER_OPEN_JOB_STATUSES = new Set([
  "ready",
  "notifying",
  "confirmations_closed",
]);

export function isJobOpenForDiscoverListing(
  status: string | null | undefined,
): boolean {
  if (status == null || status === "") return false;
  return DISCOVER_OPEN_JOB_STATUSES.has(status);
}
