import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheck,
  Bookmark,
  Flame,
  Heart,
  ImageIcon,
  MessageCircle,
  MessagesSquare,
  PlayCircle,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { avatarUrl } from "@/lib/imageTransform";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type FavoritePostAuthor = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  is_verified: boolean | null;
};

type FavoritePostRow = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  created_at: string;
  like_count?: number;
  comment_count?: number;
  author: FavoritePostAuthor | null;
};

async function fetchAuthorMap(
  authorIds: string[],
): Promise<Map<string, FavoritePostAuthor>> {
  if (authorIds.length === 0) return new Map();
  const { data: profs, error } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url, is_verified")
    .in("id", authorIds);
  if (error) throw error;
  return new Map<string, FavoritePostAuthor>(
    (profs ?? []).map((p: Record<string, unknown>) => [
      p.id as string,
      {
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        photo_url: (p.photo_url as string | null) ?? null,
        is_verified: (p.is_verified as boolean | null) ?? null,
      },
    ]),
  );
}

function useFavoritesPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ["discover-favorites-side-posts", userId ?? null],
    enabled: !!userId,
    staleTime: 60_000 * 2,
    queryFn: async (): Promise<FavoritePostRow[]> => {
      if (!userId) return [];

      const { data: favs, error: favErr } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", userId);
      if (favErr) throw favErr;
      const authorIds = (favs ?? []).map(
        (r: { favorite_user_id: string }) => r.favorite_user_id,
      );
      if (authorIds.length === 0) return [];

      const { data: postsData, error: postsErr } = await supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at",
        )
        .in("author_id", authorIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (postsErr) throw postsErr;

      const posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        created_at: string;
      }>;
      if (posts.length === 0) return [];

      const byAuthor = await fetchAuthorMap([
        ...new Set(posts.map((p) => p.author_id)),
      ]);

      return posts.map<FavoritePostRow>((p) => ({
        id: p.id,
        author_id: p.author_id,
        caption: p.caption,
        media_type: p.media_type,
        storage_path: p.storage_path,
        created_at: p.created_at,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function useMostLikedPosts() {
  return useQuery({
    queryKey: ["discover-most-liked-side-posts"],
    staleTime: 60_000 * 5,
    queryFn: async (): Promise<FavoritePostRow[]> => {
      // Aggregate the latest likes to build a "popular right now" set.
      // 1000 most recent like events is more than enough to surface the top posts
      // without needing a dedicated server-side aggregate.
      const { data: likes, error: likesErr } = await supabase
        .from("profile_post_likes")
        .select("post_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (likesErr) throw likesErr;

      const counts = new Map<string, number>();
      for (const row of likes ?? []) {
        const id = (row as { post_id: string }).post_id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([id]) => id);
      if (topIds.length === 0) return [];

      const { data: postsData, error: postsErr } = await supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at",
        )
        .in("id", topIds);
      if (postsErr) throw postsErr;
      const posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        created_at: string;
      }>;
      if (posts.length === 0) return [];

      const byAuthor = await fetchAuthorMap([
        ...new Set(posts.map((p) => p.author_id)),
      ]);

      const postById = new Map(posts.map((p) => [p.id, p] as const));
      // Preserve the count-ranked order from `topIds`.
      const ordered = topIds
        .map((id) => postById.get(id))
        .filter((p): p is (typeof posts)[number] => Boolean(p));

      return ordered.map<FavoritePostRow>((p) => ({
        id: p.id,
        author_id: p.author_id,
        caption: p.caption,
        media_type: p.media_type,
        storage_path: p.storage_path,
        created_at: p.created_at,
        like_count: counts.get(p.id) ?? 0,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function useMostCommentedPosts() {
  return useQuery({
    queryKey: ["discover-most-commented-side-posts"],
    staleTime: 60_000 * 5,
    queryFn: async (): Promise<FavoritePostRow[]> => {
      // Aggregate the latest comments to surface the most-discussed posts.
      const { data: comments, error: commentsErr } = await supabase
        .from("profile_post_comments")
        .select("post_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (commentsErr) throw commentsErr;

      const counts = new Map<string, number>();
      for (const row of comments ?? []) {
        const id = (row as { post_id: string }).post_id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([id]) => id);
      if (topIds.length === 0) return [];

      const { data: postsData, error: postsErr } = await supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at",
        )
        .in("id", topIds);
      if (postsErr) throw postsErr;
      const posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        created_at: string;
      }>;
      if (posts.length === 0) return [];

      const byAuthor = await fetchAuthorMap([
        ...new Set(posts.map((p) => p.author_id)),
      ]);

      const postById = new Map(posts.map((p) => [p.id, p] as const));
      const ordered = topIds
        .map((id) => postById.get(id))
        .filter((p): p is (typeof posts)[number] => Boolean(p));

      return ordered.map<FavoritePostRow>((p) => ({
        id: p.id,
        author_id: p.author_id,
        caption: p.caption,
        media_type: p.media_type,
        storage_path: p.storage_path,
        created_at: p.created_at,
        comment_count: counts.get(p.id) ?? 0,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function useMyOwnPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ["discover-my-own-side-posts", userId ?? null],
    enabled: !!userId,
    staleTime: 60_000 * 2,
    queryFn: async (): Promise<FavoritePostRow[]> => {
      if (!userId) return [];

      const { data: postsData, error: postsErr } = await supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at",
        )
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (postsErr) throw postsErr;

      const posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        created_at: string;
      }>;
      if (posts.length === 0) return [];

      // Only one author here (the current user), but reuse the helper for consistency.
      const byAuthor = await fetchAuthorMap([userId]);

      return posts.map<FavoritePostRow>((p) => ({
        id: p.id,
        author_id: p.author_id,
        caption: p.caption,
        media_type: p.media_type,
        storage_path: p.storage_path,
        created_at: p.created_at,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function ThumbCard({
  post,
  onOpen,
  showLikeCount,
  showCommentCount,
}: {
  post: FavoritePostRow;
  onOpen: () => void;
  showLikeCount?: boolean;
  showCommentCount?: boolean;
}) {
  const author = post.author;
  const authorName = author?.full_name?.trim() || "Member";
  const thumb = post.storage_path
    ? publicProfileMediaPublicUrl(post.storage_path)
    : null;
  const isVideo = post.media_type === "video";
  const caption = post.caption?.trim() || "View post";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-start gap-3.5 rounded-2xl p-2 text-left transition-colors",
        "hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
      )}
      aria-label={`Open ${authorName}'s profile`}
    >
      <div className="relative h-[112px] w-[180px] shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 lg:h-[124px] lg:w-[200px]">
        {thumb ? (
          isVideo ? (
            <>
              <video
                src={thumb}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                <PlayCircle
                  className="h-9 w-9 text-white drop-shadow-md"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </div>
            </>
          ) : (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            <ImageIcon className="h-7 w-7" strokeWidth={2} aria-hidden />
          </div>
        )}
        {showLikeCount && typeof post.like_count === "number" && post.like_count > 0 ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
            <Heart className="h-3 w-3 fill-rose-400 text-rose-400" strokeWidth={0} aria-hidden />
            {post.like_count}
          </span>
        ) : null}
        {showCommentCount && typeof post.comment_count === "number" && post.comment_count > 0 ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
            <MessageCircle className="h-3 w-3 fill-sky-400 text-sky-400" strokeWidth={0} aria-hidden />
            {post.comment_count}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 py-1">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-zinc-900 dark:text-white">
          {caption}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage
              src={avatarUrl.sm(author?.photo_url) ?? undefined}
              alt=""
            />
            <AvatarFallback className="bg-zinc-200 text-[11px] font-black text-zinc-700 dark:bg-zinc-700 dark:text-white">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="inline-flex min-w-0 items-center gap-1 truncate text-[13.5px] font-semibold text-zinc-600 dark:text-zinc-300">
            <span className="truncate">{authorName}</span>
            {author?.is_verified ? (
              <BadgeCheck
                className="h-4 w-4 shrink-0"
                fill="#0ea5e9"
                color="#ffffff"
                aria-label="Verified"
              />
            ) : null}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
          {timeAgo(post.created_at)}
        </p>
      </div>
    </button>
  );
}

function ThumbSkeletonRow() {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl p-2">
      <div className="h-[112px] w-[180px] shrink-0 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bookmark;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/40 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-300">
        <Icon className="h-6 w-6" strokeWidth={2.5} aria-hidden />
      </div>
      <p className="text-[14px] font-bold text-zinc-700 dark:text-zinc-200">
        {title}
      </p>
      <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

/**
 * YouTube-style sidebar for the discover community feed.
 *
 * Two stacked sections, same card style:
 *  1) "From your favorites" — latest posts by profiles the viewer favorited.
 *  2) "Most liked" — community-wide popular posts (ranked by recent likes).
 */
export function FavoritesPostsSidePanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: favPosts, isLoading: favLoading } = useFavoritesPosts(user?.id);
  const { data: popularPosts, isLoading: popularLoading } = useMostLikedPosts();
  const { data: commentedPosts, isLoading: commentedLoading } =
    useMostCommentedPosts();
  const { data: myPosts, isLoading: myLoading } = useMyOwnPosts(user?.id);

  if (!user?.id) return null;

  const hasFav = Array.isArray(favPosts) && favPosts.length > 0;
  const hasPopular = Array.isArray(popularPosts) && popularPosts.length > 0;
  const hasCommented =
    Array.isArray(commentedPosts) && commentedPosts.length > 0;
  const hasMine = Array.isArray(myPosts) && myPosts.length > 0;

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:shrink-0",
        "md:w-[380px] lg:w-[420px] xl:w-[460px] 2xl:w-[480px]",
      )}
      aria-label="Posts from your favorites and popular posts"
    >
      <div className="pr-1">
        {/* Section 1: From your favorites */}
        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-2 px-1">
            <h3 className="inline-flex items-center gap-2 text-[15px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              <Bookmark
                className="h-5 w-5 text-orange-500"
                strokeWidth={2.5}
                aria-hidden
              />
              From your favorites
            </h3>
          </div>
          <div className="space-y-3">
            {favLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasFav ? (
              <EmptyState
                icon={Bookmark}
                title="No posts yet"
                description="Save profiles you love to see their latest posts here."
              />
            ) : (
              favPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  onOpen={() => navigate(`/profile/${post.author_id}`)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section 2: Most liked */}
        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-2 px-1">
            <h3 className="inline-flex items-center gap-2 text-[15px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              <Flame
                className="h-5 w-5 text-rose-500"
                strokeWidth={2.5}
                aria-hidden
              />
              Most liked
            </h3>
          </div>
          <div className="space-y-3">
            {popularLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasPopular ? (
              <EmptyState
                icon={Flame}
                title="No popular posts yet"
                description="As people start liking posts, the top ones will appear here."
              />
            ) : (
              popularPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  showLikeCount
                  onOpen={() => navigate(`/profile/${post.author_id}`)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section 3: Most commented */}
        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-2 px-1">
            <h3 className="inline-flex items-center gap-2 text-[15px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              <MessagesSquare
                className="h-5 w-5 text-sky-500"
                strokeWidth={2.5}
                aria-hidden
              />
              Most commented
            </h3>
          </div>
          <div className="space-y-3">
            {commentedLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasCommented ? (
              <EmptyState
                icon={MessagesSquare}
                title="No discussions yet"
                description="As people start commenting, the most-discussed posts will appear here."
              />
            ) : (
              commentedPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  showCommentCount
                  onOpen={() => navigate(`/profile/${post.author_id}`)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section 4: Your community posts */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-2 px-1">
            <h3 className="inline-flex items-center gap-2 text-[15px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              <UserCircle2
                className="h-5 w-5 text-emerald-500"
                strokeWidth={2.5}
                aria-hidden
              />
              Your community posts
            </h3>
          </div>
          <div className="space-y-3">
            {myLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasMine ? (
              <EmptyState
                icon={UserCircle2}
                title="You haven't posted yet"
                description="Share an update with the community to see it here."
              />
            ) : (
              myPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  onOpen={() => navigate(`/profile/${post.author_id}`)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
