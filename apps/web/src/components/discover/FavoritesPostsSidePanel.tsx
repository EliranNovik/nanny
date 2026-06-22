import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { communityFeedScrollState } from "@/lib/communityFeedNav";
import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import {
  BadgeCheck,
  Bookmark,
  Flame,
  Heart,
  MessageCircle,
  MessagesSquare,
  PlayCircle,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiscoverSidePostsLive } from "@/hooks/useCommunityPostsLive";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { avatarUrl } from "@/lib/imageTransform";
import { getServiceCategoryImage } from "@/lib/serviceCategories";
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
  post_type_id?: string | null;
  post_metadata?: {
    category?: string | null;
    service?: string | null;
  } | null;
  created_at: string;
  like_count?: number;
  comment_count?: number;
  author: FavoritePostAuthor | null;
};

/** Side panel width at each desktop breakpoint (visible from md / 768px). */
export const FAVORITES_SIDE_PANEL_WIDTH_CLASS =
  "md:w-[260px] lg:w-[320px] xl:w-[380px] 2xl:w-[420px]";

/** Matches fixed panel width + right inset so feed header filters do not sit under the panel. */
export const FAVORITES_SIDE_PANEL_RESERVE_CLASS =
  "md:max-w-[calc(100%-276px)] lg:max-w-[calc(100%-336px)] xl:max-w-[calc(100%-396px)] 2xl:max-w-[calc(100%-436px)]";

/** Fixed panel offset: slightly below app nav for a small gap from the feed header. */
export const FAVORITES_SIDE_PANEL_FIXED_TOP_CLASS = "md:top-[4.75rem]";

export const FAVORITES_SIDE_PANEL_FIXED_MAX_H_CLASS =
  "md:max-h-[calc(100vh-4.75rem)]";

const SIDE_PANEL_THUMB_CLASS =
  "h-[84px] w-[118px] lg:h-[96px] lg:w-[144px] xl:h-[108px] xl:w-[168px] 2xl:h-[120px] 2xl:w-[192px]";

const SIDE_PANEL_SECTION_TITLE_CLASS =
  "text-[13px] lg:text-[14px] xl:text-[15px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200";

const SIDE_PANEL_SECTION_CLASS = "mb-4 last:mb-0";

const SIDE_PANEL_SECTION_HEADER_CLASS =
  "mb-1.5 flex items-center justify-between gap-2 px-1";

const SIDE_PANEL_POSTS_LIST_CLASS = "space-y-1.5";

function categoryIdFromSidePanelPost(post: FavoritePostRow): string | null {
  const meta = post.post_metadata;
  if (!meta) return null;
  if (post.post_type_id === "request_help") return meta.category ?? null;
  if (post.post_type_id === "offer_service") return meta.service ?? null;
  return null;
}

function sidePanelThumbUrl(post: FavoritePostRow): string {
  if (post.storage_path) {
    return publicProfileMediaPublicUrl(post.storage_path);
  }
  return getServiceCategoryImage(categoryIdFromSidePanelPost(post));
}

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

