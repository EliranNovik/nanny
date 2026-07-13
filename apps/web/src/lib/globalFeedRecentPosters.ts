import { supabase } from "@/lib/supabase";
import { isJobOpenForDiscoverListing } from "@/lib/discoverOpenJobStatuses";

export type GlobalFeedRecentPoster = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  live_until: string | null;
  is_verified?: boolean | null;
  city?: string | null;
  average_rating?: number | null;
  total_ratings?: number | null;
};

const DEFAULT_MAX_POSTERS = 15;
const AUTHOR_POOL_SIZE = 48;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function fetchGlobalFeedRecentPosters(
  excludeUserId?: string | null,
  limit = DEFAULT_MAX_POSTERS,
): Promise<GlobalFeedRecentPoster[]> {
  const [{ data: posts, error: postsErr }, { data: jobs, error: jobsErr }] =
    await Promise.all([
      supabase
        .from("profile_posts")
        .select("author_id, created_at")
        .order("created_at", { ascending: false })
        .limit(AUTHOR_POOL_SIZE),
      supabase
        .from("job_requests")
        .select("client_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(AUTHOR_POOL_SIZE),
    ]);

  if (postsErr) throw postsErr;
  if (jobsErr) throw jobsErr;

  const recentAuthors: { id: string; ts: number }[] = [];

  for (const row of posts ?? []) {
    const id = String(row.author_id ?? "").trim();
    if (!id) continue;
    recentAuthors.push({
      id,
      ts: new Date(String(row.created_at)).getTime(),
    });
  }

  for (const row of jobs ?? []) {
    if (!isJobOpenForDiscoverListing(String(row.status ?? ""))) continue;
    const id = String(row.client_id ?? "").trim();
    if (!id) continue;
    recentAuthors.push({
      id,
      ts: new Date(String(row.created_at)).getTime(),
    });
  }

  recentAuthors.sort((a, b) => b.ts - a.ts);

  const seen = new Set<string>();
  const pool: string[] = [];
  for (const entry of recentAuthors) {
    if (excludeUserId && entry.id === excludeUserId) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    pool.push(entry.id);
    if (pool.length >= AUTHOR_POOL_SIZE) break;
  }

  const pickedIds = shuffle(pool).slice(0, Math.max(1, limit));
  if (pickedIds.length === 0) return [];

  const [{ data: profiles, error: profileErr }, { data: fpRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, photo_url, is_verified, city, average_rating, total_ratings")
        .in("id", pickedIds),
      supabase
        .from("freelancer_profiles")
        .select("user_id, live_until")
        .in("user_id", pickedIds),
    ]);
  if (profileErr) throw profileErr;

  const liveUntilByUser = new Map(
    (fpRows ?? []).map((row) => [
      row.user_id as string,
      (row.live_until as string | null) ?? null,
    ]),
  );

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        photo_url: (p.photo_url as string | null) ?? null,
        live_until: liveUntilByUser.get(p.id as string) ?? null,
        is_verified: (p.is_verified as boolean | null) ?? null,
        city: (p.city as string | null) ?? null,
        average_rating: (p.average_rating as number | null) ?? null,
        total_ratings: (p.total_ratings as number | null) ?? null,
      } satisfies GlobalFeedRecentPoster,
    ]),
  );

  return pickedIds
    .map((id) => profileMap.get(id))
    .filter(Boolean) as GlobalFeedRecentPoster[];
}
