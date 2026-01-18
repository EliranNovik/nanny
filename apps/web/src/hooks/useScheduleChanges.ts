import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export function useScheduleChanges() {
  const { user, profile } = useAuth();
  const [scheduleChanges, setScheduleChanges] = useState(0);

  useEffect(() => {
    if (!user || !profile) {
      setScheduleChanges(0);
      return;
    }

    async function fetchScheduleChanges() {
      try {
        // Get all conversations for active jobs (locked or active status)
        let conversations;
        if (profile.role === "client") {
          // For clients: get conversations for their active jobs
          const { data: activeJobs } = await supabase
            .from("job_requests")
            .select("id")
            .eq("client_id", user.id)
            .in("status", ["locked", "active"]);

          if (!activeJobs || activeJobs.length === 0) {
            setScheduleChanges(0);
            return;
          }

          const { data: convos } = await supabase
            .from("conversations")
            .select("id")
            .in("job_id", activeJobs.map(j => j.id));

          conversations = convos;
        } else {
          // For freelancers: get conversations for jobs where they are selected
          const { data: activeJobs } = await supabase
            .from("job_requests")
            .select("id")
            .eq("selected_freelancer_id", user.id)
            .in("status", ["locked", "active"]);

          if (!activeJobs || activeJobs.length === 0) {
            setScheduleChanges(0);
            return;
          }

          const { data: convos } = await supabase
            .from("conversations")
            .select("id")
            .in("job_id", activeJobs.map(j => j.id));

          conversations = convos;
        }

        if (!conversations || conversations.length === 0) {
          setScheduleChanges(0);
          return;
        }

        const conversationIds = conversations.map((c) => c.id);

        // Get conversation details to determine other user IDs
        const { data: convosDetails } = await supabase
          .from("conversations")
          .select("id, client_id, freelancer_id")
          .in("id", conversationIds);

        if (!convosDetails) {
          setScheduleChanges(0);
          return;
        }

        // Get all schedule-related messages
        // Fetch all messages and filter in JavaScript to handle emojis properly
        const { data: allMessages } = await supabase
          .from("messages")
          .select("id, body, sender_id, conversation_id, created_at, read_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false });
        
        // Filter for schedule-related messages
        const scheduleMessages = (allMessages || []).filter(msg => 
          msg.body?.includes("📅 Schedule Request") || 
          msg.body?.includes("🔄 Schedule Revision") ||
          msg.body?.includes("✓ Schedule confirmed") ||
          msg.body?.includes("Schedule confirmed")
        );

        if (!scheduleMessages || scheduleMessages.length === 0) {
          setScheduleChanges(0);
          return;
        }

        // Count unread schedule-related messages from the other party
        let unreadCount = 0;
        
        for (const msg of scheduleMessages) {
          const convo = convosDetails.find((c) => c.id === msg.conversation_id);
          if (!convo) continue;

          const otherUserId = profile.role === "client" 
            ? convo.freelancer_id 
            : convo.client_id;

          // Only count messages from the other party
          if (msg.sender_id !== otherUserId) continue;

          // For clients: count revision requests (🔄 Schedule Revision)
          // For freelancers: count schedule requests (📅 Schedule Request)
          const isScheduleMessage = profile.role === "client"
            ? msg.body?.includes("🔄 Schedule Revision")
            : msg.body?.includes("📅 Schedule Request");

          if (!isScheduleMessage) continue;

          // Only count unread messages
          if (msg.read_at) continue;

            // Check if there's a confirmation after this message
            // If confirmed, don't count it
            const hasConfirmation = scheduleMessages.some(m => 
              m.conversation_id === msg.conversation_id &&
              new Date(m.created_at) > new Date(msg.created_at) &&
              (m.body?.includes("✓ Schedule confirmed") || m.body?.includes("Schedule confirmed")) &&
              m.sender_id === user.id
            );

          if (!hasConfirmation) {
            unreadCount++;
          }
        }

        setScheduleChanges(unreadCount);
      } catch (error) {
        console.error("Error fetching schedule changes:", error);
      }
    }

    fetchScheduleChanges();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`schedule-changes:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchScheduleChanges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  return { scheduleChanges };
}

