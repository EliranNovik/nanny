import { useQuery } from "@tanstack/react-query";
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
  client_photo_url: string | null;
  client_display_name: string | null;
  /** Present when RPC returns it — used to hide the viewer’s own requests client-side. */
  client_id?: string | null;
  /** job_requests.status — filter to open-only when present. */
  status?: string | null;
};

/**
 * Open help requests posted via “I need help” / client create flow (community_post_id is null).
 * Pass the signed-in user id to exclude their own requests from the list.
 */
export function useDiscoverOpenHelpRequests(
  enabled: boolean,
  excludeUserId?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.discoverOpenHelpRequests(excludeUserId ?? undefined),
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
      return rows;
    },
  });
}
