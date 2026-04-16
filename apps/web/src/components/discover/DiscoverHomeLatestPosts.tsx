import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { INTERACTIVE_CARD_HOVER } from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ChevronRight, Radio, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type FeedPost = {
  id: string;
  title: string;
  category: string | null;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  author_id: string;
  author?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  } | null;
};

type PostImage = {
  post_id: string;
  image_url: string;
  sort_order: number;
};

type PostCardRow = FeedPost & { coverUrl: string | null };

/** Row shape from `community_posts` select before normalizing embedded `author` */
type RawLatestPostRow = {
  id: string;
  title: string;
  category: string | null;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  author_id: string;
  author: unknown;
};

/** Supabase may return embedded `profiles` as one object or a one-element array */
function normalizeFeedPostRow(row: RawLatestPostRow): FeedPost {
  const a = row.author;
  let author: FeedPost["author"] = null;
  if (a != null) {
    author = Array.isArray(a)
      ? ((a[0] as FeedPost["author"]) ?? null)
      : (a as FeedPost["author"]);
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    note: row.note,
    created_at: row.created_at,
    expires_at: row.expires_at,
    author_id: row.author_id,
    author,
  };
}

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

function clampText(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(0, n - 1)).trimEnd()}…`;
}

function safeWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function DiscoverHomeLatestPosts() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PostCardRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("community_posts")
        .select(
          `
            id, title, category, note, created_at, expires_at, author_id,
            author:profiles!author_id (
              id,
              full_name,
              photo_url
            )
          `,
        )
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(6);

      if (cancelled) return;
      if (error) {
        console.warn("[DiscoverHomeLatestPosts] community_posts:", error);
        setRows([]);
        setLoading(false);
        return;
      }

      const posts: FeedPost[] = (data ?? []).map((row) =>
        normalizeFeedPostRow(row as RawLatestPostRow),
      );
      if (posts.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const postIds = posts.map((p) => p.id);
      const { data: imgs, error: imgErr } = await supabase
        .from("community_post_images")
        .select("post_id, image_url, sort_order")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (imgErr) {
        console.warn(
          "[DiscoverHomeLatestPosts] community_post_images:",
          imgErr,
        );
      }

      const coverByPost = new Map<string, string>();
      for (const img of (imgs ?? []) as PostImage[]) {
        if (!coverByPost.has(img.post_id) && img.image_url) {
          coverByPost.set(img.post_id, img.image_url);
        }
      }

      const merged: PostCardRow[] = posts.map((p) => ({
        ...p,
        coverUrl: coverByPost.get(p.id) ?? null,
      }));
      setRows(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => rows.slice(0, 6), [rows]);
  const preview = visible[0] ?? null;

  if (loading && !preview) {
    return (
      <section className="w-full" aria-label="Live activity on the board">
        <div className="flex items-center justify-between gap-3 pb-3 pt-1">
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-tight text-stone-900 sm:text-2xl dark:text-white">
              Live activity
            </h2>
            <p className="text-xs font-medium text-muted-foreground">
              Loading…
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!preview) return null;

  const openPost = (postId: string) => {
    setIsOpen(false);
    navigate(`/public/posts?post=${encodeURIComponent(postId)}`);
  };

  const PostCard = ({
    post,
    showChevron,
  }: {
    post: PostCardRow;
    showChevron?: boolean;
  }) => {
    const title = post.title?.trim() || "Post";
    const note = (post.note || "").trim();
    const when = safeWhen(post.created_at);
    const authorName = post.author?.full_name?.trim() || "User";
    return (
      <button
        type="button"
        onClick={() => openPost(post.id)}
        className={cn(
          "group w-full rounded-2xl bg-white dark:bg-zinc-900 px-4 py-4 text-left",
          "border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
          INTERACTIVE_CARD_HOVER,
          "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label="Open post"
      >
        <div className="flex items-start gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-muted dark:border-white/5">
            {post.coverUrl ? (
              <img
                src={post.coverUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-background">
                <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                  <AvatarImage
                    src={post.author?.photo_url || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-orange-500/10 text-orange-600 text-xs font-black dark:bg-orange-500/15 dark:text-orange-400">
                    {initials(authorName)}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-base font-black leading-snug text-stone-900 dark:text-white">
                {title}
              </p>
              {showChevron ? (
                <ChevronRight
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {when ? (
                <span className="text-sm font-semibold text-muted-foreground sm:text-xs">
                  {when}
                </span>
              ) : null}
            </div>
            {note ? (
              <p className="mt-2 line-clamp-2 text-base font-semibold leading-relaxed text-slate-700 sm:text-sm dark:text-slate-200">
                {clampText(note, 120)}
              </p>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  return (
    <section className="w-full" aria-label="Live activity on the board">
      <div className="flex items-center justify-between gap-3 pb-4 pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-1.5 py-1 text-left transition-colors hover:bg-orange-500/5 active:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Open live activity posts"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
              <Radio
                className="h-6 w-6 motion-safe:animate-pulse"
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="absolute right-1 top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-stone-900 sm:text-2xl dark:text-white">
                Happening now
              </h2>
              <p className="text-xs font-medium text-muted-foreground">
                Public posts · updating often
              </p>
            </div>
          </div>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        </button>
      </div>

      {/* Mobile: show 1. sm+: horizontal */}
      <div
        className={cn(
          "flex gap-4 overflow-hidden pb-1",
          "sm:overflow-x-auto sm:overscroll-x-contain sm:[-webkit-overflow-scrolling:touch]",
          "sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden",
          "sm:snap-x sm:snap-mandatory sm:touch-pan-x",
        )}
      >
        {visible.map((p, idx) => (
          <div
            key={p.id}
            className={cn(
              idx > 0 && "hidden sm:block",
              "w-full sm:w-[min(92vw,24rem)] sm:shrink-0 sm:snap-start",
            )}
          >
            <PostCard post={p} showChevron />
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[100vw] w-full h-[100dvh] p-0 border-none bg-background gap-0 overflow-hidden flex flex-col sm:rounded-none">
          <div className="relative flex h-full w-full flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/5 bg-background/90 px-5 py-4 backdrop-blur-md dark:border-white/5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600/90 dark:text-orange-400/90">
                  Live
                </p>
                <h3 className="truncate text-lg font-black tracking-tight text-stone-900 dark:text-white">
                  Happening now
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="group rounded-full border border-black/5 bg-card/90 p-3 shadow-2xl backdrop-blur-sm transition-all hover:bg-card active:scale-[0.98] dark:border-white/5 dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-900 transition-transform group-hover:scale-110 dark:text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
              <div className="flex flex-col gap-4 pt-4">
                {visible.slice(0, 6).map((p) => (
                  <PostCard key={`modal-${p.id}`} post={p} />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
