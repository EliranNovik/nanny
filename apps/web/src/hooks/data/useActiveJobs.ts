import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";

export interface ActiveJobParticipant {
  full_name: string | null;
  photo_url: string | null;
  average_rating?: number;
  total_ratings?: number;
}

export function useActiveJobs(userId?: string) {
  return useQuery({
    queryKey: queryKeys.activeJobs(userId),
    enabled: !!userId,
    queryFn: async () => {
      // 1. Fetch active jobs for freelancer
      const { data: jobs, error: jobsError } = await supabase
        .from("job_requests")
        .select("*")
        .eq("selected_freelancer_id", userId!)
        .in("status", ["locked", "active"])
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;
      
      const activeJobsList = jobs || [];
      const profileMap: Record<string, ActiveJobParticipant> = {};
      const conversationMap: Record<string, string> = {};

      if (activeJobsList.length > 0) {
        const clientIds = Array.from(
          new Set(activeJobsList.map((j) => j.client_id))
        );
        const jobIds = activeJobsList.map((j) => j.id);

        const [profRes, convRes, fallbackConvRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, photo_url, average_rating, total_ratings")
            .in("id", clientIds),
          supabase
            .from("conversations")
            .select("id, job_id, client_id")
            .in("job_id", jobIds),
          supabase
            .from("conversations")
            .select("id, client_id, freelancer_id")
            .eq("freelancer_id", userId!)
            .in("client_id", clientIds),
        ]);

        if (profRes.error) throw profRes.error;
        if (convRes.error) throw convRes.error;

        profRes.data?.forEach((p) => {
          profileMap[p.id] = p;
        });

        activeJobsList.forEach((job) => {
          const conv = convRes.data?.find((c) => c.job_id === job.id);
          if (conv) {
            conversationMap[job.id] = conv.id;
          } else {
            const fallback = fallbackConvRes.data?.find(
              (c) => c.client_id === job.client_id
            );
            if (fallback) {
              conversationMap[job.id] = fallback.id;
            }
          }
        });
      }

      return {
        activeJobs: activeJobsList,
        clientProfiles: profileMap,
        activeConversationIds: conversationMap,
      };
    },
  });
}
