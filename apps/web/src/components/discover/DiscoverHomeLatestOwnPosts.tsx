import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import {
  EXPLORE_PAGE_AVATAR_RING,
  EXPLORE_PAGE_CARD_SURFACE,
  INTERACTIVE_CARD_HOVER,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import {
  DISCOVER_HOME_CATEGORIES,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

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
  const last =
    parts.length > 1
      ? (parts[parts.length - 1]?.[0] ?? "")
      : (parts[0]?.[1] ?? "");
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
  "ring-1 ring-emerald-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
);

function LiveExpiryRow({ expiresAtIso }: { expiresAtIso: string }) {
  return (
    <div
      className="mt-1 flex min-w-0 items-center gap-1.5"
      role="status"
      aria-live="polite"
    >
      <Clock
        className="h-4 w-4 shrink-0 text-emerald-600 sm:h-3.5 sm:w-3.5 dark:text-emerald-400"
        aria-hidden
      />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
        Live
      </span>
      <ExpiryCountdown
        expiresAtIso={expiresAtIso}
        compact
        endedLabel="Ended"
        className="!font-mono text-xs font-semibold tabular-nums text-emerald-700 sm:text-[11px] dark:text-emerald-400"
      />
    </div>
  );
}

/**
 * Latest active availability posts by the viewer, with hire-interest counts and client avatars.
 * Strip: embedded on Discover home (max 4). Page: full Explore view with empty state + higher limit.
 */
export function DiscoverHomeLatestOwnPosts({
  variant = "strip",
  embeddedInExplore = false,
}: {
  variant?: "strip" | "page";
  /** When true with `page`, hide duplicate section title (Explore provides tab labels). */
  embeddedInExplore?: boolean;
}) {
  const explorePageCards = embeddedInExplore && variant === "page";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<LatestOwnPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectCountByPostId, setConnectCountByPostId] = useState<
    Record<string, number>
  >({});
  const [connectAvatarsByPostId, setConnectAvatarsByPostId] = useState<
    Record<
      string,
      { id: string; photo_url: string | null; full_name: string | null }[]
    >
  >({});
  const [confirmedJobIdByPostId, setConfirmedJobIdByPostId] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!user?.id) {
      setPosts([]);
      setConnectCountByPostId({});
      setConnectAvatarsByPostId({});
      setConfirmedJobIdByPostId({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const nowIso = new Date().toISOString();
      let postQuery = supabase
        .from("community_posts")
        .select("id, title, category, created_at, expires_at")
        .eq("author_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      /** Home strip: only upcoming / live pulses. Explore "Others hire requests": include ended pulses so hire-interest cards stay visible (confirmed or pending). */
      if (variant !== "page") {
        postQuery = postQuery.gt("expires_at", nowIso);
      }
      const { data: postRows, error: postErr } = await postQuery.limit(
        variant === "page" ? 50 : 4,
      );

      if (cancelled) return;
      if (postErr) {
        console.warn("[DiscoverHomeLatestOwnPosts] community_posts", postErr);
        setPosts([]);
        setConnectCountByPostId({});
        setConnectAvatarsByPostId({});
        setConfirmedJobIdByPostId({});
        setLoading(false);
        return;
      }

      const rows = (postRows ?? []) as LatestOwnPost[];
      setPosts(rows);

      if (rows.length === 0) {
        setConnectCountByPostId({});
        setConnectAvatarsByPostId({});
        setConfirmedJobIdByPostId({});
        setLoading(false);
        return;
      }

      const postIds = rows.map((p) => p.id);
      const { data: interestRows, error: intErr } = await supabase
        .from("community_post_hire_interests")
        .select(
          `
          community_post_id,
          client_id,
          created_at,
          status,
          job_request_id,
          client:profiles!client_id ( id, photo_url, full_name )
        `,
        )
        .in("community_post_id", postIds)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (intErr) {
        console.warn("[DiscoverHomeLatestOwnPosts] hire interests", intErr);
        setConnectCountByPostId({});
        setConnectAvatarsByPostId({});
        setConfirmedJobIdByPostId({});
        setLoading(false);
        return;
      }

      const raw = (interestRows ?? []) as {
        community_post_id: string;
        client_id: string;
        created_at: string;
        status: string;
        job_request_id: string | null;
        client:
          | { id: string; photo_url: string | null; full_name: string | null }
          | { id: string; photo_url: string | null; full_name: string | null }[]
          | null;
      }[];

      const sortedInterest = [...raw].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      );
      const confirmedJobByPost: Record<string, string> = {};
      for (const r of sortedInterest) {
        const pid = String(r.community_post_id);
        const st = String(r.status || "").toLowerCase();
        const jid =
          r.job_request_id != null ? String(r.job_request_id).trim() : "";
        if (st === "confirmed" && jid && !confirmedJobByPost[pid]) {
          confirmedJobByPost[pid] = jid;
        }
      }
      setConfirmedJobIdByPostId(confirmedJobByPost);

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

      const profileMap = new Map<
        string,
        { photo_url: string | null; full_name: string | null }
      >();
      for (const r of raw) {
        const cRaw = r.client;
        const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
        const id = c?.id != null ? String(c.id) : "";
        if (!id || profileMap.has(id)) continue;
        profileMap.set(id, {
          photo_url: c?.photo_url ?? null,
          full_name: c?.full_name ?? null,
        });
      }

      const avatars: Record<
        string,
        { id: string; photo_url: string | null; full_name: string | null }[]
      > = {};
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
  }, [user?.id, variant]);

  if (!user?.id) return null;
  if (variant === "strip" && !loading && posts.length === 0) return null;

  const availabilityListUrl = "/availability";

  function openOwnPostCard(postId: string) {
    const jobId = confirmedJobIdByPostId[postId];
    if (jobId) {
      navigate(
        `${buildJobsUrl("freelancer", "jobs")}&highlightJob=${encodeURIComponent(jobId)}`,
      );
      return;
    }
    navigate(`/availability/post/${encodeURIComponent(postId)}/hires`);
  }

  const postCard = (r: LatestOwnPost) => {
    const count = connectCountByPostId[r.id] || 0;
    const clients = connectAvatarsByPostId[r.id] || [];
    const imgSrc = postCategoryImageSrc(r.category);
    const subtitle =
      formatCategoryLabel(r.category || "") || "Availability";
    return (
      <button
        type="button"
        onClick={() => openOwnPostCard(r.id)}
        className={cn(
          "group relative w-full rounded-2xl p-4 text-left",
          explorePageCards
            ? EXPLORE_PAGE_CARD_SURFACE
            : "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
          INTERACTIVE_CARD_HOVER,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        )}
      >
        {count > 0 ? (
          <span className={connectBadgeClass}>{count}</span>
        ) : null}
        <div
          className={cn(
            "flex items-start justify-between gap-3",
            count > 0 ? "pr-9" : undefined,
          )}
        >
          <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
            {formatPostHeading(r)}
          </p>
          <div className="flex shrink-0 items-center">
            <div className="flex -space-x-2.5">
              {clients.slice(0, 3).map((p) => (
                <Avatar
                  key={p.id}
                  className={cn(
                    "h-10 w-10",
                    explorePageCards
                      ? EXPLORE_PAGE_AVATAR_RING
                      : "border-2 border-background shadow-md",
                  )}
                >
                  <AvatarImage
                    src={p.photo_url || undefined}
                    className="object-cover"
                  />
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
            {imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-black/15" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-muted-foreground">
              {subtitle}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Posted {new Date(r.created_at).toLocaleDateString()}
            </p>
            <LiveExpiryRow expiresAtIso={r.expires_at} />
            {embeddedInExplore && variant === "page" ? (
              <p className="mt-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {count === 0
                  ? "No hire requests yet"
                  : `${count} hire request${count === 1 ? "" : "s"}`}
              </p>
            ) : null}
          </div>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
            strokeWidth={2}
          />
        </div>
      </button>
    );
  };

  return (
    <section
      className={cn(variant === "page" ? "mt-0" : "mt-4 px-1 md:mt-5")}
      aria-label="Your latest availability posts"
    >
      <div
        className={cn(
          "mb-2 flex items-center gap-3",
          embeddedInExplore && variant === "page"
            ? "justify-end"
            : "justify-between",
        )}
      >
        {!(embeddedInExplore && variant === "page") ? (
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {variant === "page" ? "Your live posts" : "Your latest posts"}
            </p>
            {variant === "page" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Tap a card to see who responded to Hire on that post.
              </p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => navigate(availabilityListUrl)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          Show more
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-4 text-sm text-muted-foreground">
          {variant === "page"
            ? "Loading your posts…"
            : "Loading your latest posts…"}
        </div>
      ) : variant === "page" && posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/20 px-4 py-10 text-center">
          <p className="text-base font-semibold text-foreground">
            {embeddedInExplore
              ? "No availability posts yet"
              : "No live availability posts"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {embeddedInExplore
              ? "Post availability so clients can tap Hire — hire request counts show on each card here."
              : "Post availability so clients can tap Hire — responses show up here."}
          </p>
          <Link
            to="/availability/post-now"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Post availability
          </Link>
        </div>
      ) : variant === "page" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((r) => (
            <Fragment key={r.id}>{postCard(r)}</Fragment>
          ))}
        </div>
      ) : (
        <>
          <div className="sm:hidden">
            {posts.slice(0, 1).map((r) => {
              const count = connectCountByPostId[r.id] || 0;
              const clients = connectAvatarsByPostId[r.id] || [];
              const imgSrc = postCategoryImageSrc(r.category);
              const subtitle =
                formatCategoryLabel(r.category || "") || "Availability";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openOwnPostCard(r.id)}
                  className={cn(
                    "group relative w-full rounded-xl p-3 text-left",
                    explorePageCards
                      ? EXPLORE_PAGE_CARD_SURFACE
                      : "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
                    INTERACTIVE_CARD_HOVER,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                  )}
                >
                  {count > 0 ? (
                    <span className={connectBadgeClass}>{count}</span>
                  ) : null}
                  <div
                    className={cn(
                      "flex items-start justify-between gap-3",
                      count > 0 ? "pr-9" : undefined,
                    )}
                  >
                    <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {formatPostHeading(r)}
                    </p>
                    <div className="flex shrink-0 items-center">
                      <div className="flex -space-x-2.5">
                        {clients.slice(0, 3).map((p) => (
                          <Avatar
                            key={p.id}
                            className={cn(
                              "h-9 w-9",
                              explorePageCards
                                ? EXPLORE_PAGE_AVATAR_RING
                                : "border-2 border-background shadow-md",
                            )}
                          >
                            <AvatarImage
                              src={p.photo_url || undefined}
                              className="object-cover"
                            />
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
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="pointer-events-none absolute inset-0 bg-black/15" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-muted-foreground">
                        {subtitle}
                      </p>
                      <p className="mt-0.5 text-base text-muted-foreground">
                        Posted {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <LiveExpiryRow expiresAtIso={r.expires_at} />
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                      strokeWidth={2}
                    />
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
              const subtitle =
                formatCategoryLabel(r.category || "") || "Availability";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openOwnPostCard(r.id)}
                  className={cn(
                    "group relative w-full rounded-2xl p-4 text-left",
                    explorePageCards
                      ? EXPLORE_PAGE_CARD_SURFACE
                      : "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
                    INTERACTIVE_CARD_HOVER,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                  )}
                >
                  {count > 0 ? (
                    <span className={connectBadgeClass}>{count}</span>
                  ) : null}
                  <div
                    className={cn(
                      "flex items-start justify-between gap-3",
                      count > 0 ? "pr-9" : undefined,
                    )}
                  >
                    <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {formatPostHeading(r)}
                    </p>
                    <div className="flex shrink-0 items-center">
                      <div className="flex -space-x-2.5">
                        {clients.slice(0, 3).map((p) => (
                          <Avatar
                            key={p.id}
                            className={cn(
                              "h-10 w-10",
                              explorePageCards
                                ? EXPLORE_PAGE_AVATAR_RING
                                : "border-2 border-background shadow-md",
                            )}
                          >
                            <AvatarImage
                              src={p.photo_url || undefined}
                              className="object-cover"
                            />
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
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="pointer-events-none absolute inset-0 bg-black/15" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-muted-foreground">
                        {subtitle}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Posted {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <LiveExpiryRow expiresAtIso={r.expires_at} />
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                      strokeWidth={2}
                    />
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
