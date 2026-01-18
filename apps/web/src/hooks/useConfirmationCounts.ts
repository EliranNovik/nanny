import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export function useConfirmationCounts() {
  const { user, profile } = useAuth();
  const [totalConfirmations, setTotalConfirmations] = useState(0);

  useEffect(() => {
    if (!user || profile?.role !== "client") {
      setTotalConfirmations(0);
      return;
    }

    async function fetchConfirmationCounts() {
      try {
        // Get all jobs waiting for responses
        const { data: jobs } = await supabase
          .from("job_requests")
          .select("id")
          .eq("client_id", user.id)
          .in("status", ["notifying", "confirmations_closed"]);

        if (!jobs || jobs.length === 0) {
          setTotalConfirmations(0);
          return;
        }

        // Count total confirmations across all waiting jobs
        const { count } = await supabase
          .from("job_confirmations")
          .select("*", { count: "exact", head: true })
          .in("job_id", jobs.map((j) => j.id))
          .eq("status", "available");

        setTotalConfirmations(count || 0);
      } catch (error) {
        console.error("Error fetching confirmation counts:", error);
      }
    }

    fetchConfirmationCounts();

    // Subscribe to real-time updates for job_confirmations and job_requests
    const confirmationsChannel = supabase
      .channel(`confirmation-counts-confirmations:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_confirmations",
        },
        () => {
          fetchConfirmationCounts();
        }
      )
      .subscribe();

    const jobsChannel = supabase
      .channel(`confirmation-counts-jobs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_requests",
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          fetchConfirmationCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(confirmationsChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [user, profile]);

  return { totalConfirmations };
}

