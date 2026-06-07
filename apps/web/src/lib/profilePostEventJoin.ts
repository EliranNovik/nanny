import type { SupabaseClient } from "@supabase/supabase-js";

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
  profiles?: EventJoinInterestProfile | EventJoinInterestProfile[] | null;
};

export async function hasEventJoinInterest(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profile_post_event_join_interests")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function recordEventJoinInterest(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<{ alreadyJoined: boolean }> {
  const { error } = await supabase
    .from("profile_post_event_join_interests")
    .insert({ post_id: postId, user_id: userId });

  if (error?.code === "23505") {
    return { alreadyJoined: true };
  }
  if (error) throw error;
  return { alreadyJoined: false };
}

export function normalizeJoinInterestProfile(
  profiles: EventJoinInterestRow["profiles"],
): EventJoinInterestProfile | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}
