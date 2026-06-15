const MAX_IDS = 400;

function storageKey(userId: string | null | undefined) {
  const scope = userId?.trim() || "guest";
  return `dismissed_open_help_requests_v1_${scope}`;
}

export function loadDismissedOpenHelpRequestIds(
  userId: string | null | undefined,
): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    const strings = arr.filter((x): x is string => typeof x === "string");
    return new Set(strings.slice(-MAX_IDS));
  } catch {
    return new Set();
  }
}

export function persistDismissedOpenHelpRequestIds(
  userId: string | null | undefined,
  ids: Set<string>,
): void {
  try {
    const arr = [...ids].slice(-MAX_IDS);
    localStorage.setItem(storageKey(userId), JSON.stringify(arr));
  } catch {
    /* ignore quota */
  }
}

export function rememberDismissedOpenHelpRequest(
  userId: string | null | undefined,
  jobId: string,
): void {
  const ids = loadDismissedOpenHelpRequestIds(userId);
  ids.add(jobId);
  persistDismissedOpenHelpRequestIds(userId, ids);
}
