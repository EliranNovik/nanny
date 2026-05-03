import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, Heart, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";

/** Narrow post shape for reels (avoids circular imports with ProfilePostsFeed). */
export type ReelFeedPost = {
  id: string;
  source: "post" | "availability";
  author_id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  like_count: number;
  comment_count: number;
  share_click_count: number;
  liked_by_me: boolean;
  author?: {
    full_name: string | null;
    photo_url: string | null;
    live_until?: string | null;
  } | null;
};

function isReelablePost(p: ReelFeedPost): p is ReelFeedPost & {
  media_type: "image" | "video";
  storage_path: string;
} {
  return (
    p.source === "post" &&
    p.media_type != null &&
    Boolean(p.storage_path && String(p.storage_path).trim() !== "")
  );
}

function reelCaptionParts(caption: string): ReactNode {
  const parts = caption.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="font-semibold text-orange-300">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

/** m:ss for on-screen “time left” labels */
function formatClockSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

type Props = {
  open: boolean;
  posts: ReelFeedPost[];
  initialPostId: string | null;
  onClose: () => void;
  currentUserId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => void;
  onRefreshShareStats: (postId: string) => void;
  onOpenComments: (postId: string) => void;
  /** Liked-posts-only contexts — hide redundant like control. */
  hideLikeButton?: boolean;
};

export function PostMediaReelsViewer({
  open,
  posts,
  initialPostId,
  onClose,
  currentUserId,
  onLikeToggle,
  onRefreshShareStats,
  onOpenComments,
  hideLikeButton = false,
}: Props) {
  const { addToast } = useToast();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likingId, setLikingId] = useState<string | null>(null);

  const slides = useMemo(() => {
    return posts.filter(isReelablePost).map((p) => ({
      postId: p.id,
      authorId: p.author_id,
      mediaUrl: publicProfileMediaPublicUrl(p.storage_path),
      mediaType: p.media_type,
      caption: p.caption,
      authorName: p.author?.full_name?.trim() || "User",
      authorPhotoUrl: p.author?.photo_url ?? null,
      authorLiveUntil: p.author?.live_until ?? null,
      likeCount: p.like_count,
      commentCount: p.comment_count,
      shareClickCount: p.share_click_count,
      likedByMe: p.liked_by_me,
    }));
  }, [posts]);

  const initialIndex = useMemo(() => {
    if (!initialPostId || slides.length === 0) return 0;
    const i = slides.findIndex((s) => s.postId === initialPostId);
    return i >= 0 ? i : 0;
  }, [initialPostId, slides]);

  const safeIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  const activeSlide = slides[safeIndex] ?? slides[0];

  const syncActiveFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || slides.length === 0) return;
    const h = el.clientHeight;
    if (h <= 0) return;
    const idx = Math.min(
      slides.length - 1,
      Math.max(0, Math.round(el.scrollTop / h)),
    );
    setActiveIndex(idx);
  }, [slides.length]);

  useLayoutEffect(() => {
    if (!open || slides.length === 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled || !el) return;
      const h = el.clientHeight;
      if (h <= 0 && attempts < 12) {
        attempts += 1;
        requestAnimationFrame(tryScroll);
        return;
      }
      if (h <= 0) return;
      el.scrollTo(0, initialIndex * h);
      setActiveIndex(initialIndex);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [open, initialIndex, slides.length]);

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncActiveFromScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, syncActiveFromScroll]);

  useEffect(() => {
    if (!open || slides.length === 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => syncActiveFromScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, slides.length, syncActiveFromScroll]);

  async function toggleLike(postId: string, currentlyLiked: boolean) {
    if (!currentUserId) {
      addToast({ title: "Sign in to like posts", variant: "warning" });
      return;
    }
    setLikingId(postId);
    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("profile_post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_post_likes")
          .insert({ post_id: postId, user_id: currentUserId });
        if (error) throw error;
      }
      onLikeToggle(postId, !currentlyLiked);
    } catch (e) {
      console.error("[PostMediaReelsViewer] toggleLike", e);
      addToast({
        title: "Could not like post",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setLikingId(null);
    }
  }

  async function handleShare(postId: string) {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Check this post", url });
      } else {
        await navigator.clipboard.writeText(url);
        addToast({ title: "Link copied!", variant: "success" });
      }
    } catch {
      return;
    }
    if (!currentUserId) return;
    const { error } = await supabase.from("profile_post_shares").insert({
      post_id: postId,
      user_id: currentUserId,
    });
    if (error) {
      console.error("[PostMediaReelsViewer] share insert", error);
      return;
    }
    void onRefreshShareStats(postId);
  }

  useEffect(() => {
    if (open && slides.length === 0) onClose();
  }, [open, slides.length, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (slides.length === 0) {
    return null;
  }

  /** Portaled to `document.body` so `position:fixed` is viewport-anchored (feed wrappers use transform from `animate-in`, which traps fixed descendants). BottomNav is portaled at z-[125] so it stays above this shell (z-[119]); #root is z-[1] so in-root nav could not. */
  return createPortal(
    <div
      className={cn(
        "fixed inset-x-0 top-0 bottom-0 z-[119] flex flex-col bg-black pointer-events-auto max-md:rounded-none",
        "md:left-1/2 md:mx-auto md:mt-2 md:max-w-lg md:-translate-x-1/2 md:overflow-hidden md:rounded-t-2xl",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Post media"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute left-[max(0.25rem,env(safe-area-inset-left))] top-[env(safe-area-inset-top,0px)] z-30 flex h-11 w-11 items-center justify-center text-white transition-opacity hover:opacity-90 md:left-3 md:top-[max(0.75rem,env(safe-area-inset-top))]"
        aria-label="Back"
      >
        <ChevronLeft
          className="h-8 w-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      {/* Right action rail — fixed to viewer, reflects active slide */}
      <div className="pointer-events-none absolute right-2 top-[42%] z-30 flex -translate-y-1/2 flex-col items-center gap-5">
        <div className="pointer-events-auto flex flex-col items-center gap-5 pr-1">
          {!hideLikeButton ? (
          <button
            type="button"
            disabled={likingId === activeSlide.postId}
            onClick={() =>
              void toggleLike(activeSlide.postId, activeSlide.likedByMe)
            }
            className={cn(
              "flex flex-col items-center gap-1 text-white transition-transform active:scale-95 disabled:opacity-50",
            )}
            aria-label={activeSlide.likedByMe ? "Unlike" : "Like"}
          >
            <Heart
              className={cn(
                "h-8 w-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
                activeSlide.likedByMe && "scale-110 fill-rose-500 text-rose-500",
              )}
              strokeWidth={2.5}
            />
            {activeSlide.likeCount > 0 ? (
              <span className="text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                {activeSlide.likeCount}
              </span>
            ) : null}
          </button>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenComments(activeSlide.postId)}
            className="flex flex-col items-center gap-1 text-white transition-transform active:scale-95"
            aria-label="Comments"
          >
            <MessageCircle
              className="h-8 w-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              strokeWidth={2.5}
            />
            {activeSlide.commentCount > 0 ? (
              <span className="text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                {activeSlide.commentCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => void handleShare(activeSlide.postId)}
            className="flex flex-col items-center gap-1 text-white transition-transform active:scale-95"
            aria-label="Share"
          >
            <Send
              className="h-8 w-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              strokeWidth={2.5}
            />
            {activeSlide.shareClickCount > 0 ? (
              <span className="text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                {activeSlide.shareClickCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 touch-pan-y snap-y snap-mandatory overflow-y-auto overflow-x-hidden scroll-smooth"
      >
        {slides.map((slide) => (
          <ReelSlide
            key={slide.postId}
            slide={slide}
            activePostId={activeSlide.postId}
            onOpenComments={onOpenComments}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function ReelSlide({
  slide,
  activePostId,
  onOpenComments,
}: {
  slide: {
    postId: string;
    authorId: string;
    mediaUrl: string;
    mediaType: "image" | "video";
    caption: string | null;
    authorName: string;
    authorPhotoUrl: string | null;
    authorLiveUntil: string | null;
  };
  activePostId: string;
  onOpenComments: (postId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const showLiveRing = isFreelancerInActive24hLiveWindow({
    live_until: slide.authorLiveUntil,
  });
  /** `true` = wider than tall → show full frame, centered; `false` = portrait/square → immersive crop on mobile */
  const [isLandscapeMedia, setIsLandscapeMedia] = useState<boolean | null>(
    null,
  );
  const [videoClock, setVideoClock] = useState({ current: 0, duration: 0 });

  const syncVideoClockFromEl = useCallback((vid: HTMLVideoElement) => {
    const duration = vid.duration;
    setVideoClock({
      current: vid.currentTime,
      duration:
        Number.isFinite(duration) && duration > 0 ? duration : 0,
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || slide.mediaType !== "video") return;
    const vid = videoRef.current;
    if (!vid) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          vid.muted = false;
          const p = vid.play();
          if (p && typeof (p as Promise<void>).catch === "function") {
            (p as Promise<void>).catch(() => {});
          }
        } else {
          try {
            vid.pause();
          } catch {
            /* ignore */
          }
        }
      },
      { threshold: [0, 0.35, 0.55, 0.85] },
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, [slide.mediaType, slide.postId]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || slide.mediaType !== "video") return;
    if (activePostId !== slide.postId) {
      try {
        vid.pause();
      } catch {
        /* ignore */
      }
    }
  }, [activePostId, slide.mediaType, slide.postId]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || slide.mediaType !== "video") return;
    if (activePostId !== slide.postId) return;
    const onTime = () => syncVideoClockFromEl(vid);
    const onMeta = () => {
      syncVideoClockFromEl(vid);
      const w = vid.videoWidth;
      const h = vid.videoHeight;
      if (w > 0 && h > 0) setIsLandscapeMedia(w > h);
    };
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("loadedmetadata", onMeta);
    syncVideoClockFromEl(vid);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("loadedmetadata", onMeta);
    };
  }, [activePostId, slide.mediaType, slide.postId, syncVideoClockFromEl]);

  const mediaObjectClass = cn(
    "h-full w-full",
    isLandscapeMedia === true &&
      "object-contain object-center max-md:object-contain max-md:object-center",
    isLandscapeMedia === false &&
      "object-contain md:object-contain max-md:object-cover max-md:object-top",
    isLandscapeMedia === null && "object-contain object-center",
  );

  const showVideoProgress =
    slide.mediaType === "video" &&
    activePostId === slide.postId &&
    videoClock.duration > 0;
  const remaining = Math.max(0, videoClock.duration - videoClock.current);
  const playedPct =
    videoClock.duration > 0
      ? Math.min(100, (videoClock.current / videoClock.duration) * 100)
      : 0;

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
      }}
      className="relative flex h-full min-h-full w-full shrink-0 snap-start snap-always flex-col bg-black"
    >
      {showVideoProgress ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[35] flex flex-col items-stretch px-3 pt-[max(0.35rem,env(safe-area-inset-top,0px))]"
          role="group"
          aria-label={`Video: ${formatClockSeconds(remaining)} remaining`}
        >
          <div
            className="h-[3px] w-full overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(playedPct)}
            aria-label="Playback position"
          >
            <div
              className="h-full rounded-full bg-white/90 shadow-sm transition-[width] duration-150 ease-linear"
              style={{ width: `${playedPct}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] font-semibold tabular-nums tracking-tight text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {formatClockSeconds(remaining)} left
          </p>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-black">
        {slide.mediaType === "image" ? (
          <img
            src={slide.mediaUrl}
            alt=""
            className={mediaObjectClass}
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w > 0 && h > 0) setIsLandscapeMedia(w > h);
            }}
          />
        ) : (
          <div className="relative block h-full w-full overflow-hidden">
            <video
              ref={videoRef}
              src={slide.mediaUrl}
              className={mediaObjectClass}
              playsInline
              muted={false}
              loop
              preload="metadata"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.muted = false;
                const w = v.videoWidth;
                const h = v.videoHeight;
                if (w > 0 && h > 0) setIsLandscapeMedia(w > h);
                syncVideoClockFromEl(v);
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom — avatar + name; caption (2 lines) opens comments for full text */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/75 to-transparent px-4 pt-24",
          /* Keep copy above BottomNav on mobile; desktop keeps compact padding */
          "pb-5 max-md:pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]",
        )}
      >
        <div className="pointer-events-auto max-w-[calc(100%-3.5rem)]">
          <div className="flex items-center gap-2.5">
            <Link
              to={`/profile/${slide.authorId}`}
              className={cn(
                "shrink-0 rounded-full",
                !showLiveRing && "ring-1 ring-white/20",
              )}
              title={
                showLiveRing ? "Live now (24h availability)" : undefined
              }
              onClick={(e) => e.stopPropagation()}
              aria-label={`View ${slide.authorName} profile`}
            >
              {showLiveRing ? (
                <span className="inline-flex rounded-full bg-gradient-to-br from-lime-400 via-emerald-500 to-green-700 p-[2.5px] shadow-[0_0_12px_rgba(34,197,94,0.35)]">
                  <span className="rounded-full overflow-hidden ring-1 ring-black/30">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={slide.authorPhotoUrl ?? undefined}
                        className="object-cover"
                        alt=""
                      />
                      <AvatarFallback className="bg-white/15 text-sm font-bold text-white">
                        {slide.authorName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                </span>
              ) : (
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={slide.authorPhotoUrl ?? undefined}
                    className="object-cover"
                    alt=""
                  />
                  <AvatarFallback className="bg-white/15 text-sm font-bold text-white">
                    {slide.authorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </Link>
            <Link
              to={`/profile/${slide.authorId}`}
              className="min-w-0 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-lg font-black lowercase leading-tight text-white drop-shadow-md">
                {slide.authorName}
              </span>
            </Link>
          </div>
          {slide.caption?.trim() ? (
            <button
              type="button"
              onClick={() => onOpenComments(slide.postId)}
              className="mt-2 w-full rounded-lg py-1 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Open comments to read full caption"
            >
              <p className="line-clamp-2 break-words text-base leading-snug text-white/95 drop-shadow">
                {reelCaptionParts(slide.caption.trim())}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenComments(slide.postId)}
              className="mt-2 text-left text-sm font-semibold text-white/80 underline-offset-2 hover:text-white hover:underline"
              aria-label="Open comments"
            >
              View comments
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
