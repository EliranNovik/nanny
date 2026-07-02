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
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GuestAwareProfileLink } from "@/components/GuestAwareProfileLink";
import { ChevronLeft, Clock, Coins, Heart, Loader2, MapPin, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bidirectionalClass,
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
import { acceptOpenHelpRequest } from "@/lib/acceptOpenHelpRequest";
import { linkedJobRequestIdFromPost } from "@/lib/createJobFromRequestHelpCompose";
import { isRequestHelpWhenExpired } from "@/lib/requestHelpWhen";
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
} from "@/lib/globalFeedPostUi";
import {
  getEventJoinInterestStatus,
  recordEventJoinInterest,
  type EventJoinInterestStatus,
} from "@/lib/profilePostEventJoin";
import { ReelDesktopCommentsPanel } from "@/components/profile/PostMediaDesktopViewer";
import { useCommunityFeedOverlayLock } from "@/hooks/useCommunityFeedOverlayLock";
import { useIsMobileViewport } from "@/lib/discoverSheetDialog";
import { useContentTranslation } from "@/hooks/useContentTranslation";
import { TranslateLinkButton } from "@/components/translate/TranslateTextControl";
import {
  requestPostAccentTextClass,
  requestPostCtaPendingClass,
  requestPostReelTextOnlyMobileClass,
} from "@/lib/requestPostTheme";

function textOnlyReelTypeCardClass(typeId: string | null): string {
  const base =
    "rounded-[1.75rem] border-0 p-6 text-white max-md:shadow-none max-md:backdrop-blur-none";
  const desktopFrost =
    "md:shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:backdrop-blur-xl";

  switch (typeId) {
    case "request_help":
      return cn(base, desktopFrost, requestPostReelTextOnlyMobileClass);
    case "offer_service":
      return cn(base, desktopFrost, "max-md:bg-emerald-950/40 md:bg-emerald-400/45");
    case "event":
      return cn(base, desktopFrost, "max-md:bg-violet-950/40 md:bg-violet-400/45");
    default:
      return cn(base, desktopFrost, "max-md:bg-blue-950/35 md:bg-blue-400/45");
  }
}

