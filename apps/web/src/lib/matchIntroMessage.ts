import { supabase } from "@/lib/supabase";

const PREFIX = "__MATCH_CTX__:";

export type MatchIntroPayload = {
  category: string;
  location: string;
  time: string;
  kind: "helper" | "job";
};

export function formatMatchIntroBody(payload: MatchIntroPayload): string {
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function parseMatchIntroBody(body: string | null): MatchIntroPayload | null {
  if (!body?.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PREFIX.length)) as MatchIntroPayload;
  } catch {
    return null;
  }
}

export async function insertMatchIntroMessage(params: {
  conversationId: string;
  senderId: string;
  payload: MatchIntroPayload;
}): Promise<void> {
  const { conversationId, senderId, payload } = params;
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: formatMatchIntroBody(payload),
  });
  if (error) throw error;
}
