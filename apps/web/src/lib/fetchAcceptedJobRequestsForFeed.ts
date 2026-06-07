import { supabase } from "@/lib/supabase";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";

type JobRequestDbRow = {
  id: string;
  service_type: string | null;
  location_city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  start_at: string | null;
  created_at: string | null;
  shift_hours: string | null;
  time_duration: string | null;
  care_type: string | null;
  care_frequency: string | null;
  client_id: string;
  status: string | null;
  service_details: Record<string, unknown> | null;
  notes: string | null;
  when_timeframe: string | null;
  custom_when_at: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_rate_type: string | null;
  ai_generated_copy: unknown;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  average_rating: number | null;
  total_ratings: number | null;
  is_verified: boolean | null;
};

function toDiscoverRow(
  job: JobRequestDbRow,
  profile?: ProfileRow,
): DiscoverOpenHelpRequestRow {
  return {
    id: job.id,
    service_type: job.service_type,
    location_city: job.location_city,
    location_lat: job.location_lat,
    location_lng: job.location_lng,
    start_at: job.start_at,
    created_at: job.created_at,
    shift_hours: job.shift_hours,
    time_duration: job.time_duration,
    care_type: job.care_type,
    care_frequency: job.care_frequency,
    client_id: job.client_id,
    client_photo_url: profile?.photo_url ?? null,
    client_display_name: profile?.full_name ?? null,
    client_average_rating: profile?.average_rating ?? null,
    client_total_ratings: profile?.total_ratings ?? null,
    is_verified: profile?.is_verified ?? null,
    status: job.status,
    service_details: job.service_details,
    notes: job.notes,
    when_timeframe: job.when_timeframe,
    custom_when_at: job.custom_when_at,
    budget_min: job.budget_min,
    budget_max: job.budget_max,
    budget_rate_type: job.budget_rate_type,
    ai_generated_copy: job.ai_generated_copy,
  };
}

/**
 * Job requests the viewer accepted (`job_confirmations.status = available`),
 * ordered by acceptance time (newest first by default).
 */
export async function fetchAcceptedJobRequestsForFeed(
  viewerUserId: string,
  sortOrder: "newest" | "oldest" = "newest",
): Promise<DiscoverOpenHelpRequestRow[]> {
  const { data: confirmations, error: confErr } = await supabase
    .from("job_confirmations")
    .select("job_id, created_at")
    .eq("freelancer_id", viewerUserId)
    .eq("status", "available")
    .order("created_at", { ascending: sortOrder === "oldest" })
    .limit(200);

  if (confErr) throw confErr;

  const orderedJobIds = (confirmations ?? []).map((r) => r.job_id as string);
  if (orderedJobIds.length === 0) return [];

  const { data: jobs, error: jobsErr } = await supabase
    .from("job_requests")
    .select(
      "id, service_type, location_city, location_lat, location_lng, start_at, created_at, shift_hours, time_duration, care_type, care_frequency, client_id, status, service_details, notes, when_timeframe, custom_when_at, budget_min, budget_max, budget_rate_type, ai_generated_copy",
    )
    .in("id", orderedJobIds)
    .is("community_post_id", null);

  if (jobsErr) throw jobsErr;

  const jobRows = (jobs ?? []) as JobRequestDbRow[];
  if (jobRows.length === 0) return [];

  const clientIds = [...new Set(jobRows.map((j) => j.client_id))];
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url, average_rating, total_ratings, is_verified")
    .in("id", clientIds);

  if (profErr) throw profErr;

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const byId = new Map(
    jobRows.map((job) => [
      job.id,
      toDiscoverRow(job, profileMap.get(job.client_id)),
    ]),
  );

  return orderedJobIds
    .map((id) => byId.get(id))
    .filter(Boolean) as DiscoverOpenHelpRequestRow[];
}

export async function fetchAcceptedRequestCount(viewerUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from("job_confirmations")
    .select("job_id", { count: "exact", head: true })
    .eq("freelancer_id", viewerUserId)
    .eq("status", "available");

  if (error) throw error;
  return count ?? 0;
}
