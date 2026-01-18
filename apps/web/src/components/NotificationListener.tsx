import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";

export function NotificationListener() {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const previousNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || profile?.role !== "freelancer") {
      return;
    }

    // Fetch initial notifications to populate the ref
    async function initializeNotifications() {
      const { data } = await supabase
        .from("job_candidate_notifications")
        .select("id")
        .eq("freelancer_id", user.id)
        .in("status", ["pending", "opened"]);

      if (data) {
        previousNotificationIdsRef.current = new Set(data.map((n) => n.id));
      }
    }

    initializeNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel(`global-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_candidate_notifications",
          filter: `freelancer_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotification = payload.new as any;
          
          // Check if this is a new notification
          if (!previousNotificationIdsRef.current.has(newNotification.id)) {
            previousNotificationIdsRef.current.add(newNotification.id);

            // Fetch job details for the toast
            const { data: jobData } = await supabase
              .from("job_requests")
              .select("care_type, location_city, confirm_ends_at")
              .eq("id", newNotification.job_id)
              .single();

            // Only show toast if job is not expired
            if (jobData && jobData.confirm_ends_at) {
              const endTime = new Date(jobData.confirm_ends_at).getTime();
              const now = Date.now();
              
              if (endTime > now) {
                // Show toast notification only for non-expired requests
                addToast({
                  title: "New Job Request!",
                  description: `${jobData?.location_city || "Location"} - ${jobData?.care_type || "Care"} needed`,
                  variant: "info",
                  duration: 5000,
                  action: {
                    label: "View Requests",
                    onClick: () => {
                      navigate("/freelancer/notifications");
                    },
                  },
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, addToast, navigate]);

  return null;
}

