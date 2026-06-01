import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { shareProfilePost } from "@/lib/profilePostShare";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import {
  type ReelFeedPost,
} from "@/components/profile/PostMediaReelsViewer";

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

  const slides = useMemo(() => {
    return posts
      .filter(
        (p): p is ReelFeedPost & {
          media_type: "image" | "video";
          storage_path: string;
        } =>
          p.source === "post" &&
          p.media_type != null &&
          Boolean(p.storage_path && String(p.storage_path).trim() !== ""),
      )
      .map((p) => ({
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
    [addToast, currentUserId, onLikeToggle],
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
          <Link
            to={`/profile/${activeSlide.authorId}`}
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
          </Link>
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
          {activeSlide.caption?.trim() ? (
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
        <div className="pointer-events-none absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-4">
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
        <DesktopComments
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
    mediaUrl: string;
    mediaType: "image" | "video";
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

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {slide.mediaType === "image" ? (
        <img
          src={slide.mediaUrl}
          alt=""
          className="h-full max-h-full w-auto max-w-full object-contain"
          draggable={false}
        />
      ) : (
        <video
          ref={videoRef}
          src={slide.mediaUrl}
          className="h-full max-h-full w-auto max-w-full object-contain"
          playsInline
          controls
          loop
          preload="metadata"
        />
      )}
    </div>
  );
}

// ─── Comments ────────────────────────────────────────────────────────────────

function DesktopComments({
  postId,
  initialCount,
  currentUserId,
  onClose,
}: {
  postId: string;
  initialCount: number;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const [comments, setComments] = useState<DesktopCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number>(initialCount);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("profile_post_comments")
        .select("id, body, created_at, author_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(250);
      if (error) throw error;
      const list = (rows ?? []) as Omit<DesktopCommentRow, "author">[];
      if (list.length === 0) {
        setComments([]);
        setCount(0);
        return;
      }
      const ids = [...new Set(list.map((r) => r.author_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      const map = new Map(
        (profs ?? []).map((p) => [p.id as string, p as DesktopCommentRow["author"]]),
      );
      setComments(list.map((r) => ({ ...r, author: map.get(r.author_id) })));
      setCount(list.length);
    } catch (e) {
      console.error("[PostMediaDesktopViewer] comments fetch", e);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

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
    if (!body || !currentUserId) return;
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

  function onComposerKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitComment();
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
          {loading && comments.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
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
                    <Link
                      to={c.author?.id ? `/profile/${c.author.id}` : "#"}
                      className={cn(
                        "shrink-0 rounded-full outline-none transition-opacity",
                        c.author?.id
                          ? "hover:opacity-90"
                          : "pointer-events-none opacity-60",
                      )}
                      onClick={onClose}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.author?.photo_url ?? undefined} />
                        <AvatarFallback className="text-[11px] font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-bold text-foreground">
                          {name}
                        </span>
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

      <div className="shrink-0 border-t border-border/40 px-5 py-3">
        {currentUserId ? (
          <div className="flex items-end gap-2">
            <Textarea
              placeholder="Write a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKeyDown}
              maxLength={4000}
              rows={2}
              {...bidirectionalInputProps(
                draft,
                "min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
              disabled={submitting}
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-orange-600 text-white hover:bg-orange-700"
              disabled={submitting || !draft.trim()}
              onClick={() => void submitComment()}
              aria-label="Post comment"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 translate-x-[1px]" />
              )}
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="font-semibold text-orange-600 underline underline-offset-2"
            >
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}
      </div>
    </section>
  );
}
