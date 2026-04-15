/** How the user is acting on the unified /jobs page */
export type JobsPerspective = "freelancer" | "client";

export const FREELANCER_TAB_IDS = [
  "requests",
  "pending",
  "jobs",
  "past",
] as const;
export type FreelancerJobsTabId = (typeof FREELANCER_TAB_IDS)[number];

export const CLIENT_TAB_IDS = ["my_requests", "jobs", "past"] as const;
export type ClientJobsTabId = (typeof CLIENT_TAB_IDS)[number];

export type UnifiedJobsTabId = FreelancerJobsTabId | ClientJobsTabId;

const STORAGE_KEY = "jobsPerspectivePreference";

export function readStoredPerspective(): JobsPerspective | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === "freelancer" || v === "client") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredPerspective(p: JobsPerspective) {
  try {
    sessionStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

export function defaultTabForPerspective(
  mode: JobsPerspective,
): UnifiedJobsTabId {
  return mode === "client" ? "my_requests" : "requests";
}

export function isTabValidForPerspective(
  mode: JobsPerspective,
  tab: string | null | undefined,
): tab is UnifiedJobsTabId {
  if (!tab) return false;
  if (mode === "client")
    return (CLIENT_TAB_IDS as readonly string[]).includes(tab);
  return (FREELANCER_TAB_IDS as readonly string[]).includes(tab);
}

/** Infer perspective from legacy ?tab= when ?mode= was missing */
export function inferPerspectiveFromTab(
  tab: string | null | undefined,
): JobsPerspective | null {
  if (!tab) return null;
  if (tab === "my_requests") return "client";
  if (tab === "requests" || tab === "pending") return "freelancer";
  if (tab === "jobs" || tab === "past") return readStoredPerspective();
  return null;
}

export function buildJobsUrl(mode: JobsPerspective, tab?: string) {
  const t =
    tab && isTabValidForPerspective(mode, tab)
      ? tab
      : defaultTabForPerspective(mode);
  return `/jobs?mode=${mode}&tab=${encodeURIComponent(t)}`;
}

/** Deep links from notifications / dashboard when only a tab id is known */
export function buildJobsUrlFromTabId(tabId: string): string {
  if (tabId === "my_requests") return buildJobsUrl("client", "my_requests");
  if (tabId === "requests" || tabId === "pending")
    return buildJobsUrl("freelancer", tabId);
  const m = readStoredPerspective() ?? "freelancer";
  return buildJobsUrl(m, tabId);
}
