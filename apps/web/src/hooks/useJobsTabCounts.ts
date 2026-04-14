import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { JobsPerspective } from "@/components/jobs/jobsPerspective";

export type JobsTabCountsState = {
  my_requests: number;
  requests: number;
  pending: number;
  jobs_client: number;
  past_client: number;
  jobs_freelancer: number;
  past_freelancer: number;
};

const INITIAL: JobsTabCountsState = {
  my_requests: 0,
  requests: 0,
  pending: 0,
  jobs_client: 0,
  past_client: 0,
  jobs_freelancer: 0,
  past_freelancer: 0,
};

/** Same mapping as `JobsTabBar` badge — keeps menu + /jobs UI in sync. */
export function badgeCountForJobsTab(
  tabId: string,
  perspective: JobsPerspective,
  counts: JobsTabCountsState
): number {
  if (tabId === "jobs") {
    return perspective === "client" ? counts.jobs_client : counts.jobs_freelancer;
  }
  if (tabId === "past") {
    return perspective === "client" ? counts.past_client : counts.past_freelancer;
  }
  if (tabId === "my_requests") return counts.my_requests;
  if (tabId === "requests") return counts.requests;
  if (tabId === "pending") return counts.pending;
  return 0;
}

/**
 * Live counts for each /jobs tab (client + freelancer), shared by JobsTabBar and app menu.
 * Pass `user` from `useAuth()` in the caller to avoid importing AuthContext here (prevents circular module init / `useAuth is not defined` at runtime).
 */
export function useJobsTabCounts(user: User | null): JobsTabCountsState {
  const [counts, setCounts] = useState<JobsTabCountsState>(INITIAL);

  useEffect(() => {
    async function loadCounts() {
      if (!user) {
        setCounts(INITIAL);
        return;
      }
      try {
        const [myReqRes, jobsRes, notifsRes, confRes] = await Promise.all([
          supabase
            .from("job_requests")
            .select("id", { count: "exact", head: true })
            .eq("client_id", user.id)
            .in("status", ["ready", "notifying", "confirmations_closed"]),
          supabase
            .from("job_requests")
            .select("id,status,client_id,selected_freelancer_id")
            .or(`client_id.eq.${user.id},selected_freelancer_id.eq.${user.id}`)
            .in("status", ["locked", "active", "completed", "cancelled"]),
          supabase
            .from("job_candidate_notifications")
            .select("job_id")
            .eq("freelancer_id", user.id)
            .in("status", ["pending", "opened"]),
          supabase.from("job_confirmations").select("job_id,status").eq("freelancer_id", user.id),
        ]);

        const rows = (jobsRes.data || []) as {
          status: string;
          client_id: string;
          selected_freelancer_id: string | null;
        }[];
        const asClient = rows.filter((j) => j.client_id === user.id);
        const asFreelancer = rows.filter((j) => j.selected_freelancer_id === user.id);
        const countLivePast = (arr: typeof rows) => ({
          live: arr.filter((j) => j.status === "locked" || j.status === "active").length,
          past: arr.filter((j) => j.status === "completed" || j.status === "cancelled").length,
        });
        const clientLP = countLivePast(asClient);
        const freelancerLP = countLivePast(asFreelancer);

        const confirmedIds = new Set(
          (confRes.data || [])
            .filter((c: { status: string }) => c.status === "available")
            .map((c: { job_id: string }) => c.job_id)
        );
        const pending = (notifsRes.data || []).filter((n: { job_id: string }) =>
          confirmedIds.has(n.job_id)
        ).length;
        const requests = (notifsRes.data || []).length - pending;

        setCounts({
          my_requests: myReqRes.count || 0,
          requests: Math.max(0, requests),
          pending: Math.max(0, pending),
          jobs_client: clientLP.live,
          past_client: clientLP.past,
          jobs_freelancer: freelancerLP.live,
          past_freelancer: freelancerLP.past,
        });
      } catch {
        setCounts(INITIAL);
      }
    }
    void loadCounts();
  }, [user?.id]);

  return counts;
}
