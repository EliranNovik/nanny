import type { NavigateFunction } from "react-router-dom";
import {
  getLastCategory,
  setLastCategory,
  hasProfileCoords,
} from "@/lib/discoverMatchPreferences";
import { trackEvent } from "@/lib/analytics";

type Profile = {
  role?: string;
  service_radius?: unknown;
  location_lat?: unknown;
  location_lng?: unknown;
} | null;


/** Client — full helpers directory / search (Find helpers), not swipe match. */
export function navigateToHelpersBrowse(navigate: NavigateFunction): void {
  trackEvent("discover_helpers_browse", {});
  navigate("/client/helpers");
}

/** Shared with Discover home — helpers match with optional category + GPS from profile. */
export function navigateToHelpersMatch(
  navigate: NavigateFunction,
  profile: Profile,
): void {
  trackEvent("discover_secondary_helpers_match", {});
  const radiusKm = (() => {
    const r =
      profile?.service_radius != null ? Number(profile.service_radius) : 25;
    if (Number.isNaN(r)) return 25;
    return Math.min(100, Math.max(5, Math.round(r / 5) * 5));
  })();
  if (hasProfileCoords(profile) && profile) {
    const last = getLastCategory("hire");
    if (last) {
      setLastCategory("hire", last);
      const lat = Number(profile.location_lat);
      const lng = Number(profile.location_lng);
      const p = new URLSearchParams();
      p.set("category", last);
      p.set("lat", String(lat));
      p.set("lng", String(lng));
      p.set("radius", String(radiusKm));
      navigate(`/client/helpers/match?${p.toString()}`);
      return;
    }
  }
  navigate("/client/helpers/match");
}

/** Freelancer — jobs match with category + GPS when possible. */
export function navigateToJobsMatch(
  navigate: NavigateFunction,
  profile: Profile,
): void {
  trackEvent("discover_secondary_jobs_match", {});
  const radiusKm = (() => {
    const r =
      profile?.service_radius != null ? Number(profile.service_radius) : 25;
    if (Number.isNaN(r)) return 25;
    return Math.min(100, Math.max(5, Math.round(r / 5) * 5));
  })();
  if (hasProfileCoords(profile) && profile) {
    const last = getLastCategory("work");
    if (last) {
      setLastCategory("work", last);
      const lat = Number(profile.location_lat);
      const lng = Number(profile.location_lng);
      const p = new URLSearchParams();
      p.set("category", last);
      p.set("lat", String(lat));
      p.set("lng", String(lng));
      p.set("radius", String(radiusKm));
      navigate(`/freelancer/jobs/match?${p.toString()}`);
      return;
    }
  }
  navigate("/freelancer/jobs/match");
}

/**
 * “Help others” browse: same match entry for freelancers; others land on Find jobs / match
 * (open help requests come from job_requests, not community availability posts).
 */
export function navigateToWorkBrowseRequests(
  navigate: NavigateFunction,
  profile: Profile,
): void {
  if (profile?.role === "freelancer") {
    navigateToJobsMatch(navigate, profile);
    return;
  }
  trackEvent("discover_browse_open_help_requests", {});
  navigate("/freelancer/jobs/match");
}
