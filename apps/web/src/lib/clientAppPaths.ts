/**
 * Client helpers directory — same route as `App.tsx` `path="/client/helpers"` →
 * `apps/web/src/pages/client/HelpersPage.tsx`.
 */
export const CLIENT_HELPERS_PAGE_PATH = "/client/helpers" as const;

/** Query keys read by `HelpersPage` to open on a specific helper card. */
export const HELPERS_FOCUS_HELPER_QUERY = "focus_helper_id" as const;
export const HELPERS_FOCUS_LAT_QUERY = "focus_lat" as const;
export const HELPERS_FOCUS_LNG_QUERY = "focus_lng" as const;

/** Deep-link from discover (or elsewhere) into Find helpers on that helper’s card. */
export function buildHelpersPageUrlForFocusedHelper(
  helperUserId: string,
  anchor?: { lat: number | null | undefined; lng: number | null | undefined },
): string {
  const id = helperUserId.trim();
  if (!id) return CLIENT_HELPERS_PAGE_PATH;
  const p = new URLSearchParams();
  p.set(HELPERS_FOCUS_HELPER_QUERY, id);
  const la = anchor?.lat;
  const ln = anchor?.lng;
  if (
    la != null &&
    ln != null &&
    Number.isFinite(Number(la)) &&
    Number.isFinite(Number(ln))
  ) {
    p.set(HELPERS_FOCUS_LAT_QUERY, String(la));
    p.set(HELPERS_FOCUS_LNG_QUERY, String(ln));
  }
  return `${CLIENT_HELPERS_PAGE_PATH}?${p.toString()}`;
}
