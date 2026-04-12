import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { BadgeCheck, Briefcase, Heart, Loader2, MessageSquare, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { type AvailabilityPayload } from "@/lib/availabilityPosts";
import type { User } from "@supabase/supabase-js";

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
  onToggleFavorite: (postId: string) => void;
  hiringPostId: string | null;
  pendingHirePostIds: Set<string>;
  onHireFromPost: (postId: string) => void;
  onOpenChat: () => void;
  cardClassName?: string;
  /** When true, card is sized for horizontal carousels (narrow min-width). */
  compact?: boolean;
  /** No bordered panel — sits on page background (e.g. Discover home). */
  plain?: boolean;
  /** Icon-only Hire / Chat / Share row (e.g. Discover availability modal). */
  iconOnlyActions?: boolean;
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
}: CommunityPostCardProps) {
  const { addToast } = useToast();
  const isMine = user?.id === post.author_id;
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(null);
  const imageUrls = useMemo(
    () => post.images.map((i) => i.image_url).filter((u): u is string => Boolean(u)),
    [post.images]
  );

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

  const avatarEl = (
    <Avatar className="h-14 w-14 shadow-none ring-0 ring-offset-0">
      <AvatarImage src={post.author_photo_url ?? undefined} className="object-cover" alt="" />
      <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-lg font-bold text-orange-800 dark:from-orange-950 dark:to-amber-950 dark:text-orange-200">
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
        cardClassName
      )}
    >
      <CardContent className={cn("p-0", plain && "flex flex-col gap-5")}>
        <div
          className={cn(
            "flex items-start gap-3 px-3.5 pt-3.5 pb-2",
            plain && "gap-4 px-4 pt-5 pb-3"
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
          </div>
          {!isMine && (
            <div className="shrink-0">
              {user ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-full text-muted-foreground hover:text-red-500",
                    favoritedIds.has(post.id) && "text-red-500 hover:text-red-600"
                  )}
                  onClick={() => void onToggleFavorite(post.id)}
                  aria-pressed={favoritedIds.has(post.id)}
                  aria-label={
                    favoritedIds.has(post.id) ? "Remove from favorites" : "Add to favorites"
                  }
                >
                  <Heart
                    className={cn("h-5 w-5", favoritedIds.has(post.id) && "fill-current")}
                    aria-hidden
                  />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-red-500"
                  asChild
                  aria-label="Sign in to save favorites"
                >
                  <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>
                    <Heart className="h-5 w-5" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className={cn("px-3.5 pb-6", plain && "px-4 pb-7")}>
          <p className="text-lg font-semibold leading-snug text-foreground">{post.title}</p>
        </div>

        <div className={cn("space-y-2 px-3.5 pb-3", plain && "space-y-3 px-4 pb-4")}>
          {post.availability_payload?.area_tag && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">Area</span>{" "}
              {post.availability_payload.area_tag}
            </p>
          )}
          {description && (
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
              {description}
            </p>
          )}
          {imageUrls.length > 0 && (
            <div className="pt-1">
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
                        : "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20"
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
            </div>
          )}
        </div>

        <div
          className={cn(
            "space-y-2 px-3.5 py-3",
            plain
              ? "space-y-4 border-t border-border/35 bg-transparent px-4 py-5 dark:border-border/50"
              : "border-t border-neutral-200 bg-white dark:border-neutral-700 dark:bg-card sm:bg-white dark:sm:bg-card"
          )}
        >
          <ExpiryCountdown expiresAtIso={post.expires_at} />
          <p className="text-xs font-medium text-muted-foreground">
            Posted {new Date(post.created_at).toLocaleString()}
          </p>
          {!isMine && user && profile && (
            iconOnlyActions ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex w-full items-center justify-center gap-3">
                  {(profile.role === "client" || profile.role === "freelancer") &&
                    post.author_role === "freelancer" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-400 dark:hover:bg-orange-500/15 dark:hover:text-orange-300"
                        disabled={hiringPostId === post.id || pendingHirePostIds.has(post.id)}
                        onClick={() => void onHireFromPost(post.id)}
                        aria-label="Hire now"
                      >
                        {hiringPostId === post.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Briefcase className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={onOpenChat}
                    aria-label="Chat"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => void sharePost()}
                    aria-label="Share"
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
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
                  "flex gap-2",
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
                      className="w-full gap-2 rounded-xl"
                      disabled={hiringPostId === post.id || pendingHirePostIds.has(post.id)}
                      onClick={() => void onHireFromPost(post.id)}
                    >
                      {hiringPostId === post.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Briefcase className="h-4 w-4" />
                      )}
                      Hire now
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
              </div>
            )
          )}
          {!isMine && !user && (
            <Button type="button" variant="outline" size="sm" className="w-full rounded-xl" asChild>
              <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>Sign in to contact</Link>
            </Button>
          )}
          {isMine && user && (
            <Button type="button" variant="ghost" size="sm" className="w-full" asChild>
              <Link to={`/profile/${post.author_id}`}>View your public profile</Link>
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
