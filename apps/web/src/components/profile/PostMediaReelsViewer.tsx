import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GuestAwareProfileLink } from "@/components/GuestAwareProfileLink";
import { ChevronLeft, Clock, Coins, Heart, Loader2, MapPin, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bidirectionalClass,
  bidirectionalInputProps,
  bidirectionalTextProps,
} from "@/lib/textDirection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { shareProfilePost } from "@/lib/profilePostShare";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { useAuth } from "@/context/AuthContext";
import { openCommunityContact } from "@/lib/communityContact";
import type { GeneratedPostCopy } from "@/lib/generatedPostCopy";
import {
  feedPostBudgetLine,
  feedPostDescription,
  feedPostReelLocationLine,
  feedPostTitle,
  feedPostWhenLabel,
  globalFeedCtaLabel,
  globalFeedPostTypeBadgeClass,
  globalFeedPostTypeBadgeLabel,
  globalFeedPrimaryCtaClass,
  globalFeedTextOnlySurfaceClass,
} from "@/lib/globalFeedPostUi";
import {
  getEventJoinInterestStatus,
  recordEventJoinInterest,
  type EventJoinInterestStatus,
} from "@/lib/profilePostEventJoin";
import { ReelDesktopCommentsPanel } from "@/components/profile/PostMediaDesktopViewer";

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
  post_type_id?: string | null;
  post_types?: { id: string; name?: string } | null;
  post_metadata?: Record<string, unknown> | null;
  ai_generated_copy?: GeneratedPostCopy | null;
  custom_category?: string | null;
  author?: {
    full_name: string | null;
    photo_url: string | null;
    live_until?: string | null;
    role?: string | null;
  } | null;
};

function postHasReelsMedia(p: ReelFeedPost): boolean {
  return (
    p.media_type != null &&
    Boolean(p.storage_path && String(p.storage_path).trim() !== "")
  );
}

export function isReelsViewerPost(p: ReelFeedPost): boolean {
  if (p.source !== "post") return false;
  if (postHasReelsMedia(p)) return true;

  const typeId = p.post_types?.id ?? p.post_type_id ?? null;
  if (
    typeId === "request_help" ||
    typeId === "offer_service" ||
    typeId === "event"
  ) {
    return true;
  }

  if (p.caption?.trim()) return true;

  const copy = p.ai_generated_copy;
  return Boolean(copy?.title?.trim() || copy?.short_text?.trim());
}

type ReelSlideData = {
  postId: string;
  authorId: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  isTextOnly: boolean;
  isTypedTextOnly: boolean;
  title: string | null;
  description: string | null;
  caption: string | null;
  authorName: string;
  authorFirstName: string;
  authorPhotoUrl: string | null;
  authorLiveUntil: string | null;
  authorRole: string | null;
  postTypeId: string | null;
  postTypeName: string | null;
  locationLine: string | null;
  whenLabel: string | null;
  budgetLine: string | null;
  likeCount: number;
  commentCount: number;
  shareClickCount: number;
  likedByMe: boolean;
  actionLabel: string;
  showActionButton: boolean;
};

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

function isReelCaptionExpandable(text: string, maxLines: number): boolean {
  const trimmed = text.trim();
  if (maxLines <= 2) {
    return trimmed.length > 100 || trimmed.includes("\n");
  }
  if (maxLines <= 4) {
    return trimmed.length > 220 || (trimmed.match(/\n/g) || []).length > 2;
  }
  return trimmed.length > 480 || (trimmed.match(/\n/g) || []).length > 8;
}

const reelCaptionLineClampClass: Record<2 | 4 | 10, string> = {
  2: "line-clamp-2",
  4: "line-clamp-4",
  10: "line-clamp-[10]",
};

