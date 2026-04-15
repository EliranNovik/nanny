import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import {
  BadgeCheck,
  Clock,
  Heart,
  MessageSquare,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { type AvailabilityPayload } from "@/lib/availabilityPosts";
import {
  playFavoriteAddedToLikedTabFlight,
  playFavoriteRemovedFromLikedTabFlight,
} from "@/lib/favoriteToLikedTabFlight";
import { CommunityPostCommentsControl } from "@/components/community/CommunityPostCommentsControl";
import type { User } from "@supabase/supabase-js";

/** e.g. `2d 5h 14m ago` — days / hours / minutes only, no seconds */
export function formatPostedAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  let ms = Math.max(0, Date.now() - t);
  const days = Math.floor(ms / 86_400_000);
  ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000);
  if (days === 0 && hours === 0 && minutes === 0) return "just now";
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || (days === 0 && hours === 0)) parts.push(`${minutes}m`);
  return `${parts.join(" ")} ago`;
}

export function PostTimeLeftBadge({ expiresAtIso }: { expiresAtIso: string }) {
  return (
    <div
      className={cn(
        "inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-lg border border-white/20",
        "bg-black/55 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-md",
        "dark:border-white/15 dark:bg-black/60"
      )}
      role="status"
      aria-live="polite"
    >
      <Clock className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span className="text-[11px] font-semibold leading-none">Time left</span>
      <ExpiryCountdown
        expiresAtIso={expiresAtIso}
        compact
        className="!font-mono text-sm font-bold !text-white"
      />
    </div>
  );
}

type PostViewerProfile = {
  role: "client" | "freelancer" | "admin";
} | null;

export type CommunityFeedPost = {
  id: string;
  author_id: string;
  category: string;
  title: string;
  body: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  availability_payload: AvailabilityPayload | null;
  author_full_name: string | null;
  author_photo_url: string | null;
  author_city: string | null;
  author_role: string | null;
  author_is_verified?: boolean | null;
  author_average_rating?: number | string | null;
  author_total_ratings?: number | string | null;
};

export type CommunityPostImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

export type CommunityPostWithMeta = CommunityFeedPost & {
  images: CommunityPostImage[];
};

export type CommunityPostCardProps = {
  post: CommunityPostWithMeta;
  user: User | null;
  profile: PostViewerProfile;
  loginRedirect: string;
  favoritedIds: Set<string>;
  /** Return `true` after a successful save/unsave so the heart flight animation can run. */
  onToggleFavorite: (postId: string) => void | Promise<boolean>;
  hiringPostId: string | null;
  pendingHirePostIds: Set<string>;
  onHireFromPost: (postId: string) => void;
  onOpenChat: () => void;
  cardClassName?: string;
  /** When true, card is sized for horizontal carousels (narrow min-width). */
  compact?: boolean;
  /** No bordered panel — sits on page background (e.g. Discover home). */
  plain?: boolean;
  /** Icon-only Hire / Chat / Comments row (e.g. Discover availability modal). Share is by the heart in the header. */
  iconOnlyActions?: boolean;
  /** Extra vertical padding + gaps on small screens (Discover “Available now” bottom sheet). */
  availabilitySheetComfort?: boolean;
  /** Omit the Share control next to the heart (e.g. public posts grid). */
  hideShareInIconRow?: boolean;
};

