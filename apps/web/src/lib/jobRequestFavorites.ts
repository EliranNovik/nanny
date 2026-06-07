import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { supabase } from "@/lib/supabase";

export async function fetchJobRequestFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("job_request_favorites")
    .select("job_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.job_id as string));
}

export async function toggleJobRequestFavorite(
  userId: string,
  jobId: string,
  currentlySaved: boolean,
): Promise<void> {
  if (currentlySaved) {
    const { error } = await supabase
      .from("job_request_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("job_id", jobId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("job_request_favorites").insert({
    user_id: userId,
    job_id: jobId,
  });
  if (error) throw error;
}

export async function fetchSavedOpenHelpRequests(): Promise<DiscoverOpenHelpRequestRow[]> {
  const { data, error } = await supabase.rpc("get_saved_open_help_requests");
  if (error) throw error;
  return (data ?? []) as DiscoverOpenHelpRequestRow[];
}
