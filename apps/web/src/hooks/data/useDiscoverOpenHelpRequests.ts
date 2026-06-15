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
  /** Present when RPC returns it — used to hide the viewer's own requests client-side. */
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
  is_verified?: boolean | null;
  /** From job_requests enrichment — job photos live in `images` */
  service_details?: Record<string, unknown> | null;
  /** From job_requests enrichment */
  notes?: string | null;
  when_timeframe?: string | null;
  custom_when_at?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: string | null;
  ai_generated_copy?: unknown;
};

/**
 * Open help requests posted via "I need help" / client create flow (community_post_id is null).
 * Pass the signed-in user id to exclude their own requests from the list.
 *
 * Performance fixes:
 * - Was 3 serial awaits (profiles, stats, job-extras) → now single Promise.all (1× parallel round-trip)
 * - Duplicate job_requests call merged into the parallel batch
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

      const missingClientIds = [
        ...new Set(
          rows
            .filter(
              (r) =>
                r.client_id &&
                (!r.client_photo_url?.trim() || !r.client_display_name?.trim()),
            )
            .map((r) => r.client_id as string),
        ),
      ];

      if (missingClientIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, is_verified")
          .in("id", missingClientIds);
        const profMap = new Map(
          (profs ?? []).map((p) => [
            p.id as string,
            {
              full_name: (p.full_name as string | null) ?? null,
              photo_url: (p.photo_url as string | null) ?? null,
              is_verified: (p.is_verified as boolean | null) ?? null,
            },
          ]),
        );
        rows = rows.map((r) => {
          if (!r.client_id) return r;
          const p = profMap.get(r.client_id);
          if (!p) return r;
          return {
            ...r,
            client_display_name: r.client_display_name?.trim()
              ? r.client_display_name
              : p.full_name,
            client_photo_url: r.client_photo_url?.trim()
              ? r.client_photo_url
              : p.photo_url,
            is_verified:
              r.is_verified != null ? r.is_verified : p.is_verified ?? false,
          };
        });
      }

      return rows;
    },
  });
}
