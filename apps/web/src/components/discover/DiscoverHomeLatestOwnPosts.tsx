import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { DISCOVER_HOME_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";

type LatestOwnPost = {
  id: string;
  title: string | null;
  category: string | null;
  created_at: string;
  expires_at: string;
};

function initials(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  if (!t) return "??";
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : (parts[0]?.[1] ?? "");
  const s = (first + last).toUpperCase();
  return s || "??";
}

function formatCategoryLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t
    .split("_")
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatPostHeading(p: LatestOwnPost): string {
  const title = p.title?.trim();
  if (title) return title;
  const cat = formatCategoryLabel(p.category || "");
  if (cat) return cat;
  return "Availability post";
}

function postCategoryImageSrc(category: string | null): string | null {
  const id = (category || "").trim();
  if (!id) return null;
  const fromService = SERVICE_CATEGORIES.find((c) => c.id === id)?.imageSrc;
  if (fromService) return fromService;
  return DISCOVER_HOME_CATEGORIES.find((c) => c.id === id)?.imageSrc ?? null;
}

const connectBadgeClass = cn(
  "absolute right-1.5 top-1.5 z-[1] inline-flex h-6 min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums leading-none text-white shadow-sm",
  "bg-gradient-to-r from-emerald-500 to-teal-600",
  "ring-1 ring-emerald-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
);

function LiveExpiryRow({ expiresAtIso }: { expiresAtIso: string }) {
  return (
    <div className="mt-1 flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
      <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live</span>
      <ExpiryCountdown
        expiresAtIso={expiresAtIso}
        compact
        endedLabel="Ended"
        className="!font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
      />
    </div>
  );
}

/**
 * Help others tab: latest active availability posts by the viewer, with Connect (hire) interest
 * counts and client avatars. Tapping a card opens the hires / availability review screen.
 */
export function DiscoverHomeLatestOwnPosts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<LatestOwnPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectCountByPostId, setConnectCountByPostId] = useState<Record<string, number>>({});
  const [connectAvatarsByPostId, setConnectAvatarsByPostId] = useState<
    Record<string, { id: string; photo_url: string | null; full_name: string | null }[]>
  >({});

  useEffect(() => {
    if (!user?.id) {
      setPosts([]);
      setConnectCountByPostId({});
      setConnectAvatarsByPostId({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const nowIso = new Date().toISOString();
      const { data: postRows, error: postErr } = await supabase
        .from("community_posts")
        .select("id, title, category, created_at, expires_at")
        .eq("author_id", user.id)
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(4);

      if (cancelled) return;
      if (postErr) {
        console.warn("[DiscoverHomeLatestOwnPosts] community_posts", postErr);
        setPosts([]);
        setConnectCountByPostId({});
        setConnectAvatarsByPostId({});
        setLoading(false);
        return;
      }

      const rows = (postRows ?? []) as LatestOwnPost[];
      setPosts(rows);

      if (rows.length === 0) {
        setConnectCountByPostId({});
        setConnectAvatarsByPostId({});
        setLoading(false);
        return;
      }

      const postIds = rows.map((p) => p.id);
      const { data: interestRows, error: intErr } = await supabase
        .from("community_post_hire_interests")
        .select("community_post_id, client_id, created_at, status")
        .in("community_post_id", postIds)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (intErr) {
        console.warn("[DiscoverHomeLatestOwnPosts] hire interests", intErr);
        setConnectCountByPostId({});
        setConnectAvatarsByPostId({});
        setLoading(false);
        return;
      }

      const raw = (interestRows ?? []) as {
        community_post_id: string;
        client_id: string;
        created_at: string;
      }[];

      const counts: Record<string, number> = {};
      for (const r of raw) {
        const pid = String(r.community_post_id);
        counts[pid] = (counts[pid] || 0) + 1;
      }

      const avatarClientIdsByPost: Record<string, string[]> = {};
      for (const pid of postIds) {
        const forPost = raw.filter((x) => String(x.community_post_id) === pid);
        const seen = new Set<string>();
        const ids: string[] = [];
        for (const r of forPost) {
          const cid = String(r.client_id);
          if (!cid || seen.has(cid)) continue;
          seen.add(cid);
          ids.push(cid);
          if (ids.length >= 3) break;
        }
        avatarClientIdsByPost[pid] = ids;
      }

      const allClientIds = Array.from(new Set(Object.values(avatarClientIdsByPost).flat()));
      const profileMap = new Map<string, { photo_url: string | null; full_name: string | null }>();
      if (allClientIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, photo_url, full_name")
          .in("id", allClientIds);
        if (!pErr && profs) {
          for (const p of profs) {
            const row = p as { id: string; photo_url: string | null; full_name: string | null };
            profileMap.set(String(row.id), {
              photo_url: row.photo_url ?? null,
              full_name: row.full_name ?? null,
            });
          }
        }
      }

      const avatars: Record<string, { id: string; photo_url: string | null; full_name: string | null }[]> = {};
      for (const pid of postIds) {
        avatars[pid] = (avatarClientIdsByPost[pid] || []).map((cid) => ({
          id: cid,
          photo_url: profileMap.get(cid)?.photo_url ?? null,
          full_name: profileMap.get(cid)?.full_name ?? null,
        }));
      }

      setConnectCountByPostId(counts);
      setConnectAvatarsByPostId(avatars);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user?.id) return null;
  if (!loading && posts.length === 0) return null;

  const availabilityListUrl = "/availability";

  return (
    <section className="mt-4 px-1 md:mt-5" aria-label="Your latest availability posts">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Your latest posts
          </p>
          
        </div>
        <button
          type="button"
          onClick={() => navigate(availabilityListUrl)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          Show more
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-4 text-sm text-muted-foreground">
          Loading your latest posts…
        </div>
      ) : (
        <>
          <div className="sm:hidden">
            {posts.slice(0, 1).map((r) => {
              const count = connectCountByPostId[r.id] || 0;
              const clients = connectAvatarsByPostId[r.id] || [];
              const imgSrc = postCategoryImageSrc(r.category);
              const subtitle = formatCategoryLabel(r.category || "") || "Availability";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/availability/post/${encodeURIComponent(r.id)}/hires`)}
                  className={cn(
                    "relative w-full rounded-xl bg-muted/20 p-2.5 text-left transition-colors dark:bg-muted/40",
                    "hover:bg-muted/30 active:bg-muted/45 dark:hover:bg-muted/55 dark:active:bg-muted/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  {count > 0 ? <span className={connectBadgeClass}>{count}</span> : null}
                  <div
                    className={cn(
                      "flex items-start justify-between gap-3",
                      count > 0 ? "pr-9" : undefined
                    )}
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {formatPostHeading(r)}
                    </p>
                    <div className="flex shrink-0 items-center">
                      <div className="flex -space-x-2.5">
                        {clients.slice(0, 3).map((p) => (
                          <Avatar key={p.id} className="h-9 w-9 border-2 border-background shadow-md">
                            <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-card text-[11px] font-black text-foreground">
                              {initials(p.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div
                      className="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-xl border border-emerald-500/20 bg-muted/40 shadow-sm ring-1 ring-emerald-500/15"
                      aria-hidden
                    >
                      {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : null}
                      <div className="pointer-events-none absolute inset-0 bg-black/15" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-muted-foreground">{subtitle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Posted {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <LiveExpiryRow expiresAtIso={r.expires_at} />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:grid sm:grid-cols-1 sm:gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4 lg:gap-3">
            {posts.slice(0, 4).map((r) => {
              const count = connectCountByPostId[r.id] || 0;
              const clients = connectAvatarsByPostId[r.id] || [];
              const imgSrc = postCategoryImageSrc(r.category);
              const subtitle = formatCategoryLabel(r.category || "") || "Availability";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/availability/post/${encodeURIComponent(r.id)}/hires`)}
                  className={cn(
                    "relative w-full rounded-2xl bg-muted/20 p-4 text-left transition-colors dark:bg-muted/30",
                    "hover:bg-muted/25 active:bg-muted/40 dark:hover:bg-muted/45 dark:active:bg-muted/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  {count > 0 ? <span className={connectBadgeClass}>{count}</span> : null}
                  <div
                    className={cn(
                      "flex items-start justify-between gap-3",
                      count > 0 ? "pr-9" : undefined
                    )}
                  >
                    <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {formatPostHeading(r)}
                    </p>
                    <div className="flex shrink-0 items-center">
                      <div className="flex -space-x-2.5">
                        {clients.slice(0, 3).map((p) => (
                          <Avatar key={p.id} className="h-10 w-10 border-2 border-background shadow-md">
                            <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-card text-[11px] font-black text-foreground">
                              {initials(p.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-emerald-500/20 bg-muted/40 shadow-sm ring-1 ring-emerald-500/15"
                      aria-hidden
                    >
                      {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-cover" /> : null}
                      <div className="pointer-events-none absolute inset-0 bg-black/15" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-muted-foreground">{subtitle}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Posted {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <LiveExpiryRow expiresAtIso={r.expires_at} />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
