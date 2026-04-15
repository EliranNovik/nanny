import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

export function NotificationListener() {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Refs to avoid duplicate toasts for the same event
  const processedNotificationIds = useRef<Set<string>>(new Set());
  const processedMessageIds = useRef<Set<string>>(new Set());
  const processedConfirmationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !profile) return;

    // 1. Subscribe to Messages (Everyone)
    const messagesChannel = supabase
      .channel(`message-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id === user.id) return;
          if (processedMessageIds.current.has(newMsg.id)) return;
          processedMessageIds.current.add(newMsg.id);

          // Fetch sender name
          const { data: sender } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", newMsg.sender_id)
            .single();

          addToast({
            title: "New Message",
            description: `${sender?.full_name || "Someone"} sent you a message: "${newMsg.body?.substring(0, 30)}${newMsg.body?.length > 30 ? "..." : ""}"`,
            variant: "info",
            duration: 5000,
            action: {
              label: "Chat",
              onClick: () => navigate(`/chat/${newMsg.conversation_id}`),
            },
          });
        },
      )
      .subscribe();

    // 2. Subscribe to Job Requests (Freelancer Only)
    let jobsChannel: any;
    if (profile.role === "freelancer") {
      jobsChannel = supabase
        .channel(`freelancer-notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "job_candidate_notifications",
            filter: `freelancer_id=eq.${user.id}`,
          },
          async (payload) => {
            const newNotif = payload.new as any;
            if (processedNotificationIds.current.has(newNotif.id)) return;
            processedNotificationIds.current.add(newNotif.id);

            const { data: job } = await supabase
              .from("job_requests")
              .select("care_type, location_city")
              .eq("id", newNotif.job_id)
              .single();

            addToast({
              title: "New Job Request!",
              description: `${job?.care_type || "Helper"} needed in ${job?.location_city || "your area"}`,
              variant: "info",
              duration: 6000,
              action: {
                label: "View",
                onClick: () => navigate(buildJobsUrl("freelancer", "requests")),
              },
            });
          },
        )
        .subscribe();
    }

    // 3. Subscribe to Job Confirmations (Client Only)
    let confirmationsChannel: any;
    if (profile.role === "client") {
      confirmationsChannel = supabase
        .channel(`client-notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "job_confirmations",
          },
          async (payload) => {
            const newConf = payload.new as any;
            if (processedConfirmationIds.current.has(newConf.id)) return;
            processedConfirmationIds.current.add(newConf.id);

            // Verify if the job belongs to this client
            const { data: job } = await supabase
              .from("job_requests")
              .select("client_id, care_type")
              .eq("id", newConf.job_id)
              .single();

            if (job && job.client_id === user.id) {
              const { data: sender } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", newConf.freelancer_id)
                .single();

              addToast({
                title: "Helper Available!",
                description: `${sender?.full_name || "A helper"} responded to your ${job.care_type || "job"} request`,
                variant: "success",
                duration: 6000,
                action: {
                  label: "Review",
                  onClick: () =>
                    navigate(buildJobsUrl("client", "my_requests")),
                },
              });
            }
          },
        )
        .subscribe();
    }

    // 4. Subscribe to Job Status Changes (Everyone)
    const statusChannel = supabase
      .channel(`status-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_requests",
        },
        async (payload) => {
          const oldJob = payload.old as any;
          const newJob = payload.new as any;

          // Only notify if status changed and user is involved
          const isInvolved =
            newJob.client_id === user.id ||
            newJob.selected_freelancer_id === user.id;
          if (!isInvolved || oldJob.status === newJob.status) return;

          let title = "Job Update";
          let message = `Job status changed to ${newJob.status}`;
          let targetTab: "jobs" | "past" = "jobs";

          if (newJob.status === "locked" || newJob.status === "active") {
            title = "Job Confirmed! 🎉";
            message = `Your ${newJob.care_type || "job"} is now confirmed and ready.`;
            targetTab = "jobs";
          } else if (newJob.status === "completed") {
            title = "Job Completed ✨";
            message = "The job has been marked as finished.";
            targetTab = "past";
          } else {
            return; // Only notify on specific transitions
          }

          const mode = newJob.client_id === user.id ? "client" : "freelancer";

          addToast({
            title,
            description: message,
            variant: "success",
            duration: 6000,
            action: {
              label: "Go to Job",
              onClick: () => navigate(buildJobsUrl(mode, targetTab)),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      if (jobsChannel) supabase.removeChannel(jobsChannel);
      if (confirmationsChannel) supabase.removeChannel(confirmationsChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [user?.id, profile?.role, addToast, navigate]);

  return null;
}
