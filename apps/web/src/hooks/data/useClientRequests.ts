import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";

export function useClientRequests(userId?: string, limit: number = 3) {
  return useQuery({
    queryKey: [...queryKeys.clientRequests(userId), limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data: myPostedRes, error } = await supabase
        .from("job_requests")
        .select("*")
        .eq("client_id", userId!)
        .in("status", ["ready", "notifying", "confirmations_closed"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      const myRequestsList = myPostedRes || [];
      const confirmedCounts: Record<string, number> = {};

      if (myRequestsList.length > 0) {
        const { data: allConfs, error: confsError } = await supabase
          .from("job_confirmations")
          .select("job_id")
          .in("job_id", myRequestsList.map((r) => r.id))
          .eq("status", "available");

        if (confsError) throw confsError;

        allConfs?.forEach((c) => {
          confirmedCounts[c.job_id] = (confirmedCounts[c.job_id] || 0) + 1;
        });
      }

      return {
        myRequests: myRequestsList,
        confirmedCounts,
      };
    },
  });
}
