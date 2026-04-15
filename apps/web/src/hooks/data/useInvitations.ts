import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";

export function useInvitations(userId?: string) {
  return useQuery({
    queryKey: queryKeys.userInvitations(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data: invitationsRes, error } = await supabase
        .from("job_candidate_notifications")
        .select(
          `id, job_id, status, created_at,
          job_requests (
            id, client_id, service_type, care_type, children_count, children_age_group,
            location_city, start_at, created_at, service_details, time_duration, care_frequency, selected_freelancer_id,
            profiles!job_requests_client_id_fkey ( full_name, photo_url )
          )`
        )
        .eq("freelancer_id", userId!)
        .in("status", ["pending", "opened"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rawInvitations = invitationsRes || [];
      let confs: any[] = [];
      const invitationJobIds = rawInvitations.map((inv) => inv.job_id);

      if (invitationJobIds.length > 0) {
        const { data, error: confsError } = await supabase
          .from("job_confirmations")
          .select("job_id, status")
          .eq("freelancer_id", userId!)
          .in("job_id", invitationJobIds);
          
        if (confsError) throw confsError;
        if (data) confs = data;
      }

      const confirmedIds = new Set(
        (confs || [])
          .filter((c) => c.status === "available")
          .map((c) => c.job_id),
      );
      const declinedIds = new Set(
        (confs || [])
          .filter((c) => c.status === "declined")
          .map((c) => c.job_id),
      );

      const mappedInvitations = rawInvitations
        .filter((n) => n.job_requests)
        .map((n) => ({
          ...n,
          isConfirmed: confirmedIds.has(n.job_id),
          isDeclined: declinedIds.has(n.job_id),
        }));

      const incomingKpiCount = mappedInvitations.filter(
        (n) => !n.isConfirmed && !n.isDeclined
      ).length;

      return {
        invitations: mappedInvitations,
        incomingKpiCount,
      };
    },
  });
}
