import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { isJobOpenForDiscoverListing } from "@/lib/discoverOpenJobStatuses";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";

const DEFAULT_LIMIT = 8;

/** Row from get_discover_open_help_requests — create-request flow, not community availability. */
export type DiscoverOpenHelpRequestRow = {
  id: string;
  service_type: string | null;
  location_city: string | null;
  start_at: string | null;
  created_at: string | null;
  shift_hours: string | null;
  time_duration: string | null;
  care_type: string | null;
  care_frequency: string | null;
  client_photo_url: string | null;
  client_display_name: string | null;
  /** Present when RPC returns it — used to hide the viewer’s own requests client-side. */
  client_id?: string | null;
  /** Enriched client rating (fetched from profiles when client_id exists). */
  client_average_rating?: number | null;
  /** Enriched client reviews count (fetched from profiles when client_id exists). */
  client_total_ratings?: number | null;
  /** job_requests.status — filter to open-only when present. */
  status?: string | null;
  client_avg_reply_seconds?: number | null;
  client_reply_sample_count?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
};

/**
 * Open help requests posted via “I need help” / client create flow (community_post_id is null).
 * Pass the signed-in user id to exclude their own requests from the list.
 */
export function useDiscoverOpenHelpRequests(
  enabled: boolean,
  excludeUserId?: string | null,
) {
  const queryClient = useQueryClient();
  const qk = queryKeys.discoverOpenHelpRequests(excludeUserId ?? undefined);

  useRealtimeSubscription(
    { table: "job_requests", event: "*", enabled },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    }
  );

  return useQuery({
    queryKey: qk,
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<DiscoverOpenHelpRequestRow[]> => {
      // Single-arg RPC matches PostgREST + deployed DB (see db/sql/052 / 054). Exclude own rows via client_id when present.
      const { data, error } = await supabase.rpc(
        "get_discover_open_help_requests",
        { p_limit: DEFAULT_LIMIT },
      );
      if (error) throw error;
      let rows = (data || []) as DiscoverOpenHelpRequestRow[];
      rows = rows.filter((r) => {
        if (r.status == null || r.status === "") return true;
        return isJobOpenForDiscoverListing(String(r.status));
      });
      if (excludeUserId) {
        rows = rows.filter(
          (r) => !r.client_id || r.client_id !== excludeUserId,
        );
      }

      const clientIds = Array.from(
        new Set(
          rows
            .map((r) => (r.client_id || "").trim())
            .filter(Boolean),
        ),
      );
      if (clientIds.length > 0) {
        const [profRes, statsRes] = await Promise.all([
          supabase.from("profiles").select("id, average_rating, total_ratings").in("id", clientIds),
          supabase.rpc("get_client_chat_response_stats", { p_client_ids: clientIds }),
        ]);

        const { data: profs, error: profErr } = profRes;
        const { data: statsRows } = statsRes;

        const profMap = new Map<string, { average_rating: number | null; total_ratings: number | null }>();
        if (!profErr && profs && profs.length > 0) {
          for (const p of profs as Array<{ id: string; average_rating: number | null; total_ratings: number | null }>) {
            profMap.set(p.id, {
              average_rating: p.average_rating != null ? Number(p.average_rating) : null,
              total_ratings: p.total_ratings != null ? Number(p.total_ratings) : null,
            });
          }
        }

        const statsMap = new Map<string, { avg_seconds: number; sample_count: number }>();
        if (Array.isArray(statsRows)) {
          for (const r of statsRows) {
            if (r.client_id && r.avg_seconds != null && r.sample_count != null) {
              statsMap.set(r.client_id, {
                avg_seconds: Number(r.avg_seconds),
                sample_count: Number(r.sample_count),
              });
            }
          }
        }

        const jobIds = rows.map((r) => r.id);
        const { data: jobLocations } = await supabase
          .from("job_requests")
          .select("id, location_lat, location_lng")
          .in("id", jobIds);

        const locationMap = new Map<string, { lat: number | null; lng: number | null }>();
        if (jobLocations) {
          for (const loc of jobLocations) {
            locationMap.set(loc.id, { lat: loc.location_lat, lng: loc.location_lng });
          }
        }

        rows = rows.map((r) => {
          const id = (r.client_id || "").trim();
          const hit = id ? profMap.get(id) : undefined;
          const statHit = id ? statsMap.get(id) : undefined;
          const locHit = locationMap.get(r.id);
          return {
            ...r,
            client_average_rating: hit?.average_rating ?? null,
            client_total_ratings: hit?.total_ratings ?? null,
            client_avg_reply_seconds: statHit?.avg_seconds ?? null,
            client_reply_sample_count: statHit?.sample_count ?? null,
            location_lat: locHit?.lat ?? null,
            location_lng: locHit?.lng ?? null,
          };
        });
      } else {
        const jobIds = rows.map((r) => r.id);
        const { data: jobLocations } = await supabase
          .from("job_requests")
          .select("id, location_lat, location_lng")
          .in("id", jobIds);
        
        const locationMap = new Map<string, { lat: number | null; lng: number | null }>();
        if (jobLocations) {
          for (const loc of jobLocations) {
            locationMap.set(loc.id, { lat: loc.location_lat, lng: loc.location_lng });
          }
        }
        rows = rows.map((r) => {
          const locHit = locationMap.get(r.id);
          return {
            ...r,
            location_lat: locHit?.lat ?? null,
            location_lng: locHit?.lng ?? null,
          };
        });
      }
      return rows;
    },
  });
}
