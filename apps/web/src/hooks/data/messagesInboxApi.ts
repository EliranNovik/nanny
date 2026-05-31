import { supabase } from "@/lib/supabase";
import type { JobSummaryRow } from "@/lib/chatJobContext";

export type InboxConversation = {
  id: string;
  job_id: string | null;
  client_id: string;
  freelancer_id: string;
  created_at: string;
  other_user_id?: string;
  other_user_profile?: {
    full_name: string | null;
    photo_url: string | null;
    city?: string | null;
    is_verified?: boolean | null;
  };
  job_summary?: JobSummaryRow | null;
  last_message?:
    | {
        body: string | null;
        created_at: string;
        sender_id: string;
        read_at: string | null;
        read_by: string | null;
        attachment_type?: string | null;
        attachment_name?: string | null;
      }
    | undefined;
  unread_count: number;
};

async function attachJobSummaries(
  sortedConversations: InboxConversation[],
): Promise<InboxConversation[]> {
  const jobIds = [
    ...new Set(
      sortedConversations
        .map((c) => c.job_id)
        .filter((id): id is string => !!id),
    ),
  ];
  if (jobIds.length === 0) return sortedConversations;
  const { data: jobRows } = await supabase
    .from("job_requests")
    .select("id, status, stage, service_type, care_type, location_city, start_at")
    .in("id", jobIds);
  const jm = new Map(
    (jobRows ?? []).map((j) => [j.id as string, j as JobSummaryRow]),
  );
  return sortedConversations.map((c) =>
    c.job_id && jm.has(c.job_id)
      ? { ...c, job_summary: jm.get(c.job_id)! }
      : c,
  );
}

async function loadInboxLegacy(userId: string): Promise<InboxConversation[]> {
  const { data: convos } = await supabase
    .from("conversations")
    .select("id, job_id, client_id, freelancer_id, created_at")
    .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!convos?.length) return [];

  const conversationsByUser = new Map<string, typeof convos>();
  for (const convo of convos) {
    const otherUserId =
      convo.client_id === userId ? convo.freelancer_id : convo.client_id;
    if (otherUserId === userId) continue;
    if (!conversationsByUser.has(otherUserId)) {
      conversationsByUser.set(otherUserId, []);
    }
    conversationsByUser.get(otherUserId)!.push(convo);
  }

  if (conversationsByUser.size === 0) return [];

  const uniqueOtherIds = Array.from(conversationsByUser.keys());
  const { data: profilesRows } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url, city, is_verified")
    .in("id", uniqueOtherIds);

  const profileById = new Map((profilesRows ?? []).map((p) => [p.id, p]));
  const entries = Array.from(conversationsByUser.entries());
  const BATCH = 8;
  const enriched: InboxConversation[] = [];

  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const batch = await Promise.all(
      slice.map(async ([otherUserId, userConversations]) => {
        const conversationIds = userConversations.map((c) => c.id);
        const otherProfile = profileById.get(otherUserId);

        const [messagesRes, unreadRes] = await Promise.all([
          supabase
            .from("messages")
            .select(
              "body, created_at, sender_id, read_at, read_by, attachment_type, attachment_name, conversation_id",
            )
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", conversationIds)
            .eq("sender_id", otherUserId)
            .is("read_at", null),
        ]);

        const row = messagesRes.data;
        const mostRecentConversationId =
          row?.conversation_id || userConversations[0].id;
        const mostRecentConversation =
          userConversations.find((c) => c.id === mostRecentConversationId) ||
          userConversations[0];

        const last_message = row
          ? {
              body: row.body,
              created_at: row.created_at,
              sender_id: row.sender_id,
              read_at: row.read_at,
              read_by: row.read_by,
              attachment_type: row.attachment_type,
              attachment_name: row.attachment_name,
            }
          : undefined;

        return {
          ...mostRecentConversation,
          other_user_id: otherUserId,
          other_user_profile: {
            full_name: otherProfile?.full_name || null,
            photo_url: otherProfile?.photo_url || null,
            city: otherProfile?.city || null,
            is_verified: otherProfile?.is_verified ?? null,
          },
          last_message,
          unread_count: unreadRes.count ?? 0,
        } as InboxConversation;
      }),
    );
    enriched.push(...batch);
  }

  return enriched.sort((a, b) => {
    const timeA = a.last_message?.created_at
      ? new Date(a.last_message.created_at).getTime()
      : 0;
    const timeB = b.last_message?.created_at
      ? new Date(b.last_message.created_at).getTime()
      : 0;
    return timeB - timeA;
  });
}

export async function fetchMessagesInbox(
  userId: string,
): Promise<InboxConversation[]> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "get_messages_inbox_preview",
    { p_user_id: userId },
  );

  if (!rpcError && Array.isArray(rpcRows)) {
    if (rpcRows.length === 0) return [];

    const uniqueOtherIds = [
      ...new Set(
        (rpcRows as Record<string, unknown>[]).map(
          (r) => r.other_user_id as string,
        ),
      ),
    ];
    const { data: profilesRows } = await supabase
      .from("profiles")
      .select("id, full_name, photo_url, city, is_verified")
      .in("id", uniqueOtherIds);

    const profileById = new Map((profilesRows ?? []).map((p) => [p.id, p]));

    const sorted: InboxConversation[] = (
      rpcRows as Record<string, unknown>[]
    ).map((row) => {
      const oid = row.other_user_id as string;
      const op = profileById.get(oid);
      const lastCreated = row.last_created_at as string | null | undefined;
      const hasLast = Boolean(lastCreated);
      return {
        id: row.conversation_id as string,
        job_id: (row.job_id as string | null) ?? null,
        client_id: row.client_id as string,
        freelancer_id: row.freelancer_id as string,
        created_at: row.created_at as string,
        other_user_id: oid,
        other_user_profile: {
          full_name: op?.full_name ?? null,
          photo_url: op?.photo_url ?? null,
          city: (op?.city as string | null) ?? null,
          is_verified: (op?.is_verified as boolean | null) ?? null,
        },
        last_message: hasLast
          ? {
              body: (row.last_body as string | null) ?? null,
              created_at: lastCreated as string,
              sender_id: row.last_sender_id as string,
              read_at: (row.last_read_at as string | null) ?? null,
              read_by: (row.last_read_by as string | null) ?? null,
              attachment_type:
                (row.last_attachment_type as string | null) ?? null,
              attachment_name:
                (row.last_attachment_name as string | null) ?? null,
            }
          : undefined,
        unread_count: Number(row.unread_count ?? 0),
      };
    });

    return attachJobSummaries(sorted);
  }

  if (rpcError) {
    console.warn(
      "[fetchMessagesInbox] get_messages_inbox_preview unavailable, legacy load",
      rpcError,
    );
  }

  const legacy = await loadInboxLegacy(userId);
  return attachJobSummaries(legacy);
}