function ReelExpandableCaption({
  text,
  maxLines = 2,
  slideKey,
  variant = "overlay",
  className,
}: {
  text: string;
  maxLines?: 2 | 4 | 10;
  slideKey: string;
  variant?: "overlay" | "card";
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandable = isReelCaptionExpandable(text, maxLines);

  useEffect(() => {
    setExpanded(false);
  }, [slideKey]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expandable) return;
    setExpanded((prev) => !prev);
  };

  const isOverlay = variant === "overlay";
  const glassPanelClass =
    isOverlay && expanded
      ? cn("rounded-xl px-3 py-2", "bg-zinc-900/50 backdrop-blur-lg")
      : null;
  const textClassName = cn(
    "whitespace-pre-wrap break-words leading-snug",
    isOverlay
      ? "text-[18px] text-white/95 drop-shadow"
      : "text-[18px] text-foreground/90",
    !expanded && expandable && reelCaptionLineClampClass[maxLines],
    className,
  );
  const textContent = (
    <>
      <p {...bidirectionalTextProps(text, textClassName)}>{reelCaptionParts(text)}</p>
      {expandable ? (
        <span
          className={cn(
            "mt-1 block text-[14px] font-bold",
            isOverlay ? "text-white/85" : "text-foreground/70",
          )}
        >
          {expanded ? "Less" : "More"}
        </span>
      ) : null}
    </>
  );

  if (!expandable) {
    return (
      <div
        className={cn("w-full py-0.5", bidirectionalClass(text))}
        dir={bidirectionalTextProps(text).dir}
      >
        {textContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "w-full transition-colors",
        glassPanelClass,
        !expanded && "rounded-lg py-0.5",
        bidirectionalClass(text),
        "cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2",
        isOverlay
          ? expanded
            ? "focus-visible:ring-white/40"
            : "hover:bg-white/10 focus-visible:ring-white/40"
          : "hover:bg-black/5 focus-visible:ring-foreground/20 dark:hover:bg-white/5",
        expanded && isOverlay && "max-h-[45vh] overflow-y-auto",
      )}
      dir={bidirectionalTextProps(text).dir}
      aria-expanded={expanded}
      aria-label={expanded ? "Show less post text" : "Show full post text"}
    >
      {textContent}
    </button>
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
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { user, profile: viewerProfile } = useAuth();
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [primaryActionPostId, setPrimaryActionPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [eventJoinByPostId, setEventJoinByPostId] = useState<
    Record<string, EventJoinInterestStatus | null>
  >({});

  const slides = useMemo((): ReelSlideData[] => {
    return posts.filter(isReelsViewerPost).map((p) => {
      const postTypeId = p.post_types?.id ?? p.post_type_id ?? null;
      const authorName = p.author?.full_name?.trim() || "User";
      const authorFirstName = authorName.split(" ")[0] || authorName;
      const hasMedia = postHasReelsMedia(p);
      const generatedCopy = p.ai_generated_copy ?? null;
      const categoryLabel =
        p.custom_category?.trim() ||
        (typeof p.post_metadata?.custom_category === "string"
          ? p.post_metadata.custom_category.trim()
          : null);
      const title = feedPostTitle(
        t,
        {
          source: "post",
          post_type_id: p.post_type_id,
          post_types: p.post_types,
          post_metadata: p.post_metadata,
        },
        generatedCopy,
        categoryLabel,
      );
      const description = feedPostDescription(
        generatedCopy,
        p.caption ?? "",
        title,
      );
      const isTextOnly = !hasMedia;
      const isTypedTextOnly =
        isTextOnly &&
        (postTypeId === "request_help" ||
          postTypeId === "offer_service" ||
          postTypeId === "event");
      const postLike = {
        source: "post" as const,
        post_type_id: p.post_type_id,
        post_types: p.post_types,
        post_metadata: p.post_metadata,
      };
      const locationLine = feedPostReelLocationLine(t, postLike);
      const whenLabel = feedPostWhenLabel(
        t,
        i18n.language,
        postTypeId,
        p.post_metadata,
      );
      const budgetLine = feedPostBudgetLine(t, postTypeId, p.post_metadata);

      return {
        postId: p.id,
        authorId: p.author_id,
        mediaUrl: hasMedia
          ? publicProfileMediaPublicUrl(p.storage_path!)
          : null,
        mediaType: hasMedia ? p.media_type : null,
        isTextOnly,
        isTypedTextOnly,
        title,
        description: description || (isTextOnly ? p.caption?.trim() || null : null),
        caption: p.caption,
        authorName,
        authorFirstName,
        authorPhotoUrl: p.author?.photo_url ?? null,
        authorLiveUntil: p.author?.live_until ?? null,
        authorRole: p.author?.role ?? null,
        postTypeId,
        postTypeName: p.post_types?.name ?? null,
        locationLine,
        whenLabel,
        budgetLine,
        likeCount: p.like_count,
        commentCount: p.comment_count,
        shareClickCount: p.share_click_count,
        likedByMe: p.liked_by_me,
        actionLabel: globalFeedCtaLabel(t, {
          isJobRequest: false,
          jobAcceptedAt: null,
          postTypeId,
          authorFirstName,
          isOwnEventPost: user?.id === p.author_id && postTypeId === "event",
          eventJoinStatus: null,
        }),
        showActionButton: user?.id !== p.author_id,
      };
    });
  }, [posts, t, i18n.language, user?.id]);

  const initialIndex = useMemo(() => {
    if (!initialPostId || slides.length === 0) return 0;
    const i = slides.findIndex((s) => s.postId === initialPostId);
    return i >= 0 ? i : 0;
  }, [initialPostId, slides]);

  const safeIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  const activeSlide = slides[safeIndex] ?? slides[0];
  const activeCommentCount =
    commentCounts[activeSlide.postId] ?? activeSlide.commentCount;
  const activeCommentDraft = commentDrafts[activeSlide.postId] ?? "";

  useEffect(() => {
    if (!open) {
      setCommentDrafts({});
      setCommentCounts({});
      return;
    }
    setCommentCounts((prev) => {
      const next = { ...prev };
      for (const slide of slides) {
        const local = next[slide.postId];
        if (local === undefined || slide.commentCount > local) {
          next[slide.postId] = slide.commentCount;
        }
      }
      return next;
    });
  }, [open, slides]);

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
      openGuestAuthPrompt({ variant: "engage" });
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

  async function handlePrimaryAction(slide: ReelSlideData) {
    if (!user || !viewerProfile) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    if (user.id === slide.authorId) return;

    const eventJoinStatus = eventJoinByPostId[slide.postId] ?? null;

    if (slide.postTypeId === "event") {
      if (eventJoinStatus === "declined") {
        addToast({
          title: "Not selected for this event",
          description: "The host declined your request.",
          variant: "warning",
        });
        return;
      }
      if (eventJoinStatus === "accepted") return;

      setPrimaryActionPostId(slide.postId);
      try {
        const result = await recordEventJoinInterest(supabase, slide.postId, user.id);
        setEventJoinByPostId((prev) => ({ ...prev, [slide.postId]: result.status }));
        addToast({
          title: result.alreadyJoined ? "Already interested" : "You're interested in this event!",
          variant: "success",
        });
      } catch (error) {
        console.error("[PostMediaReelsViewer] event join", error);
        addToast({
          title: "Could not save your interest",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      } finally {
        setPrimaryActionPostId(null);
      }
      return;
    }

    setPrimaryActionPostId(slide.postId);
    try {
      await openCommunityContact({
        supabase,
        user,
        myRole: viewerProfile.role,
        targetUserId: slide.authorId,
        targetRole: slide.authorRole,
        navigate,
        addToast,
      });
    } finally {
      setPrimaryActionPostId(null);
    }
  }

  async function submitReelComment() {
    const postId = activeSlide.postId;
    const body = activeCommentDraft.trim();
    if (!body || commentSubmitting) return;
    if (!currentUserId) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setCommentSubmitting(true);
    try {
      const { error } = await supabase.from("profile_post_comments").insert({
        post_id: postId,
        author_id: currentUserId,
        body,
      });
      if (error) throw error;
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      setCommentCounts((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? activeSlide.commentCount) + 1,
      }));
    } catch (e) {
      console.error("[PostMediaReelsViewer] submitComment", e);
      addToast({ title: "Could not post comment", variant: "error" });
    } finally {
      setCommentSubmitting(false);
    }
  }

  function onCommentKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitReelComment();
    }
  }

  useEffect(() => {
    if (!open || !user?.id) {
      setEventJoinByPostId({});
      return;
    }
    const eventSlides = slides.filter((s) => s.postTypeId === "event");
    if (eventSlides.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        eventSlides.map(async (slide) => {
          if (slide.authorId === user.id) return null;
          try {
            const status = await getEventJoinInterestStatus(
              supabase,
              slide.postId,
              user.id,
            );
            return [slide.postId, status] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, EventJoinInterestStatus | null> = {};
      for (const entry of entries) {
        if (entry && entry[1]) next[entry[0]] = entry[1];
      }
      setEventJoinByPostId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slides, user?.id]);

  async function handleShare(postId: string) {
    const slide = slides.find((s) => s.postId === postId);
    if (!slide) return;

    const result = await shareProfilePost({
      postId,
      authorName: slide.authorName,
      caption: slide.caption,
      mediaUrl: slide.mediaUrl,
      mediaType: slide.mediaType,
    });

    if (result === "cancelled") return;
    if (result === "copied") {
      addToast({
        title: "Link copied",
        description: "Paste anywhere to share this post.",
        variant: "success",
      });
    } else if (result === "failed") {
      addToast({
        title: "Could not share",
        description: "Try copying the page URL manually.",
        variant: "error",
      });
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
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const el = scrollerRef.current;
      if (!el) return;
      const h = el.clientHeight;
      if (h <= 0) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        el.scrollBy({ top: h, behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        el.scrollBy({ top: -h, behavior: "smooth" });
      }
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

  /** Portaled to `document.body` so `position:fixed` is viewport-anchored above app chrome. */
  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex h-[100dvh] flex-col bg-black pointer-events-auto md:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label="Post media"
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-30 flex h-11 w-11 items-center justify-center text-white transition-opacity hover:opacity-90"
          aria-label="Back"
        >
          <ChevronLeft
            className="h-8 w-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            strokeWidth={2.5}
            aria-hidden
          />
        </button>

        {/* Right action rail — mobile + desktop media column */}
        <div className="pointer-events-none absolute right-2 top-[42%] z-30 flex -translate-y-1/2 flex-col items-center gap-8">
          <div className="pointer-events-auto flex flex-col items-center gap-8 pr-1">
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
              className="flex flex-col items-center gap-1 text-white transition-transform active:scale-95 md:hidden"
              aria-label="Comments"
            >
              <MessageCircle
                className="h-8 w-8 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                strokeWidth={2.5}
              />
              {activeCommentCount > 0 ? (
                <span className="text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                  {activeCommentCount}
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
          className="min-h-0 flex-1 touch-pan-y snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [&>*]:h-full [&>*]:min-h-full"
        >
          {slides.map((slide) => {
            const eventJoinStatus = eventJoinByPostId[slide.postId] ?? null;
            const actionLabel = globalFeedCtaLabel(t, {
              isJobRequest: false,
              jobAcceptedAt: null,
              postTypeId: slide.postTypeId,
              authorFirstName: slide.authorFirstName,
              isOwnEventPost: user?.id === slide.authorId && slide.postTypeId === "event",
              eventJoinStatus,
            });
            const actionClassName = globalFeedPrimaryCtaClass(
              slide.postTypeId,
              eventJoinStatus === "accepted"
                ? "accepted"
                : eventJoinStatus === "declined"
                  ? "declined"
                  : eventJoinStatus === "pending"
                    ? "pending"
                    : undefined,
            );
            const actionDisabled =
              primaryActionPostId === slide.postId ||
              (slide.postTypeId === "event" &&
                (eventJoinStatus === "accepted" || eventJoinStatus === "declined"));

            return (
              <ReelSlide
                key={slide.postId}
                slide={slide}
                activePostId={activeSlide.postId}
                showActionButton={slide.showActionButton}
                actionLabel={actionLabel}
                actionClassName={actionClassName}
                actionDisabled={actionDisabled}
                actionBusy={primaryActionPostId === slide.postId}
                onPrimaryAction={() => void handlePrimaryAction(slide)}
              />
            );
          })}
        </div>

        <div className="relative z-40 flex shrink-0 items-center gap-3 bg-black px-4 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:hidden">
          <div className="min-w-0 flex-1 rounded-full bg-zinc-800/95 px-4 py-2.5 dark:bg-zinc-700/90">
            <input
              type="text"
              value={activeCommentDraft}
              onChange={(e) =>
                setCommentDrafts((prev) => ({
                  ...prev,
                  [activeSlide.postId]: e.target.value,
                }))
              }
              onKeyDown={onCommentKeyDown}
              onFocus={() => {
                if (!currentUserId) openGuestAuthPrompt({ variant: "engage" });
              }}
              placeholder={t("feed.writeComment")}
              maxLength={4000}
              disabled={commentSubmitting}
              {...bidirectionalInputProps(
                activeCommentDraft,
                "w-full border-0 bg-transparent py-0.5 text-[15px] text-white outline-none placeholder:text-white/45 disabled:opacity-60",
              )}
              aria-label={t("feed.writeComment")}
            />
          </div>
          <button
            type="button"
            disabled={commentSubmitting || !activeCommentDraft.trim()}
            onClick={() => void submitReelComment()}
            className="shrink-0 p-1 text-white transition active:scale-95 disabled:opacity-35"
            aria-label="Post comment"
          >
            {commentSubmitting ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            ) : (
              <Send className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>
      </div>

      <aside
        className={cn(
          "hidden min-h-0 shrink-0 flex-col border-l border-border/40 bg-background text-foreground md:flex",
          "w-[380px] lg:w-[420px] xl:w-[460px] 2xl:w-[500px]",
        )}
        aria-label="Comments"
      >
        <ReelDesktopCommentsPanel
          key={activeSlide.postId}
          postId={activeSlide.postId}
          initialCount={activeCommentCount}
          currentUserId={currentUserId}
          onClose={onClose}
          onCountChange={(count) =>
            setCommentCounts((prev) => ({ ...prev, [activeSlide.postId]: count }))
          }
        />
      </aside>
    </div>,
    document.body,
  );
}

function ReelPostTypeBadge({
  postTypeId,
  postTypeName,
}: {
  postTypeId: string | null;
  postTypeName: string | null;
}) {
  const { t } = useTranslation();
  if (!postTypeId) return null;
  return (
    <span
      className={cn(
        globalFeedPostTypeBadgeClass(postTypeId),
        "rounded-lg px-3.5 py-1 text-[13px] tracking-wide",
      )}
    >
      {globalFeedPostTypeBadgeLabel(t, postTypeId, postTypeName ?? undefined)}
    </span>
  );
}

function ReelPostDetails({
  slide,
  variant = "overlay",
}: {
  slide: Pick<
    ReelSlideData,
    "postTypeId" | "locationLine" | "whenLabel" | "budgetLine"
  >;
  variant?: "overlay" | "card";
}) {
  const hasDetails =
    slide.locationLine || slide.whenLabel || slide.budgetLine;
  if (!hasDetails) return null;

  const iconClass =
    variant === "overlay"
      ? "h-4 w-4 shrink-0 text-white/55"
      : "h-4 w-4 shrink-0 text-muted-foreground";
  const textClass =
    variant === "overlay"
      ? "text-[14px] font-medium text-white/90"
      : "text-[14px] font-medium text-foreground/85";
  const budgetClass =
    variant === "overlay"
      ? cn(
          "text-[14px] font-medium",
          slide.postTypeId === "offer_service"
            ? "text-emerald-300"
            : "text-red-300",
        )
      : cn(
          "text-[14px] font-medium",
          slide.postTypeId === "offer_service"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        );

  return (
    <div className="mt-3 space-y-1.5">
      {slide.locationLine ? (
        <div className="flex items-center gap-2">
          <MapPin className={iconClass} aria-hidden />
          <span className={textClass}>{slide.locationLine}</span>
        </div>
      ) : null}
      {slide.whenLabel ? (
        <div className="flex items-center gap-2">
          <Clock className={iconClass} aria-hidden />
          <span className={textClass}>{slide.whenLabel}</span>
        </div>
      ) : null}
      {slide.budgetLine ? (
        <div className="flex items-center gap-2">
          <Coins className={iconClass} aria-hidden />
          <span className={budgetClass}>{slide.budgetLine}</span>
        </div>
      ) : null}
    </div>
  );
}

function reelSlideBodyText(slide: ReelSlideData): string | null {
  return (
    slide.description?.trim() ||
    slide.caption?.trim() ||
    null
  );
}

function reelSlideShowTitle(slide: ReelSlideData, bodyText: string | null): boolean {
  return Boolean(
    slide.title?.trim() &&
      slide.title.trim().toLowerCase() !== bodyText?.toLowerCase(),
  );
}

function ReelTextOnlyCenter({ slide }: { slide: ReelSlideData }) {
  const bodyText = reelSlideBodyText(slide);
  const showTitle = reelSlideShowTitle(slide, bodyText);
  const useCard = slide.isTypedTextOnly;
  const contentLayout = bidirectionalTextProps(bodyText || slide.title || "");

  if (!showTitle && !bodyText) {
    return <div className="relative min-h-0 flex-1 bg-black" aria-hidden />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-black px-6 pb-44 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pb-8">
      <div
        className={cn(
          "mx-auto w-full max-w-md",
          useCard && "rounded-2xl p-6",
          useCard && globalFeedTextOnlySurfaceClass(slide.postTypeId),
          useCard ? contentLayout.className : cn("text-center", contentLayout.className),
        )}
        dir={contentLayout.dir}
      >
        {showTitle ? (
          <h2
            {...bidirectionalTextProps(
              slide.title!,
              cn(
                "text-[22px] font-bold leading-snug",
                useCard ? "text-foreground" : "text-white drop-shadow-md",
              ),
            )}
          >
            {slide.title}
          </h2>
        ) : null}
        {bodyText ? (
          <ReelExpandableCaption
            text={bodyText}
            maxLines={10}
            slideKey={slide.postId}
            variant={useCard ? "card" : "overlay"}
            className={showTitle ? "mt-3" : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReelSlideBottomPanel({
  slide,
  showLiveRing,
  showActionButton,
  actionLabel,
  actionClassName,
  actionDisabled,
  actionBusy,
  onPrimaryAction,
}: {
  slide: ReelSlideData;
  showLiveRing: boolean;
  showActionButton: boolean;
  actionLabel: string;
  actionClassName: string;
  actionDisabled: boolean;
  actionBusy: boolean;
  onPrimaryAction: () => void;
}) {
  const bodyText = slide.isTextOnly
    ? null
    : slide.caption?.trim() || slide.description?.trim() || null;
  const showTitle =
    !slide.isTextOnly && reelSlideShowTitle(slide, bodyText);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-20 pb-3",
      )}
    >
      <div className="pointer-events-auto max-w-[calc(100%-3.5rem)]">
        <div className="flex items-center gap-2.5">
          <GuestAwareProfileLink
            userId={slide.authorId}
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
          </GuestAwareProfileLink>
          <GuestAwareProfileLink
            userId={slide.authorId}
            className="min-w-0 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-lg font-black lowercase leading-tight text-white drop-shadow-md">
              {slide.authorName}
            </span>
          </GuestAwareProfileLink>
        </div>

        {showTitle ? (
          <h3
            {...bidirectionalTextProps(
              slide.title!,
              "mt-2 text-[19px] font-bold leading-snug text-white drop-shadow-md",
            )}
          >
            {slide.title}
          </h3>
        ) : null}

        {bodyText ? (
          <div className="mt-1.5">
            <ReelExpandableCaption
              text={bodyText}
              maxLines={2}
              slideKey={slide.postId}
              variant="overlay"
            />
          </div>
        ) : null}

        <ReelPostDetails slide={slide} variant="overlay" />

        {showActionButton ? (
          <button
            type="button"
            disabled={actionDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onPrimaryAction();
            }}
            className={cn(
              "mt-3 inline-flex h-11 w-full max-w-sm items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold shadow-lg transition active:scale-[0.98] disabled:opacity-60",
              actionClassName,
            )}
          >
            {actionBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReelSlide({
  slide,
  activePostId,
  showActionButton,
  actionLabel,
  actionClassName,
  actionDisabled,
  actionBusy,
  onPrimaryAction,
}: {
  slide: ReelSlideData;
  activePostId: string;
  showActionButton: boolean;
  actionLabel: string;
  actionClassName: string;
  actionDisabled: boolean;
  actionBusy: boolean;
  onPrimaryAction: () => void;
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
    isLandscapeMedia === true && "object-contain object-center",
    isLandscapeMedia === false && "object-cover object-top",
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
      {slide.postTypeId ? (
        <div className="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right,0px))] top-[calc(env(safe-area-inset-top,0px)+0.625rem)] z-[25]">
          <ReelPostTypeBadge
            postTypeId={slide.postTypeId}
            postTypeName={slide.postTypeName}
          />
        </div>
      ) : null}

      {showVideoProgress ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[35] flex flex-col items-stretch px-3 pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]"
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

      {slide.isTextOnly ? (
        <ReelTextOnlyCenter slide={slide} />
      ) : (
      <div className="relative min-h-0 flex-1 bg-black">
        {slide.mediaType === "image" && slide.mediaUrl ? (
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
        ) : slide.mediaUrl ? (
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
        ) : null}
      </div>
      )}

      <ReelSlideBottomPanel
        slide={slide}
        showLiveRing={showLiveRing}
        showActionButton={showActionButton}
        actionLabel={actionLabel}
        actionClassName={actionClassName}
        actionDisabled={actionDisabled}
        actionBusy={actionBusy}
        onPrimaryAction={onPrimaryAction}
      />
    </div>
  );
}