/** Narrow post shape for reels (avoids circular imports with ProfilePostsFeed). */
export type ReelFeedPost = {
  id: string;
  source: "post" | "availability" | "job_request";
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
  created_at?: string | null;
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
  if (p.source === "job_request") return true;
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
  whenExpired: boolean;
  budgetLine: string | null;
  likeCount: number;
  commentCount: number;
  shareClickCount: number;
  likedByMe: boolean;
  actionLabel: string;
  showActionButton: boolean;
  jobRequestId: string | null;
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

/** Sync visible viewport box for iOS Safari toolbar / notch (CSS vars on html). */
function useReelsVisualViewportSync(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const root = document.documentElement;
    const mobileQuery = window.matchMedia("(max-width: 767.98px)");

    const update = () => {
      if (!mobileQuery.matches) {
        root.style.removeProperty("--reels-vv-top");
        root.style.removeProperty("--reels-vv-height");
        return;
      }
      const vv = window.visualViewport;
      const top = Math.max(0, Math.round(vv?.offsetTop ?? 0));
      const height = Math.round(
        vv?.height ?? window.innerHeight ?? root.clientHeight,
      );
      root.style.setProperty("--reels-vv-top", `${top}px`);
      root.style.setProperty("--reels-vv-height", `${height}px`);
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    vv?.addEventListener("geometrychange", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    mobileQuery.addEventListener("change", update);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      vv?.removeEventListener("geometrychange", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      mobileQuery.removeEventListener("change", update);
      root.style.removeProperty("--reels-vv-top");
      root.style.removeProperty("--reels-vv-height");
    };
  }, [active]);
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
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [eventJoinByPostId, setEventJoinByPostId] = useState<
    Record<string, EventJoinInterestStatus | null>
  >({});
  const [acceptedJobIds, setAcceptedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user?.id) {
      setAcceptedJobIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("job_confirmations")
          .select("job_id")
          .eq("freelancer_id", user.id)
          .eq("status", "available");
        if (!cancelled && data) {
          setAcceptedJobIds(new Set(data.map((row) => row.job_id as string)));
        }
      } catch (e) {
        console.error("[PostMediaReelsViewer] fetch accepted confirmations", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);
  const isMobileViewport = useIsMobileViewport();
  useCommunityFeedOverlayLock(open && isMobileViewport);
  useReelsVisualViewportSync(open && isMobileViewport);

  useEffect(() => {
    if (!open || !isMobileViewport) return;
    document.documentElement.dataset.reelsViewerOpen = "";
    return () => {
      delete document.documentElement.dataset.reelsViewerOpen;
    };
  }, [open, isMobileViewport]);

  const slides = useMemo((): ReelSlideData[] => {
    return posts.filter(isReelsViewerPost).map((p) => {
      const postTypeId =
        p.source === "job_request"
          ? "request_help"
          : p.post_types?.id ?? p.post_type_id ?? null;
      const authorName = p.author?.full_name?.trim() || "User";
      const authorFirstName = authorName.split(" ")[0] || authorName;
      const hasMedia = postHasReelsMedia(p);
      const generatedCopy = p.ai_generated_copy ?? null;
      const categoryLabel =
        p.custom_category?.trim() ||
        (typeof p.post_metadata?.custom_category === "string"
          ? p.post_metadata.custom_category.trim()
          : null);
      const title =
        p.source === "job_request"
          ? feedPostTitle(
              t,
              {
                source: "job_request",
                post_metadata: p.post_metadata,
              },
              generatedCopy,
              categoryLabel,
            )
          : feedPostTitle(
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
      const postLike =
        p.source === "job_request"
          ? {
              source: "job_request" as const,
              post_metadata: p.post_metadata,
            }
          : {
              source: "post" as const,
              post_type_id: p.post_type_id,
              post_types: p.post_types,
              post_metadata: p.post_metadata,
            };
      const locationLine = feedPostReelLocationLine(t, postLike);
      const whenTimeframe =
        postTypeId === "request_help"
          ? ((p.post_metadata?.timeframe as string | null | undefined) ?? null)
          : null;
      const whenExpired = isRequestHelpWhenExpired(
        whenTimeframe,
        p.created_at ?? new Date(0).toISOString(),
      );
      const whenLabel = feedPostWhenLabel(
        t,
        i18n.language,
        postTypeId,
        p.post_metadata,
        p.created_at,
      );
      const budgetLine = feedPostBudgetLine(t, postTypeId, p.post_metadata);
      const jobRequestId =
        p.source === "job_request"
          ? p.id
          : postTypeId === "request_help"
            ? linkedJobRequestIdFromPost({
                source: "post",
                id: p.id,
                post_type_id: postTypeId,
                post_metadata: p.post_metadata as Record<string, unknown> | null,
              })
            : null;
      const isOwnPost = user?.id === p.author_id;

      return {
        postId: p.id,
        authorId: p.author_id,
        mediaUrl: hasMedia
          ? publicProfileMediaPublicUrl(p.storage_path!)
          : null,
        mediaType: hasMedia ? p.media_type : null,
        isTextOnly,
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
        whenExpired,
        budgetLine,
        likeCount: p.like_count,
        commentCount: p.comment_count,
        shareClickCount: p.share_click_count,
        likedByMe: p.liked_by_me,
        actionLabel:
          p.source === "job_request"
            ? globalFeedCtaLabel(t, {
                isJobRequest: true,
                jobAcceptedAt: null,
                postTypeId,
                authorFirstName,
                isOwnEventPost: false,
                eventJoinStatus: null,
              })
            : jobRequestId && isOwnPost
              ? t("feed.global.viewRequest")
              : globalFeedCtaLabel(t, {
                  isJobRequest: false,
                  jobAcceptedAt: null,
                  postTypeId,
                  authorFirstName,
                  isOwnEventPost: isOwnPost && postTypeId === "event",
                  eventJoinStatus: null,
                }),
        showActionButton:
          p.source === "job_request"
            ? !isOwnPost
            : !isOwnPost || Boolean(jobRequestId && postTypeId === "request_help"),
        jobRequestId,
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

  useEffect(() => {
    if (!open) {
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

    if (slide.postTypeId === "request_help" && slide.jobRequestId) {
      if (user.id === slide.authorId) {
        navigate(`/client/jobs/${encodeURIComponent(slide.jobRequestId)}/live`);
        return;
      }
      const canHelp =
        viewerProfile.role === "freelancer" ||
        (viewerProfile.role === "client" &&
          viewerProfile.is_available_for_jobs === true);
      if (!canHelp) {
        addToast({
          title: "Enable helper profile",
          description: "Turn on help mode to accept requests.",
          variant: "warning",
        });
        return;
      }
      setPrimaryActionPostId(slide.postId);
      try {
        await acceptOpenHelpRequest(slide.jobRequestId);
        addToast({
          title: "Accepted",
          description: `Waiting for ${slide.authorFirstName}.`,
          variant: "success",
        });
      } catch (error) {
        addToast({
          title: "Failed to accept",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error",
        });
      } finally {
        setPrimaryActionPostId(null);
      }
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
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

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
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
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
      className="pointer-events-auto fixed inset-0 isolate z-[10000] flex w-full max-w-none flex-col overflow-hidden bg-black md:h-[100dvh] md:max-h-[100dvh] md:flex-row"
      data-post-media-reels-viewer
      role="dialog"
      aria-modal="true"
      aria-label="Post media"
    >
      <div
        className="relative h-full min-h-0 min-w-0 flex-1"
        data-reels-column
      >
        <div
          ref={scrollerRef}
          data-reels-scroller
          className="absolute inset-0 z-0 touch-pan-y snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth"
        >
          {slides.map((slide) => {
            const eventJoinStatus = eventJoinByPostId[slide.postId] ?? null;
            const jobAccepted = slide.jobRequestId ? acceptedJobIds.has(slide.jobRequestId) : false;
            const actionLabel = globalFeedCtaLabel(t, {
              isJobRequest: false,
              jobAcceptedAt: jobAccepted ? "accepted" : null,
              postTypeId: slide.postTypeId,
              authorFirstName: slide.authorFirstName,
              isOwnEventPost: user?.id === slide.authorId && slide.postTypeId === "event",
              eventJoinStatus,
            });
            const actionClassName = jobAccepted
              ? requestPostCtaPendingClass
              : globalFeedPrimaryCtaClass(
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
              jobAccepted ||
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
        <div className="pointer-events-none absolute right-4 md:right-8 top-[42%] z-30 flex -translate-y-1/2 flex-col items-center gap-8">
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
          data-reels-comment-bar
          className="absolute inset-x-0 bottom-0 z-50 flex items-center bg-black px-4 pb-[max(0.75rem,var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))] pt-3 md:hidden"
        >
          <button
            type="button"
            onClick={() => onOpenComments(activeSlide.postId)}
            className="w-full rounded-full bg-zinc-800 px-4 py-2.5 text-left text-[15px] text-white/45 transition active:scale-[0.99]"
          >
            {t("feed.writeComment")}
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

function ReelExpiredBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-600/90 px-3 py-1 text-[12px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
      <Clock className="h-3.5 w-3.5 shrink-0 text-white/90" aria-hidden />
      {t("feed.whenExpired")}
    </span>
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
            : "text-orange-300",
        )
      : cn(
          "text-[14px] font-medium",
          slide.postTypeId === "offer_service"
            ? "text-emerald-600 dark:text-emerald-400"
            : requestPostAccentTextClass,
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
  const translation = useContentTranslation({
    contentKind: "profile_post",
    contentId: slide.postId,
    title: slide.title,
    body: bodyText,
  });
  const displayTitle = translation.displayTitle ?? slide.title;
  const displayBody = translation.displayBody ?? bodyText;
  const contentLayout = bidirectionalTextProps(
    displayBody || displayTitle || "",
  );

  if (!showTitle && !displayBody) {
    return <div className="relative min-h-0 flex-1 bg-black" aria-hidden />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-black px-6 pb-44 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pb-8">
      <div
        className={cn(
          "mx-auto w-full max-w-md",
          textOnlyReelTypeCardClass(slide.postTypeId),
          contentLayout.className,
        )}
        dir={contentLayout.dir}
      >
        {showTitle && displayTitle ? (
          <h2
            {...bidirectionalTextProps(
              displayTitle,
              cn(
                "text-[22px] font-bold leading-snug",
                "text-white",
              ),
            )}
          >
            {displayTitle}
          </h2>
        ) : null}
        {displayBody ? (
          <ReelExpandableCaption
            text={displayBody}
            maxLines={10}
            slideKey={slide.postId}
            variant="card"
            className={cn("text-white/95", showTitle && "mt-3")}
          />
        ) : null}
        {translation.showControl ? (
          <TranslateLinkButton
            loading={translation.loading}
            label={translation.controlLabel}
            variant="onDark"
            className="mt-3"
            onClick={(e) => {
              e.stopPropagation();
              void translation.toggle();
            }}
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
  const translation = useContentTranslation({
    contentKind: "profile_post",
    contentId: slide.postId,
    title: showTitle ? slide.title : null,
    body: bodyText,
    enabled: !slide.isTextOnly,
  });
  const displayTitle = translation.displayTitle ?? slide.title;
  const displayBody = translation.displayBody ?? bodyText;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-20 pb-3",
        "max-md:bottom-[calc(4rem+var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))] md:bottom-0",
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

        {showTitle && displayTitle ? (
          <h3
            {...bidirectionalTextProps(
              displayTitle,
              "mt-2 text-[19px] font-bold leading-snug text-white drop-shadow-md",
            )}
          >
            {displayTitle}
          </h3>
        ) : null}

        {displayBody ? (
          <div className="mt-1.5">
            <ReelExpandableCaption
              text={displayBody}
              maxLines={2}
              slideKey={slide.postId}
              variant="overlay"
            />
          </div>
        ) : null}

        {translation.showControl ? (
          <TranslateLinkButton
            loading={translation.loading}
            label={translation.controlLabel}
            variant="onDark"
            className="mt-1.5"
            onClick={(e) => {
              e.stopPropagation();
              void translation.toggle();
            }}
          />
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

  const isPortraitMobile =
    isLandscapeMedia !== true;

  const mediaObjectClass = cn(
    isPortraitMobile &&
      "max-md:absolute max-md:inset-0 max-md:h-full max-md:w-full max-md:object-contain max-md:object-center",
    isLandscapeMedia === true &&
      "max-md:max-h-full max-md:max-w-full max-md:object-contain max-md:object-center",
    "md:h-full md:w-full",
    isLandscapeMedia === true && "md:object-contain md:object-center",
    isLandscapeMedia === false && "md:object-contain md:object-center",
    isLandscapeMedia === null && "md:object-contain md:object-center",
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
      data-reels-slide
      className="relative flex h-full min-h-full w-full shrink-0 snap-start snap-always flex-col bg-black"
    >
      {slide.postTypeId ? (
        <div className="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right,0px))] top-[calc(env(safe-area-inset-top,0px)+0.625rem)] z-[25] flex items-center gap-1.5">
          {slide.whenExpired && slide.postTypeId === "request_help" ? (
            <ReelExpiredBadge />
          ) : null}
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
      <div
        className={cn(
          "relative min-h-0 flex-1 bg-black",
          isPortraitMobile
            ? "max-md:overflow-hidden"
            : "flex items-center justify-center px-2",
        )}
      >
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
