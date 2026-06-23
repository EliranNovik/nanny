import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { GuestAwareProfileLink } from "@/components/GuestAwareProfileLink";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bidirectionalInputProps,
  bidirectionalTextProps,
} from "@/lib/textDirection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { shareProfilePost } from "@/lib/profilePostShare";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import {
  type ReelFeedPost,
} from "@/components/profile/PostMediaReelsViewer";

function desktopTextOnlyTypeCardClass(typeId: string | null): string {
  const base =
    "max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border-0 p-8 text-white shadow-[0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl";

  switch (typeId) {
    case "request_help":
      return cn(base, "bg-red-400/45");
    case "offer_service":
      return cn(base, "bg-emerald-400/45");
    case "event":
      return cn(base, "bg-violet-400/45");
    default:
      return cn(base, "bg-blue-400/45");
  }
}

/** Render @-mentions as accent-coloured spans inside captions. */
function captionWithMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="font-semibold text-orange-500">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

type DesktopCommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  } | null;
};

type Props = {
  open: boolean;
  posts: ReelFeedPost[];
  initialPostId: string | null;
  onClose: () => void;
  currentUserId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => void;
  onRefreshShareStats: (postId: string) => void;
  hideLikeButton?: boolean;
};

/**
 * Desktop full-size post viewer.
 *  - Large centered video / image with on-overlay Prev/Next arrows.
 *  - Action rail (like, comments anchor, share) attached to the media.
 *  - Comments thread + inline composer rendered below the media within the
 *    same modal, so the conversation is always visible without an extra dialog.
 *  - Keyboard: ←/→ to navigate, Esc to close.
 *
 * Pair with `PostMediaReelsViewer` (mobile / portrait); pick the desktop variant
 * when `matchMedia("(min-width: 768px)")` matches.
 */
