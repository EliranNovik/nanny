import type { SupabaseClient } from "@supabase/supabase-js";

export type EventJoinInterestStatus = "pending" | "accepted" | "declined";

export type EventJoinInterestProfile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

export type EventJoinInterestRow = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
  status?: EventJoinInterestStatus | null;
  profiles?: EventJoinInterestProfile | EventJoinInterestProfile[] | null;
};

export type EventPostHelperCounts = {
  accepted_count: number;
  pending_count: number;
  declined_count: number;
};

export async function getEventJoinInterestStatus(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<EventJoinInterestStatus | null> {
  const { data, error } = await supabase
    .from("profile_post_event_join_interests")
    .select("status")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const status = data.status as EventJoinInterestStatus | null;
  return status ?? "pending";
}

/** @deprecated Use getEventJoinInterestStatus */
export async function hasEventJoinInterest(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<boolean> {
  const status = await getEventJoinInterestStatus(supabase, postId, userId);
  return status != null;
}

export async function recordEventJoinInterest(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<{ alreadyJoined: boolean; status: EventJoinInterestStatus }> {
  const { error } = await supabase
    .from("profile_post_event_join_interests")
    .insert({ post_id: postId, user_id: userId, status: "pending" });

  if (error?.code === "23505") {
    const existing = await getEventJoinInterestStatus(supabase, postId, userId);
    return { alreadyJoined: true, status: existing ?? "pending" };
  }
  if (error) throw error;
  return { alreadyJoined: false, status: "pending" };
}

export async function updateEventJoinInterestStatus(
  supabase: SupabaseClient,
  interestId: string,
  status: EventJoinInterestStatus,
): Promise<void> {
  const { error } = await supabase
    .from("profile_post_event_join_interests")
    .update({ status })
    .eq("id", interestId);
  if (error) throw error;
}

export async function fetchEventPostHelperCounts(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, EventPostHelperCounts>> {
  const map = new Map<string, EventPostHelperCounts>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase.rpc("get_event_post_helper_counts", {
    p_post_ids: postIds,
  });
  if (error) throw error;

  for (const row of data ?? []) {
    const r = row as {
      post_id: string;
      accepted_count: number | string;
      pending_count: number | string;
      declined_count: number | string;
    };
    map.set(r.post_id, {
      accepted_count: Number(r.accepted_count),
      pending_count: Number(r.pending_count),
      declined_count: Number(r.declined_count),
    });
  }
  return map;
}

export function parseEventHelpersNeeded(
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  const raw = metadata?.helpers_needed;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function updateEventPostHelpersNeeded(
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  metadata: Record<string, unknown>,
  helpersNeeded: number | null,
): Promise<void> {
  const nextMetadata = { ...metadata };
  if (helpersNeeded != null && helpersNeeded > 0) {
    nextMetadata.helpers_needed = helpersNeeded;
  } else {
    delete nextMetadata.helpers_needed;
  }

  const { error } = await supabase
    .from("profile_posts")
    .update({ post_metadata: nextMetadata })
    .eq("id", postId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export function normalizeJoinInterestProfile(
  profiles: EventJoinInterestRow["profiles"],
): EventJoinInterestProfile | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}
