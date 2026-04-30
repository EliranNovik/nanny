import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DISCOVER_OPEN_JOB_STATUSES } from "@/lib/discoverOpenJobStatuses";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export function useLiveJobCounts() {
  const queryClient = useQueryClient();

  useRealtimeSubscription(
    { table: "job_requests", event: "*" },
    () => {
      void queryClient.invalidateQueries({ queryKey: ["liveJobCounts"] });
    }
  );

  return useQuery({
    queryKey: ["liveJobCounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_requests")
        .select("service_type, status");
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach(job => {
        if (job.status && DISCOVER_OPEN_JOB_STATUSES.has(job.status)) {
          const type = job.service_type || "other";
          counts[type] = (counts[type] || 0) + 1;
        }
      });
      return counts;
    },
    staleTime: 15000,
  });
}
