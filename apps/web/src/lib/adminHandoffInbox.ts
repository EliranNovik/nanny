import { isAiSentBody, isHandoffBody, HANDOFF_MARK } from "@/components/chat/AiSentAvatar";
import { supabase } from "@/lib/supabase";

export type AdminHandoffWaiting = {
  userIds: Set<string>;
  conversationByUserId: Map<string, string>;
};

const EMPTY_WAITING: AdminHandoffWaiting = {
  userIds: new Set(),
  conversationByUserId: new Map(),
};

/**
 * Chats the bot moved to the Tebnu team, where no admin has typed since.
 * The other person is still waiting for a reply.
 */
export async function fetchAdminHandoffWaiting(
  adminId: string,
): Promise<AdminHandoffWaiting> {
  const handoffAt = new Map<string, string>();

  const { data: marked, error: markedError } = await supabase
    .from("messages")
    .select("conversation_id, created_at, body")
    .eq("sender_id", adminId)
    .like("body", `${HANDOFF_MARK}%`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (markedError) {
    console.warn("[Messages] Handoff list unavailable:", markedError.message);
    return EMPTY_WAITING;
  }

  for (const row of marked ?? []) {
    if (!isHandoffBody(row.body as string | null)) continue;
    const conversationId = row.conversation_id as string;
    const createdAt = row.created_at as string;
    const previous = handoffAt.get(conversationId);
    if (!previous || createdAt > previous) handoffAt.set(conversationId, createdAt);
  }

  const conversationIds = [...handoffAt.keys()];
  if (conversationIds.length === 0) return EMPTY_WAITING;

  const since = [...handoffAt.values()].sort()[0];
  const [{ data: convos, error: convoError }, { data: replies, error: replyError }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id, client_id, freelancer_id")
        .in("id", conversationIds),
      supabase
        .from("messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", conversationIds)
        .eq("sender_id", adminId)
        .gte("created_at", since),
    ]);

  if (convoError || replyError) {
    console.warn(
      "[Messages] Handoff list unavailable:",
      convoError?.message || replyError?.message,
    );
    return EMPTY_WAITING;
  }

  const answered = new Set<string>();
  for (const message of replies ?? []) {
    const conversationId = message.conversation_id as string;
    const at = handoffAt.get(conversationId);
    if (!at || (message.created_at as string) <= at) continue;
    if (isAiSentBody(message.body as string | null)) continue;
    answered.add(conversationId);
  }

  const userIds = new Set<string>();
  const conversationByUserId = new Map<string, string>();
  for (const convo of convos ?? []) {
    const conversationId = convo.id as string;
    if (answered.has(conversationId)) continue;
    const otherId =
      convo.client_id === adminId ? convo.freelancer_id : convo.client_id;
    if (!otherId || otherId === adminId) continue;
    const other = otherId as string;
    userIds.add(other);
    const previous = conversationByUserId.get(other);
    const previousAt = previous ? handoffAt.get(previous) : undefined;
    const thisAt = handoffAt.get(conversationId);
    if (!previous || (thisAt && (!previousAt || thisAt > previousAt))) {
      conversationByUserId.set(other, conversationId);
    }
  }

  return { userIds, conversationByUserId };
}
