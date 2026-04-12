import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { fetchInboxActivityAlerts } from "@/lib/inboxActivityAlerts";

const ACTIVITY_INBOX_DEBOUNCE_MS = 220;

/**
 * Message tab: raw unread message rows.
 * Bell / News & Activity: same list as NotificationsModal (includes dismissed filter via fetchInboxActivityAlerts).
 */
export function useUnreadCounts() {
  const { user, profile } = useAuth();
  const [activityInboxCount, setActivityInboxCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const activityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleActivityInboxFetch = useCallback(() => {
    if (activityDebounceRef.current) clearTimeout(activityDebounceRef.current);
    activityDebounceRef.current = setTimeout(() => {
      void (async () => {
        if (!user || !profile) {
          setActivityInboxCount(0);
          return;
        }
        try {
          const rows = await fetchInboxActivityAlerts(user, profile, {
            includeUnreadMessageAlerts: true,
          });
          setActivityInboxCount(rows.length);
        } catch (error) {
          console.error("Error fetching activity inbox count:", error);
        }
      })();
    }, ACTIVITY_INBOX_DEBOUNCE_MS);
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile) {
      setActivityInboxCount(0);
      setUnreadMessages(0);
      return;
    }

    scheduleActivityInboxFetch();

    const onDismiss = () => scheduleActivityInboxFetch();
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        scheduleActivityInboxFetch();
      }
    };
    window.addEventListener("activity-inbox-dismiss", onDismiss);
    document.addEventListener("visibilitychange", onVisible);

    async function fetchUnreadMessages() {
      if (!user || !profile) return;

      try {
        let conversations;
        if (profile.role === "client") {
          const { data } = await supabase
            .from("conversations")
            .select("id")
            .eq("client_id", user.id);
          conversations = data;
        } else {
          const { data } = await supabase
            .from("conversations")
            .select("id")
            .eq("freelancer_id", user.id);
          conversations = data;
        }

        if (!conversations || conversations.length === 0) {
          setUnreadMessages(0);
          return;
        }

        const conversationIds = conversations.map((c) => c.id);

        const { data: allMessages } = await supabase
          .from("messages")
          .select("sender_id, read_at, conversation_id")
          .in("conversation_id", conversationIds);

        if (!allMessages || allMessages.length === 0) {
          setUnreadMessages(0);
          return;
        }

        const { data: convos } = await supabase
          .from("conversations")
          .select("id, client_id, freelancer_id")
          .in("id", conversationIds);

        if (!convos) {
          setUnreadMessages(0);
          return;
        }

        const unreadCount = allMessages.filter((msg) => {
          const convo = convos.find((c) => c.id === msg.conversation_id);
          if (!convo) return false;

          const otherUserId =
            profile.role === "client" ? convo.freelancer_id : convo.client_id;

          return msg.sender_id === otherUserId && !msg.read_at;
        }).length;

        setUnreadMessages(unreadCount);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    }

    fetchUnreadMessages();

    const notificationsChannel = supabase
      .channel(`unread-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_candidate_notifications",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => {
          scheduleActivityInboxFetch();
        }
      )
      .subscribe();

    const clientJobsChannel =
      profile.role === "client"
        ? supabase
            .channel(`unread-client-jobs:${user.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "job_requests",
                filter: `client_id=eq.${user.id}`,
              },
              () => {
                scheduleActivityInboxFetch();
              }
            )
            .subscribe()
        : null;

    const freelancerJobsChannel =
      profile.role === "freelancer"
        ? supabase
            .channel(`activity-inbox-fr-jobs:${user.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "job_requests",
                filter: `selected_freelancer_id=eq.${user.id}`,
              },
              () => {
                scheduleActivityInboxFetch();
              }
            )
            .subscribe()
        : null;

    const messagesChannel = supabase
      .channel(`unread-messages:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadMessages();
          scheduleActivityInboxFetch();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("activity-inbox-dismiss", onDismiss);
      document.removeEventListener("visibilitychange", onVisible);
      if (activityDebounceRef.current) clearTimeout(activityDebounceRef.current);
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
      if (clientJobsChannel) {
        supabase.removeChannel(clientJobsChannel);
      }
      if (freelancerJobsChannel) {
        supabase.removeChannel(freelancerJobsChannel);
      }
      supabase.removeChannel(messagesChannel);
    };
  }, [user, profile, scheduleActivityInboxFetch]);

  return { activityInboxCount, unreadMessages };
}
