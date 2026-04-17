import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getLiveJobBannerFromRow,
  type LiveJobBannerPayload,
} from "@/lib/liveJobConversationBanner";

const JOB_SELECT =
  "id, status, service_type, care_type, client_id, selected_freelancer_id";

/**
 * “Live helping” banner for the open thread.
 * - Loads `job_id` from the conversation row; if missing, finds an active/locked job for the same
 *   client–helper pair (some threads share a pair but only one row links `job_id`).
 * - Resolves from DB by `conversations.id` so it works even when the inbox list row doesn’t match the URL.
 */
export function useLiveJobConversationBanner(
  conversationId: string | null | undefined,
  userId: string | undefined,
) {
  const [banner, setBanner] = useState<LiveJobBannerPayload | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) {
      setBanner(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .select("job_id, client_id, freelancer_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (convoErr || !convo) {
        setBanner(null);
        return;
      }

      async function loadJobById(jobId: string) {
        const { data: job, error: jobErr } = await supabase
          .from("job_requests")
          .select(JOB_SELECT)
          .eq("id", jobId)
          .maybeSingle();
        if (cancelled) return null;
        if (jobErr || !job) return null;
        return job;
      }

      let jobRow: {
        status: string;
        service_type?: string | null;
        care_type?: string | null;
        client_id: string;
        selected_freelancer_id: string | null;
      } | null = null;

      if (convo.job_id) {
        jobRow = await loadJobById(convo.job_id);
      }

      /** Same client + helper as this thread — job_requests uses the same role columns */
      if (!jobRow && convo.client_id && convo.freelancer_id) {
        const { data: pairJob } = await supabase
          .from("job_requests")
          .select(JOB_SELECT)
          .eq("client_id", convo.client_id)
          .eq("selected_freelancer_id", convo.freelancer_id)
          .in("status", ["locked", "active"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (pairJob) jobRow = pairJob;
      }

      if (!jobRow) {
        setBanner(null);
        return;
      }
      setBanner(getLiveJobBannerFromRow(jobRow, userId));
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  return banner;
}
