import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import {
  fetchChatThread,
  type ChatMessage,
  type ChatThreadPayload,
} from "./chatThreadApi";
import { readThreadCache, writeThreadCache } from "@/lib/messagesCache";

export type { ChatMessage, ChatThreadPayload };

export function useChatThread(
  conversationId: string | undefined,
  userId: string | undefined,
  propOtherUserId?: string,
) {
  const threadKey = queryKeys.chatThread(userId, conversationId);

  return useQuery({
    queryKey: threadKey,
    enabled: Boolean(conversationId && userId),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    placeholderData: () => {
      if (!userId || !conversationId) return undefined;
      return readThreadCache<ChatThreadPayload>(userId, conversationId);
    },
    queryFn: async () => {
      const payload = await fetchChatThread(
        conversationId!,
        userId!,
        propOtherUserId,
      );
      if (!payload) throw new Error("Conversation not found");
      writeThreadCache(userId!, conversationId!, payload);
      return payload;
    },
  });
}

export function patchChatThreadMessages(
  queryClient: ReturnType<typeof useQueryClient>,
  threadKey: readonly unknown[],
  updater: (messages: ChatMessage[]) => ChatMessage[],
) {
  queryClient.setQueryData<ChatThreadPayload>(threadKey, (prev) => {
    if (!prev) return prev;
    return { ...prev, messages: updater(prev.messages) };
  });
}
