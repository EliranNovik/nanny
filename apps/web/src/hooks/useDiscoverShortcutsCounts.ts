import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * Counts for Discover home shortcuts: open posted requests (as client) and
 * incoming job notifications (as freelancer / client receiving requests).
 */
export function useDiscoverShortcutsCounts() {
  const { user, profile } = useAuth();
  const [myPostedRequestsCount, setMyPostedRequestsCount] = useState(0);
  const [incomingRequestsCount, setIncomingRequestsCount] = useState(0);

  const receiveIncoming =
    profile?.role === "freelancer" || profile?.is_available_for_jobs === true;

  const fetchCounts = useCallback(async () => {
    if (!user?.id) {
      setMyPostedRequestsCount(0);
      setIncomingRequestsCount(0);
      return;
    }

    const postedRes = await supabase
      .from("job_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_id", user.id)
      .in("status", ["ready", "notifying", "confirmations_closed"]);

    setMyPostedRequestsCount(postedRes.error ? 0 : postedRes.count ?? 0);

    if (!receiveIncoming) {
      setIncomingRequestsCount(0);
      return;
    }

    const incomingRes = await supabase
      .from("job_candidate_notifications")
      .select("id", { count: "exact", head: true })
      .eq("freelancer_id", user.id)
      .in("status", ["pending", "opened"]);

    setIncomingRequestsCount(incomingRes.error ? 0 : incomingRes.count ?? 0);
  }, [user?.id, receiveIncoming]);

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
        }
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsCh);
      supabase.removeChannel(notifCh);
    };
  }, [user?.id, fetchCounts]);

  return { myPostedRequestsCount, incomingRequestsCount };
}
