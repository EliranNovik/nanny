import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export function useUnreadCounts() {
  const { user, profile } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user || !profile) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    // Fetch unread notifications count (for freelancers only)
    async function fetchUnreadNotifications() {
      if (!user || !profile || profile.role !== "freelancer") {
        setUnreadNotifications(0);
        return;
      }

      try {
        // Fetch notifications with job details to check expiration
        const { data: notifications } = await supabase
          .from("job_candidate_notifications")
          .select(`
            id,
            job_requests (
              confirm_ends_at
            )
          `)
          .eq("freelancer_id", user.id)
          .in("status", ["pending", "opened"]);

        if (!notifications) {
          setUnreadNotifications(0);
          return;
        }

        // Filter out expired notifications
        const now = new Date();
        const validNotifications = notifications.filter((notif: any) => {
          const job = notif.job_requests;
          if (!job || !job.confirm_ends_at) return false;
          
          const endTime = new Date(job.confirm_ends_at).getTime();
          return endTime > now.getTime(); // Only count if not expired
        });

        setUnreadNotifications(validNotifications.length);
      } catch (error) {
        console.error("Error fetching unread notifications:", error);
      }
    }

    // Fetch unread messages count
    async function fetchUnreadMessages() {
      if (!user || !profile) return;
      
      try {
        // Get all conversations for this user
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

        // Count unread messages (messages from other users that haven't been read)
        const conversationIds = conversations.map((c) => c.id);
        
        // Get all messages in these conversations
        const { data: allMessages } = await supabase
          .from("messages")
          .select("sender_id, read_at, conversation_id")
          .in("conversation_id", conversationIds);

        if (!allMessages || allMessages.length === 0) {
          setUnreadMessages(0);
          return;
        }

        // Get conversation details to determine other user IDs
        const { data: convos } = await supabase
          .from("conversations")
          .select("id, client_id, freelancer_id")
          .in("id", conversationIds);

        if (!convos) {
          setUnreadMessages(0);
          return;
        }

        // Count unread messages from other users
        const unreadCount = allMessages.filter((msg) => {
          const convo = convos.find((c) => c.id === msg.conversation_id);
          if (!convo) return false;
          
          const otherUserId = profile.role === "client" 
            ? convo.freelancer_id 
            : convo.client_id;
          
          return msg.sender_id === otherUserId && !msg.read_at;
        }).length;

        setUnreadMessages(unreadCount);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    }

    fetchUnreadNotifications();
    fetchUnreadMessages();

    // Subscribe to real-time updates
    const notificationsChannel = profile.role === "freelancer" 
      ? supabase
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
              fetchUnreadNotifications();
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
        }
      )
      .subscribe();

    return () => {
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
      supabase.removeChannel(messagesChannel);
    };
  }, [user, profile]);

  return { unreadNotifications, unreadMessages };
}

