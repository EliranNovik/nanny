import { supabase } from "@/lib/supabase";

export const CHAT_MESSAGE_PAGE_SIZE = 50;

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
};

export type ChatConversation = {
  id: string;
  job_id: string | null;
  client_id: string;
  freelancer_id: string;
  created_at: string;
};

export type ChatProfile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  phone: string | null;
  whatsapp_number_e164?: string | null;
  telegram_username?: string | null;
  share_whatsapp?: boolean;
  share_telegram?: boolean;
  bio?: string | null;
  role?: "client" | "freelancer";
  rating_avg?: number;
  rating_count?: number;
  categories?: string[];
};

const JOB_SELECT =
  "id, client_id, selected_freelancer_id, status, stage, care_type, children_count, children_age_group, location_city, start_at, created_at, offered_hourly_rate, price_offer_status, schedule_confirmed, service_type, service_details, time_duration, care_frequency, community_post_id, community_post_expires_at, notes";

export type ChatThreadPayload = {
  conversation: ChatConversation;
  messages: ChatMessage[];
  otherUser: ChatProfile | null;
  job: Record<string, unknown> | null;
  realtimeConvoIds: string[];
  otherUserId: string;
  hasMoreOlder: boolean;
};

async function resolveConversationIds(
  userId: string,
  otherId: string,
  fallbackConversationId: string,
): Promise<string[]> {
  const { data: allConversations } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(client_id.eq.${userId},freelancer_id.eq.${otherId}),and(client_id.eq.${otherId},freelancer_id.eq.${userId})`,
    );
  const ids = (allConversations ?? []).map((c) => c.id);
  if (ids.length === 0) {
    return fallbackConversationId ? [fallbackConversationId] : [];
  }
  return ids;
}

async function loadMergedMessages(
  userId: string,
  otherId: string,
  fallbackConversationId: string,
  options?: { limit?: number; beforeCreatedAt?: string },
): Promise<{ messages: ChatMessage[]; multiIds: string[]; hasMoreOlder: boolean }> {
  const limit = options?.limit ?? CHAT_MESSAGE_PAGE_SIZE;
  const ids = await resolveConversationIds(
    userId,
    otherId,
    fallbackConversationId,
  );

  if (ids.length === 0) {
    return { messages: [], multiIds: [], hasMoreOlder: false };
  }

  let query = supabase
    .from("messages")
    .select("*")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options?.beforeCreatedAt) {
    query = query.lt("created_at", options.beforeCreatedAt);
  }

  const { data: rows } = await query;
  const fetched = (rows ?? []) as ChatMessage[];
  const hasMoreOlder = fetched.length > limit;
  const page = hasMoreOlder ? fetched.slice(0, limit) : fetched;
  page.reverse();

  return { messages: page, multiIds: ids, hasMoreOlder };
}

async function loadOtherProfile(otherId: string): Promise<ChatProfile | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, photo_url, city, phone, role, whatsapp_number_e164, telegram_username, share_whatsapp, share_telegram, categories",
    )
    .eq("id", otherId)
    .single();
  if (!profile) return null;
  if (profile.role !== "freelancer") return profile as ChatProfile;
  const { data: freelancerData } = await supabase
    .from("freelancer_profiles")
    .select("bio, rating_avg, rating_count")
    .eq("user_id", otherId)
    .single();
  if (!freelancerData) return profile as ChatProfile;
  return {
    ...profile,
    bio: freelancerData.bio,
    rating_avg: freelancerData.rating_avg,
    rating_count: freelancerData.rating_count,
  } as ChatProfile;
}

export async function fetchOlderChatMessages(
  userId: string,
  otherId: string,
  fallbackConversationId: string,
  beforeCreatedAt: string,
  limit = CHAT_MESSAGE_PAGE_SIZE,
): Promise<{ messages: ChatMessage[]; hasMoreOlder: boolean }> {
  const pack = await loadMergedMessages(userId, otherId, fallbackConversationId, {
    limit,
    beforeCreatedAt,
  });
  return { messages: pack.messages, hasMoreOlder: pack.hasMoreOlder };
}

export async function fetchChatThread(
  conversationId: string,
  userId: string,
  propOtherUserId?: string,
): Promise<ChatThreadPayload | null> {
  const { data: convo, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (error || !convo) return null;

  const otherId =
    propOtherUserId ||
    (convo.client_id === userId ? convo.freelancer_id : convo.client_id);

  const [msgPack, profile, jobData] = await Promise.all([
    loadMergedMessages(userId, otherId, conversationId, {
      limit: CHAT_MESSAGE_PAGE_SIZE,
    }),
    loadOtherProfile(otherId),
    convo.job_id
      ? supabase
          .from("job_requests")
          .select(JOB_SELECT)
          .eq("id", convo.job_id)
          .single()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);

  const realtimeConvoIds =
    msgPack.multiIds.length > 0 ? msgPack.multiIds : [conversationId];

  return {
    conversation: convo as ChatConversation,
    messages: msgPack.messages,
    otherUser: profile,
    job: jobData as Record<string, unknown> | null,
    realtimeConvoIds,
    otherUserId: otherId,
    hasMoreOlder: msgPack.hasMoreOlder,
  };
}