function useFavoritesPosts(
  userId: string | undefined,
  postTypeIds?: string[] | null,
) {
  return useQuery({
    queryKey: ["discover-favorites-side-posts", userId ?? null, postTypeIds ?? null],
    enabled: !!userId,
    staleTime: 0,
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

      let postsQuery = supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at, post_type_id, post_metadata",
        )
        .in("author_id", authorIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (postTypeIds?.length) {
        postsQuery = postsQuery.in("post_type_id", postTypeIds);
      }
      const { data: postsData, error: postsErr } = await postsQuery;
      if (postsErr) throw postsErr;

      const posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        post_type_id?: string | null;
        post_metadata?: FavoritePostRow["post_metadata"];
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
        post_type_id: p.post_type_id,
        post_metadata: p.post_metadata,
        created_at: p.created_at,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function useMostLikedPosts(postTypeIds?: string[] | null) {
  return useQuery({
    queryKey: ["discover-most-liked-side-posts", postTypeIds ?? null],
    staleTime: 0,
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
          "id, author_id, caption, media_type, storage_path, created_at, post_type_id, post_metadata",
        )
        .in("id", topIds);
      if (postsErr) throw postsErr;
      let posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        created_at: string;
        post_type_id?: string | null;
        post_metadata?: FavoritePostRow["post_metadata"];
      }>;
      if (postTypeIds?.length) {
        posts = posts.filter(
          (p) => p.post_type_id != null && postTypeIds.includes(p.post_type_id),
        );
      }
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
        post_type_id: p.post_type_id,
        post_metadata: p.post_metadata,
        created_at: p.created_at,
        like_count: counts.get(p.id) ?? 0,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function useMostCommentedPosts(postTypeIds?: string[] | null) {
  return useQuery({
    queryKey: ["discover-most-commented-side-posts", postTypeIds ?? null],
    staleTime: 0,
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
          "id, author_id, caption, media_type, storage_path, created_at, post_type_id, post_metadata",
        )
        .in("id", topIds);
      if (postsErr) throw postsErr;
      let posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        created_at: string;
        post_type_id?: string | null;
        post_metadata?: FavoritePostRow["post_metadata"];
      }>;
      if (postTypeIds?.length) {
        posts = posts.filter(
          (p) => p.post_type_id != null && postTypeIds.includes(p.post_type_id),
        );
      }
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
        post_type_id: p.post_type_id,
        post_metadata: p.post_metadata,
        created_at: p.created_at,
        comment_count: counts.get(p.id) ?? 0,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
}

function useMyOwnPosts(
  userId: string | undefined,
  postTypeIds?: string[] | null,
) {
  return useQuery({
    queryKey: ["discover-my-own-side-posts", userId ?? null, postTypeIds ?? null],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async (): Promise<FavoritePostRow[]> => {
      if (!userId) return [];

      let postsQuery = supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at, post_type_id, post_metadata",
        )
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (postTypeIds?.length) {
        postsQuery = postsQuery.in("post_type_id", postTypeIds);
      }
      const { data: postsData, error: postsErr } = await postsQuery;
      if (postsErr) throw postsErr;

      const posts = (postsData ?? []) as Array<{
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        post_type_id?: string | null;
        post_metadata?: FavoritePostRow["post_metadata"];
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
        post_type_id: p.post_type_id,
        post_metadata: p.post_metadata,
        created_at: p.created_at,
        author: byAuthor.get(p.author_id) ?? null,
      }));
    },
  });
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
  const { t, i18n } = useTranslation();
  const author = post.author;
  const authorName = author?.full_name?.trim() || t("feed.sidePanel.member");
  const hasMedia = Boolean(post.storage_path);
  const thumb = sidePanelThumbUrl(post);
  const isVideo = hasMedia && post.media_type === "video";
  const caption = post.caption?.trim() || t("feed.sidePanel.viewPost");
  const postedAgo = (() => {
    try {
      return formatDistanceToNow(new Date(post.created_at), {
        addSuffix: true,
        locale: dateFnsLocaleFor(i18n.language),
      });
    } catch {
      return "";
    }
  })();

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-start gap-2 rounded-xl p-1.5 text-left transition-colors",
        "lg:gap-3 lg:rounded-2xl lg:p-2 xl:gap-3.5",
        "hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
      )}
      aria-label={t("feed.sidePanel.openAuthorsPost", { name: authorName })}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 lg:rounded-xl",
          SIDE_PANEL_THUMB_CLASS,
        )}
      >
        {isVideo ? (
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
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
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
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-zinc-900 dark:text-white lg:text-[14px] xl:text-[15px]">
          {caption}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 lg:mt-2 lg:gap-2">
          <Avatar className="h-5 w-5 shrink-0 lg:h-6 lg:w-6">
            <AvatarImage
              src={avatarUrl.sm(author?.photo_url) ?? undefined}
              alt=""
            />
            <AvatarFallback className="bg-zinc-200 text-[11px] font-black text-zinc-700 dark:bg-zinc-700 dark:text-white">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="inline-flex min-w-0 items-center gap-1 truncate text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 lg:text-[13.5px]">
            <span className="truncate">{authorName}</span>
            {author?.is_verified ? (
              <BadgeCheck
                className="h-4 w-4 shrink-0"
                fill="#0ea5e9"
                color="#ffffff"
                aria-label={t("feed.sidePanel.verified")}
              />
            ) : null}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 lg:mt-1 lg:text-[12.5px]">
          {postedAgo}
        </p>
      </div>
    </button>
  );
}

