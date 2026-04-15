import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "./keys";

export function useRecentMessages(userId?: string, limit: number = 3) {
  return useQuery({
    queryKey: [...queryKeys.recentMessages(userId), limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data: recentMessagesRes, error } = await supabase
        .from("conversations")
        .select(
          `
          id, 
          client_id,
          freelancer_id, 
          created_at,
          messages (
            body, 
            created_at,
            sender_id,
            read_at
          )
        `
        )
        .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const recentMessagesData = recentMessagesRes || [];
      const otherUserIdsForMessages = Array.from(new Set(
        recentMessagesData.map((conv) => conv.client_id === userId ? conv.freelancer_id : conv.client_id)
      ));

      let recentProfileMap = new Map<string, any>();
      if (otherUserIdsForMessages.length > 0) {
        const { data: recentProfiles, error: profError } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", otherUserIdsForMessages);
          
        if (profError) throw profError;
        recentProfiles?.forEach(p => recentProfileMap.set(p.id, p));
      }

      const processedMessages = recentMessagesData.map((conv) => {
        const lastMsg = conv.messages?.sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];

        const otherUserId = conv.client_id === userId ? conv.freelancer_id : conv.client_id;
        const otherProfile = recentProfileMap.get(otherUserId);

        return {
          id: conv.id,
          otherName: otherProfile?.full_name || "Client",
          otherPhoto: otherProfile?.photo_url || null,
          lastMessage: lastMsg?.body || "No messages yet",
          lastMessageTime: lastMsg?.created_at || conv.created_at,
          isUnread: lastMsg ? lastMsg.sender_id !== userId && !lastMsg.read_at : false,
        };
      });

      return processedMessages.filter((m) => m.lastMessage !== "No messages yet");
    },
  });
}