export function PostMediaDesktopViewer({
  open,
  posts,
  initialPostId,
  onClose,
  currentUserId,
  onLikeToggle,
  onRefreshShareStats,
  hideLikeButton = false,
}: Props) {
  const { addToast } = useToast();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();

  const slides = useMemo(() => {
    return posts
      .filter((p) => {
        if (p.source !== "post") return false;
        const hasMedia =
          p.media_type != null &&
          Boolean(p.storage_path && String(p.storage_path).trim() !== "");
        if (hasMedia) return true;
        return Boolean(
          p.caption?.trim() ||
            p.ai_generated_copy?.title?.trim() ||
            p.ai_generated_copy?.short_text?.trim(),
        );
      })
      .map((p) => {
        const hasMedia =
          p.media_type != null &&
          Boolean(p.storage_path && String(p.storage_path).trim() !== "");
        const generatedTitle = p.ai_generated_copy?.title?.trim() || null;
        const generatedBody = p.ai_generated_copy?.short_text?.trim() || null;
        const caption = p.caption?.trim() || null;
        return {
        postId: p.id,
        authorId: p.author_id,
        postTypeId: p.post_types?.id ?? p.post_type_id ?? null,
        mediaUrl: hasMedia ? publicProfileMediaPublicUrl(p.storage_path!) : null,
        mediaType: hasMedia ? p.media_type : null,
        isTextOnly: !hasMedia,
        title: generatedTitle,
        text: generatedBody || caption,
        caption: p.caption,
        authorName: p.author?.full_name?.trim() || "User",
        authorPhotoUrl: p.author?.photo_url ?? null,
        authorLiveUntil: p.author?.live_until ?? null,
        likeCount: p.like_count,
        commentCount: p.comment_count,
        shareClickCount: p.share_click_count,
        likedByMe: p.liked_by_me,
        };
      });
  }, [posts]);

  const initialIndex = useMemo(() => {
    if (!initialPostId || slides.length === 0) return 0;
    const i = slides.findIndex((s) => s.postId === initialPostId);
    return i >= 0 ? i : 0;
  }, [initialPostId, slides]);

  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  const safeIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  const activeSlide = slides[safeIndex];

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < slides.length - 1;

  const goPrev = useCallback(() => {
    setActiveIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setActiveIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  // Lock body scroll + global keyboard shortcuts.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Don't hijack ↑/↓/PageUp/PageDown while the user is typing in a comment.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "textarea" ||
        tag === "input" ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTyping) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        goNext();
      } else if (
        e.key === "ArrowUp" ||
        e.key === "PageUp" ||
        e.key === "k"
      ) {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, goNext, goPrev]);

  // Auto-close if there are no eligible posts.
  useEffect(() => {
    if (open && slides.length === 0) onClose();
  }, [open, slides.length, onClose]);

  // Throttle wheel events so a single trackpad / mouse-wheel gesture only
  // advances one post (the user is "swiping" between feeds, not scrolling).
  const wheelLockRef = useRef<number>(0);
  const onMediaStageWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (Math.abs(e.deltaY) < 12) return;
      const now = performance.now();
      if (now - wheelLockRef.current < 450) return;
      wheelLockRef.current = now;
      if (e.deltaY > 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  const [likingId, setLikingId] = useState<string | null>(null);
  const toggleLike = useCallback(
    async (postId: string, currentlyLiked: boolean) => {
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
        console.error("[PostMediaDesktopViewer] toggleLike", e);
        addToast({
          title: "Could not like post",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "error",
        });
      } finally {
        setLikingId(null);
      }
    },
    [addToast, currentUserId, onLikeToggle, openGuestAuthPrompt],
  );

  const handleShare = useCallback(
    async (postId: string) => {
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
        console.error("[PostMediaDesktopViewer] share insert", error);
        return;
      }
      void onRefreshShareStats(postId);
    },
    [addToast, currentUserId, onRefreshShareStats, slides],
  );

  if (!open || !activeSlide) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Post viewer"
    >
      {/* ─── Left: media stage (fills viewport, dark) ───────────────────── */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        onWheel={onMediaStageWheel}
      >
        {/* Top bar — author + close */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 via-black/35 to-transparent px-5 pt-4 pb-10">
          <GuestAwareProfileLink
            userId={activeSlide.authorId}
            className="pointer-events-auto flex min-w-0 items-center gap-3"
            onClick={onClose}
          >
            {isFreelancerInActive24hLiveWindow({
              live_until: activeSlide.authorLiveUntil,
            }) ? (
              <span className="inline-flex rounded-full bg-gradient-to-br from-lime-400 via-emerald-500 to-green-700 p-[2px]">
                <Avatar className="h-11 w-11 ring-2 ring-black/40">
                  <AvatarImage
                    src={activeSlide.authorPhotoUrl ?? undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-sm font-bold">
                    {activeSlide.authorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </span>
            ) : (
              <Avatar className="h-11 w-11 ring-1 ring-white/20">
                <AvatarImage
                  src={activeSlide.authorPhotoUrl ?? undefined}
                  className="object-cover"
                />
                <AvatarFallback className="text-sm font-bold">
                  {activeSlide.authorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <div className="truncate text-[16px] font-black text-white drop-shadow-md">
                {activeSlide.authorName}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/75">
                {safeIndex + 1} / {slides.length}
              </div>
            </div>
          </GuestAwareProfileLink>
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        {/* Media — fills available height */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <DesktopSlideMedia key={activeSlide.postId} slide={activeSlide} />

          {/* Caption — overlay near the bottom */}
          {!activeSlide.isTextOnly && activeSlide.caption?.trim() ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-7 pb-7 pt-16">
              <p
                {...bidirectionalTextProps(
                  activeSlide.caption,
                  "pointer-events-auto max-w-3xl whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/95 drop-shadow-md",
                )}
              >
                {captionWithMentions(activeSlide.caption.trim())}
              </p>
            </div>
          ) : null}
        </div>

        {/* Right-edge action rail (like / share) */}
        <div className="pointer-events-none absolute right-8 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-4">
          {!hideLikeButton ? (
            <button
              type="button"
              disabled={likingId === activeSlide.postId}
              onClick={() =>
                void toggleLike(activeSlide.postId, activeSlide.likedByMe)
              }
              className={cn(
                "pointer-events-auto flex flex-col items-center gap-1 text-white transition-transform active:scale-95 disabled:opacity-50",
              )}
              aria-label={activeSlide.likedByMe ? "Unlike" : "Like"}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-lg backdrop-blur-md hover:bg-white/20">
                <Heart
                  className={cn(
                    "h-6 w-6",
                    activeSlide.likedByMe &&
                      "fill-rose-500 text-rose-500",
                  )}
                  strokeWidth={2.5}
                />
              </span>
              {activeSlide.likeCount > 0 ? (
                <span className="text-xs font-bold tabular-nums drop-shadow">
                  {activeSlide.likeCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleShare(activeSlide.postId)}
            className="pointer-events-auto flex flex-col items-center gap-1 text-white transition-transform active:scale-95"
            aria-label="Share"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-lg backdrop-blur-md hover:bg-white/20">
              <Send className="h-6 w-6" strokeWidth={2.5} />
            </span>
            {activeSlide.shareClickCount > 0 ? (
              <span className="text-xs font-bold tabular-nums drop-shadow">
                {activeSlide.shareClickCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Vertical prev/next nav (Up/Down) — stacked on the far right edge */}
        <div className="pointer-events-none absolute right-4 bottom-6 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            className={cn(
              "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-all",
              "bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
            aria-label="Previous post"
          >
            <ChevronUp className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            className={cn(
              "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-all",
              "bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
            aria-label="Next post"
          >
            <ChevronDown className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>

      {/* ─── Right: comments rail (fixed-width panel) ───────────────────── */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-l border-border/40 bg-background text-foreground",
          "w-[380px] lg:w-[420px] xl:w-[460px] 2xl:w-[500px]",
        )}
        aria-label="Comments"
      >
        <ReelDesktopCommentsPanel
          postId={activeSlide.postId}
          initialCount={activeSlide.commentCount}
          currentUserId={currentUserId}
          onClose={onClose}
        />
      </aside>
    </div>,
    document.body,
  );
}

// ─── Slide media ─────────────────────────────────────────────────────────────

function DesktopSlideMedia({
  slide,
}: {
  slide: {
    postId: string;
    mediaUrl: string | null;
    mediaType: "image" | "video" | null;
    isTextOnly: boolean;
    postTypeId: string | null;
    title: string | null;
    text: string | null;
  };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-play when the slide is mounted; pause/cleanup when unmounted.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || slide.mediaType !== "video") return;
    vid.muted = false;
    const p = vid.play();
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).catch(() => {});
    }
    return () => {
      try {
        vid.pause();
      } catch {
        /* ignore */
      }
    };
  }, [slide.mediaType, slide.postId]);

  if (slide.isTextOnly) {
    const text = slide.text?.trim() || "";
    const title = slide.title?.trim() || "";
    const hasDistinctTitle =
      title && title.toLowerCase() !== text.toLowerCase();

    return (
      <div className="relative flex h-full w-full items-center justify-center bg-black px-8 py-24">
        <article
          className={desktopTextOnlyTypeCardClass(slide.postTypeId)}
          dir={bidirectionalTextProps(text || title).dir}
        >
          {hasDistinctTitle ? (
            <h2
              {...bidirectionalTextProps(
                title,
                "text-[28px] font-black leading-tight text-white",
              )}
            >
              {title}
            </h2>
          ) : null}
          {text ? (
            <p
              {...bidirectionalTextProps(
                text,
                cn(
                  "whitespace-pre-wrap break-words text-[19px] leading-relaxed text-white/95",
                  hasDistinctTitle && "mt-4",
                ),
              )}
            >
              {captionWithMentions(text)}
            </p>
          ) : null}
        </article>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {slide.mediaType === "image" && slide.mediaUrl ? (
        <img
          src={slide.mediaUrl}
          alt=""
          className="h-full max-h-full w-auto max-w-full object-contain"
          draggable={false}
        />
      ) : slide.mediaUrl ? (
        <video
          ref={videoRef}
          src={slide.mediaUrl}
          className="h-full max-h-full w-auto max-w-full object-contain"
          playsInline
          controls
          loop
          preload="metadata"
        />
      ) : null}
    </div>
  );
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function ReelDesktopCommentsPanel({
  postId,
  initialCount,
  currentUserId,
  onClose,
  onCountChange,
}: {
  postId: string;
  initialCount: number;
  currentUserId: string | null;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  const { addToast } = useToast();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const [comments, setComments] = useState<DesktopCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [count, setCount] = useState<number>(initialCount);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    setComments([]);
    setCount(initialCount);
    setHasLoadedComments(false);
    setCommentsError(false);
    setLoading(false);
  }, [postId, initialCount]);

  const fetchComments = useCallback(async () => {
    const fetchSeq = fetchSeqRef.current + 1;
    fetchSeqRef.current = fetchSeq;
    setLoading(true);
    setCommentsError(false);
    try {
      const commentRowsPromise = supabase
          .from("profile_post_comments")
          .select("id, body, created_at, author_id")
          .eq("post_id", postId)
          .order("created_at", { ascending: true })
          .limit(250);
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        window.setTimeout(() => resolve("timeout"), 8000);
      });
      const result = await Promise.race([commentRowsPromise, timeoutPromise]);
      if (fetchSeqRef.current !== fetchSeq) return;
      if (result === "timeout") {
        throw new Error("Timed out loading comments");
      }
      const { data: rows, error } = result;
      if (error) throw error;
      const list = (rows ?? []) as Omit<DesktopCommentRow, "author">[];
      if (list.length === 0) {
        setComments([]);
        setCount(0);
        onCountChange?.(0);
        return;
      }
      const ids = [...new Set(list.map((r) => r.author_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      if (fetchSeqRef.current !== fetchSeq) return;
      const map = new Map(
        (profs ?? []).map((p) => [p.id as string, p as DesktopCommentRow["author"]]),
      );
      const withAuthors = list.map((r) => ({ ...r, author: map.get(r.author_id) }));
      setComments(withAuthors);
      const nextCount = withAuthors.length;
      setCount(nextCount);
      onCountChange?.(nextCount);
    } catch (e) {
      console.error("[PostMediaDesktopViewer] comments fetch", e);
      setComments([]);
      setCommentsError(true);
    } finally {
      if (fetchSeqRef.current === fetchSeq) {
        setHasLoadedComments(true);
        setLoading(false);
      }
    }
  }, [postId, onCountChange]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  useRealtimeSubscription(
    {
      table: "profile_post_comments",
      event: "*",
      filter: `post_id=eq.${postId}`,
      enabled: true,
    },
    () => {
      void fetchComments();
    },
  );

  async function submitComment() {
    const body = draft.trim();
    if (!body) return;
    if (!currentUserId) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("profile_post_comments").insert({
        post_id: postId,
        author_id: currentUserId,
        body,
      });
      if (error) throw error;
      setDraft("");
      void fetchComments();
    } catch {
      addToast({ title: "Could not post comment", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/40 px-5 py-4">
        <MessageCircle
          className="h-5 w-5 text-orange-500"
          strokeWidth={2}
          aria-hidden
        />
        <h3 className="text-[15px] font-black tracking-tight text-foreground">
          {count === 0 ? "Comments" : `${count} ${count === 1 ? "Comment" : "Comments"}`}
        </h3>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-4">
          {loading && !hasLoadedComments && comments.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : commentsError && comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Could not load comments. Try again in a moment.
            </p>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {comments.map((c) => {
                const name = c.author?.full_name?.trim() || "Member";
                return (
                  <div key={c.id} className="flex gap-3 py-3">
                    {c.author?.id ? (
                      <GuestAwareProfileLink
                        userId={c.author.id}
                        className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-90"
                        aria-label={`View ${name} profile`}
                        onClick={onClose}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.author?.photo_url ?? undefined} />
                          <AvatarFallback className="text-[11px] font-bold">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </GuestAwareProfileLink>
                    ) : (
                      <Avatar className="h-8 w-8 shrink-0 opacity-60">
                        <AvatarImage src={c.author?.photo_url ?? undefined} />
                        <AvatarFallback className="text-[11px] font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {c.author?.id ? (
                          <GuestAwareProfileLink
                            userId={c.author.id}
                            className="truncate text-[13px] font-bold text-foreground hover:underline underline-offset-2"
                            aria-label={`View ${name} profile`}
                            onClick={onClose}
                          >
                            {name}
                          </GuestAwareProfileLink>
                        ) : (
                          <span className="truncate text-[13px] font-bold text-foreground">
                            {name}
                          </span>
                        )}
                        <time className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true,
                          })}
                        </time>
                      </div>
                      <p
                        {...bidirectionalTextProps(
                          c.body,
                          "mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90",
                        )}
                      >
                        {c.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 px-5 py-3">
        {currentUserId ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 rounded-full bg-zinc-800/95 px-4 py-2.5 dark:bg-zinc-700/90">
              <input
                type="text"
                placeholder="Write a comment…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitComment();
                  }
                }}
                maxLength={4000}
                disabled={submitting}
                {...bidirectionalInputProps(
                  draft,
                  "w-full border-0 bg-transparent py-0.5 text-[15px] text-white outline-none placeholder:text-white/45 disabled:opacity-60",
                )}
                aria-label="Write a comment…"
              />
            </div>
            <button
              type="button"
              disabled={submitting || !draft.trim()}
              onClick={() => void submitComment()}
              className="shrink-0 p-1 text-foreground transition active:scale-95 disabled:opacity-35 dark:text-white"
              aria-label="Post comment"
            >
              {submitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Send className="h-6 w-6" strokeWidth={2.25} />
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              Join the community to comment and connect with others.
            </p>
            <Button
              type="button"
              className={cn(
                "h-10 w-full rounded-xl font-bold",
                "bg-black text-white hover:bg-black/90 focus-visible:ring-white/30",
              )}
              onClick={() => openGuestAuthPrompt({ variant: "engage" })}
            >
              Sign in / Register
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
