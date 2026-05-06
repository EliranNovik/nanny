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
  const activityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        scheduleActivityInboxFetch();
      }
    };
    window.addEventListener("activity-inbox-dismiss", onDismiss);
    document.addEventListener("visibilitychange", onVisible);

    async function fetchUnreadMessages() {
      if (!user || !profile) return;

      try {
        const { data: conversations, error: convErr } = await supabase
          .from("conversations")
          .select("id")
          .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

        if (convErr) throw convErr;

        if (!conversations || conversations.length === 0) {
          setUnreadMessages(0);
          return;
        }

        const conversationIds = conversations.map((c) => c.id);

        // Count messages where sender is NOT me and read_at is null
        const { count, error } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", conversationIds)
          .neq("sender_id", user.id)
          .is("read_at", null);

        if (error) throw error;
        setUnreadMessages(count || 0);
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
        },
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
              },
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
              },
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
          void fetchUnreadMessages();
          scheduleActivityInboxFetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
        },
        () => {
          void fetchUnreadMessages();
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("activity-inbox-dismiss", onDismiss);
      document.removeEventListener("visibilitychange", onVisible);
      if (activityDebounceRef.current)
        clearTimeout(activityDebounceRef.current);
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
