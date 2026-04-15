import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * Counts for Discover home shortcuts: open posted requests (as client) and
 * incoming job notifications (as freelancer / client receiving requests).
 */
export function useDiscoverShortcutsCounts() {
  const { user } = useAuth();
  const [myPostedRequestsCount, setMyPostedRequestsCount] = useState(0);
  const [incomingRequestsCount, setIncomingRequestsCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!user?.id) {
      setMyPostedRequestsCount(0);
      setIncomingRequestsCount(0);
      return;
    }

    const [postedRes, incomingRowsRes, confsRes] = await Promise.all([
      supabase
        .from("job_requests")
        .select("id", { count: "exact", head: true })
        .eq("client_id", user.id)
        .in("status", ["ready", "notifying", "confirmations_closed"]),
      supabase
        .from("job_candidate_notifications")
        .select("id, job_id, job_requests ( client_id, community_post_id )")
        .eq("freelancer_id", user.id)
        .in("status", ["pending", "opened"]),
      supabase
        .from("job_confirmations")
        .select("job_id, status")
        .eq("freelancer_id", user.id),
    ]);

    setMyPostedRequestsCount(postedRes.error ? 0 : (postedRes.count ?? 0));

    const confirmedJobIds = confsRes.error
      ? new Set<string>()
      : new Set(
          (confsRes.data || [])
            .filter((c: { status?: string }) => c.status === "available")
            .map((c: { job_id: string }) => c.job_id),
        );

    const incomingRows = (incomingRowsRes.data || []) as {
      job_id: string;
      job_requests?:
        | { client_id?: string; community_post_id?: string | null }
        | { client_id?: string; community_post_id?: string | null }[]
        | null;
    }[];
    const incomingVisible = incomingRows.filter((row) => {
      const raw = row.job_requests;
      const j = Array.isArray(raw) ? raw[0] : raw;
      if (!j || j.community_post_id || j.client_id === user.id) return false;
      if (confirmedJobIds.has(row.job_id)) return false;
      return true;
    });
    setIncomingRequestsCount(
      incomingRowsRes.error ? 0 : incomingVisible.length,
    );
  }, [user?.id]);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!user?.id) return;

    const jobsCh = supabase
      .channel(`discover-shortcuts-jobs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_requests",
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          void fetchCounts();
        },
      )
      .subscribe();

    const notifCh = supabase
      .channel(`discover-shortcuts-notifs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_candidate_notifications",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => {
          void fetchCounts();
        },
      )
      .subscribe();

    const confCh = supabase
      .channel(`discover-shortcuts-confs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_confirmations",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => {
          void fetchCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsCh);
      supabase.removeChannel(notifCh);
      supabase.removeChannel(confCh);
    };
  }, [user?.id, fetchCounts]);

  return { myPostedRequestsCount, incomingRequestsCount };
}