export function CommunityPostCard({
  post,
  user,
  profile,
  loginRedirect,
  favoritedIds,
  onToggleFavorite,
  hiringPostId,
  pendingHirePostIds,
  onHireFromPost,
  onOpenChat,
  cardClassName,
  compact,
  plain,
  iconOnlyActions = false,
  availabilitySheetComfort = false,
  hideShareInIconRow = false,
}: CommunityPostCardProps) {
  const { addToast } = useToast();
  const isMine = user?.id === post.author_id;
  const postFavoriteButtonRef = useRef<HTMLButtonElement>(null);
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(null);
  const imageUrls = useMemo(
    () => post.images.map((i) => i.image_url).filter((u): u is string => Boolean(u)),
    [post.images]
  );

  /** Public grid: pull Hire / Chat / Comments up against the post image */
  const tightenIconRowToImage = Boolean(plain && iconOnlyActions && imageUrls.length > 0);
  /** Public icon-only row: always use larger tap targets (with or without image) */
  const largePublicIconRow = Boolean(plain && iconOnlyActions);
  /** Public posts grid: plain + icon row — used for desktop stretch + footer pin */
  const publicFeedCard = Boolean(plain && iconOnlyActions);
  const sheetComfort = Boolean(availabilitySheetComfort && publicFeedCard);
  const pinFooterToBottom = publicFeedCard && imageUrls.length === 0;
  const splitDesktopImageCard = publicFeedCard && imageUrls.length > 0;
  const noImagePublicFeed = publicFeedCard && imageUrls.length === 0;

  const sharePost = useCallback(async () => {
    const url = `${window.location.origin}/public/posts?post=${encodeURIComponent(post.id)}`;
    const title = post.title;
    const text =
      [post.note, post.body].find((t) => t && String(t).trim()) || title;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name;
      if (name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      addToast({
        title: "Link copied",
        description: "Paste anywhere to share this post.",
        variant: "success",
      });
    } catch {
      addToast({
        title: "Could not share",
        description: "Try copying the page URL manually.",
        variant: "error",
      });
    }
  }, [post.id, post.title, post.note, post.body, addToast]);
  const description =
    (post.note && post.note.trim()) || (post.body && post.body.trim()) || null;
  const verified = Boolean(post.author_is_verified);
  const postedAgoLabel = useMemo(() => formatPostedAgo(post.created_at), [post.created_at]);

  const handleTogglePostFavorite = useCallback(async () => {
    const wasFav = favoritedIds.has(post.id);
    const res = onToggleFavorite(post.id);
    const ok = await Promise.resolve(res);
    if (ok === false) return;
    const el = postFavoriteButtonRef.current;
    if (!el) return;
    if (!wasFav) playFavoriteAddedToLikedTabFlight(el);
    else playFavoriteRemovedFromLikedTabFlight(el);
  }, [favoritedIds, onToggleFavorite, post.id]);

  const avatarEl = (
    <Avatar
      className={cn(
        "h-14 w-14 shadow-none ring-0 ring-offset-0",
        sheetComfort && "max-md:h-[4.25rem] max-md:w-[4.25rem]"
      )}
    >
      <AvatarImage src={post.author_photo_url ?? undefined} className="object-cover" alt="" />
      <AvatarFallback
        className={cn(
          "bg-gradient-to-br from-orange-100 to-amber-100 text-lg font-bold text-orange-800 dark:from-orange-950 dark:to-amber-950 dark:text-orange-200",
          sheetComfort && "max-md:text-xl"
        )}
      >
        {(post.author_full_name || "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
    <Card
      id={compact ? undefined : `community-post-${post.id}`}
      {...(compact ? { "data-job-card": true as const } : {})}
      className={cn(
        plain
          ? "border-0 bg-transparent shadow-none dark:bg-transparent"
          : "overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-card sm:bg-white dark:sm:bg-card",
        compact && "min-w-[min(88vw,320px)] max-w-[320px] shrink-0 snap-start",
        plain && compact && "rounded-none",
        publicFeedCard &&
          (availabilitySheetComfort
            ? "flex h-full min-h-0 flex-1 flex-col"
            : "flex min-h-0 flex-col md:h-full"),
        noImagePublicFeed &&
          "max-md:min-h-[min(90dvh,36rem)] max-md:flex-1 max-md:flex-col",
        cardClassName,
        /* cardClassName often sets h-full; without a tall parent that blocks grid/flex stretch for split image column */
        splitDesktopImageCard && "md:!h-auto md:min-h-0"
      )}
    >
      <CardContent
        className={cn(
          "p-0",
          plain && !publicFeedCard && "flex flex-col gap-3",
          publicFeedCard && "flex min-h-0 flex-1 flex-col"
        )}
      >
        <div
          className={cn(
            publicFeedCard && "flex min-h-0 flex-1 flex-col gap-3",
            noImagePublicFeed && "max-md:gap-5",
            sheetComfort && "max-md:gap-5",
            plain && !publicFeedCard && "contents",
            /* Grid gives the image column a real row height so flex-1 + object-contain can fill next to text */
            splitDesktopImageCard &&
              "md:grid md:min-h-0 md:grid-cols-[minmax(0,11.5rem)_minmax(0,1fr)] md:items-start md:gap-x-4 md:gap-y-0"
          )}
        >
          {splitDesktopImageCard && (
            <div className="hidden min-h-0 md:flex md:w-full md:max-w-none md:shrink-0 md:flex-col md:pl-4 md:pt-5 md:pb-2">
              <div className="flex shrink-0 items-start gap-3 pb-3">
                {!isMine ? (
                  <Link
                    to={`/profile/${post.author_id}`}
                    className="relative shrink-0 rounded-full outline-none ring-offset-2 ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70"
                    aria-label={`View ${post.author_full_name || "member"} profile`}
                  >
                    <Avatar className="h-12 w-12 shadow-none ring-0 ring-offset-0">
                      <AvatarImage
                        src={post.author_photo_url ?? undefined}
                        className="object-cover"
                        alt=""
                      />
                      <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-base font-bold text-orange-800 dark:from-orange-950 dark:to-amber-950 dark:text-orange-200">
                        {(post.author_full_name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                ) : (
                  <div className="relative shrink-0 rounded-full">
                    <Avatar className="h-12 w-12 shadow-none ring-0 ring-offset-0">
                      <AvatarImage
                        src={post.author_photo_url ?? undefined}
                        className="object-cover"
                        alt=""
                      />
                      <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-base font-bold text-orange-800 dark:from-orange-950 dark:to-amber-950 dark:text-orange-200">
                        {(post.author_full_name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">
                      {post.author_full_name || "Member"}
                    </span>
                    {verified && (
                      <BadgeCheck
                        className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:fill-sky-400"
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  {(() => {
                    const total = Number(post.author_total_ratings ?? 0);
                    const avg = Number(post.author_average_rating ?? 0);
                    if (total > 0) {
                      return (
                        <StarRating
                          rating={avg}
                          totalRatings={total}
                          size="sm"
                          className="mt-1"
                          starClassName="text-amber-500 dark:text-amber-400"
                          numberClassName="text-amber-950 dark:text-amber-100"
                        />
                      );
                    }
                    return <p className="mt-1 text-xs text-muted-foreground">No reviews yet</p>;
                  })()}
                  {postedAgoLabel && (
                    <time
                      dateTime={post.created_at}
                      title={new Date(post.created_at).toISOString()}
                      className="mt-1 block text-xs font-medium tabular-nums tracking-tight text-muted-foreground"
                    >
                      Posted {postedAgoLabel}
                    </time>
                  )}
                </div>
              </div>

              {/* Row height comes from grid; flex-1 fills cell — object-contain shows full image (portrait uses height). */}
              <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl bg-muted/40 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setImageLightboxIndex(0)}
                  className="relative z-0 flex h-full min-h-[10rem] w-full flex-1 items-center justify-center p-0 text-left outline-none transition-opacity hover:opacity-95 active:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="View image full screen"
                >
                  <img
                    src={imageUrls[0]}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </button>
                <div className="pointer-events-none absolute bottom-2 left-2 z-[2]">
                  <PostTimeLeftBadge expiresAtIso={post.expires_at} />
                </div>
              </div>
            </div>
          )}

          <div className={cn(splitDesktopImageCard && "flex min-h-0 flex-col md:flex-none")}>
        <div
          className={cn(
            "flex items-start gap-3 px-3.5 pt-3.5 pb-0",
            plain && "gap-4 px-4 pt-5 pb-0.5",
            sheetComfort && "max-md:gap-4 max-md:px-5 max-md:pt-6 max-md:pb-1",
            noImagePublicFeed && "max-md:gap-4 max-md:pb-3",
            splitDesktopImageCard && "md:justify-end md:px-4 md:pt-4 md:pb-0"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-start gap-3",
              splitDesktopImageCard && "md:hidden"
            )}
          >
            {!isMine ? (
              <Link
                to={`/profile/${post.author_id}`}
                className="relative shrink-0 rounded-full outline-none ring-offset-2 ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70"
                aria-label={`View ${post.author_full_name || "member"} profile`}
              >
                {avatarEl}
              </Link>
            ) : (
              <div className="relative shrink-0 rounded-full">{avatarEl}</div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1">
                <span className="truncate text-base font-semibold leading-tight tracking-tight text-foreground">
                  {post.author_full_name || "Member"}
                </span>
                {verified && (
                  <BadgeCheck
                    className="h-[18px] w-[18px] shrink-0 fill-sky-500 text-white dark:fill-sky-400"
                    aria-label="Verified"
                  />
                )}
              </div>
              {(() => {
                const total = Number(post.author_total_ratings ?? 0);
                const avg = Number(post.author_average_rating ?? 0);
                if (total > 0) {
                  return (
                    <StarRating
                      rating={avg}
                      totalRatings={total}
                      size="md"
                      className="mt-1.5"
                      starClassName="text-amber-500 dark:text-amber-400"
                      numberClassName="text-amber-950 dark:text-amber-100"
                    />
                  );
                }
                return <p className="mt-1 text-xs text-muted-foreground">No reviews yet</p>;
              })()}
              {postedAgoLabel && (
                <time
                  dateTime={post.created_at}
                  title={new Date(post.created_at).toISOString()}
                  className="mt-1.5 block text-xs font-medium tabular-nums tracking-tight text-muted-foreground"
                >
                  Posted {postedAgoLabel}
                </time>
              )}
            </div>
          </div>
          {(!isMine || !hideShareInIconRow) && (
            <div className="flex shrink-0 items-start gap-0.5">
              {!isMine &&
                (user ? (
                  <Button
                    ref={postFavoriteButtonRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "group h-9 w-9 rounded-full text-muted-foreground",
                      "hover:bg-transparent active:bg-transparent",
                      "focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-red-500/35 focus-visible:ring-offset-2",
                      favoritedIds.has(post.id)
                        ? "text-red-500 hover:bg-transparent hover:text-red-600"
                        : "hover:text-red-500"
                    )}
                    onClick={() => void handleTogglePostFavorite()}
                    aria-pressed={favoritedIds.has(post.id)}
                    aria-label={
                      favoritedIds.has(post.id) ? "Remove from favorites" : "Add to favorites"
                    }
                  >
                    <Heart
                      className={cn(
                        "h-5 w-5 transition-colors",
                        favoritedIds.has(post.id)
                          ? "fill-current"
                          : "fill-transparent text-muted-foreground group-hover:fill-red-500 group-hover:text-red-500"
                      )}
                      aria-hidden
                    />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "group h-9 w-9 rounded-full text-muted-foreground",
                      "hover:bg-transparent hover:text-red-500 active:bg-transparent",
                      "focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-red-500/35 focus-visible:ring-offset-2"
                    )}
                    asChild
                    aria-label="Sign in to save favorites"
                  >
                    <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>
                      <Heart
                        className="h-5 w-5 fill-transparent text-muted-foreground transition-colors group-hover:fill-red-500 group-hover:text-red-500"
                        aria-hidden
                      />
                    </Link>
                  </Button>
                ))}
              {!hideShareInIconRow && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full text-muted-foreground",
                    "hover:bg-transparent hover:text-foreground active:bg-transparent",
                    "focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-orange-500/35 focus-visible:ring-offset-2"
                  )}
                  onClick={() => void sharePost()}
                  aria-label="Share"
                >
                  <Share2 className="h-5 w-5" aria-hidden />
                </Button>
              )}
            </div>
          )}
        </div>

        {imageUrls.length > 0 && !(plain && imageUrls.length === 1) && (
          <div className={cn("px-3.5", plain && "px-4", splitDesktopImageCard && "md:hidden")}>
            <div>
              <div
                className={cn(
                  "flex gap-2",
                  imageUrls.length > 1 && "max-w-full overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
                )}
              >
                {imageUrls.map((url, idx) => (
                  <button
                    key={post.images[idx]?.id ?? `${post.id}-img-${idx}`}
                    type="button"
                    onClick={() => setImageLightboxIndex(idx)}
                    className={cn(
                      "shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-left outline-none transition-opacity hover:opacity-95 active:opacity-90 dark:border-neutral-700 dark:bg-neutral-900/40",
                      "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      imageUrls.length === 1
                        ? "aspect-[4/3] w-full max-w-[160px]"
                        : "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 lg:h-[4.5rem] lg:w-[4.5rem]"
                    )}
                    aria-label={`View image ${idx + 1} full screen`}
                  >
                    <img
                      src={url}
                      alt=""
                      className={cn(
                        "h-full w-full object-cover",
                        imageUrls.length === 1 && "aspect-[4/3]"
                      )}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              {plain && imageUrls.length > 1 && (
                <div className="mt-2 flex justify-start">
                  <PostTimeLeftBadge expiresAtIso={post.expires_at} />
                </div>
              )}
            </div>
          </div>
        )}

        {plain && imageUrls.length === 1 && (
          <div
            className={cn(
              "w-full px-4",
              tightenIconRowToImage ? "mt-0 sm:mt-0.5" : "mt-0.5 sm:mt-1",
              splitDesktopImageCard && "md:hidden"
            )}
          >
            <div className="relative w-full overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={() => setImageLightboxIndex(0)}
                className="relative block aspect-[4/3] w-full overflow-hidden bg-muted/40 text-left outline-none transition-opacity hover:opacity-95 active:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-neutral-900/50 lg:aspect-[16/10]"
                aria-label="View image full screen"
              >
                <img
                  src={imageUrls[0]}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
              <div className="pointer-events-none absolute bottom-2 left-2 z-[2]">
                <PostTimeLeftBadge expiresAtIso={post.expires_at} />
              </div>
            </div>
          </div>
        )}

        <div
          className={cn(
            "px-3.5 pb-6 pt-0.5",
            plain && "px-4 pb-7 pt-1",
            sheetComfort && "max-md:px-5 max-md:pb-8 max-md:pt-2",
            noImagePublicFeed && "max-md:pb-8 max-md:pt-2",
            splitDesktopImageCard && "md:px-4 md:pb-3 md:pt-0.5",
            splitDesktopImageCard && plain && "md:pb-3 md:pt-1"
          )}
        >
          <p
            className={cn(
              "text-lg font-semibold leading-snug text-foreground",
              sheetComfort && "max-md:text-xl max-md:leading-snug"
            )}
          >
            {post.title}
          </p>
        </div>

        <div
          className={cn(
            "space-y-2 px-3.5 pb-3",
            plain && "space-y-3 px-4 pb-4",
            sheetComfort && "max-md:space-y-4 max-md:px-5 max-md:pb-6",
            noImagePublicFeed && "max-md:space-y-5 max-md:px-4 max-md:pb-6",
            splitDesktopImageCard && "md:space-y-1.5 md:px-4 md:pb-2",
            splitDesktopImageCard && plain && "md:pb-2"
          )}
        >
          {post.availability_payload?.area_tag && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">Area</span>{" "}
              {post.availability_payload.area_tag}
            </p>
          )}
          {description && (
            <p
              className={cn(
                "whitespace-pre-wrap text-base leading-relaxed text-foreground/90",
                sheetComfort && "max-md:text-[17px] max-md:leading-relaxed"
              )}
            >
              {description}
            </p>
          )}
          {plain && imageUrls.length === 0 && (
            <div className={cn("flex justify-start pt-1", sheetComfort && "max-md:pt-2")}>
              <PostTimeLeftBadge expiresAtIso={post.expires_at} />
            </div>
          )}
        </div>
          </div>
        </div>

        <div
          className={cn(
            "space-y-2 px-3.5 py-3",
            plain
              ? tightenIconRowToImage
                ? cn(
                    "space-y-3 bg-transparent px-4 pb-4 pt-2",
                    sheetComfort && "max-md:space-y-4 max-md:px-5 max-md:pb-6 max-md:pt-4",
                    splitDesktopImageCard && "md:space-y-2 md:px-4 md:pb-2 md:pt-2"
                  )
                : largePublicIconRow
                  ? cn(
                      "space-y-3 bg-transparent px-4 pb-4 pt-3",
                      noImagePublicFeed &&
                        "max-md:space-y-5 max-md:border-t max-md:border-border/50 max-md:px-4 max-md:pb-6 max-md:pt-6",
                      sheetComfort &&
                        "max-md:space-y-5 max-md:border-t max-md:border-border/60 max-md:px-5 max-md:pb-6 max-md:pt-6",
                      splitDesktopImageCard && "md:space-y-2 md:px-4 md:pb-2 md:pt-2"
                    )
                  : "space-y-4 bg-transparent px-4 py-5"
              : "border-t border-neutral-200 bg-white dark:border-neutral-700 dark:bg-card sm:bg-white dark:sm:bg-card",
            pinFooterToBottom && "mt-auto"
          )}
        >
          {!plain && <ExpiryCountdown expiresAtIso={post.expires_at} />}
          {!isMine && user && profile && (
            iconOnlyActions ? (
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex w-full flex-wrap items-center justify-center",
                    largePublicIconRow ? "gap-3 sm:gap-5" : "gap-3",
                    sheetComfort && "max-md:gap-4"
                  )}
                >
                  {(profile.role === "client" || profile.role === "freelancer") &&
                    post.author_role === "freelancer" && (
                      <Button
                        type="button"
                        className={cn(
                          "shrink-0 rounded-full border-0 font-semibold text-white shadow-md",
                          "bg-orange-500 hover:bg-orange-600",
                          "focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
                          "disabled:opacity-60 dark:bg-orange-500 dark:hover:bg-orange-600",
                          largePublicIconRow ? "h-11 px-4 text-sm sm:h-12 sm:px-5 sm:text-base" : "h-9 px-3 text-xs"
                        )}
                        disabled={hiringPostId === post.id || pendingHirePostIds.has(post.id)}
                        onClick={() => void onHireFromPost(post.id)}
                      >
                        {hiringPostId === post.id ? "Connecting…" : "Connect now"}
                      </Button>
                    )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground",
                      largePublicIconRow ? "h-12 w-12" : "h-10 w-10"
                    )}
                    onClick={onOpenChat}
                    aria-label="Chat"
                  >
                    <MessageSquare
                      className={largePublicIconRow ? "h-6 w-6" : "h-5 w-5"}
                    />
                  </Button>
                  <CommunityPostCommentsControl
                    postId={post.id}
                    loginRedirect={loginRedirect}
                    user={user}
                    largeIcon={largePublicIconRow}
                  />
                </div>
                {pendingHirePostIds.has(post.id) &&
                  (profile.role === "client" || profile.role === "freelancer") &&
                  post.author_role === "freelancer" && (
                    <p className="text-center text-[11px] font-semibold leading-snug text-muted-foreground">
                      Waiting for confirmation.
                    </p>
                  )}
              </div>
            ) : (
              <div
                className={cn(
                  "flex flex-wrap gap-2",
                  plain && "gap-3",
                  compact
                    ? "flex-nowrap overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                    : "flex-col sm:flex-row sm:flex-wrap"
                )}
              >
                {(profile.role === "client" || profile.role === "freelancer") &&
                  post.author_role === "freelancer" && (
                  <div
                    className={cn(
                      "flex flex-col gap-1",
                      compact ? "min-w-[9.5rem] shrink-0" : "w-full sm:flex-1"
                    )}
                  >
                    <Button
                      type="button"
                      size="sm"
                      className="w-full rounded-xl"
                      disabled={hiringPostId === post.id || pendingHirePostIds.has(post.id)}
                      onClick={() => void onHireFromPost(post.id)}
                    >
                      {hiringPostId === post.id ? "Connecting…" : "Connect now"}
                    </Button>
                    {pendingHirePostIds.has(post.id) && (
                      <p className="text-center text-[11px] font-semibold leading-snug text-muted-foreground sm:text-left">
                        Waiting for confirmation.
                      </p>
                    )}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-2 rounded-xl",
                    compact ? "min-w-[7.5rem] shrink-0" : "w-full sm:flex-1"
                  )}
                  onClick={onOpenChat}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </Button>
                <CommunityPostCommentsControl
                  postId={post.id}
                  loginRedirect={loginRedirect}
                  user={user}
                />
              </div>
            )
          )}
          {((!isMine && !user) || (isMine && user)) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CommunityPostCommentsControl
                postId={post.id}
                loginRedirect={loginRedirect}
                user={user}
                largeIcon={largePublicIconRow}
              />
            </div>
          )}
          {!isMine && !user && (
            <Button type="button" variant="outline" size="sm" className="w-full rounded-xl" asChild>
              <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>Sign in to contact</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    <ImageLightboxModal
      images={imageUrls}
      initialIndex={imageLightboxIndex ?? 0}
      isOpen={imageLightboxIndex !== null && imageUrls.length > 0}
      onClose={() => setImageLightboxIndex(null)}
    />
    </>
  );
}
