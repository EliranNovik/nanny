import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";

type ConfRow = {
  job_id: string;
  freelancer_id: string;
  created_at: string;
  profiles: {
    id: string;
    photo_url: string | null;
    full_name: string | null;
  } | null;
};

export type FreelancerRequestsData = {
  myOpenRequests: any[];
  confirmedHelperAvatarsByJobId: Record<
    string,
    { id: string; photo_url: string | null; full_name: string | null }[]
  >;
  inboundNotifications: any[];
};

export function useFreelancerRequests(userId: string | undefined) {
  const queryClient = useQueryClient();
  const qk = queryKeys.freelancerRequests(userId);

  useRealtimeSubscription(
    { table: "job_requests", event: "*", enabled: !!userId },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    }
  );

  useRealtimeSubscription(
    { table: "job_candidate_notifications", event: "*", enabled: !!userId },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    }
  );

  useRealtimeSubscription(
    { table: "job_confirmations", event: "*", enabled: !!userId },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    }
  );

  return useQuery<FreelancerRequestsData>({
    queryKey: qk,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes — requests change frequently
    queryFn: async () => {
      const [openJobsRes, notifsRes] = await Promise.all([
        supabase
          .from("job_requests")
          .select("*")
          .eq("client_id", userId!)
          .in("status", ["ready", "notifying", "confirmations_closed"])
          .order("created_at", { ascending: false }),
        supabase
          .from("job_candidate_notifications")
          .select(
            `id, job_id, status, created_at,
             job_requests (
               id, status, client_id, community_post_id, community_post_expires_at, service_type, care_type, care_frequency, children_count, children_age_group, location_city, start_at, shift_hours, time_duration, languages_pref, requirements, budget_min, budget_max, notes, stage, offered_hourly_rate, price_offer_status, schedule_confirmed, service_details, created_at,
               profiles!job_requests_client_id_fkey ( full_name, photo_url, average_rating, total_ratings, city )
             )`,
          )
          .eq("freelancer_id", userId!)
          .in("status", ["pending", "opened"])
          .order("created_at", { ascending: false }),
      ]);

      const openJobs = openJobsRes.data || [];
      const notificationsData = notifsRes.data || [];

      const [confsRes, openJobDetailConfsRes] = await Promise.all([
        supabase
          .from("job_confirmations")
          .select("job_id, status")
          .eq("freelancer_id", userId!),
        openJobs.length === 0
          ? Promise.resolve({ data: [] as ConfRow[] })
          : supabase
              .from("job_confirmations")
              .select(
                `job_id, freelancer_id, created_at,
                 profiles!job_confirmations_freelancer_id_fkey ( id, photo_url, full_name )`,
              )
              .in("job_id", openJobs.map((j: any) => j.id))
              .eq("status", "available")
              .order("created_at", { ascending: true }),
      ]);

      const jobConfsData = (openJobDetailConfsRes.data || []) as ConfRow[];

      const countsMap = jobConfsData.reduce(
        (acc: Record<string, number>, curr) => {
          acc[curr.job_id] = (acc[curr.job_id] || 0) + 1;
          return acc;
        },
        {},
      );

      const avatarMap: Record<
        string,
        { id: string; photo_url: string | null; full_name: string | null }[]
      > = {};
      jobConfsData.forEach((c) => {
        if (!avatarMap[c.job_id]) avatarMap[c.job_id] = [];
        if (avatarMap[c.job_id].length >= 5) return;
        const p = c.profiles;
        avatarMap[c.job_id].push(
          p
            ? { id: p.id, photo_url: p.photo_url, full_name: p.full_name }
            : { id: c.freelancer_id, photo_url: null, full_name: null },
        );
      });

      const processedOpenJobs = openJobs.map((job: any) => ({
        ...job,
        acceptedCount: countsMap[job.id] || 0,
      }));

      const confirmedJobIds = new Set(
        (confsRes.data || [])
          .filter((c) => c.status === "available")
          .map((c) => c.job_id),
      );
      const declinedJobIds = new Set(
        (confsRes.data || [])
          .filter((c) => c.status === "declined")
          .map((c) => c.job_id),
      );

      const validNotifications = notificationsData
        .filter((n: any) => n.job_requests && !n.job_requests.community_post_id)
        .map((n: any) => ({
          ...n,
          isConfirmed: confirmedJobIds.has(n.job_id),
          isDeclined: declinedJobIds.has(n.job_id),
        }));

      return {
        myOpenRequests: processedOpenJobs,
        confirmedHelperAvatarsByJobId: avatarMap,
        inboundNotifications: validNotifications,
      };
    },
  });
}
