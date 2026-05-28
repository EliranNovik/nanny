import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";
import {
  fetchMessagesInbox,
  type InboxConversation,
} from "./messagesInboxApi";
import { readInboxCache, writeInboxCache } from "@/lib/messagesCache";

export type { InboxConversation };

export function useMessagesInbox(
  userId: string | undefined,
  role: string | undefined,
) {
  const queryClient = useQueryClient();
  const inboxKey = queryKeys.messagesInbox(userId, role);

  const query = useQuery({
    queryKey: inboxKey,
    enabled: Boolean(userId && role),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    placeholderData: () => {
      if (!userId || !role) return undefined;
      const cached = readInboxCache<InboxConversation[]>(userId, role);
      return cached ?? undefined;
    },
    queryFn: async () => {
      const rows = await fetchMessagesInbox(userId!);
      if (userId && role) writeInboxCache(userId, role, rows);
      return rows;
    },
  });

  useEffect(() => {
    if (!userId || !role) return;

    const channel = supabase
      .channel(`messages-inbox-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void queryClient.invalidateQueries({ queryKey: inboxKey });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          void queryClient.invalidateQueries({ queryKey: inboxKey });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        () => {
          void queryClient.invalidateQueries({ queryKey: inboxKey });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useMessagesInbox] realtime channel error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, role, queryClient, inboxKey]);

  return query;
}