function ThumbSkeletonRow() {
  return (
    <div className="flex items-start gap-2 rounded-xl p-1.5 lg:gap-3.5 lg:rounded-2xl lg:p-2">
      <div
        className={cn(
          "shrink-0 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 lg:rounded-xl",
          SIDE_PANEL_THUMB_CLASS,
        )}
      />
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
export function FavoritesPostsSidePanel({
  postTypeIds = null,
  fixed = false,
  onPostOpen,
}: {
  postTypeIds?: string[] | null;
  /** Pin to viewport top-right; panel scrolls independently (community feed page). */
  fixed?: boolean;
  /** Focus a post in the community feed (pins to top without full page reload). */
  onPostOpen?: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const panelAriaLabel = t("feed.sidePanel.ariaLabel");
  useDiscoverSidePostsLive(user?.id);
  const { data: favPosts, isLoading: favLoading } = useFavoritesPosts(
    user?.id,
    postTypeIds,
  );
  const { data: popularPosts, isLoading: popularLoading } =
    useMostLikedPosts(postTypeIds);
  const { data: commentedPosts, isLoading: commentedLoading } =
    useMostCommentedPosts(postTypeIds);
  const { data: myPosts, isLoading: myLoading } = useMyOwnPosts(
    user?.id,
    postTypeIds,
  );

  if (!user?.id) return null;

  const openPost = (postId: string) => {
    if (onPostOpen) {
      onPostOpen(postId);
      return;
    }
    navigate(GLOBAL_POSTS_PATH, { state: communityFeedScrollState(postId) });
  };

  const hasFav = Array.isArray(favPosts) && favPosts.length > 0;
  const hasPopular = Array.isArray(popularPosts) && popularPosts.length > 0;
  const hasCommented =
    Array.isArray(commentedPosts) && commentedPosts.length > 0;
  const hasMine = Array.isArray(myPosts) && myPosts.length > 0;

  if (fixed) {
    return (
      <>
        {/* Reserve horizontal space so the feed column does not expand under the panel */}
        <div
          className={cn("hidden md:block md:shrink-0", FAVORITES_SIDE_PANEL_WIDTH_CLASS)}
          aria-hidden
        />
        <aside
          className={cn(
            "hidden md:flex md:flex-col md:shrink-0",
            FAVORITES_SIDE_PANEL_WIDTH_CLASS,
            "md:fixed md:z-40",
            FAVORITES_SIDE_PANEL_FIXED_TOP_CLASS,
            FAVORITES_SIDE_PANEL_FIXED_MAX_H_CLASS,
            "md:end-2 lg:end-3 xl:end-4",
          )}
          aria-label={panelAriaLabel}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {renderPanelSections({
              t,
              favPosts,
              favLoading,
              hasFav,
              popularPosts,
              popularLoading,
              hasPopular,
              commentedPosts,
              commentedLoading,
              hasCommented,
              myPosts,
              myLoading,
              hasMine,
              openPost,
            })}
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:shrink-0 md:self-start",
        FAVORITES_SIDE_PANEL_WIDTH_CLASS,
      )}
      aria-label={panelAriaLabel}
    >
      <div className="pr-1">
        {renderPanelSections({
          t,
          favPosts,
          favLoading,
          hasFav,
          popularPosts,
          popularLoading,
          hasPopular,
          commentedPosts,
          commentedLoading,
          hasCommented,
          myPosts,
          myLoading,
          hasMine,
          openPost,
        })}
      </div>
    </aside>
  );
}

function renderPanelSections({
  t,
  favPosts,
  favLoading,
  hasFav,
  popularPosts,
  popularLoading,
  hasPopular,
  commentedPosts,
  commentedLoading,
  hasCommented,
  myPosts,
  myLoading,
  hasMine,
  openPost,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  favPosts: FavoritePostRow[] | undefined;
  favLoading: boolean;
  hasFav: boolean;
  popularPosts: FavoritePostRow[] | undefined;
  popularLoading: boolean;
  hasPopular: boolean;
  commentedPosts: FavoritePostRow[] | undefined;
  commentedLoading: boolean;
  hasCommented: boolean;
  myPosts: FavoritePostRow[] | undefined;
  myLoading: boolean;
  hasMine: boolean;
  openPost: (postId: string) => void;
}) {
  return (
    <>
        {/* Section 1: From your favorites */}
        <section className={SIDE_PANEL_SECTION_CLASS}>
          <div className={SIDE_PANEL_SECTION_HEADER_CLASS}>
            <h3 className={cn("inline-flex items-center gap-1.5 lg:gap-2", SIDE_PANEL_SECTION_TITLE_CLASS)}>
              <Bookmark
                className="h-4 w-4 text-orange-500 lg:h-5 lg:w-5"
                strokeWidth={2.5}
                aria-hidden
              />
              {t("feed.sidePanel.fromYourFavorites")}
            </h3>
          </div>
          <div className={SIDE_PANEL_POSTS_LIST_CLASS}>
            {favLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasFav ? (
              <EmptyState
                icon={Bookmark}
                title={t("feed.sidePanel.noPostsYet")}
                description={t("feed.sidePanel.noPostsYetDesc")}
              />
            ) : (
              favPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  onOpen={() => openPost(post.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section 2: Most liked */}
        <section className={SIDE_PANEL_SECTION_CLASS}>
          <div className={SIDE_PANEL_SECTION_HEADER_CLASS}>
            <h3 className={cn("inline-flex items-center gap-1.5 lg:gap-2", SIDE_PANEL_SECTION_TITLE_CLASS)}>
              <Flame
                className="h-4 w-4 text-rose-500 lg:h-5 lg:w-5"
                strokeWidth={2.5}
                aria-hidden
              />
              {t("feed.sidePanel.mostLiked")}
            </h3>
          </div>
          <div className={SIDE_PANEL_POSTS_LIST_CLASS}>
            {popularLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasPopular ? (
              <EmptyState
                icon={Flame}
                title={t("feed.sidePanel.noPopularYet")}
                description={t("feed.sidePanel.noPopularYetDesc")}
              />
            ) : (
              popularPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  showLikeCount
                  onOpen={() => openPost(post.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section 3: Most commented */}
        <section className={SIDE_PANEL_SECTION_CLASS}>
          <div className={SIDE_PANEL_SECTION_HEADER_CLASS}>
            <h3 className={cn("inline-flex items-center gap-1.5 lg:gap-2", SIDE_PANEL_SECTION_TITLE_CLASS)}>
              <MessagesSquare
                className="h-4 w-4 text-sky-500 lg:h-5 lg:w-5"
                strokeWidth={2.5}
                aria-hidden
              />
              {t("feed.sidePanel.mostCommented")}
            </h3>
          </div>
          <div className={SIDE_PANEL_POSTS_LIST_CLASS}>
            {commentedLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasCommented ? (
              <EmptyState
                icon={MessagesSquare}
                title={t("feed.sidePanel.noDiscussedYet")}
                description={t("feed.sidePanel.noDiscussedYetDesc")}
              />
            ) : (
              commentedPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  showCommentCount
                  onOpen={() => openPost(post.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section 4: Your community posts */}
        <section className={SIDE_PANEL_SECTION_CLASS}>
          <div className={SIDE_PANEL_SECTION_HEADER_CLASS}>
            <h3 className={cn("inline-flex items-center gap-1.5 lg:gap-2", SIDE_PANEL_SECTION_TITLE_CLASS)}>
              <UserCircle2
                className="h-4 w-4 text-emerald-500 lg:h-5 lg:w-5"
                strokeWidth={2.5}
                aria-hidden
              />
              {t("feed.sidePanel.yourCommunityPosts")}
            </h3>
          </div>
          <div className={SIDE_PANEL_POSTS_LIST_CLASS}>
            {myLoading ? (
              Array.from({ length: 3 }).map((_, i) => <ThumbSkeletonRow key={i} />)
            ) : !hasMine ? (
              <EmptyState
                icon={UserCircle2}
                title={t("feed.sidePanel.noMineYet")}
                description={t("feed.sidePanel.noMineYetDesc")}
              />
            ) : (
              myPosts!.map((post) => (
                <ThumbCard
                  key={post.id}
                  post={post}
                  onOpen={() => openPost(post.id)}
                />
              ))
            )}
          </div>
        </section>
    </>
  );
}
