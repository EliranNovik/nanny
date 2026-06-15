import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/data/keys";
import { Link, useNavigate } from "react-router-dom";
import { GuestAwareProfileLink } from "@/components/GuestAwareProfileLink";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import {
  Heart,
  MessageCircle,
  Send,
  Plus,
  X,
  Loader2,
  AtSign,
  Trash2,
  LayoutGrid,
  Sparkles,
  BadgeCheck,
  VolumeX,
  Volume2,
  Bookmark,
  Briefcase,
  Users,
  CalendarDays,
  MapPin,
  Coins,
  HelpCircle,
  LifeBuoy,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useKycGate } from "@/context/KycGateContext";
import { needsKycVerification } from "@/lib/kyc";
import { useToast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithLiveDot } from "@/components/AvatarWithLiveDot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, noFieldSpinnerClass } from "@/lib/utils";
import {
  mobileSheetSafePaddingBottom,
} from "@/lib/mobileModalLayout";
import { useIsMobileViewport } from "@/lib/discoverSheetDialog";
import { useCommunityFeedOverlayLock } from "@/hooks/useCommunityFeedOverlayLock";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { useGooglePlacesPacModalSupport } from "@/lib/googlePlacesPacModal";
import {
  bidirectionalInputProps,
  bidirectionalTextProps,
} from "@/lib/textDirection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SimpleCalendar } from "@/components/SimpleCalendar";
import { LocationPicker } from "@/components/LocationPicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PUBLIC_PROFILE_MEDIA_BUCKET,
  publicProfileMediaPublicUrl,
} from "@/lib/publicProfileMedia";
import { scrollToProfilePostWhenReady, shareProfilePost, parseProfilePostShareId } from "@/lib/profilePostShare";
import { fetchProfilePostById } from "@/lib/fetchProfilePostById";
import {
  debugProfilePostDeepLink,
  warnProfilePostDeepLink,
} from "@/lib/profilePostDeepLinkDebug";
import type { AvailabilityPayload } from "@/lib/availabilityPosts";
import {
  isServiceCategoryId,
  CUSTOM_POST_CATEGORY_MAX_LEN,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import { HIRE_CATEGORY_TILE_UI } from "@/lib/discoverCategoryTileIcons";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useProfilePostsFeedRealtime } from "@/hooks/useProfilePostsFeedRealtime";
import { FavoritesPostsSidePanel } from "@/components/discover/FavoritesPostsSidePanel";
import {
  mapOpenHelpRequestToFeedPost,
  jobRequestMatchesFeedFilters,
  type JobRequestFeedPost,
} from "@/lib/openHelpRequestFeedPost";
import { JobRequestCommentsSidePanel } from "@/components/jobs/JobRequestCommentsSidePanel";
import { JobRequestCommentsModal } from "@/components/jobs/JobRequestCommentsModal";
import {
  applyJobRequestEngagement,
  fetchJobRequestEngagement,
  fetchJobRequestForFeedById,
} from "@/lib/fetchJobRequestForFeed";
import { fetchAcceptedJobRequestsForFeed } from "@/lib/fetchAcceptedJobRequestsForFeed";
import {
  feedItemDomId,
  parseJobRequestShareId,
  scrollToFeedItemWhenReady,
  shareJobRequest,
} from "@/lib/jobRequestShare";
import { acceptOpenHelpRequest } from "@/lib/acceptOpenHelpRequest";
import { toggleJobRequestFavorite } from "@/lib/jobRequestFavorites";
import { useJobRequestFavoriteIds } from "@/hooks/data/useJobRequestFavoriteIds";
import {
  buildPostTextInputFromProfile,
  generatePostText,
  mapProfilePostTypeToCopyType,
} from "@/utils/postTextTemplates";
import { parseGeneratedPostCopy, type GeneratedPostCopy } from "@/lib/generatedPostCopy";
import {
  feedPostDescription,
  feedPostLocationAddress,
  feedPostLocationLine,
  feedPostTitle,
  feedPostTypeId,
  globalFeedCtaLabel,
  globalFeedCardSurfaceClass,
  globalFeedPostTypeAccentClass,
  globalFeedPrimaryCtaClass,
  globalFeedTextOnlySurfaceClass,
  type ViewerLocation,
} from "@/lib/globalFeedPostUi";
import { isJobOpenForDiscoverListing } from "@/lib/discoverOpenJobStatuses";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  isReelsViewerPost,
  PostMediaReelsViewer,
  type ReelFeedPost,
} from "@/components/profile/PostMediaReelsViewer";
import { PostMediaGalleryModal } from "@/components/profile/PostMediaGalleryModal";
import {
  MAX_PROFILE_POST_MEDIA,
  allProfilePostStoragePaths,
  extraProfilePostMediaItems,
  getProfilePostMediaItems,
  type ProfilePostMediaItem,
} from "@/lib/profilePostMedia";
import type { CommunityFeedAdvancedFilters } from "@/lib/communityFeedFilters";
import { postMatchesAdvancedFeedFilters } from "@/lib/communityFeedFilters";
import {
  REQUEST_HELP_WHEN_OPTIONS,
  isRequestHelpWhenUrgent,
  type RequestHelpTimeframe,
} from "@/lib/requestHelpWhen";
import { openCommunityContact } from "@/lib/communityContact";
import {
  fetchEventPostHelperCounts,
  getEventJoinInterestStatus,
  parseEventHelpersNeeded,
  recordEventJoinInterest,
  type EventJoinInterestStatus,
} from "@/lib/profilePostEventJoin";
import { preventDialogDismissForGooglePlacesPac } from "@/lib/googlePlacesPacModal";

function mergeProfilePostMetadata(
  metadata: Record<string, unknown> | null | undefined,
  customCategory: string | null | undefined,
): Record<string, unknown> | null {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};
  const trimmed = customCategory?.trim();
  if (trimmed) base.custom_category = trimmed;
  return Object.keys(base).length > 0 ? base : null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  is_verified?: boolean | null;
  /** Active 24h go-live window end (from `freelancer_profiles`), if any. */
  live_until?: string | null;
  telegram_username?: string | null;
  role?: string | null;
};

export type ProfilePost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  tagged_user_ids: string[];
  created_at: string;
  author?: ProfileSnippet;
  like_count: number;
  comment_count: number;
  /** Total share-button taps recorded (see profile_post_shares). */
  share_click_count: number;
  /** Distinct logged-in users who tapped share at least once. */
  share_distinct_user_count: number;
  liked_by_me: boolean;
  tagged_profiles: ProfileSnippet[];
  source: "post"; // discriminator
  post_type_id?: string | null;
  post_types?: {
    id: string;
    name: string;
    emoji: string;
    color: string;
  } | null;
  post_metadata?: any | null;
  ai_generated_copy?: GeneratedPostCopy | null;
  /** Accepted helper count for event posts (from join interests). */
  event_accepted_helpers_count?: number;
};

export type AvailabilityPost = {
  id: string;
  author_id: string;
  caption: string | null; // mapped from note
  media_type: null;
  storage_path: null;
  tagged_user_ids: string[];
  created_at: string;
  author?: ProfileSnippet;
  like_count: number;
  comment_count: number;
  share_click_count: number;
  share_distinct_user_count: number;
  liked_by_me: boolean;
  tagged_profiles: ProfileSnippet[];
  source: "availability"; // discriminator
  category: string;
  availability_payload: AvailabilityPayload | null;
};

export type FeedPost = ProfilePost | AvailabilityPost | JobRequestFeedPost;

export type PostComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author?: ProfileSnippet;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FEED_POST_TYPE_IDS = [
  "request_help",
  "offer_service",
  "community",
  "event",
] as const;

function feedCategoryLabel(
  t: TFunction,
  categoryId?: string | null,
  customCategory?: string | null,
): string {
  if (categoryId === "other_help" && customCategory?.trim()) {
    return customCategory.trim();
  }
  if (categoryId && isServiceCategoryId(categoryId)) {
    return t(`feed.categories.${categoryId}`);
  }
  if (!categoryId) return t("feed.categories.help_request");
  return categoryId.replace(/_/g, " ");
}

function feedPostTypeBadgeLabel(t: TFunction, typeId: string, typeName?: string) {
  if ((FEED_POST_TYPE_IDS as readonly string[]).includes(typeId)) {
    return t(`feed.postType.${typeId}`);
  }
  return typeName ?? typeId;
}

function feedContactLabel(t: TFunction, fullName: string | null | undefined): string {
  return t("feed.contactName", {
    name: fullName?.trim() || t("feed.defaultUser"),
  });
}

const FEED_WHEN_LABEL_KEYS: Record<string, string> = {
  now: "feed.filters.whenNow",
  today: "feed.filters.whenToday",
  tomorrow: "feed.filters.whenTomorrow",
  this_week: "feed.filters.whenThisWeek",
  custom: "feed.filters.whenCustom",
};

function feedEventDateTimeLabel(
  t: TFunction,
  language: string,
  metadata: {
    date_time?: string | null;
    event_date?: string | null;
    event_time?: string | null;
  },
): string | null {
  if (metadata.event_date?.trim()) {
    try {
      const base = parseISO(metadata.event_date.trim());
      if (!Number.isNaN(base.getTime())) {
        const locale = dateFnsLocaleFor(language);
        const [hours, minutes] = (metadata.event_time ?? "00:00")
          .split(":")
          .map((part) => parseInt(part, 10));
        const dt = new Date(base);
        dt.setHours(
          Number.isFinite(hours) ? hours : 0,
          Number.isFinite(minutes) ? minutes : 0,
          0,
          0,
        );
        return t("feed.event.dateTime", {
          date: format(dt, "EEEE, MMMM d", { locale }),
          time: format(dt, "h:mm a", { locale }),
        });
      }
    } catch {
      /* fall through to stored string */
    }
  }
  return metadata.date_time?.trim() ?? null;
}

function feedWhenLabel(
  t: TFunction,
  metadata: {
    timeframe?: string | null;
    custom_when?: string | null;
  },
): string | null {
  if (!metadata.timeframe) return null;
  if (metadata.timeframe === "custom" && metadata.custom_when) {
    return metadata.custom_when;
  }
  const key = FEED_WHEN_LABEL_KEYS[metadata.timeframe];
  if (key) return t(key);
  return metadata.timeframe.replace(/_/g, " ");
}

function feedLocationSlug(part: string): string {
  return part
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function feedRateTypeLabel(t: TFunction, rateType?: string | null): string {
  return rateType === "per_hour"
    ? t("feed.budget.perHour")
    : t("feed.budget.fixedPrice");
}

function feedLocationLabel(t: TFunction, location?: string | null): string {
  if (!location?.trim()) return "";
  const localizedCountry = t("feed.location.countryIsrael");
  const parts = location
    .trim()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return location.trim();

  return parts
    .map((part) => {
      if (/^israel$/i.test(part)) return localizedCountry;
      const slug = feedLocationSlug(part);
      if (!slug) return part;
      return t(`feed.location.cities.${slug}`, { defaultValue: part });
    })
    .join(", ");
}

/** Renders the official Discover-home icon for a service category (cleaning → Sparkles, nanny → Baby, etc.). */
function CategoryIcon({
  categoryId,
  className,
  variant = "default",
}: {
  categoryId: string;
  className?: string;
  variant?: "default" | "badge";
}) {
  const normalized = (categoryId ?? "").trim().toLowerCase();
  const id = isServiceCategoryId(normalized) ? normalized : null;
  const ui = id ? HIRE_CATEGORY_TILE_UI[id] : null;
  const Icon = ui?.Icon ?? HelpCircle;
  const colorClass =
    variant === "badge"
      ? ui?.badgeIconClass ?? "text-slate-700"
      : ui?.iconClass ?? "text-muted-foreground";

  return (
    <Icon
      className={cn(colorClass, className)}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

function renderCaptionWithMentions(caption: string): React.ReactNode {
  const parts = caption.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="font-semibold text-orange-600 dark:text-orange-400">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

// ─── Comment Dialog ───────────────────────────────────────────────────────────

function ReelsStyleCommentComposer({
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  placeholder,
  signedIn,
  onSignIn,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  placeholder: string;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  if (!signedIn) {
    return (
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
          onClick={onSignIn}
        >
          Sign in / Register
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 rounded-full bg-zinc-800/95 px-4 py-2.5 dark:bg-zinc-700/90">
        <input
          type="text"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          maxLength={4000}
          disabled={submitting}
          {...bidirectionalInputProps(
            draft,
            "w-full border-0 bg-transparent py-0.5 text-[15px] text-white outline-none placeholder:text-white/45 disabled:opacity-60",
          )}
          aria-label={placeholder}
        />
      </div>
      <button
        type="button"
        disabled={submitting || !draft.trim()}
        onClick={onSubmit}
        className="shrink-0 p-1 text-foreground transition active:scale-95 disabled:opacity-35 dark:text-white"
        aria-label="Post comment"
      >
        {submitting ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        ) : (
          <Send className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        )}
      </button>
    </div>
  );
}

function CommentsDialog({
  postId,
  open,
  onClose,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { addToast } = useToast();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dateLocale = dateFnsLocaleFor(i18n.language);
  const isMobile = useIsMobileViewport();
  const [sheetExpanded, setSheetExpanded] = useState(true);

  useEffect(() => {
    if (open) setSheetExpanded(true);
  }, [open]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("profile_post_comments")
        .select("id, body, created_at, author_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const list = (rows ?? []) as Omit<PostComment, "author">[];
      if (list.length === 0) { setComments([]); return; }

      const ids = [...new Set(list.map((r) => r.author_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, is_verified")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id as string, p as ProfileSnippet]));
      setComments(list.map((r) => ({ ...r, author: map.get(r.author_id) })));
    } catch (e) {
      console.error("[ProfilePostsFeed] comments fetch", e);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (open) void fetchComments();
  }, [open, fetchComments]);

  // Live updates while the dialog is open (new / deleted comments).
  useRealtimeSubscription(
    {
      table: "profile_post_comments",
      event: "*",
      filter: `post_id=eq.${postId}`,
      enabled: open,
    },
    () => {
      void fetchComments();
    },
  );

  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [comments.length]);

  async function submitComment() {
    const body = draft.trim();
    if (!body) return;
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("profile_post_comments").insert({
        post_id: postId,
        author_id: user.id,
        body,
      });
      if (error) throw error;
      setDraft("");
      void fetchComments();
    } catch (e) {
      addToast({ title: "Could not post comment", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const dismiss = () => onClose();

  const commentsHeader = (
    <div className="flex shrink-0 items-center gap-2 px-5 py-3">
      <MessageCircle className="h-5 w-5 text-orange-500" strokeWidth={2} />
      <h2
        id="comments-sheet-title"
        className="text-base font-bold text-foreground"
      >
        {t("common.comments")}
      </h2>
    </div>
  );

  const commentsBody = (
    <ScrollArea className="min-h-0 flex-1 px-5">
      <div className="space-y-5 py-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("feed.noCommentsYet")}
          </p>
        ) : (
          comments.map((c) => {
            const name = c.author?.full_name?.trim() || "Member";
            return (
              <div key={c.id} className="flex gap-3">
                {c.author?.id ? (
                  <GuestAwareProfileLink
                    userId={c.author.id}
                    className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`View ${name} profile`}
                    onClick={() => onClose()}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.author?.photo_url ?? undefined} />
                      <AvatarFallback className="text-xs font-bold">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </GuestAwareProfileLink>
                ) : (
                  <Avatar className="h-8 w-8 shrink-0 opacity-60">
                    <AvatarImage src={c.author?.photo_url ?? undefined} />
                    <AvatarFallback className="text-xs font-bold">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {c.author?.id ? (
                      <GuestAwareProfileLink
                        userId={c.author.id}
                        className="text-sm font-semibold text-foreground hover:underline underline-offset-2"
                        aria-label={`View ${name} profile`}
                        onClick={() => onClose()}
                      >
                        {name}
                      </GuestAwareProfileLink>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        {name}
                      </span>
                    )}
                    <time className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                        locale: dateLocale,
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
          })
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );

  const commentsComposer = (
    <div
      className={cn(
        "shrink-0 px-4 py-2.5",
        mobileSheetSafePaddingBottom,
      )}
    >
      <ReelsStyleCommentComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => void submitComment()}
        submitting={submitting}
        placeholder={t("feed.writeComment")}
        signedIn={Boolean(user)}
        onSignIn={() => openGuestAuthPrompt({ variant: "engage" })}
      />
    </div>
  );

  if (isMobile) {
    const sheet = (
      <MobileSnapBottomSheet
        expanded={sheetExpanded}
        onExpandedChange={setSheetExpanded}
        onDismiss={dismiss}
        hidePeek
        titleId="comments-sheet-title"
        className="z-[140]"
        maxHeight="min(85dvh,720px)"
        ariaLabel="Drag down to close comments"
      >
        <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
          {commentsHeader}
          {commentsBody}
          {commentsComposer}
        </div>
      </MobileSnapBottomSheet>
    );
    return createPortal(sheet, document.body);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90vh,580px)] flex-col gap-0 overflow-hidden border-0 p-0",
          "md:max-w-md md:rounded-2xl",
        )}
      >
        <DialogHeader className="shrink-0 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <MessageCircle className="h-5 w-5 text-orange-500" strokeWidth={2} />
            {t("common.comments")}
          </DialogTitle>
        </DialogHeader>

        {commentsBody}
        {commentsComposer}
      </DialogContent>
    </Dialog>
  );
}

function CommentsSidePanel({
  postId,
  authorName,
  initialCount,
  wideLayout = false,
}: {
  postId: string;
  authorName?: string;
  initialCount?: number | null;
  wideLayout?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { addToast } = useToast();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState<number | null>(
    typeof initialCount === "number" ? initialCount : null,
  );
  const dateLocale = dateFnsLocaleFor(i18n.language);

  const fetchCount = useCallback(async () => {
    try {
      const { count: n, error } = await supabase
        .from("profile_post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      if (error) throw error;
      setCount(n ?? 0);
    } catch {
      setCount(null);
    }
  }, [postId]);

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

      const list = (rows ?? []) as Omit<PostComment, "author">[];
      if (list.length === 0) {
        setComments([]);
        return;
      }

      const ids = [...new Set(list.map((r) => r.author_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, is_verified")
        .in("id", ids);
      const map = new Map(
        (profs ?? []).map((p) => [p.id as string, p as ProfileSnippet]),
      );
      setComments(list.map((r) => ({ ...r, author: map.get(r.author_id) })));
    } catch (e) {
      console.error("[ProfilePostsFeed] comments panel fetch", e);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void fetchCount();
    void fetchComments();
  }, [fetchCount, fetchComments]);

  async function submitComment() {
    const body = draft.trim();
    if (!body) return;
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("profile_post_comments").insert({
        post_id: postId,
        author_id: user.id,
        body,
      });
      if (error) throw error;
      setDraft("");
      void fetchCount();
      void fetchComments();
    } catch {
      addToast({ title: "Could not post comment", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0",
        wideLayout
          ? "min-w-[320px] flex-1 max-w-[640px]"
          : "w-[380px] lg:w-[460px] xl:w-[520px] 2xl:w-[600px]",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-base font-black text-foreground">
              {count == null
                ? t("common.comments")
                : t("feed.commentsCount", { count })}
            </div>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {authorName ? t("feed.onAuthorsPost", { name: authorName }) : " "}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            void fetchCount();
            void fetchComments();
          }}
        >
          {t("feed.refresh")}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-1 pb-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("feed.noCommentsYet")}
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {comments.map((c) => {
                const name = c.author?.full_name?.trim() || "Member";
                return (
                  <div key={c.id} className="flex gap-3 py-4">
                    {c.author?.id ? (
                      <GuestAwareProfileLink
                        userId={c.author.id}
                        className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`View ${name} profile`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.author?.photo_url ?? undefined} />
                          <AvatarFallback className="text-xs font-bold">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </GuestAwareProfileLink>
                    ) : (
                      <Avatar className="h-8 w-8 shrink-0 opacity-60">
                        <AvatarImage src={c.author?.photo_url ?? undefined} />
                        <AvatarFallback className="text-xs font-bold">
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
                          >
                            {name}
                          </GuestAwareProfileLink>
                        ) : (
                          <span className="truncate text-[13px] font-bold text-foreground">
                            {name}
                          </span>
                        )}
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </time>
                      </div>
                      <p
                        {...bidirectionalTextProps(
                          c.body,
                          "mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90",
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

      <div className="border-t border-border/60 bg-background/80 px-1 pt-3 pb-2">
        {user ? (
          <div className="flex items-end gap-2">
            <Textarea
              placeholder={t("feed.writeComment")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              maxLength={4000}
              rows={2}
              {...bidirectionalInputProps(
                draft,
                "min-h-[2.5rem] flex-1 resize-none bg-muted/30 text-sm rounded-2xl border border-border/60 px-4 py-3 focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
              disabled={submitting}
            />
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-orange-600 hover:bg-orange-700 text-white"
              disabled={submitting || !draft.trim()}
              onClick={() => void submitComment()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 translate-x-[1px]" />
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 px-3">
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
    </aside>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────

const POST_TYPE_METADATA: Record<string, {
  title: string;
  desc: string;
  icon: React.ComponentType<any>;
  themeColor: string;
  iconBg: string;
  iconColor: string;
  activeBorder: string;
  activeBg: string;
  textClass: string;
}> = {
  request_help: {
    title: "Request Help",
    desc: "I need help with something",
    icon: LifeBuoy,
    themeColor: "text-red-500 dark:text-red-400",
    iconBg: "bg-red-500/10 dark:bg-red-500/20",
    iconColor: "text-red-500 dark:text-red-400",
    activeBorder: "border-red-500 dark:border-red-500/80 ring-red-500/15",
    activeBg: "bg-red-50/20 dark:bg-red-950/10",
    textClass: "text-red-600 dark:text-red-400",
  },
  offer_service: {
    title: "Offer Service",
    desc: "I want to offer my services",
    icon: Briefcase,
    themeColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    activeBorder: "border-emerald-500 dark:border-emerald-500/80 ring-emerald-500/15",
    activeBg: "bg-emerald-50/20 dark:bg-emerald-950/10",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  community: {
    title: "Community Post",
    desc: "Share something with the community",
    icon: Users,
    themeColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
    iconColor: "text-blue-500 dark:text-blue-400",
    activeBorder: "border-blue-500 dark:border-blue-500/80 ring-blue-500/15",
    activeBg: "bg-blue-50/20 dark:bg-blue-950/10",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  event: {
    title: "Event",
    desc: "Create or share an event",
    icon: CalendarDays,
    themeColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/10 dark:bg-violet-500/20",
    iconColor: "text-violet-500 dark:text-violet-400",
    activeBorder: "border-violet-500 dark:border-violet-500/80 ring-violet-500/15",
    activeBg: "bg-violet-50/20 dark:bg-violet-950/10",
    textClass: "text-violet-600 dark:text-violet-400",
  },
};

function formatEventPostDateTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(":").map((part) => parseInt(part, 10));
  const dt = new Date(date);
  dt.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return format(dt, "EEEE, MMMM d 'at' h:mm a");
}

function postTypeBadgeClassName(
  typeId: string,
  size: "default" | "lg" = "default",
) {
  return cn(
    "inline-flex items-center font-black uppercase tracking-wider border-0 shadow-none",
    size === "lg"
      ? "gap-2.5 rounded-lg px-4 py-2 text-[14px]"
      : "gap-2 rounded-md px-3.5 py-1.5 text-[13px]",
    typeId === "request_help" &&
      "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    typeId === "offer_service" &&
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    typeId === "community" &&
      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    typeId === "event" &&
      "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  );
}

function PostTypeBadge({
  typeId,
  typeName,
  className,
  size = "default",
  compact = false,
}: {
  typeId: string;
  typeName?: string;
  className?: string;
  size?: "default" | "lg";
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const meta = POST_TYPE_METADATA[typeId];
  const Icon = meta?.icon ?? Sparkles;

  if (compact) {
    return (
      <span className={cn(postTypeBadgeClassName(typeId, "default"), "px-3 py-1 text-[12px] tracking-wide", className)}>
        {feedPostTypeBadgeLabel(t, typeId, typeName)}
      </span>
    );
  }

  return (
    <span className={cn(postTypeBadgeClassName(typeId, size), className)}>
      <Icon
        className={cn(
          size === "lg" ? "h-5 w-5" : "h-[19px] w-[19px]",
          "shrink-0",
          meta?.iconColor ?? "text-orange-500",
        )}
        strokeWidth={2.25}
        aria-hidden
      />
      {feedPostTypeBadgeLabel(t, typeId, typeName)}
    </span>
  );
}

export function ComposeModal({
  open,
  onClose,
  onPosted,
  authorProfile,
  initialPostTypeId = null,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  authorProfile: ProfileSnippet;
  initialPostTypeId?: string | null;
}) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { openKycRequiredDialog } = useKycGate();
  const { addToast } = useToast();
  const [caption, setCaption] = useState("");
  const [composeMedia, setComposeMedia] = useState<ComposeMediaDraft[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<ProfileSnippet[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<ProfileSnippet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [postTypes, setPostTypes] = useState<{ id: string; name: string; emoji: string; color: string }[]>([]);
  const [selectedPostTypeId, setSelectedPostTypeId] = useState<string | null>(null);

  // Post Details / Metadata States
  const [requestHelpCategory, setRequestHelpCategory] = useState("");
  const [postLocation, setPostLocation] = useState<{
    address: string;
    lat?: number;
    lng?: number;
  }>({ address: "" });
  const [timeframe, setTimeframe] = useState<RequestHelpTimeframe>("today");
  const [customWhenDate, setCustomWhenDate] = useState<Date | null>(null);
  const [customWhenTime, setCustomWhenTime] = useState("");
  const [customWhenDatePickerOpen, setCustomWhenDatePickerOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetRateType, setBudgetRateType] = useState<"per_hour" | "fixed">("per_hour");

  const [offerServiceCategory, setOfferServiceCategory] = useState("");
  const [offerRate, setOfferRate] = useState("");
  const [offerRateType, setOfferRateType] = useState<"per_hour" | "fixed">("per_hour");

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventTime, setEventTime] = useState("");
  const [eventDatePickerOpen, setEventDatePickerOpen] = useState(false);
  const [eventLocation, setEventLocation] = useState<{
    address: string;
    lat?: number;
    lng?: number;
  }>({ address: "" });
  const [eventHelpersNeeded, setEventHelpersNeeded] = useState("");

  const [communityTitle, setCommunityTitle] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [captionEditorOpen, setCaptionEditorOpen] = useState(false);
  const isMobileViewport = useIsMobileViewport();
  const [sheetExpanded, setSheetExpanded] = useState(true);
  useCommunityFeedOverlayLock(open && isMobileViewport);

  useEffect(() => {
    if (open) setSheetExpanded(true);
  }, [open]);

  useGooglePlacesPacModalSupport(open);

  const captionPlaceholder =
    selectedPostTypeId === "request_help"
      ? "Describe what you need help with..."
      : selectedPostTypeId === "offer_service"
        ? "Describe your service..."
        : selectedPostTypeId === "event"
          ? "Describe your event details..."
          : "Describe what you want to talk about...";

  useEffect(() => {
    async function loadPostTypes() {
      const { data } = await supabase
        .from("post_types")
        .select("id, name, emoji, color")
        .order("created_at", { ascending: true });
      if (data) setPostTypes(data);
    }
    if (open) {
      void loadPostTypes();
      if (initialPostTypeId) {
        setSelectedPostTypeId(initialPostTypeId);
      }
    }
  }, [open, initialPostTypeId]);

  useEffect(() => {
    if (open && profile?.city) {
      setPostLocation((prev) =>
        prev.lat != null && prev.lng != null ? prev : { address: profile.city! },
      );
    }
  }, [open, profile?.city]);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const tagTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagBoxRef = useRef<HTMLDivElement>(null);

  function reset() {
    setCaption("");
    setComposeMedia((prev) => {
      revokeComposeMediaUrls(prev);
      return [];
    });
    setTagQuery("");
    setTagResults([]);
    setTaggedUsers([]);
    setSelectedPostTypeId(null);
    setRequestHelpCategory("");
    setPostLocation({ address: profile?.city || "" });
    setTimeframe("today");
    setCustomWhenDate(null);
    setCustomWhenTime("");
    setCustomWhenDatePickerOpen(false);
    setBudgetAmount("");
    setBudgetRateType("per_hour");
    setOfferServiceCategory("");
    setOfferRate("");
    setOfferRateType("per_hour");
    setEventName("");
    setEventDate(null);
    setEventTime("");
    setEventDatePickerOpen(false);
    setEventLocation({ address: "" });
    setEventHelpersNeeded("");
    setCommunityTitle("");
    setCustomCategory("");
    setCaptionEditorOpen(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handlePhotoVideoPick(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setComposeMedia((prev) => {
      const room = MAX_PROFILE_POST_MEDIA - prev.length;
      if (room <= 0) return prev;
      const next = list.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind: (file.type.startsWith("video/") ? "video" : "image") as "image" | "video",
      }));
      return [...prev, ...next];
    });
  }

  function removeComposeMedia(id: string) {
    setComposeMedia((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }



  useEffect(() => {
    if (!tagQuery.trim()) { setTagResults([]); return; }
    if (tagTimeoutRef.current) clearTimeout(tagTimeoutRef.current);
    tagTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, is_verified")
        .ilike("full_name", `%${tagQuery.trim()}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      setTagResults((data ?? []) as ProfileSnippet[]);
    }, 280);
  }, [tagQuery, user?.id]);

  // Close the tag dropdown on outside click / escape / focus change.
  useEffect(() => {
    if (tagResults.length === 0) return;

    const onDocPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const box = tagBoxRef.current;
      if (!box) return;
      if (box.contains(target)) return;
      setTagResults([]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTagResults([]);
    };

    const capture = true;
    document.addEventListener("mousedown", onDocPointerDown, capture);
    document.addEventListener("touchstart", onDocPointerDown, capture);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown, capture);
      document.removeEventListener("touchstart", onDocPointerDown, capture);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [tagResults.length]);

  async function handleSubmit() {
    if (!user?.id) return;
    if (needsKycVerification(profile)) {
      openKycRequiredDialog("share_post");
      return;
    }
    if (!selectedPostTypeId) {
      addToast({ title: "Please choose what you are posting", variant: "warning" });
      return;
    }
    if (selectedPostTypeId === "request_help" && !requestHelpCategory) {
      addToast({ title: "Please choose what you need help with", variant: "warning" });
      return;
    }
    if (
      selectedPostTypeId === "request_help" &&
      (postLocation.lat == null || postLocation.lng == null || !postLocation.address.trim())
    ) {
      addToast({
        title: "Please pick a location",
        description: "Choose from the suggestions or select a spot on the map.",
        variant: "warning",
      });
      return;
    }
    if (selectedPostTypeId === "request_help" && timeframe === "custom") {
      if (!customWhenDate || !customWhenTime) {
        addToast({ title: "Please pick a custom date and time", variant: "warning" });
        return;
      }
    }
    if (selectedPostTypeId === "offer_service" && !offerServiceCategory) {
      addToast({ title: "Please choose which service you are offering", variant: "warning" });
      return;
    }
    const usesOtherHelpCategory =
      (selectedPostTypeId === "request_help" && requestHelpCategory === "other_help") ||
      (selectedPostTypeId === "offer_service" && offerServiceCategory === "other_help");
    const trimmedCustomCategory = customCategory.trim();
    if (usesOtherHelpCategory && !trimmedCustomCategory) {
      addToast({ title: "Please name your category", variant: "warning" });
      return;
    }
    if (usesOtherHelpCategory && trimmedCustomCategory.length > CUSTOM_POST_CATEGORY_MAX_LEN) {
      addToast({
        title: `Category must be ${CUSTOM_POST_CATEGORY_MAX_LEN} characters or less`,
        variant: "warning",
      });
      return;
    }
    if (selectedPostTypeId === "event" && !eventName.trim()) {
      addToast({ title: "Please enter an event name", variant: "warning" });
      return;
    }
    if (selectedPostTypeId === "event" && !eventDate) {
      addToast({ title: "Please pick an event date", variant: "warning" });
      return;
    }
    if (selectedPostTypeId === "event" && !eventTime) {
      addToast({ title: "Please pick an event time", variant: "warning" });
      return;
    }
    if (selectedPostTypeId === "event" && eventHelpersNeeded.trim()) {
      const needed = parseInt(eventHelpersNeeded, 10);
      if (!Number.isFinite(needed) || needed < 1) {
        addToast({
          title: "Helpers needed must be at least 1",
          variant: "warning",
        });
        return;
      }
    }
    if (
      selectedPostTypeId === "event" &&
      (eventLocation.lat == null || eventLocation.lng == null || !eventLocation.address.trim())
    ) {
      addToast({
        title: "Please pick a location",
        description: "Choose from the suggestions or select a spot on the map.",
        variant: "warning",
      });
      return;
    }
    if (selectedPostTypeId === "community" && !communityTitle.trim()) {
      addToast({ title: "Please enter a title for your post", variant: "warning" });
      return;
    }
    if (!caption.trim() && composeMedia.length === 0) {
      addToast({ title: "Add a caption or media", variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const uploadedMedia: ProfilePostMediaItem[] = [];

      for (const item of composeMedia) {
        const ext =
          item.file.name.split(".").pop()?.toLowerCase() ??
          (item.kind === "image" ? "jpg" : "mp4");
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PUBLIC_PROFILE_MEDIA_BUCKET)
          .upload(path, item.file, {
            upsert: false,
            contentType: item.file.type || undefined,
          });
        if (upErr) throw upErr;
        uploadedMedia.push({ storage_path: path, media_type: item.kind });
      }

      const primaryMedia = uploadedMedia[0] ?? null;
      const savedCustomCategory = usesOtherHelpCategory ? trimmedCustomCategory : null;
      let metadata: Record<string, unknown> = {};
      if (uploadedMedia.length > 0) {
        metadata.media_items = uploadedMedia;
      }
      if (selectedPostTypeId === "request_help") {
        metadata = {
          ...metadata,
          category: requestHelpCategory,
          location: postLocation.address,
          location_lat: postLocation.lat,
          location_lng: postLocation.lng,
          timeframe: timeframe,
          ...(timeframe === "custom" && customWhenDate && customWhenTime
            ? {
                custom_when: formatEventPostDateTime(customWhenDate, customWhenTime),
                custom_when_date: format(customWhenDate, "yyyy-MM-dd"),
                custom_when_time: customWhenTime,
              }
            : {}),
          budget: budgetAmount ? Number(budgetAmount) : null,
          rate_type: budgetRateType,
          ...(savedCustomCategory ? { custom_category: savedCustomCategory } : {}),
        };
      } else if (selectedPostTypeId === "offer_service") {
        metadata = {
          ...metadata,
          service: offerServiceCategory,
          ...(postLocation.lat != null && postLocation.lng != null && postLocation.address.trim()
            ? {
                location: postLocation.address,
                location_lat: postLocation.lat,
                location_lng: postLocation.lng,
              }
            : {}),
          rate: offerRate ? Number(offerRate) : null,
          rate_type: offerRateType,
          ...(savedCustomCategory ? { custom_category: savedCustomCategory } : {}),
        };
      } else if (selectedPostTypeId === "event") {
        const helpersNeeded = eventHelpersNeeded.trim()
          ? parseInt(eventHelpersNeeded, 10)
          : null;
        metadata = {
          ...metadata,
          event_name: eventName,
          date_time: formatEventPostDateTime(eventDate!, eventTime),
          event_date: format(eventDate!, "yyyy-MM-dd"),
          event_time: eventTime,
          location: eventLocation.address,
          location_lat: eventLocation.lat,
          location_lng: eventLocation.lng,
          ...(helpersNeeded != null && Number.isFinite(helpersNeeded) && helpersNeeded > 0
            ? { helpers_needed: helpersNeeded }
            : {}),
        };
      } else if (selectedPostTypeId === "community") {
        metadata = {
          ...metadata,
          title: communityTitle,
        };
      }

      let generatedCopy: GeneratedPostCopy | null = null;
      if (mapProfilePostTypeToCopyType(selectedPostTypeId)) {
        generatedCopy = generatePostText(
          buildPostTextInputFromProfile(selectedPostTypeId, metadata, caption),
        );
      }

      const captionToSave =
        caption.trim() ||
        generatedCopy?.short_text ||
        generatedCopy?.feed_preview ||
        null;

      const { error } = await supabase.from("profile_posts").insert({
        author_id: user.id,
        caption: captionToSave,
        media_type: primaryMedia?.media_type ?? null,
        storage_path: primaryMedia?.storage_path ?? null,
        tagged_user_ids: taggedUsers.map((u) => u.id),
        post_type_id: selectedPostTypeId,
        post_metadata: metadata,
        custom_category: savedCustomCategory,
        ai_generated_copy: generatedCopy,
      });
      if (error) throw error;

      addToast({ title: "Post shared!", variant: "success" });
      reset();
      onPosted();
      onClose();
    } catch (e) {
      console.error("[ComposeModal] submit", e);
      const message = e instanceof Error ? e.message : "Try again.";
      if (message.toLowerCase().includes("verify")) {
        openKycRequiredDialog("share_post");
      }
      addToast({ title: "Could not post", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const otherHelpCategoryField = (
    <div className="space-y-1.5">
      <label className="text-[13px] font-bold text-foreground">Your category</label>
      <input
        type="text"
        value={customCategory}
        onChange={(e) =>
          setCustomCategory(e.target.value.slice(0, CUSTOM_POST_CATEGORY_MAX_LEN))
        }
        maxLength={CUSTOM_POST_CATEGORY_MAX_LEN}
        placeholder="E.g. Dog walking"
        className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-medium text-foreground dark:bg-zinc-800/60"
        disabled={submitting}
      />
      <div className="text-right text-[10px] font-bold text-muted-foreground">
        {customCategory.length}/{CUSTOM_POST_CATEGORY_MAX_LEN}
      </div>
    </div>
  );

  const photoUploadSection = (
    <div className="space-y-2 pt-2">
      <div className="text-[13px] font-black text-muted-foreground uppercase tracking-wider">
        Add photos (optional)
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {composeMedia.map((item) => (
          <div
            key={item.id}
            className="relative h-20 w-20 overflow-hidden rounded-2xl border border-border/40 bg-black shadow-sm"
          >
            {item.kind === "image" ? (
              <img src={item.previewUrl} className="h-full w-full object-cover" alt="Preview" />
            ) : (
              <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline />
            )}
            <button
              type="button"
              onClick={() => removeComposeMedia(item.id)}
              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 shadow-md active:scale-[0.85] transition-transform"
              aria-label="Remove media"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </div>
        ))}

        {composeMedia.length < MAX_PROFILE_POST_MEDIA ? (
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-400 transition-all hover:border-zinc-400 hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:text-zinc-600 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/30"
            disabled={submitting}
            aria-label="Add photos or videos"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );

  const livePreviewSection = (
    <div className="space-y-2.5 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60 sm:border-t-0 sm:pt-0">
      <div className="text-[13px] font-black text-muted-foreground uppercase tracking-wider">
        Post Preview
      </div>
      <div className="rounded-2xl border-0 bg-zinc-100 dark:bg-zinc-800/55 overflow-hidden p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9">
              <AvatarImage src={authorProfile.photo_url ?? undefined} />
              <AvatarFallback className="text-xs font-bold">
                {(authorProfile.full_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                {authorProfile.full_name ?? "You"}
              </span>
              <span className="text-[11px] text-muted-foreground">Preview</span>
            </div>
          </div>

          {(() => {
            const pt = postTypes.find((p) => p.id === selectedPostTypeId);
            if (!pt) return null;
            return (
              <PostTypeBadge typeId={pt.id} typeName={pt.name} />
            );
          })()}
        </div>

        {composeMedia[0] ? (
          <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black aspect-video max-h-48 shadow-sm flex items-center justify-center">
            {composeMedia[0].kind === "image" ? (
              <img src={composeMedia[0].previewUrl} className="h-full w-full object-cover" alt="Preview" />
            ) : (
              <video src={composeMedia[0].previewUrl} className="h-full w-full object-cover" muted playsInline />
            )}
            {composeMedia.length > 1 ? (
              <div className="absolute bottom-2 right-2 flex items-end">
                {composeMedia.slice(1, 4).map((item, i) => (
                  <div
                    key={item.id}
                    className={cn(
                      "relative h-9 w-9 overflow-hidden rounded-md border-2 border-white shadow-md",
                      i > 0 && "-ml-2",
                    )}
                    style={{ zIndex: 10 + i }}
                  >
                    {item.kind === "image" ? (
                      <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline />
                    )}
                    {i === 2 && composeMedia.length > 4 ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-black text-white">
                        +{composeMedia.length - 4}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {caption.trim() && (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {caption}
          </p>
        )}

        {(() => {
          const hasMeta =
            (selectedPostTypeId === "request_help" &&
              (requestHelpCategory || postLocation.address || budgetAmount || customCategory.trim())) ||
            (selectedPostTypeId === "offer_service" &&
              (offerServiceCategory || postLocation.address || offerRate || customCategory.trim())) ||
            (selectedPostTypeId === "event" &&
              (eventName ||
                eventDate ||
                eventTime ||
                eventLocation.address ||
                eventHelpersNeeded)) ||
            (selectedPostTypeId === "community" && communityTitle);

          if (!hasMeta) return null;

          return (
            <div className="p-3.5 rounded-2xl border border-zinc-100 bg-zinc-50/50 dark:border-zinc-900 dark:bg-zinc-950/40 space-y-2">
              {selectedPostTypeId === "request_help" && (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    {requestHelpCategory && (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <CategoryIcon categoryId={requestHelpCategory} className="h-3.5 w-3.5 shrink-0" />
                        <span>{feedCategoryLabel(t, requestHelpCategory, customCategory)}</span>
                      </div>
                    )}
                    {postLocation.address &&
                    postLocation.lat != null &&
                    postLocation.lng != null ? (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{feedLocationLabel(t, postLocation.address)}</span>
                      </div>
                    ) : null}
                    {timeframe ? (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 font-bold",
                          isRequestHelpWhenUrgent(timeframe)
                            ? "text-red-600 dark:text-red-400"
                            : "text-foreground",
                        )}
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {timeframe === "custom" && customWhenDate && customWhenTime
                            ? formatEventPostDateTime(customWhenDate, customWhenTime)
                            : feedWhenLabel(t, { timeframe }) ?? ""}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {budgetAmount && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50 text-xs font-black text-rose-600 dark:text-rose-400">
                      <Coins className="h-3.5 w-3.5 shrink-0" />
                      <span>₪{budgetAmount}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {feedRateTypeLabel(t, budgetRateType)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {selectedPostTypeId === "offer_service" && (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    {offerServiceCategory && (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <CategoryIcon categoryId={offerServiceCategory} className="h-3.5 w-3.5 shrink-0" />
                        <span>{feedCategoryLabel(t, offerServiceCategory, customCategory)}</span>
                      </div>
                    )}
                    {postLocation.address &&
                    postLocation.lat != null &&
                    postLocation.lng != null ? (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{feedLocationLabel(t, postLocation.address)}</span>
                      </div>
                    ) : null}
                  </div>
                  {offerRate && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50 text-xs font-black text-emerald-600 dark:text-emerald-400">
                      <Coins className="h-3.5 w-3.5 shrink-0" />
                      <span>₪{offerRate}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {feedRateTypeLabel(t, offerRateType)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {selectedPostTypeId === "event" && (
                <div className="space-y-1.5 text-xs">
                  {eventName && (
                    <div className="flex items-center gap-1.5 font-extrabold text-[13px] text-violet-600 dark:text-violet-400">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>{eventName}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(eventDate || eventTime) && (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {eventDate && eventTime
                            ? formatEventPostDateTime(eventDate, eventTime)
                            : eventDate
                              ? format(eventDate, "EEEE, MMMM d, yyyy")
                              : eventTime}
                        </span>
                      </div>
                    )}
                    {eventLocation.address && (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{eventLocation.address}</span>
                      </div>
                    )}
                    {eventHelpersNeeded.trim() ? (
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {eventHelpersNeeded} {Number(eventHelpersNeeded) === 1 ? "helper" : "helpers"} needed
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {selectedPostTypeId === "community" && communityTitle && (
                <div className="flex items-center gap-1.5 font-extrabold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>{communityTitle}</span>
                </div>
              )}
            </div>
          );
        })()}

        {selectedPostTypeId && selectedPostTypeId !== "community" && (
          <button
            type="button"
            disabled
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider opacity-75 cursor-not-allowed",
              selectedPostTypeId === "request_help" && "bg-red-600 text-white",
              selectedPostTypeId === "offer_service" && "bg-emerald-600 text-white",
              selectedPostTypeId === "event" && "bg-violet-600 text-white",
            )}
          >
            {selectedPostTypeId === "request_help" && t("feed.iCanHelp")}
            {selectedPostTypeId === "offer_service" &&
              feedContactLabel(t, authorProfile.full_name)}
            {selectedPostTypeId === "event" && "I want to join"}
          </button>
        )}
      </div>
    </div>
  );

  const composeScrollFields = (
    <>
            {/* Author row */}
            <div className="flex items-center gap-2.5">
              <Avatar className="h-10 w-10">
                <AvatarImage src={authorProfile.photo_url ?? undefined} />
                <AvatarFallback className="font-bold text-sm">
                  {(authorProfile.full_name ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="inline-flex items-center gap-1 text-[15px] font-bold text-foreground">
                {authorProfile.full_name ?? "You"}
                {authorProfile.is_verified ? (
                  <BadgeCheck
                    className="h-4 w-4 fill-sky-500 text-white dark:fill-sky-400"
                    aria-label="Verified"
                  />
                ) : null}
              </span>
            </div>

            {/* Selected Post Type Header card with Change button */}
            {selectedPostTypeId && (
              (() => {
                const pt = postTypes.find((p) => p.id === selectedPostTypeId);
                if (!pt) return null;
                const meta = POST_TYPE_METADATA[pt.id] || {
                  title: pt.name,
                  desc: "",
                  icon: Sparkles,
                  iconBg: "bg-orange-500/10 dark:bg-orange-500/20",
                  iconColor: "text-orange-500 dark:text-orange-400",
                };
                const IconComponent = meta.icon;
                return (
                  <div className="flex items-center justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", meta.iconBg, meta.iconColor)}>
                        <IconComponent className="h-5.5 w-5.5" strokeWidth={2.25} />
                      </div>
                      <span className="font-extrabold text-[15px] text-foreground tracking-tight">{meta.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPostTypeId(null);
                        setCustomCategory("");
                      }}
                      className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                );
              })()
            )}

            {/* Grid selector: What are you posting? (shown when no type is selected) */}
            {!selectedPostTypeId && postTypes.length > 0 && (
              <div className="space-y-3.5 pt-1">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground/90">
                  What are you posting?
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {postTypes.map((pt) => {
                    const meta = POST_TYPE_METADATA[pt.id] || {
                      title: pt.name,
                      desc: "Share something with the board",
                      icon: Sparkles,
                      themeColor: "text-orange-600 dark:text-orange-400",
                      iconBg: "bg-orange-500/10 dark:bg-orange-500/20",
                      iconColor: "text-orange-500 dark:text-orange-400",
                      activeBorder: "border-orange-500 dark:border-orange-500/80 ring-orange-500/15",
                      activeBg: "bg-orange-50/30 dark:bg-orange-950/20",
                      textClass: "text-orange-600 dark:text-orange-400",
                    };
                    const IconComponent = meta.icon;

                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => {
                          setSelectedPostTypeId(pt.id);
                          setCustomCategory("");
                        }}
                        className={cn(
                          "flex min-h-[7.25rem] flex-col items-start gap-2.5 rounded-2xl border-0 bg-zinc-50 p-4 text-left shadow-none transition-all duration-200 outline-none",
                          "hover:bg-zinc-100/80 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-orange-500/40",
                          "dark:bg-zinc-900/80",
                        )}
                      >
                        <div className="flex w-full items-center gap-3">
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                              meta.iconBg,
                              meta.iconColor,
                            )}
                          >
                            <IconComponent className="h-5 w-5" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0 text-base font-bold tracking-tight text-foreground">
                            {meta.title}
                          </div>
                        </div>
                        <div className="w-full text-[13px] font-medium leading-snug text-muted-foreground">
                          {meta.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Type-specific Form inputs */}
            {selectedPostTypeId && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                {/* 1. Request Help Specific Fields */}
                {selectedPostTypeId === "request_help" && (
                  <>
                    {/* What do you need help with? */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">What do you need help with?</label>
                      <div className="relative">
                        <select
                          value={requestHelpCategory}
                          onChange={(e) => {
                            const next = e.target.value;
                            setRequestHelpCategory(next);
                            if (next !== "other_help") setCustomCategory("");
                          }}
                          className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 appearance-none font-medium text-foreground dark:bg-zinc-800/60"
                          disabled={submitting}
                        >
                          <option value="" disabled className="text-muted-foreground">E.g. Babysitter, Cleaning, Delivery..</option>
                          {SERVICE_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {requestHelpCategory === "other_help" ? otherHelpCategoryField : null}

                    {/* Location */}
                    <LocationPicker
                      label="Location"
                      labelClassName="text-[13px] font-bold text-foreground"
                      inputClassName="h-12 rounded-xl border-input bg-muted/40 text-sm font-medium dark:bg-zinc-800/60"
                      placeholder="Search for a place"
                      value={postLocation}
                      onChange={setPostLocation}
                      requireSelection
                    />

                    {/* When do you need it? */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">When do you need it?</label>
                      <div className="flex flex-wrap gap-2">
                        {REQUEST_HELP_WHEN_OPTIONS.map((opt) => {
                          const isSel = timeframe === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setTimeframe(opt.id);
                                if (opt.id !== "custom") {
                                  setCustomWhenDate(null);
                                  setCustomWhenTime("");
                                  setCustomWhenDatePickerOpen(false);
                                }
                              }}
                              className={cn(
                                "h-10 rounded-xl border px-4 text-xs font-semibold transition-all duration-150 active:scale-95",
                                requestHelpWhenOptionButtonClass(isSel, opt.id),
                              )}
                              disabled={submitting}
                            >
                              {t(FEED_WHEN_LABEL_KEYS[opt.id] ?? opt.id)}
                            </button>
                          );
                        })}
                      </div>
                      {timeframe === "custom" ? (
                        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-[1fr_auto]">
                          <Dialog
                            open={customWhenDatePickerOpen}
                            onOpenChange={setCustomWhenDatePickerOpen}
                          >
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                disabled={submitting}
                                className="flex h-12 w-full items-center gap-2 rounded-xl border border-input bg-muted/40 px-3.5 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted/60 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 dark:bg-zinc-800/60"
                              >
                                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className={cn(!customWhenDate && "text-muted-foreground")}>
                                  {customWhenDate
                                    ? format(customWhenDate, "EEEE, MMMM d, yyyy")
                                    : "Pick a date"}
                                </span>
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm">
                              <DialogHeader>
                                <DialogTitle>When do you need help?</DialogTitle>
                              </DialogHeader>
                              <SimpleCalendar
                                selectedDate={customWhenDate}
                                onDateSelect={(date) => {
                                  setCustomWhenDate(date);
                                  setCustomWhenDatePickerOpen(false);
                                }}
                              />
                            </DialogContent>
                          </Dialog>

                          <div className="relative sm:w-40">
                            <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="time"
                              value={customWhenTime}
                              onChange={(e) => setCustomWhenTime(e.target.value)}
                              className={cn(
                                "h-12 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-3.5 text-sm font-medium text-foreground outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 dark:bg-zinc-800/60",
                                noFieldSpinnerClass,
                              )}
                              disabled={submitting}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Budget */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">Budget (optional)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">₪</span>
                          <input
                            type="number"
                            placeholder="200"
                            value={budgetAmount}
                            onChange={(e) => setBudgetAmount(e.target.value)}
                            className={cn(
                              "w-full h-12 rounded-xl border border-input bg-muted/40 pl-8 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-medium text-foreground dark:bg-zinc-800/60",
                              noFieldSpinnerClass,
                            )}
                            disabled={submitting}
                          />
                        </div>
                        <div className="relative w-36">
                          <select
                            value={budgetRateType}
                            onChange={(e) => setBudgetRateType(e.target.value as any)}
                            className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 appearance-none font-medium text-foreground dark:bg-zinc-800/60"
                            disabled={submitting}
                          >
                            <option value="per_hour">{t("feed.budget.perHour")}</option>
                            <option value="fixed">{t("feed.budget.fixedPrice")}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Offer Service Specific Fields */}
                {selectedPostTypeId === "offer_service" && (
                  <>
                    {/* What service are you offering? */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">What service are you offering?</label>
                      <div className="relative">
                        <select
                          value={offerServiceCategory}
                          onChange={(e) => {
                            const next = e.target.value;
                            setOfferServiceCategory(next);
                            if (next !== "other_help") setCustomCategory("");
                          }}
                          className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 appearance-none font-medium text-foreground dark:bg-zinc-800/60"
                          disabled={submitting}
                        >
                          <option value="" disabled className="text-muted-foreground">E.g. Babysitter, Cleaning, Delivery..</option>
                          {SERVICE_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {offerServiceCategory === "other_help" ? otherHelpCategoryField : null}

                    {/* Location */}
                    <LocationPicker
                      label="Location"
                      labelClassName="text-[13px] font-bold text-foreground"
                      inputClassName="h-12 rounded-xl border-input bg-muted/40 text-sm font-medium dark:bg-zinc-800/60"
                      placeholder="Search for a place (optional)"
                      value={postLocation}
                      onChange={setPostLocation}
                      requireSelection
                    />

                    {/* Rate */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">Rate (optional)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">₪</span>
                          <input
                            type="number"
                            placeholder="200"
                            value={offerRate}
                            onChange={(e) => setOfferRate(e.target.value)}
                            className={cn(
                              "w-full h-12 rounded-xl border border-input bg-muted/40 pl-8 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-medium text-foreground dark:bg-zinc-800/60",
                              noFieldSpinnerClass,
                            )}
                            disabled={submitting}
                          />
                        </div>
                        <div className="relative w-36">
                          <select
                            value={offerRateType}
                            onChange={(e) => setOfferRateType(e.target.value as any)}
                            className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 appearance-none font-medium text-foreground dark:bg-zinc-800/60"
                            disabled={submitting}
                          >
                            <option value="per_hour">{t("feed.budget.perHour")}</option>
                            <option value="fixed">{t("feed.budget.fixedPrice")}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Event Specific Fields */}
                {selectedPostTypeId === "event" && (
                  <>
                    {/* Event Name */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">Event Name</label>
                      <input
                        type="text"
                        placeholder="E.g. Community Gathering, Picnic, Meetup"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-medium text-foreground dark:bg-zinc-800/60"
                        disabled={submitting}
                      />
                    </div>

                    {/* Date & Time */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">Date & Time</label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                        <Dialog open={eventDatePickerOpen} onOpenChange={setEventDatePickerOpen}>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              disabled={submitting}
                              className="flex h-12 w-full items-center gap-2 rounded-xl border border-input bg-muted/40 px-3.5 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted/60 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 dark:bg-zinc-800/60"
                            >
                              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className={cn(!eventDate && "text-muted-foreground")}>
                                {eventDate ? format(eventDate, "EEEE, MMMM d, yyyy") : "Pick a date"}
                              </span>
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>Event date</DialogTitle>
                            </DialogHeader>
                            <SimpleCalendar
                              selectedDate={eventDate}
                              onDateSelect={(date) => {
                                setEventDate(date);
                                setEventDatePickerOpen(false);
                              }}
                            />
                          </DialogContent>
                        </Dialog>

                        <div className="relative sm:w-40">
                          <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="time"
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            className={cn(
                              "h-12 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-3.5 text-sm font-medium text-foreground outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 dark:bg-zinc-800/60",
                              noFieldSpinnerClass,
                            )}
                            disabled={submitting}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <LocationPicker
                      label="Location"
                      labelClassName="text-[13px] font-bold text-foreground"
                      inputClassName="h-12 rounded-xl border-input bg-muted/40 text-sm font-medium dark:bg-zinc-800/60"
                      placeholder="Search for a place"
                      value={eventLocation}
                      onChange={setEventLocation}
                      requireSelection
                    />

                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">
                        Helpers needed
                      </label>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        placeholder="How many helpers do you need?"
                        value={eventHelpersNeeded}
                        onChange={(e) => setEventHelpersNeeded(e.target.value)}
                        className={cn(
                          "w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-medium text-foreground dark:bg-zinc-800/60",
                          noFieldSpinnerClass,
                        )}
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

                {/* 4. Community Specific Fields */}
                {selectedPostTypeId === "community" && (
                  <>
                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-foreground">Title</label>
                      <input
                        type="text"
                        placeholder="What is the topic or question?"
                        value={communityTitle}
                        onChange={(e) => setCommunityTitle(e.target.value)}
                        className="w-full h-12 rounded-xl border border-input bg-muted/40 px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-medium text-foreground dark:bg-zinc-800/60"
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

                {/* Tell us more / Description — opens expanded editor */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[13px] font-bold text-foreground">Tell us more</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCaptionEditorOpen(true)}
                      disabled={submitting}
                      className={cn(
                        "w-full rounded-xl border border-input bg-muted/40 p-3.5 text-left text-sm font-medium text-foreground outline-none transition-colors",
                        "hover:border-orange-400/70 focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500",
                        "dark:bg-zinc-800/60 min-h-[6.5rem] disabled:opacity-60",
                      )}
                    >
                      {caption.trim() ? (
                        <span className="line-clamp-4 whitespace-pre-wrap">{caption}</span>
                      ) : (
                        <span className="text-muted-foreground/60">{captionPlaceholder}</span>
                      )}
                    </button>
                    <div className="pointer-events-none absolute right-3.5 bottom-2 text-[10px] font-bold text-muted-foreground">
                      {caption.length}/500
                    </div>
                  </div>
                </div>

                <Dialog open={captionEditorOpen} onOpenChange={setCaptionEditorOpen}>
                  <DialogContent className="flex max-h-[min(92dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                    <DialogHeader className="border-b border-border/60 px-5 py-4">
                      <DialogTitle className="text-base font-bold">Tell us more</DialogTitle>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                      <Textarea
                        placeholder={captionPlaceholder}
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        maxLength={500}
                        rows={14}
                        autoFocus
                        {...bidirectionalInputProps(
                          caption,
                          "min-h-[min(52dvh,22rem)] resize-none w-full rounded-xl border border-input bg-muted/40 p-4 text-base leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500 font-medium text-foreground dark:bg-zinc-800/60 placeholder:text-muted-foreground/60",
                        )}
                        disabled={submitting}
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
                      <span className="text-xs font-bold tabular-nums text-muted-foreground">
                        {caption.length}/500
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full px-5 font-bold"
                        onClick={() => setCaptionEditorOpen(false)}
                      >
                        Done
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Photos upload — mobile only (desktop uses right panel) */}
                <div className="sm:hidden">{photoUploadSection}</div>

                {/* Tag users */}
                <div className="space-y-2">
                  <div ref={tagBoxRef} className="relative">
                    <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Tag someone…"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      onBlur={() => {
                        window.setTimeout(() => setTagResults([]), 120);
                      }}
                      className="w-full h-10 rounded-full border border-input bg-muted/40 pl-9 pr-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:bg-zinc-800/60"
                      disabled={submitting}
                    />

                    {tagResults.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-1.5 z-50 rounded-xl border border-border bg-background shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {tagResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                            onClick={() => {
                              if (!taggedUsers.find((t) => t.id === p.id)) {
                                setTaggedUsers((prev) => [...prev, p]);
                              }
                              setTagQuery("");
                              setTagResults([]);
                            }}
                          >
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={p.photo_url ?? undefined} />
                              <AvatarFallback className="text-xs font-bold">
                                {(p.full_name ?? "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{p.full_name ?? "Unknown"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {taggedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {taggedUsers.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 dark:bg-orange-950/60 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300"
                        >
                          <Avatar className="h-4 w-4 shrink-0">
                            <AvatarImage src={t.photo_url ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {(t.full_name ?? "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          @{t.full_name}
                          <button
                            type="button"
                            onClick={() => setTaggedUsers((prev) => prev.filter((u) => u.id !== t.id))}
                            className="ml-0.5 text-orange-500 hover:text-orange-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Live Preview — mobile only (desktop uses right panel) */}
                <div className="sm:hidden">{livePreviewSection}</div>
              </div>
            )}
    </>
  );

  return (
    <>
      {isMobileViewport && open ? (
        <MobileSnapBottomSheet
          expanded={sheetExpanded}
          onExpandedChange={(next) => {
            setSheetExpanded(next);
            if (!next) handleClose();
          }}
          onDismiss={handleClose}
          hidePeek
          titleId="compose-sheet-title"
          heightMode="viewport"
          maxHeight="min(92dvh, 860px)"
          ariaLabel="Create Post"
        >
          <div className="flex min-h-0 flex-col bg-background text-foreground dark:bg-[#121212]">
            <div className="flex shrink-0 items-center justify-between px-3 py-3">
              <div className="w-9 shrink-0" aria-hidden />
              <h2
                id="compose-sheet-title"
                className="text-[17px] font-bold tracking-tight text-foreground"
              >
                Create Post
              </h2>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={
                  submitting ||
                  !selectedPostTypeId ||
                  (!caption.trim() && composeMedia.length === 0)
                }
                className={cn(
                  "h-9 min-w-[72px] rounded-full px-4 text-sm font-bold transition-all",
                  submitting ||
                    !selectedPostTypeId ||
                    (!caption.trim() && composeMedia.length === 0)
                    ? "bg-muted text-muted-foreground/70"
                    : "bg-orange-600 text-white shadow-md shadow-orange-500/20 hover:bg-orange-700 active:scale-95",
                )}
              >
                {submitting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Post"
                )}
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ScrollArea className="min-h-0 flex-1">
                <div
                  className={cn("space-y-3 px-5 py-4", mobileSheetSafePaddingBottom)}
                >
                  {composeScrollFields}
                </div>
              </ScrollArea>
            </div>

            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) handlePhotoVideoPick(files);
                e.target.value = "";
              }}
            />
          </div>
        </MobileSnapBottomSheet>
      ) : null}

      {!isMobileViewport ? (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        onPointerDownOutside={preventDialogDismissForGooglePlacesPac}
        onFocusOutside={preventDialogDismissForGooglePlacesPac}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "sm:rounded-2xl dark:border-0",
          selectedPostTypeId
            ? "sm:max-w-4xl sm:h-[min(92vh,780px)] sm:max-h-[min(92vh,780px)]"
            : "sm:max-w-lg sm:max-h-[min(92vh,720px)]",
        )}
      >
        {/* Custom header — X (left), "Create Post" (center), Post button (right) */}
        <div className="flex shrink-0 items-center justify-between px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/60 active:scale-95 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <DialogTitle className="text-[17px] font-bold tracking-tight text-foreground">
            Create Post
          </DialogTitle>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !selectedPostTypeId || (!caption.trim() && composeMedia.length === 0)}
            className={cn(
              "h-9 min-w-[72px] rounded-full px-4 text-sm font-bold transition-all",
              submitting || !selectedPostTypeId || (!caption.trim() && composeMedia.length === 0)
                ? "bg-muted text-muted-foreground/70"
                : "bg-orange-600 text-white shadow-md shadow-orange-500/20 hover:bg-orange-700 active:scale-95",
            )}
          >
            {submitting ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Post"
            )}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <ScrollArea className="min-h-0 flex-1">
            <div className={cn("space-y-3 px-5 py-4", mobileSheetSafePaddingBottom)}>
            {composeScrollFields}
            </div>
          </ScrollArea>

          {selectedPostTypeId ? (
            <ScrollArea className="hidden sm:flex min-h-0 w-[min(100%,380px)] shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50/40 dark:border-zinc-800/80 dark:bg-zinc-900/25">
              <div className="space-y-5 px-5 py-4">
                {photoUploadSection}
                {livePreviewSection}
              </div>
            </ScrollArea>
          ) : null}
        </div>

        {/* Hidden file input — keeps media upload wired */}
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) handlePhotoVideoPick(files);
            e.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
      ) : null}
    </>
  );
}


/** Author avatar — green dot when in active 24h go-live (`live_until` in the future). */
function PostAuthorAvatar({
  authorName,
  photoUrl,
  liveUntil,
  variant,
}: {
  authorName: string;
  photoUrl: string | undefined;
  liveUntil?: string | null;
  variant: "overlay" | "card";
}) {
  const fallbackClass =
    variant === "overlay"
      ? "bg-black/50 text-sm font-bold text-white"
      : "font-bold text-sm";

  return (
    <AvatarWithLiveDot liveUntil={liveUntil}>
      <Avatar
        className={cn(
          "shrink-0",
          variant === "overlay" ? "h-11 w-11" : "h-14 w-14",
        )}
      >
        <AvatarImage src={photoUrl} className="object-cover" alt="" />
        <AvatarFallback
          className={cn(
            fallbackClass,
            variant === "card" && "text-base",
          )}
        >
          {authorName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </AvatarWithLiveDot>
  );
}

const mediaTaggedAtBadgeClass =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-md";

const mediaWhenBadgeClass =
  "inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-black text-slate-900 shadow-md backdrop-blur-xl";

const mediaWhenUrgentBadgeClass =
  "inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-900/35 ring-2 ring-red-400/40 backdrop-blur-sm";

const mediaWhenBadgeIconClass = "h-4 w-4 shrink-0";

const mediaWhenUrgentBadgeIconClass = "h-4 w-4 shrink-0 text-white";

function whenBadgeClassForTimeframe(timeframe?: string | null) {
  return isRequestHelpWhenUrgent(timeframe)
    ? mediaWhenUrgentBadgeClass
    : mediaWhenBadgeClass;
}

function whenBadgeIconClassForTimeframe(timeframe?: string | null) {
  return isRequestHelpWhenUrgent(timeframe)
    ? mediaWhenUrgentBadgeIconClass
    : mediaWhenBadgeIconClass;
}

function requestHelpWhenOptionButtonClass(
  selected: boolean,
  option: RequestHelpTimeframe,
) {
  if (selected) {
    return option === "now"
      ? "bg-red-600 border-transparent text-white dark:bg-red-700 shadow-sm shadow-red-900/25"
      : "bg-emerald-600 border-transparent text-white dark:bg-emerald-700 shadow-sm";
  }
  if (option === "now") {
    return "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/45";
  }
  return "bg-muted/40 border-input text-foreground hover:bg-muted/60 dark:bg-zinc-800/60";
}

function MediaTopBadges({
  serviceCategoryId,
  serviceCategoryLabelText,
  whenLabel,
  whenTimeframe,
  hideWhenLabel = false,
}: {
  serviceCategoryId?: string | null;
  serviceCategoryLabelText?: string | null;
  whenLabel?: string | null;
  whenTimeframe?: string | null;
  hideWhenLabel?: boolean;
}) {
  if (!serviceCategoryId && (!whenLabel || hideWhenLabel)) return null;

  return (
    <div className="absolute top-3 left-3 z-[4] pointer-events-none flex max-w-[calc(100%-4rem)] flex-wrap items-center gap-2">
      {serviceCategoryId && serviceCategoryLabelText ? (
        <span className={mediaWhenBadgeClass}>
          <CategoryIcon
            categoryId={serviceCategoryId}
            variant="badge"
            className="h-4 w-4 shrink-0"
          />
          {serviceCategoryLabelText}
        </span>
      ) : null}
      {!hideWhenLabel && whenLabel ? (
        <span className={whenBadgeClassForTimeframe(whenTimeframe)}>
          <CalendarDays className={whenBadgeIconClassForTimeframe(whenTimeframe)} />
          {whenLabel}
        </span>
      ) : null}
    </div>
  );
}

const mediaTaggedUserBadgeClass =
  "pointer-events-auto inline-flex max-w-full items-center gap-2.5 rounded-full bg-black/35 px-3 py-2 text-[13px] font-bold text-white shadow-md backdrop-blur-md hover:bg-black/45 focus-visible:outline-none focus-visible:ring-0 [-webkit-tap-highlight-color:transparent]";

const mediaTaggedMoreBadgeClass =
  "pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-[13px] font-bold text-white shadow-md backdrop-blur-md hover:bg-black/45 focus-visible:outline-none focus-visible:ring-0 [-webkit-tap-highlight-color:transparent]";

const mediaTaggedAvatarClass = "h-7 w-7 shrink-0";

function PostMediaExtraStack({
  items,
  onOpenGallery,
}: {
  items: ProfilePostMediaItem[];
  onOpenGallery: (indexInGallery: number) => void;
}) {
  if (items.length === 0) return null;

  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;

  return (
    <div className="absolute bottom-3 right-3 z-[5] flex items-end">
      {visible.map((item, i) => {
        const thumbUrl = publicProfileMediaPublicUrl(item.storage_path);
        const galleryIndex = i + 1;
        const showOverflow = i === visible.length - 1 && overflow > 0;

        return (
          <button
            key={item.storage_path}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenGallery(galleryIndex);
            }}
            className={cn(
              "relative h-11 w-11 overflow-hidden rounded-lg border-2 border-white bg-black shadow-lg ring-1 ring-black/25 transition-transform active:scale-95",
              i > 0 && "-ml-3",
            )}
            style={{ zIndex: 10 + i }}
            aria-label={
              showOverflow
                ? `View all ${items.length + 1} media items`
                : `View media ${galleryIndex + 1}`
            }
          >
            {item.media_type === "image" ? (
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={thumbUrl} className="h-full w-full object-cover" muted playsInline />
            )}
            {showOverflow ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] font-black text-white">
                +{overflow}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type ComposeMediaDraft = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
};

function revokeComposeMediaUrls(items: ComposeMediaDraft[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function isPostCaptionExpandable(caption: string, hasMedia: boolean): boolean {
  const trimmed = caption.trim();
  return hasMedia
    ? trimmed.length > 120 || trimmed.includes("\n")
    : trimmed.length > 600 || (trimmed.match(/\n/g) || []).length > 9;
}

type PostCardProps = {
  post: FeedPost;
  currentUserId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => void;
  isOwnFeed: boolean;
  onDeleted: (postId: string) => void;
  globalVideoUnmuted: boolean;
  onGlobalVideoUnmutedChange: (next: boolean) => void;
  refreshPostShareStats: (postId: string, source?: FeedPost["source"]) => void;
  onOpenMediaReels: (postId: string) => void;
  hidePostLikeButton?: boolean;
  appearance: "default" | "discover" | "profile";
  isFocused?: boolean;
  discoverWideLayout?: boolean;
  plainCard?: boolean;
  globalFeedLayout?: boolean;
  viewerLocation?: ViewerLocation | null;
};

function FeedPostItem(props: PostCardProps) {
  return <PostCard {...props} />;
}

function canActAsHelperOnJobRequest(
  profile: { role?: string; is_available_for_jobs?: boolean } | null | undefined,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true) return true;
  return false;
}

function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  isOwnFeed,
  onDeleted,
  globalVideoUnmuted,
  onGlobalVideoUnmutedChange,
  refreshPostShareStats,
  onOpenMediaReels,
  hidePostLikeButton,
  appearance,
  isFocused = false,
  discoverWideLayout = false,
  plainCard = false,
  globalFeedLayout = false,
  viewerLocation = null,
}: {
  post: FeedPost;
  currentUserId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => void;
  isOwnFeed: boolean;
  onDeleted: (postId: string) => void;
  globalVideoUnmuted: boolean;
  onGlobalVideoUnmutedChange: (next: boolean) => void;
  refreshPostShareStats: (postId: string, source?: FeedPost["source"]) => void;
  onOpenMediaReels: (postId: string) => void;
  /** Liked-posts-only feed (e.g. Saved / Liked) — hide redundant like control. */
  hidePostLikeButton?: boolean;
  appearance: "default" | "discover" | "profile";
  isFocused?: boolean;
  discoverWideLayout?: boolean;
  plainCard?: boolean;
  globalFeedLayout?: boolean;
  viewerLocation?: ViewerLocation | null;
}) {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { profile: viewerProfile, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isJobRequest = post.source === "job_request";
  const [chatOpening, setChatOpening] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [authorSaved, setAuthorSaved] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [jobSaveBusy, setJobSaveBusy] = useState(false);
  const [jobAccepting, setJobAccepting] = useState(false);
  const [jobAcceptedAt, setJobAcceptedAt] = useState<string | null>(null);
  const [jobCommentCount, setJobCommentCount] = useState(post.comment_count);
  const [saveNoticeOpen, setSaveNoticeOpen] = useState(false);
  const saveNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [eventJoinStatus, setEventJoinStatus] = useState<EventJoinInterestStatus | null>(
    null,
  );
  const [eventJoinBusy, setEventJoinBusy] = useState(false);

  const isEventPost =
    post.source === "post" && post.post_types?.id === "event";
  const isOwnEventPost = isEventPost && post.author_id === currentUserId;
  const eventHelpersNeeded =
    isEventPost && post.source === "post"
      ? parseEventHelpersNeeded(post.post_metadata)
      : null;
  const eventAcceptedHelpers =
    isEventPost && post.source === "post"
      ? (post.event_accepted_helpers_count ?? 0)
      : 0;

  useEffect(() => {
    if (!isEventPost || !currentUserId || isOwnEventPost) {
      setEventJoinStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const status = await getEventJoinInterestStatus(
          supabase,
          post.id,
          currentUserId,
        );
        if (!cancelled) setEventJoinStatus(status);
      } catch (error) {
        console.error("[PostCard] event join status", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, isEventPost, isOwnEventPost, post.id]);

  const handleActionButtonClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !viewerProfile) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }

    if (isEventPost) {
      if (isOwnEventPost) {
        navigate(
          viewerProfile.role === "freelancer"
            ? "/freelancer/profile/events"
            : "/client/profile/events",
        );
        return;
      }

      if (eventJoinStatus === "declined") {
        addToast({
          title: "Not selected for this event",
          description: "The host declined your request. Contact them if you think this is a mistake.",
          variant: "warning",
        });
        return;
      }
      if (eventJoinStatus === "accepted") {
        return;
      }

      setEventJoinBusy(true);
      try {
        const result = await recordEventJoinInterest(supabase, post.id, user.id);
        setEventJoinStatus(result.status);
        addToast({
          title: result.alreadyJoined
            ? "Already interested"
            : "You're interested in this event!",
          description: result.alreadyJoined
            ? "You already tapped I want to join on this event."
            : "The event host can see your interest in My events.",
          variant: "success",
        });
      } catch (error) {
        console.error("[PostCard] event join", error);
        addToast({
          title: "Could not save your interest",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      } finally {
        setEventJoinBusy(false);
      }
      return;
    }

    setChatOpening(true);
    try {
      await openCommunityContact({
        supabase,
        user,
        myRole: viewerProfile.role,
        targetUserId: post.author_id,
        targetRole: post.author?.role,
        navigate,
        addToast,
      });
    } finally {
      setChatOpening(false);
    }
  };
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showAllTagged, setShowAllTagged] = useState(false);
  const videoUnmutedByUser = globalVideoUnmuted;
  const [mediaOrientation, setMediaOrientation] = useState<
    "unknown" | "portrait" | "landscape"
  >("unknown");
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const mediaUrl =
    post.media_type && post.storage_path
      ? publicProfileMediaPublicUrl(post.storage_path)
      : null;
  const hasMedia = Boolean(mediaUrl);

  const postMediaItems = useMemo(
    () => (post.source === "post" ? getProfilePostMediaItems(post) : []),
    [post],
  );
  const extraMediaItems = useMemo(
    () => extraProfilePostMediaItems(postMediaItems),
    [postMediaItems],
  );

  function openMediaGallery(indexInGallery: number) {
    setGalleryIndex(indexInGallery);
    setGalleryOpen(true);
  }

  const canSaveAuthor =
    Boolean(currentUserId) && post.author_id !== currentUserId && !isJobRequest;
  const canSaveJobRequest =
    isJobRequest && Boolean(currentUserId) && post.author_id !== currentUserId;
  const { data: savedJobIds = new Set<string>() } = useJobRequestFavoriteIds(
    canSaveJobRequest ? user?.id : undefined,
  );
  const jobSaved = isJobRequest && savedJobIds.has(post.id);

  useEffect(() => {
    if (!isJobRequest) return;
    let cancelled = false;
    void supabase
      .from("job_request_comments")
      .select("*", { count: "exact", head: true })
      .eq("job_request_id", post.id)
      .then(({ count }) => {
        if (!cancelled && count != null) setJobCommentCount(count);
      });
    return () => {
      cancelled = true;
    };
  }, [isJobRequest, post.id, commentsOpen]);

  useEffect(() => {
    if (!isJobRequest || !user?.id) {
      setJobAcceptedAt(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("job_confirmations")
      .select("job_id, created_at")
      .eq("freelancer_id", user.id)
      .eq("status", "available")
      .eq("job_id", post.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setJobAcceptedAt(data?.created_at ? String(data.created_at) : null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isJobRequest, user?.id, post.id]);

  useEffect(() => {
    if (!canSaveAuthor || !currentUserId) {
      setAuthorSaved(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", currentUserId)
        .eq("favorite_user_id", post.author_id)
        .maybeSingle();
      if (!cancelled) setAuthorSaved(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [canSaveAuthor, currentUserId, post.author_id]);

  useEffect(() => {
    setCaptionExpanded(false);
  }, [post.id]);

  const savedProfilesHref =
    viewerProfile?.role === "freelancer"
      ? "/freelancer/profile/saved"
      : "/client/profile/saved";

  function clearSaveNoticeTimer() {
    if (saveNoticeTimerRef.current) {
      clearTimeout(saveNoticeTimerRef.current);
      saveNoticeTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (!saveNoticeOpen) {
      clearSaveNoticeTimer();
      return;
    }
    clearSaveNoticeTimer();
    saveNoticeTimerRef.current = setTimeout(() => {
      setSaveNoticeOpen(false);
      saveNoticeTimerRef.current = null;
    }, 4800);
    return () => {
      clearSaveNoticeTimer();
    };
  }, [saveNoticeOpen]);

  const videoMuteMediaClass =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45";

  const isLandscape = mediaOrientation === "landscape";
  const isDiscover = appearance === "discover";
  const isProfile = appearance === "profile";
  const isPlainCard = Boolean(plainCard);
  const isGlobalFeed = Boolean(globalFeedLayout);
  const cardPadX =
    isGlobalFeed ? "px-3 max-md:px-2.5 md:px-3.5" : isDiscover || isPlainCard ? "px-2 md:px-4" : "px-4";
  const cardMarginX =
    isGlobalFeed ? "mx-0" : isDiscover || isPlainCard ? "mx-2 md:mx-4" : "mx-4";
  const mobileMediaInsetClass = isGlobalFeed
    ? "max-md:mx-2 max-md:w-[calc(100%-16px)] max-md:rounded-xl md:mx-3.5 md:w-[calc(100%-1.75rem)] md:rounded-xl"
    : "max-md:mx-1.5 max-md:w-[calc(100%-12px)] max-md:rounded-[20px]";
  const mediaAspectStyle: React.CSSProperties | undefined = mediaAspectRatio
    ? { aspectRatio: String(mediaAspectRatio) }
    : undefined;
  const isGlobalFeedPortrait = isGlobalFeed && !isLandscape && !isEventPost;
  const isGlobalFeedEventPortrait = isGlobalFeed && isEventPost && !isLandscape;
  // Global feed: fixed 4:5 frame for portrait (avoids extreme crop/height from tall photos).
  const globalFeedPortraitBoxClass = isGlobalFeedPortrait ? "aspect-[4/5] w-full" : null;
  const globalFeedEventPortraitBoxClass = isGlobalFeedEventPortrait
    ? "aspect-video w-full max-md:max-h-[min(52vw,20rem)]"
    : null;
  // Mobile media sizing:
  // - Portrait: near full screen (Instagram-like); discover/profile feeds use shorter caps
  // - Landscape: size to the media's real aspect ratio to avoid excessive zoom
  const mobilePortraitMaxHeight = isGlobalFeed
    ? isEventPost
      ? "max-md:max-h-[min(50vw,18rem)]"
      : null
    : isDiscover
    ? "max-md:max-h-[min(76dvh,44rem)]"
    : isProfile
      ? "max-md:max-h-[min(78dvh,42rem)]"
      : "max-md:max-h-[min(90dvh,54rem)]";
  const mobilePortraitFallbackHeight = isGlobalFeed
    ? isEventPost
      ? "max-md:h-[min(50vw,18rem)]"
      : "aspect-[4/5]"
    : isDiscover
    ? "max-md:h-[min(74dvh,42rem)]"
    : isProfile
      ? "max-md:h-[min(74dvh,40rem)]"
      : "max-md:h-[min(86dvh,50rem)]";
  const mobileMediaBoxClass =
    globalFeedPortraitBoxClass
      ? cn(mobileMediaInsetClass, globalFeedPortraitBoxClass)
      : globalFeedEventPortraitBoxClass
        ? cn(mobileMediaInsetClass, globalFeedEventPortraitBoxClass)
        : mediaAspectRatio
          ? cn(
            mobileMediaInsetClass,
            // Portrait media can otherwise become extremely tall when width is full.
            !isLandscape && mobilePortraitMaxHeight,
          )
          : isLandscape
            ? mobileMediaInsetClass
            : cn(
              mobileMediaInsetClass,
              mobilePortraitFallbackHeight,
            );
  const feedMediaAspectStyle: React.CSSProperties | undefined =
    isGlobalFeed && !isLandscape ? undefined : mediaAspectStyle;
  const mobileMediaStyle: React.CSSProperties | undefined = feedMediaAspectStyle;

  // Desktop media sizing:
  // - Portrait: height-capped box with width derived from aspect ratio (no side letterboxing)
  // - Landscape: full width, sized to the media's real aspect ratio
  const portraitDesktopSizingClass = isGlobalFeed
    ? isEventPost
      ? "md:aspect-video md:w-full"
      : "md:aspect-[4/5] md:w-full"
    : isDiscover
    ? "md:h-[min(62vh,36rem)] md:max-h-[min(62vh,36rem)] md:w-auto md:max-w-full"
    : isProfile
      ? "md:h-[min(68vh,40rem)] md:max-h-[min(68vh,40rem)] md:w-auto md:max-w-full"
      : "md:h-[min(82vh,52rem)] md:max-h-[min(82vh,52rem)] md:w-auto md:max-w-full";
  const desktopMediaBoxClass = mediaAspectRatio
    ? cn(
      "md:rounded-xl",
      isLandscape ? "md:w-full" : portraitDesktopSizingClass,
    )
    : isLandscape
      ? "md:w-full md:rounded-xl"
      : cn("md:rounded-xl", portraitDesktopSizingClass);
  const portraitMediaObjectClass = isGlobalFeed
    ? "object-cover object-center"
    : "object-cover";
  const landscapeMediaObjectClass = "object-contain";
  const mediaBoxBgClass =
    isLandscape || isGlobalFeedPortrait ? "bg-black/90 dark:bg-black/80" : "bg-transparent";
  // Feed column is always full width so the header type badge aligns across post types.
  // Portrait media alone shrinks below the header.
  const desktopDiscoverFeedColumnClass = isDiscover
    ? discoverWideLayout
      ? "md:w-full md:max-w-none"
      : "md:w-full md:max-w-[820px]"
    : null;
  const desktopDiscoverMediaColumnClass =
    isDiscover && hasMedia
      ? discoverWideLayout
        ? isLandscape
          ? "md:w-full md:max-w-none"
          : "md:w-full md:max-w-[720px]"
        : isLandscape
          ? "md:w-full md:max-w-[820px]"
          : "md:w-fit md:max-w-[520px]"
      : null;
  const desktopMediaStyle: React.CSSProperties | undefined = feedMediaAspectStyle;

  async function toggleLike() {
    if (!currentUserId) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    if (post.source === "availability") return;
    setLiking(true);
    try {
      if (post.source === "job_request") {
        if (post.liked_by_me) {
          const { error } = await supabase
            .from("job_request_likes")
            .delete()
            .eq("job_id", post.id)
            .eq("user_id", currentUserId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("job_request_likes")
            .insert({ job_id: post.id, user_id: currentUserId });
          if (error) throw error;
        }
      } else if (post.liked_by_me) {
        const { error } = await supabase
          .from("profile_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
      onLikeToggle(post.id, !post.liked_by_me);
    } catch (e) {
      console.error("[PostCard] toggleLike", e);
      addToast({
        title: post.source === "job_request" ? "Could not like request" : "Could not like post",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setLiking(false);
    }
  }

  async function undoSavedProfile(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId) return;
    clearSaveNoticeTimer();
    setSaveNoticeOpen(false);
    setFavoriteBusy(true);
    try {
      const { error } = await supabase
        .from("profile_favorites")
        .delete()
        .eq("user_id", currentUserId)
        .eq("favorite_user_id", post.author_id);
      if (error) throw error;
      setAuthorSaved(false);
      addToast({ title: "Removed from saved profiles", variant: "success" });
    } catch (err) {
      console.error("[PostCard] undoSavedProfile", err);
      addToast({ title: "Could not undo", variant: "error" });
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function toggleSaveAuthor(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    if (!canSaveAuthor) return;
    setFavoriteBusy(true);
    try {
      if (authorSaved) {
        clearSaveNoticeTimer();
        setSaveNoticeOpen(false);
        const { error } = await supabase
          .from("profile_favorites")
          .delete()
          .eq("user_id", currentUserId)
          .eq("favorite_user_id", post.author_id);
        if (error) throw error;
        setAuthorSaved(false);
        addToast({ title: "Removed from saved profiles", variant: "success" });
      } else {
        const { error } = await supabase.from("profile_favorites").insert({
          user_id: currentUserId,
          favorite_user_id: post.author_id,
        });
        if (error) throw error;
        setAuthorSaved(true);
        setSaveNoticeOpen(true);
      }
    } catch (err) {
      console.error("[PostCard] toggleSaveAuthor", err);
      addToast({ title: "Could not update", variant: "error" });
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function toggleSaveJobRequest(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setJobSaveBusy(true);
    try {
      await toggleJobRequestFavorite(currentUserId, post.id, jobSaved);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jobRequestFavorites(currentUserId),
      });
      addToast({
        title: jobSaved ? "Removed from saved" : "Request saved",
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setJobSaveBusy(false);
    }
  }

  async function handleJobRequestAccept(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    if (!canActAsHelperOnJobRequest(viewerProfile)) {
      addToast({
        title: "Enable helper profile",
        description: "Turn on help mode to accept requests.",
        variant: "warning",
      });
      return;
    }
    setJobAccepting(true);
    try {
      await acceptOpenHelpRequest(post.id);
      setJobAcceptedAt(new Date().toISOString());
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discoverOpenHelpRequests(user.id),
      });
      addToast({
        title: "Accepted",
        description: `Waiting for ${authorName}.`,
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Failed to accept",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setJobAccepting(false);
    }
  }

  async function handleShare() {
    if (post.source !== "post" && post.source !== "job_request") return;

    const result =
      post.source === "job_request"
        ? await shareJobRequest({
            jobId: post.id,
            authorName,
            caption: effectiveCaption,
          })
        : await shareProfilePost({
            postId: post.id,
            authorName: authorName,
            caption: post.caption,
            mediaUrl,
            mediaType: post.media_type,
          });

    if (result === "cancelled") return;
    if (result === "copied") {
      addToast({
        title: "Link copied",
        description:
          post.source === "job_request"
            ? "Paste anywhere to share this request."
            : "Paste anywhere to share this post.",
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

    if (post.source === "job_request") {
      const { error } = await supabase.from("job_request_shares").insert({
        job_id: post.id,
        user_id: currentUserId,
      });
      if (error) {
        console.error("[PostCard] job_request_shares insert", error);
        return;
      }
      void refreshPostShareStats(post.id, "job_request");
      return;
    }

    const { error } = await supabase.from("profile_post_shares").insert({
      post_id: post.id,
      user_id: currentUserId,
    });
    if (error) {
      console.error("[PostCard] profile_post_shares insert", error);
      return;
    }
    void refreshPostShareStats(post.id, "post");
  }

  async function handleDelete() {
    if (!currentUserId || post.source !== "post") return;
    setDeleting(true);
    try {
      const paths = allProfilePostStoragePaths(post);
      if (paths.length > 0) {
        await supabase.storage.from(PUBLIC_PROFILE_MEDIA_BUCKET).remove(paths);
      }
      const { error } = await supabase.from("profile_posts").delete().eq("id", post.id);
      if (error) throw error;
      addToast({ title: "Post deleted", variant: "success" });
      onDeleted(post.id);
    } catch (e) {
      addToast({ title: "Could not delete", variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const authorName = post.author?.full_name?.trim() || "User";
  const generatedCopy =
    post.source === "post" || post.source === "job_request"
      ? post.ai_generated_copy ?? null
      : null;
  const effectiveCaption = post.caption?.trim() || generatedCopy?.short_text || "";
  const captionLayout = effectiveCaption
    ? bidirectionalTextProps(effectiveCaption)
    : null;
  const isSource = post.source === "availability";
  const eventDateTimeLabel = useMemo(() => {
    if (post.source !== "post" || post.post_type_id !== "event" || !post.post_metadata) {
      return null;
    }
    return feedEventDateTimeLabel(t, i18n.language, post.post_metadata);
  }, [post, t, i18n.language]);

  const whenLabel = useMemo(() => {
    if (post.source === "job_request" && post.post_metadata?.timeframe) {
      return feedWhenLabel(t, post.post_metadata);
    }
    if (post.source !== "post" || !post.post_metadata) return null;
    if (post.post_type_id === "request_help" && post.post_metadata.timeframe) {
      return feedWhenLabel(t, post.post_metadata);
    }
    if (post.post_type_id === "event") {
      return eventDateTimeLabel;
    }
    return null;
  }, [post, t, eventDateTimeLabel]);

  const requestWhenTimeframe = useMemo(() => {
    if (post.source === "job_request") {
      return (post.post_metadata?.timeframe as string | null | undefined) ?? null;
    }
    if (post.source !== "post" || post.post_type_id !== "request_help") return null;
    return (post.post_metadata?.timeframe as string | null | undefined) ?? null;
  }, [post]);

  const serviceCategoryMeta = useMemo(() => {
    if (post.source === "job_request" && post.post_metadata?.category) {
      return {
        id: post.post_metadata.category,
        label: feedCategoryLabel(t, post.post_metadata.category),
      };
    }
    if (post.source !== "post" || !post.post_metadata) return null;
    const categoryId =
      post.post_type_id === "request_help"
        ? post.post_metadata.category
        : post.post_type_id === "offer_service"
          ? post.post_metadata.service
          : null;
    if (!categoryId) return null;
    return {
      id: categoryId,
      label: feedCategoryLabel(t, categoryId, post.post_metadata.custom_category),
    };
  }, [post, t]);

  const postTypeId = feedPostTypeId(post);
  const postLocationRaw = useMemo(() => {
    const address = feedPostLocationAddress(post);
    if (!address) return null;
    return feedLocationLabel(t, address);
  }, [post, t]);

  const postLocationLine = useMemo(() => {
    if (!postLocationRaw) return null;
    return feedPostLocationLine(t, postLocationRaw, viewerLocation, post);
  }, [post, postLocationRaw, t, viewerLocation]);

  const postTitle = useMemo(
    () => feedPostTitle(t, post, generatedCopy, serviceCategoryMeta?.label),
    [generatedCopy, post, serviceCategoryMeta?.label, t],
  );

  const postDescription = useMemo(
    () => feedPostDescription(generatedCopy, effectiveCaption, postTitle),
    [effectiveCaption, generatedCopy, postTitle],
  );

  const postTitleLayout = useMemo(
    () => (postTitle ? bidirectionalTextProps(postTitle) : null),
    [postTitle],
  );
  const globalFeedContentLayout = useMemo(() => {
    const text = postDescription || postTitle || effectiveCaption;
    return text ? bidirectionalTextProps(text) : null;
  }, [postDescription, postTitle, effectiveCaption]);

  const authorFirstName = authorName.split(" ")[0] || authorName;

  const globalFeedCtaText = useMemo(
    () =>
      globalFeedCtaLabel(t, {
        isJobRequest,
        jobAcceptedAt,
        postTypeId,
        authorFirstName,
        isOwnEventPost,
        eventJoinStatus,
      }),
    [
      authorFirstName,
      eventJoinStatus,
      isJobRequest,
      isOwnEventPost,
      jobAcceptedAt,
      postTypeId,
      t,
    ],
  );

  const isGlobalTextOnlyCard =
    isGlobalFeed &&
    !hasMedia &&
    (isJobRequest ||
      postTypeId === "request_help" ||
      postTypeId === "offer_service" ||
      postTypeId === "event");

  const canOpenInReelsViewer = isReelsViewerPost(post as ReelFeedPost);

  function tryOpenMobileReels() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      return;
    }
    if (!canOpenInReelsViewer) return;
    onOpenMediaReels(post.id);
  }

  function handleDesktopCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isGlobalFeed || !canOpenInReelsViewer) return;
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 768px)").matches
    ) {
      return;
    }
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a, button, input, textarea, select, video, [data-feed-interactive]")) {
      return;
    }
    onOpenMediaReels(post.id);
  }

  function toggleInlineVideoMute(e: React.MouseEvent) {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const nextMuted = !el.muted;
    onGlobalVideoUnmutedChange(!nextMuted);
    el.muted = nextMuted;
    if (!nextMuted) {
      const p = el.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          /* ignore */
        });
      }
    }
  }
  const postedLabel = useMemo(
    () =>
      formatDistanceToNow(new Date(post.created_at), {
        addSuffix: true,
        locale: dateFnsLocaleFor(i18n.language),
      }),
    [post.created_at, i18n.language],
  );

  useEffect(() => {
    if (!mediaUrl || post.media_type !== "video") return;
    const el = videoRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Play whenever any part is visible; pause only once scrolled past (not intersecting).
        // Avoids stopping mid-scroll while the card is still on screen; `loop` keeps playback continuous in view.
        if (entry.isIntersecting) {
          if (!videoUnmutedByUser) el.muted = true;
          const p = el.play();
          if (p && typeof (p as Promise<void>).catch === "function") {
            (p as Promise<void>).catch(() => {
              // Autoplay can be blocked; ignore.
            });
          }
        } else {
          try {
            el.pause();
          } catch {
            /* ignore */
          }
        }
      },
      { threshold: [0, 0.05, 0.15, 0.35, 0.55, 0.75, 1] },
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [mediaUrl, post.media_type, videoUnmutedByUser]);

  function renderEngagementRow() {
    const btnPad = isGlobalFeed
      ? "py-2.5"
      : hasMedia
        ? isProfile
          ? "py-1.5"
          : "py-2"
        : isProfile
          ? "py-2.5"
          : "py-3";
    const iconClass = isGlobalFeed ? "h-6 w-6" : "h-7 w-7";
    const engagementTextClass = isGlobalFeed
      ? "text-[15px] font-bold"
      : "text-[17px] font-semibold";
    const engagementBtnPx = isGlobalFeed ? "px-3" : "px-3.5";
    const engagementDisabled = post.source === "availability";
    return (
      <div
        className={cn(
          "flex items-center justify-between",
          isGlobalFeed
            ? cn(
                cardPadX,
                "mt-1 border-t border-zinc-200/70 dark:border-zinc-700/45",
                "bg-zinc-50/70 dark:bg-transparent",
                "rounded-b-2xl pb-3.5 pt-2",
              )
            : cn("mt-1.5 bg-transparent", cardMarginX, isProfile ? "pb-3 pt-0" : "pb-3.5 pt-0"),
        )}
      >
        <div className="flex items-center gap-0">
          {!hidePostLikeButton ? (
            <button
              type="button"
              disabled={liking || engagementDisabled}
              onClick={() => void toggleLike()}
              className={cn(
                "flex items-center gap-2 rounded-full transition-all",
                engagementTextClass,
                engagementBtnPx,
                btnPad,
                post.liked_by_me
                  ? "text-rose-500"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-rose-500 dark:text-white dark:hover:text-rose-400",
                (liking || engagementDisabled) && "pointer-events-none opacity-50",
              )}
              aria-label={post.liked_by_me ? "Unlike" : "Like"}
            >
              <Heart
                className={cn(iconClass, "transition-transform", post.liked_by_me && "scale-110 fill-rose-500")}
                strokeWidth={2.75}
              />
              {post.like_count > 0 && !isGlobalFeed && (
                <span className="min-w-[1ch] tabular-nums">{post.like_count}</span>
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className={cn(
              "flex items-center gap-2 rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-orange-600 dark:text-white dark:hover:text-orange-400",
              engagementTextClass,
              engagementBtnPx,
              btnPad,
            )}
            aria-label="Comments"
          >
            <MessageCircle className={iconClass} strokeWidth={2.75} />
            {isGlobalFeed ? (
              <span>{t("feed.global.comment")}</span>
            ) : (isJobRequest ? jobCommentCount : commentCount) > 0 ? (
              <span className="min-w-[1ch] tabular-nums">
                {isJobRequest ? jobCommentCount : commentCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            title={
              post.source === "post"
                ? `${post.share_click_count} share taps · ${post.share_distinct_user_count} people`
                : undefined
            }
            className={cn(
              "flex items-center gap-2 rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-orange-600 dark:text-white dark:hover:text-orange-400",
              engagementTextClass,
              engagementBtnPx,
              btnPad,
            )}
            aria-label="Share"
          >
            <Send className={iconClass} strokeWidth={2.75} />
            {isGlobalFeed ? (
              <span>{t("feed.global.share")}</span>
            ) : post.share_click_count > 0 ? (
              <span className="min-w-[1ch] tabular-nums">{post.share_click_count}</span>
            ) : null}
          </button>
        </div>

        {canSaveJobRequest ? (
          <button
            type="button"
            disabled={jobSaveBusy}
            onClick={(e) => {
              e.stopPropagation();
              void toggleSaveJobRequest(e);
            }}
            title={jobSaved ? "Remove from saved requests" : "Save request"}
            aria-label={jobSaved ? "Remove from saved requests" : "Save request"}
            aria-pressed={jobSaved}
            className={cn(
              "flex items-center gap-2 rounded-full transition-colors",
              engagementTextClass,
              engagementBtnPx,
              btnPad,
              jobSaved
                ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                : "text-muted-foreground hover:bg-muted/60 hover:text-orange-600 dark:text-white dark:hover:text-orange-400",
            )}
          >
            {jobSaveBusy ? (
              <Loader2 className={cn(iconClass, "animate-spin")} aria-hidden />
            ) : (
              <Bookmark
                className={cn(
                  iconClass,
                  jobSaved && "fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-200",
                )}
                strokeWidth={jobSaved ? 0 : 2.75}
                aria-hidden
              />
            )}
            {isGlobalFeed ? <span>{t("feed.global.save")}</span> : null}
          </button>
        ) : null}
        {canSaveAuthor ? (
          <button
            type="button"
            disabled={favoriteBusy}
            onClick={(e) => {
              e.stopPropagation();
              void toggleSaveAuthor(e);
            }}
            title={authorSaved ? "Remove from saved profiles" : "Save profile"}
            aria-label={authorSaved ? "Remove author from saved profiles" : "Save author to saved profiles"}
            aria-pressed={authorSaved}
            className={cn(
              "flex items-center gap-2 rounded-full transition-colors",
              engagementTextClass,
              engagementBtnPx,
              btnPad,
              authorSaved
                ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                : "text-muted-foreground hover:bg-muted/60 hover:text-orange-600 dark:text-white dark:hover:text-orange-400"
            )}
          >
            {favoriteBusy ? (
              <Loader2 className={cn(iconClass, "animate-spin")} aria-hidden />
            ) : (
              <Bookmark
                className={cn(
                  iconClass,
                  authorSaved && "fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-200",
                )}
                strokeWidth={authorSaved ? 0 : 2.75}
                aria-hidden
              />
            )}
            {isGlobalFeed ? <span>{t("feed.global.save")}</span> : null}
          </button>
        ) : null}
      </div>
    );
  }

  const showFeedMetadataBox =
    (post.source === "post" || post.source === "job_request") &&
    post.post_metadata &&
    post.post_type_id !== "community" &&
    Object.keys(post.post_metadata).length > 0;

  const showFeedActionButton =
    (post.source === "post" &&
      post.post_types &&
      post.post_types.id !== "community") ||
    (isJobRequest && currentUserId !== post.author_id);

  const feedActionButtonClass = cn(
    "inline-flex h-9 w-[10.75rem] shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-65 shadow-none border-0",
    (post.source === "post" && post.post_types?.id === "request_help") || isJobRequest
      ? jobAcceptedAt
        ? "bg-red-500/15 text-red-700 ring-1 ring-red-300/80 dark:bg-red-950/30 dark:text-red-200 dark:ring-red-800/80"
        : "bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-600"
      : null,
    post.source === "post" &&
      post.post_types?.id === "offer_service" &&
      "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600",
    post.source === "post" &&
      post.post_types?.id === "event" &&
      (eventJoinStatus === "accepted"
        ? "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-300/80 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-800/80"
        : eventJoinStatus === "declined"
          ? "bg-muted text-muted-foreground ring-1 ring-border/80"
          : eventJoinStatus === "pending"
            ? "bg-violet-500/15 text-violet-700 ring-1 ring-violet-300/80 dark:bg-violet-950/30 dark:text-violet-200 dark:ring-violet-800/80"
            : "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-700 dark:hover:bg-violet-600"),
  );

  return (
    <div
      id={
        post.source === "post" || post.source === "job_request"
          ? feedItemDomId(post.source, post.id)
          : undefined
      }
      onClick={handleDesktopCardClick}
      className={cn(
        "overflow-hidden transition-all duration-300 border-0",
        isGlobalFeed
          ? cn("rounded-2xl", globalFeedCardSurfaceClass)
          : isDiscover || isPlainCard
          ? "bg-transparent shadow-none ring-0 outline-none rounded-none dark:bg-transparent"
          : "bg-white shadow-none dark:bg-zinc-950/20 md:rounded-2xl md:shadow-md",
        isFocused && "scroll-mt-24 scroll-mb-28",
        desktopDiscoverFeedColumnClass,
        isGlobalFeed && canOpenInReelsViewer && "md:cursor-pointer",
      )}
    >
      {/* Header — always rendered outside the media block */}
      {isGlobalFeed ? (
        <div className={cn("flex items-start gap-3.5", cardPadX, "pt-3.5 pb-2")}>
          <GuestAwareProfileLink
            userId={post.author_id}
            className="shrink-0 self-start"
            aria-label={`View ${authorName} profile`}
          >
            <PostAuthorAvatar
              authorName={authorName}
              photoUrl={post.author?.photo_url ?? undefined}
              liveUntil={post.author?.live_until}
              variant="card"
            />
          </GuestAwareProfileLink>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <GuestAwareProfileLink
                    userId={post.author_id}
                    className="truncate text-[19px] font-bold leading-tight text-foreground hover:underline underline-offset-2"
                    aria-label={`View ${authorName} profile`}
                  >
                    {authorName}
                  </GuestAwareProfileLink>
                  {post.author?.is_verified ? (
                    <BadgeCheck
                      className="h-5 w-5 shrink-0"
                      fill="#0ea5e9"
                      color="#ffffff"
                      aria-label="Verified"
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-[15px] font-medium leading-snug text-muted-foreground">
                  {post.author?.is_verified ? (
                    <>
                      <span>{t("feed.global.verified")}</span>
                      <span aria-hidden> · </span>
                    </>
                  ) : null}
                  <time className="tabular-nums">{postedLabel}</time>
                  {postLocationLine ? (
                    <>
                      <span aria-hidden> · </span>
                      <span>{postLocationLine}</span>
                    </>
                  ) : null}
                </p>
              </div>
              {postTypeId ? (
                <PostTypeBadge
                  typeId={postTypeId}
                  typeName={
                    post.source === "post" || post.source === "job_request"
                      ? post.post_types?.name
                      : undefined
                  }
                  compact
                />
              ) : null}
            </div>
            {serviceCategoryMeta?.label && postTypeId ? (
              <p
                className={cn(
                  "mt-1.5 text-[12px] font-bold uppercase tracking-wide",
                  globalFeedPostTypeAccentClass(postTypeId),
                )}
              >
                {feedPostTypeBadgeLabel(
                  t,
                  postTypeId,
                  post.source === "post" || post.source === "job_request"
                    ? post.post_types?.name
                    : undefined,
                )}
                <span aria-hidden> · </span>
                {serviceCategoryMeta.label}
              </p>
            ) : null}
          </div>
          {isOwnFeed && post.source === "post" ? (
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/40"
              aria-label="Delete post"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      ) : (
      <div
        className={cn(
          "flex items-start gap-3.5",
          cardPadX,
          isProfile ? "pt-3 pb-1.5" : "pt-4 pb-2",
        )}
      >
        <GuestAwareProfileLink
          userId={post.author_id}
          className="shrink-0 self-start"
          aria-label={`View ${authorName} profile`}
        >
          <PostAuthorAvatar
            authorName={authorName}
            photoUrl={post.author?.photo_url ?? undefined}
            liveUntil={post.author?.live_until}
            variant="card"
          />
        </GuestAwareProfileLink>
        <div className="min-w-0 flex-1 flex flex-col gap-1 pt-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <GuestAwareProfileLink
              userId={post.author_id}
              className="truncate text-[21px] font-black leading-tight text-foreground hover:underline underline-offset-2"
              aria-label={`View ${authorName} profile`}
            >
              {authorName}
            </GuestAwareProfileLink>
            {post.author?.is_verified ? (
              <BadgeCheck
                className="h-5 w-5 shrink-0"
                fill="#0ea5e9"
                color="#ffffff"
                aria-label="Verified"
              />
            ) : null}
          </div>
          <p className="text-[14px] font-medium leading-snug text-muted-foreground">
            {post.author?.is_verified ? (
              <>
                <span>{t("feed.global.verified")}</span>
                <span aria-hidden> · </span>
              </>
            ) : null}
            <time className="tabular-nums">{postedLabel}</time>
            {postLocationLine ? (
              <>
                <span aria-hidden> · </span>
                <span>{postLocationLine}</span>
              </>
            ) : null}
            {isSource ? (
              <>
                <span aria-hidden> · </span>
                <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  {feedCategoryLabel(t, (post as AvailabilityPost).category)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start pt-0.5">
          {isEventPost && (eventHelpersNeeded != null || eventAcceptedHelpers > 0) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {eventHelpersNeeded != null
                ? t("feed.event.helpersBadge", {
                    accepted: eventAcceptedHelpers,
                    needed: eventHelpersNeeded,
                  })
                : t("feed.event.helpersAcceptedOnly", {
                    count: eventAcceptedHelpers,
                  })}
            </span>
          ) : null}
          {post.source === "post" &&
          (post.post_types?.id ?? post.post_type_id) ? (
            <PostTypeBadge
              typeId={post.post_types?.id ?? post.post_type_id!}
              typeName={post.post_types?.name}
              size={isDiscover ? "lg" : "default"}
            />
          ) : isJobRequest && post.post_types ? (
            <PostTypeBadge
              typeId={post.post_types.id}
              typeName={post.post_types.name}
              size={isDiscover ? "lg" : "default"}
            />
          ) : null}
          {isOwnFeed && post.source === "post" ? (
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/40 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-200/60 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:border-red-900/40"
              aria-label="Delete post"
            >
              {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
            </button>
          ) : null}
        </div>
      </div>
      )}
      {/* Media */}
      {mediaUrl && post.media_type === "image" && (
        <div
          className={cn(
            "relative mt-0 overflow-hidden",
            mediaBoxBgClass,
            mobileMediaBoxClass,
            desktopMediaBoxClass,
            desktopDiscoverMediaColumnClass,
          )}
          style={{ ...mobileMediaStyle, ...desktopMediaStyle }}
        >
          <button
            type="button"
            onClick={() => onOpenMediaReels(post.id)}
            className="block h-full w-full overflow-hidden focus-visible:outline-none"
            aria-label="View image full screen"
          >
            <img
              src={mediaUrl}
              alt=""
              className={cn(
                "h-full w-full",
                isLandscape ? landscapeMediaObjectClass : portraitMediaObjectClass,
              )}
              loading="eager"
              decoding="async"
              onLoad={(e) => {
                const el = e.currentTarget;
                const w = el.naturalWidth || 0;
                const h = el.naturalHeight || 0;
                if (!w || !h) return;
                const ratio = w / h;
                setMediaAspectRatio(ratio);
                setMediaOrientation(ratio >= 1.05 ? "landscape" : "portrait");
              }}
            />
          </button>

          <MediaTopBadges
            serviceCategoryId={serviceCategoryMeta?.id}
            serviceCategoryLabelText={serviceCategoryMeta?.label}
            whenLabel={whenLabel}
            whenTimeframe={requestWhenTimeframe}
            hideWhenLabel={isGlobalFeed}
          />

          <PostMediaExtraStack items={extraMediaItems} onOpenGallery={openMediaGallery} />

          {/* Tagged users — bottom-left overlay on media */}
          {post.tagged_profiles.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[3] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
              <span className={mediaTaggedAtBadgeClass}>
                <AtSign className="h-5 w-5" aria-hidden />
              </span>
              {(showAllTagged ? post.tagged_profiles : post.tagged_profiles.slice(0, 3)).map((t) => (
                <GuestAwareProfileLink
                  key={t.id}
                  userId={t.id}
                  onClick={(e) => e.stopPropagation()}
                  className={mediaTaggedUserBadgeClass}
                  aria-label={`View tagged user ${t.full_name ?? "member"}`}
                >
                  <Avatar className={mediaTaggedAvatarClass}>
                    <AvatarImage src={t.photo_url ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-[10px] font-black text-white">
                      {(t.full_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{t.full_name ?? "Member"}</span>
                </GuestAwareProfileLink>
              ))}
              {!showAllTagged && post.tagged_profiles.length > 3 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllTagged(true);
                  }}
                  className={mediaTaggedMoreBadgeClass}
                  aria-label="Show all tagged users"
                >
                  <Plus className="h-5 w-5" strokeWidth={3} aria-hidden />
                  {post.tagged_profiles.length - 3}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {mediaUrl && post.media_type === "video" && (
        <div
          className={cn(
            "relative mt-0 overflow-hidden",
            mediaBoxBgClass,
            mobileMediaBoxClass,
            desktopMediaBoxClass,
            desktopDiscoverMediaColumnClass,
          )}
          style={{ ...mobileMediaStyle, ...desktopMediaStyle }}
        >
          <video
            ref={videoRef}
            src={mediaUrl}
            // Remove native browser controls bar (we provide our own mute + fullscreen).
            playsInline
            loop
            muted={!videoUnmutedByUser}
            preload="metadata"
            className={cn(
              "h-full w-full",
              isLandscape ? landscapeMediaObjectClass : portraitMediaObjectClass,
            )}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              const w = el.videoWidth || 0;
              const h = el.videoHeight || 0;
              if (!w || !h) return;
              const ratio = w / h;
              setMediaAspectRatio(ratio);
              setMediaOrientation(ratio >= 1.05 ? "landscape" : "portrait");
            }}
            onClick={(e) => {
              e.stopPropagation();
              try {
                videoRef.current?.pause();
              } catch {
                /* ignore */
              }
              onOpenMediaReels(post.id);
            }}
          />

          <div className="absolute top-3 right-3 z-[6]">
            <button
              type="button"
              onClick={toggleInlineVideoMute}
              className={videoMuteMediaClass}
              aria-label={videoUnmutedByUser ? "Mute video" : "Unmute video"}
              title={videoUnmutedByUser ? "Mute" : "Unmute"}
            >
              {videoUnmutedByUser ? (
                <Volume2 className="h-6 w-6" aria-hidden />
              ) : (
                <VolumeX className="h-6 w-6" aria-hidden />
              )}
            </button>
          </div>

          <MediaTopBadges
            serviceCategoryId={serviceCategoryMeta?.id}
            serviceCategoryLabelText={serviceCategoryMeta?.label}
            whenLabel={whenLabel}
            whenTimeframe={requestWhenTimeframe}
            hideWhenLabel={isGlobalFeed}
          />

          <PostMediaExtraStack items={extraMediaItems} onOpenGallery={openMediaGallery} />

          {/* Tagged users — bottom-left overlay on media */}
          {post.tagged_profiles.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[3] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
              <span className={mediaTaggedAtBadgeClass}>
                <AtSign className="h-5 w-5" aria-hidden />
              </span>
              {(showAllTagged ? post.tagged_profiles : post.tagged_profiles.slice(0, 3)).map((t) => (
                <GuestAwareProfileLink
                  key={t.id}
                  userId={t.id}
                  onClick={(e) => e.stopPropagation()}
                  className={mediaTaggedUserBadgeClass}
                  aria-label={`View tagged user ${t.full_name ?? "member"}`}
                >
                  <Avatar className={mediaTaggedAvatarClass}>
                    <AvatarImage src={t.photo_url ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-[10px] font-black text-white">
                      {(t.full_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{t.full_name ?? "Member"}</span>
                </GuestAwareProfileLink>
              ))}
              {!showAllTagged && post.tagged_profiles.length > 3 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllTagged(true);
                  }}
                  className={mediaTaggedMoreBadgeClass}
                  aria-label="Show all tagged users"
                >
                  <Plus className="h-5 w-5" strokeWidth={3} aria-hidden />
                  {post.tagged_profiles.length - 3}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {isGlobalFeed ? (
        <>
          {isGlobalTextOnlyCard ? (
            <div className={cn(cardPadX, "pb-1")}>
              <button
                type="button"
                onClick={tryOpenMobileReels}
                className={cn(
                  "w-full rounded-xl p-4 transition-opacity active:opacity-90 max-md:cursor-pointer",
                  globalFeedContentLayout?.className,
                  globalFeedTextOnlySurfaceClass(postTypeId),
                )}
                dir={globalFeedContentLayout?.dir}
                aria-label="View post full screen"
              >
                {postTitle ? (
                  <h3
                    className={cn(
                      "flex items-center gap-2 text-[19px] font-bold leading-snug text-foreground",
                      postTitleLayout?.className,
                    )}
                    dir={postTitleLayout?.dir}
                  >
                    {serviceCategoryMeta?.id ? (
                      <CategoryIcon
                        categoryId={serviceCategoryMeta.id}
                        className="h-6 w-6 shrink-0"
                      />
                    ) : null}
                    <span>{postTitle}</span>
                  </h3>
                ) : null}
                {postDescription ? (
                  <p
                    {...bidirectionalTextProps(
                      postDescription,
                      "mt-2 text-[17px] leading-relaxed text-foreground/90 whitespace-pre-wrap",
                    )}
                  >
                    {renderCaptionWithMentions(postDescription)}
                  </p>
                ) : null}
                <div
                  className={cn(
                    "mt-3 space-y-2 text-[16px] font-medium text-foreground/85",
                    globalFeedContentLayout?.className,
                  )}
                  dir={globalFeedContentLayout?.dir}
                >
                  {postLocationLine ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span>{postLocationLine}</span>
                    </div>
                  ) : null}
                  {whenLabel ? (
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span>{whenLabel}</span>
                    </div>
                  ) : null}
                  {post.source === "post" &&
                  post.post_type_id === "request_help" &&
                  post.post_metadata?.budget ? (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <Coins className="h-5 w-5 shrink-0" />
                      <span>
                        ₪{post.post_metadata.budget}{" "}
                        <span className="text-muted-foreground">
                          {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {isJobRequest && post.post_metadata?.budget ? (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <Coins className="h-5 w-5 shrink-0" />
                      <span>
                        ₪{post.post_metadata.budget}{" "}
                        <span className="text-muted-foreground">
                          {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {post.source === "post" &&
                  post.post_type_id === "offer_service" &&
                  post.post_metadata?.rate ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Coins className="h-5 w-5 shrink-0" />
                      <span>
                        ₪{post.post_metadata.rate}{" "}
                        <span className="text-muted-foreground">
                          {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {isEventPost && eventHelpersNeeded != null ? (
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span>
                        {t("feed.event.helpersBadge", {
                          accepted: eventAcceptedHelpers,
                          needed: eventHelpersNeeded,
                        })}
                      </span>
                    </div>
                  ) : null}
                </div>
              </button>
            </div>
          ) : (
            <>
              {(postTitle || postDescription) && (
                <button
                  type="button"
                  onClick={tryOpenMobileReels}
                  className={cn(
                    cardPadX,
                    hasMedia ? "pt-2.5" : "pt-2",
                    "w-full max-md:active:opacity-90",
                    globalFeedContentLayout?.className,
                    !hasMedia && "max-md:cursor-pointer",
                  )}
                  dir={globalFeedContentLayout?.dir}
                  aria-label={!hasMedia ? "View post full screen" : undefined}
                  disabled={hasMedia}
                >
                  {postTitle ? (
                    <h3
                      className={cn(
                        "text-[19px] font-bold leading-snug text-foreground",
                        postTitleLayout?.className,
                      )}
                      dir={postTitleLayout?.dir}
                    >
                      {postTitle}
                    </h3>
                  ) : null}
                  {postDescription ? (
                    <p
                      {...bidirectionalTextProps(
                        postDescription,
                        cn(
                          "text-[17px] leading-relaxed text-muted-foreground whitespace-pre-wrap",
                          postTitle && "mt-1",
                        ),
                      )}
                    >
                      {renderCaptionWithMentions(postDescription)}
                    </p>
                  ) : null}
                </button>
              )}
              {showFeedMetadataBox ? (
                <div
                  className={cn(
                    cardPadX,
                    "mt-2 space-y-2 text-[16px] font-medium text-foreground/90",
                    globalFeedContentLayout?.className,
                  )}
                  dir={globalFeedContentLayout?.dir}
                >
                  {postLocationLine ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span>{postLocationLine}</span>
                    </div>
                  ) : null}
                  {whenLabel ? (
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span>{whenLabel}</span>
                    </div>
                  ) : null}
                  {post.source === "post" &&
                  post.post_type_id === "request_help" &&
                  post.post_metadata?.budget ? (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <Coins className="h-5 w-5 shrink-0" />
                      <span>
                        ₪{post.post_metadata.budget}{" "}
                        <span className="text-muted-foreground">
                          {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {post.source === "post" &&
                  post.post_type_id === "offer_service" &&
                  post.post_metadata?.rate ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Coins className="h-5 w-5 shrink-0" />
                      <span>
                        ₪{post.post_metadata.rate}{" "}
                        <span className="text-muted-foreground">
                          {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {isEventPost && eventHelpersNeeded != null ? (
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span>
                        {t("feed.event.helpersBadge", {
                          accepted: eventAcceptedHelpers,
                          needed: eventHelpersNeeded,
                        })}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          {showFeedActionButton ? (
            <div className={cn(cardPadX, "mt-3 pb-1")}>
              <button
                type="button"
                onClick={isJobRequest ? handleJobRequestAccept : handleActionButtonClick}
                disabled={
                  isJobRequest
                    ? jobAccepting || Boolean(jobAcceptedAt)
                    : chatOpening ||
                      eventJoinBusy ||
                      eventJoinStatus === "accepted" ||
                      eventJoinStatus === "declined"
                }
                className={cn(
                  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition-all duration-200 active:scale-[0.99] disabled:opacity-65 shadow-none border-0",
                  globalFeedPrimaryCtaClass(
                    postTypeId,
                    isJobRequest && jobAcceptedAt
                      ? "accepted"
                      : eventJoinStatus === "accepted"
                        ? "accepted"
                        : eventJoinStatus === "declined"
                          ? "declined"
                          : eventJoinStatus === "pending"
                            ? "pending"
                            : undefined,
                  ),
                )}
              >
                {isJobRequest && jobAccepting ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : chatOpening || eventJoinBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : null}
                <span>{globalFeedCtaText}</span>
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
      {/* Community title — shown above caption as a heading */}
      {post.source === "post" && post.post_type_id === "community" && (generatedCopy?.title || post.post_metadata?.title) && (
        <div className={cn(cardPadX, hasMedia ? "pt-1" : "pt-3")}>
          <h3
            {...bidirectionalTextProps(
              generatedCopy?.title || post.post_metadata?.title || "",
              "text-lg font-extrabold leading-snug text-blue-600 dark:text-blue-400",
            )}
          >
            {generatedCopy?.title || post.post_metadata.title}
          </h3>
        </div>
      )}

      {effectiveCaption && (() => {
        const captionExpandable = isPostCaptionExpandable(effectiveCaption, hasMedia);
        const captionBody = (
          <div className="flex items-end justify-between gap-3">
            <div className={cn("flex-1", captionLayout?.className)} dir={captionLayout?.dir}>
              <p
                {...bidirectionalTextProps(
                  effectiveCaption,
                  cn(
                    "text-[18px] leading-relaxed text-foreground whitespace-pre-wrap",
                    !captionExpanded &&
                      (hasMedia ? "line-clamp-2" : "line-clamp-[10]"),
                  ),
                )}
              >
                <span className="text-[19px] font-black lowercase">{authorName}</span>{" "}
                <span className="mx-1 inline-block align-middle text-[13px] text-muted-foreground">•</span>{" "}
                {renderCaptionWithMentions(effectiveCaption)}
              </p>
            </div>
            {captionExpandable ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCaptionExpanded((prev) => !prev);
                }}
                className="shrink-0 text-base font-black text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                aria-label={captionExpanded ? "Show less text" : "Show full text"}
                aria-expanded={captionExpanded}
              >
                {captionExpanded ? "Less" : "More"}
              </button>
            ) : null}
          </div>
        );

        if (!hasMedia) {
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={tryOpenMobileReels}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  tryOpenMobileReels();
                }
              }}
              className={cn(
                cardPadX,
                "w-full pb-0 pt-2 max-md:cursor-pointer max-md:active:opacity-90 md:pt-3 md:pb-1",
                captionLayout?.className,
              )}
              dir={captionLayout?.dir}
              aria-label="View post full screen"
            >
              {captionBody}
            </div>
          );
        }

        return (
        <div
          className={cn(
            cardPadX,
            "pb-0",
            "pt-0 md:pt-0.5 md:pb-1",
          )}
        >
          {captionBody}
        </div>
        );
      })()}

      {/* Tagged users (only when there is no media overlay) */}
      {!hasMedia && post.tagged_profiles.length > 0 ? (
        <div className={cn("flex flex-wrap items-center gap-3 pt-2", cardPadX)}>
          <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {post.tagged_profiles.map((t) => (
            <GuestAwareProfileLink
              key={t.id}
              userId={t.id}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={t.photo_url ?? undefined} />
                <AvatarFallback className="text-[10px] font-bold">{(t.full_name ?? "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <span>{t.full_name}</span>
            </GuestAwareProfileLink>
          ))}
        </div>
      ) : null}

      {/* Post metadata + compact action button (community posts show title above caption) */}
      {(showFeedMetadataBox || showFeedActionButton) && (
        <div className={cn("mt-2 rounded-2xl bg-zinc-100/90 p-3.5 dark:bg-zinc-800/55", cardMarginX)}>
          {showFeedMetadataBox ? (
          <div className="space-y-2">
          {post.post_type_id === "request_help" && (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {post.post_metadata.category ? (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <CategoryIcon categoryId={post.post_metadata.category} className="h-4 w-4 shrink-0" />
                    <span>
                      {feedCategoryLabel(
                        t,
                        post.post_metadata.category,
                        post.post_metadata.custom_category,
                      )}
                    </span>
                  </div>
                ) : null}
                {post.post_metadata.location && (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{feedLocationLabel(t, post.post_metadata.location)}</span>
                  </div>
                )}
                {post.post_metadata.timeframe ? (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 font-bold",
                      isRequestHelpWhenUrgent(post.post_metadata.timeframe)
                        ? "text-red-600 dark:text-red-400"
                        : "text-foreground",
                    )}
                  >
                    <CalendarDays
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isRequestHelpWhenUrgent(post.post_metadata.timeframe)
                          ? "text-red-500 dark:text-red-400"
                          : "text-muted-foreground",
                      )}
                    />
                    <span className={cn(isRequestHelpWhenUrgent(post.post_metadata.timeframe) && "uppercase tracking-wide")}>
                      {feedWhenLabel(t, post.post_metadata) ?? ""}
                    </span>
                  </div>
                ) : null}
              </div>
              {post.post_metadata.budget && (
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/70 dark:border-zinc-800/50 text-[15px] font-black text-rose-600 dark:text-rose-400">
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>₪{post.post_metadata.budget}</span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                  </span>
                </div>
              )}
            </>
          )}

          {post.post_type_id === "offer_service" && (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {post.post_metadata.service ? (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <CategoryIcon categoryId={post.post_metadata.service} className="h-4 w-4 shrink-0" />
                    <span>
                      {feedCategoryLabel(
                        t,
                        post.post_metadata.service,
                        post.post_metadata.custom_category,
                      )}
                    </span>
                  </div>
                ) : null}
                {post.post_metadata.location && (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{feedLocationLabel(t, post.post_metadata.location)}</span>
                  </div>
                )}
              </div>
              {post.post_metadata.rate && (
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/70 dark:border-zinc-800/50 text-[15px] font-black text-emerald-600 dark:text-emerald-400">
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>₪{post.post_metadata.rate}</span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {feedRateTypeLabel(t, post.post_metadata.rate_type)}
                  </span>
                </div>
              )}
            </>
          )}

          {post.post_type_id === "event" && (
            <div className="space-y-1.5 text-sm">
              {post.post_metadata.event_name && (
                <div className="flex items-center gap-1.5 font-extrabold text-[15px] text-violet-600 dark:text-violet-400">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>{post.post_metadata.event_name}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {eventDateTimeLabel ? (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{eventDateTimeLabel}</span>
                  </div>
                ) : null}
                {post.post_metadata.location && (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{feedLocationLabel(t, post.post_metadata.location)}</span>
                  </div>
                )}
                {eventHelpersNeeded != null ? (
                  <div className="flex items-center gap-1.5 text-foreground font-bold">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      {t("feed.event.helpersNeededLabel", { count: eventHelpersNeeded })}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          </div>
          ) : null}

          {showFeedActionButton ? (
            <div className={cn("flex justify-end", showFeedMetadataBox && "mt-3")}>
              <button
                type="button"
                onClick={isJobRequest ? handleJobRequestAccept : handleActionButtonClick}
                disabled={
                  isJobRequest
                    ? jobAccepting || Boolean(jobAcceptedAt)
                    : chatOpening ||
                      eventJoinBusy ||
                      eventJoinStatus === "accepted" ||
                      eventJoinStatus === "declined"
                }
                className={feedActionButtonClass}
              >
                {isJobRequest ? (
                  jobAccepting ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : null
                ) : chatOpening || eventJoinBusy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : null}
                <span className="truncate">
                  {isJobRequest
                    ? jobAcceptedAt
                      ? "Accepted"
                      : t("feed.iCanHelp")
                    : null}
                  {!isJobRequest && post.source === "post" && post.post_types ? (
                    <>
                      {post.post_types.id === "request_help" && t("feed.iCanHelp")}
                      {post.post_types.id === "offer_service" &&
                        feedContactLabel(t, post.author?.full_name)}
                      {post.post_types.id === "event" &&
                        (isOwnEventPost
                          ? t("feed.event.viewInterestedUsers")
                          : eventJoinStatus === "accepted"
                            ? t("feed.event.selectedHelper")
                            : eventJoinStatus === "declined"
                              ? t("feed.event.declined")
                              : eventJoinStatus === "pending"
                                ? t("feed.event.interested")
                                : t("feed.event.wantToJoin"))}
                    </>
                  ) : null}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      )}
        </>
      )}

      {renderEngagementRow()}

      {/* Comments dialog */}
      {!isJobRequest ? (
      <CommentsDialog
        postId={post.id}
        open={commentsOpen}
        onClose={() => {
          setCommentsOpen(false);
          // Refresh comment count
          void supabase
            .from("profile_post_comments")
            .select("*", { count: "exact", head: true })
            .eq("post_id", post.id)
            .then(({ count }) => {
              if (count != null) setCommentCount(count);
            });
        }}
      />
      ) : (
      <JobRequestCommentsModal
        jobId={post.id}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentAdded={() => {
          void supabase
            .from("job_request_comments")
            .select("*", { count: "exact", head: true })
            .eq("job_request_id", post.id)
            .then(({ count }) => {
              if (count != null) setJobCommentCount(count);
            });
        }}
      />
      )}

      {postMediaItems.length > 0 ? (
        <PostMediaGalleryModal
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          items={postMediaItems}
          initialIndex={galleryIndex}
        />
      ) : null}

      {saveNoticeOpen ? (
        <div
          className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[260] flex justify-center px-4 pointer-events-none"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-sm animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
            <div className="rounded-2xl border border-white/10 bg-black/75 p-4 text-white shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Saved to
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-snug text-white/95">
                <span className="inline-flex items-center gap-1 align-middle">
                  <span className="font-bold text-white">{authorName}</span>
                  {post.author?.is_verified ? (
                    <BadgeCheck
                      className="h-[18px] w-[18px] shrink-0"
                      fill="#0ea5e9"
                      color="#ffffff"
                      aria-label="Verified account"
                    />
                  ) : null}
                </span>
                <span className="font-normal text-white/75">
                  {" "}
                  was added to your{" "}
                  <Link
                    to={savedProfilesHref}
                    className="font-semibold text-amber-300/95 underline decoration-amber-400/50 underline-offset-2 hover:text-amber-200"
                    onClick={() => {
                      clearSaveNoticeTimer();
                      setSaveNoticeOpen(false);
                    }}
                  >
                    saved profiles
                  </Link>
                  .
                </span>
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white/15">
                  <AvatarImage src={post.author?.photo_url ?? undefined} className="object-cover" alt="" />
                  <AvatarFallback className="bg-white/10 text-sm font-bold text-white">
                    {authorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-sm font-bold tracking-tight">{authorName}</p>
                    {post.author?.is_verified ? (
                      <BadgeCheck
                        className="h-[18px] w-[18px] shrink-0"
                        fill="#0ea5e9"
                        color="#ffffff"
                        aria-label="Verified account"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={favoriteBusy}
                  className="w-full rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/12 hover:text-white"
                  onClick={(e) => void undoSavedProfile(e)}
                >
                  Undo
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Feed Component ──────────────────────────────────────────────────────

interface ProfilePostsFeedProps {
  userId?: string;
  isOwnProfile?: boolean;
  filterTaggedUserId?: string;
  filterAuthorId?: string;
  authorNameFilter?: string;
  sortOrder?: "newest" | "oldest";
  /** Show only posts liked by this user (new social feed). */
  filterLikedByUserId?: string;
  limit?: number;
  /** Visual context for layout tweaks (e.g. Discover home feed). */
  appearance?: "default" | "discover" | "profile";
  /**
   * What to render in the right-side panel when `appearance === "discover"`.
   *  - "comments" (default): per-post live comments (used by Community Feed page)
   *  - "favorites": YouTube-style "From your favorites" + "Most liked" sidebar
   *    rendered once next to the first post (used by Discovery Home)
   */
  discoverSidePanel?: "comments" | "favorites";
  /** Deep link from share URLs (`/community/feed?post=`). */
  focusPostId?: string | null;
  /** Deep link from shared help requests (`/community/feed?request=`). */
  focusRequestId?: string | null;
  /** Wider post + comments columns for guest community feed on desktop. */
  expandDiscoverLayout?: boolean;
  /** Render posts on the page background (no card surface). */
  plainCards?: boolean;
  /** Filter global feed to a single post type (e.g. request_help). */
  filterPostTypeId?: string | null;
  /** Filter feed to multiple post types (Discover home hire/work tabs). */
  filterPostTypeIds?: string[] | null;
  /** Post types shown in the favorites side panel (defaults to feed filter). */
  sidePanelPostTypeIds?: string[] | null;
  /** Pin favorites panel to viewport; scroll panel independently (community feed page). */
  fixedFavoritesSidePanel?: boolean;
  /** Navigate away or handle side-panel post click (Discover home → community feed). */
  onSidePanelPostOpen?: (postId: string) => void;
  /** Scroll to a post in the feed after navigation (no pin-to-top). */
  scrollToPostId?: string | null;
  onScrollToPostDone?: () => void;
  /** Show only the viewer's posts that received comments. */
  filterCommentedOwnPosts?: boolean;
  /** Show only open help requests the viewer accepted. */
  filterAcceptedRequests?: boolean;
  /** Advanced community feed filters (when, budget, my posts, favorites). */
  feedAdvancedFilters?: CommunityFeedAdvancedFilters;
  /**
   * Hide the signed-in user's own open job requests (Discover "Help others").
   * Default: true only when `discoverSidePanel === "favorites"`.
   */
  excludeOwnJobRequests?: boolean;
  /** Unified community feed card layout (Global Posts page). */
  globalFeedLayout?: boolean;
  /** Viewer location for distance labels on global feed cards. */
  viewerLocation?: ViewerLocation | null;
}

export function ProfilePostsFeed({
  userId,
  isOwnProfile = false,
  filterTaggedUserId,
  filterAuthorId,
  authorNameFilter,
  sortOrder = "newest",
  filterLikedByUserId,
  limit,
  appearance = "default",
  discoverSidePanel = "comments",
  focusPostId = null,
  focusRequestId = null,
  expandDiscoverLayout = false,
  plainCards = false,
  filterPostTypeId = null,
  filterPostTypeIds = null,
  sidePanelPostTypeIds = null,
  fixedFavoritesSidePanel = false,
  onSidePanelPostOpen,
  scrollToPostId = null,
  onScrollToPostDone,
  filterCommentedOwnPosts = false,
  filterAcceptedRequests = false,
  feedAdvancedFilters,
  excludeOwnJobRequests,
  globalFeedLayout = false,
  viewerLocation = null,
}: ProfilePostsFeedProps) {
  const hideOwnJobRequests = excludeOwnJobRequests ?? discoverSidePanel === "favorites";
  const effectivePostTypeFilter = useMemo(() => {
    if (filterPostTypeIds?.length) return filterPostTypeIds;
    if (filterPostTypeId) return [filterPostTypeId];
    return null;
  }, [filterPostTypeId, filterPostTypeIds]);
  const resolvedSidePanelPostTypeIds =
    sidePanelPostTypeIds ?? effectivePostTypeFilter;
  const normalizedFocusPostId = parseProfilePostShareId(focusPostId);
  const normalizedFocusRequestId = parseJobRequestShareId(focusRequestId);
  const normalizedScrollToPostId = parseProfilePostShareId(scrollToPostId);
  const { user, profile: currentProfile } = useAuth();
  const { guardKycAction } = useKycGate();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const [globalVideoUnmuted, setGlobalVideoUnmuted] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const openCompose = useCallback(() => {
    if (!user) {
      openGuestAuthPrompt({ variant: "create" });
      return;
    }
    guardKycAction("share_post", () => setComposeOpen(true));
  }, [guardKycAction, openGuestAuthPrompt, user]);
  const [reelsOpenPostId, setReelsOpenPostId] = useState<string | null>(null);
  const [reelCommentsPostId, setReelCommentsPostId] = useState<string | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const requestDeepLinkHandledRef = useRef<string | null>(null);
  const scrollToPostHandledRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const advancedFilters = feedAdvancedFilters;

  // Stable query key — used to invalidate/update the cache in realtime handlers.
  const qk = useMemo(() => queryKeys.profilePostsFeed({
    userId,
    viewerUserId: user?.id,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    filterLikedByUserId,
    filterPostTypeId,
    filterPostTypeIds: effectivePostTypeFilter,
    filterCommentedOwnPosts,
    filterAcceptedRequests,
    feedWhen: advancedFilters?.when ?? null,
    feedMyPostsOnly: advancedFilters?.myPostsOnly ?? false,
    feedBudgetMin: advancedFilters?.budgetMin ?? null,
    feedBudgetMax: advancedFilters?.budgetMax ?? null,
    feedFavoriteProfilesOnly: advancedFilters?.favoriteProfilesOnly ?? false,
    limit,
  }), [
    userId,
    user?.id,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    filterLikedByUserId,
    filterPostTypeId,
    effectivePostTypeFilter,
    filterCommentedOwnPosts,
    filterAcceptedRequests,
    advancedFilters?.when,
    advancedFilters?.myPostsOnly,
    advancedFilters?.budgetMin,
    advancedFilters?.budgetMax,
    advancedFilters?.favoriteProfilesOnly,
    limit,
  ]);

  useProfilePostsFeedRealtime({
    queryClient,
    queryKey: qk,
    viewerUserId: user?.id ?? null,
    userId,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    filterLikedByUserId,
    filterPostTypeId: filterPostTypeId ?? undefined,
    filterCommentedOwnPosts,
    feedAdvancedFilters: advancedFilters,
    limit,
  });

  // Likes + comments: patch cache in place (no full refetch).
  useRealtimeSubscription(
    { table: "profile_post_likes", event: "*" },
    (payload) => {
      const row = (payload?.new ?? payload?.old) as { post_id?: string; user_id?: string } | undefined;
      const postId = row?.post_id;
      if (!postId) return;
      queryClient.setQueryData<FeedPost[]>(qk, (prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((p) => p.source === "post" && p.id === postId);
        if (idx === -1) return prev;
        const next = [...prev];
        const p = next[idx] as ProfilePost;
        const isMe = Boolean(user?.id && row?.user_id === user.id);
        if (payload?.eventType === "INSERT") {
          next[idx] = { ...p, like_count: p.like_count + 1, liked_by_me: isMe ? true : p.liked_by_me };
        } else if (payload?.eventType === "DELETE") {
          next[idx] = { ...p, like_count: Math.max(0, p.like_count - 1), liked_by_me: isMe ? false : p.liked_by_me };
        } else {
          void queryClient.invalidateQueries({ queryKey: qk, refetchType: "active" });
          return prev;
        }
        return next;
      });
    },
  );

  useRealtimeSubscription(
    { table: "profile_post_comments", event: "*" },
    (payload) => {
      const row = (payload?.new ?? payload?.old) as { post_id?: string } | undefined;
      const postId = row?.post_id;
      if (!postId) return;
      queryClient.setQueryData<FeedPost[]>(qk, (prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((p) => p.source === "post" && p.id === postId);
        if (idx === -1) return prev;
        const next = [...prev];
        const p = next[idx] as ProfilePost;
        if (payload?.eventType === "INSERT") {
          next[idx] = { ...p, comment_count: p.comment_count + 1 };
        } else if (payload?.eventType === "DELETE") {
          next[idx] = { ...p, comment_count: Math.max(0, p.comment_count - 1) };
        } else {
          void queryClient.invalidateQueries({ queryKey: qk, refetchType: "active" });
          return prev;
        }
        return next;
      });
    },
  );

  useRealtimeSubscription({ table: "job_requests", event: "*" }, () => {
    if (!userId) {
      void queryClient.invalidateQueries({ queryKey: qk, refetchType: "active" });
    }
  });

  const authorProfile: ProfileSnippet = {
    id: user?.id ?? "",
    full_name: currentProfile?.full_name ?? null,
    photo_url: currentProfile?.photo_url ?? null,
  };

  const fetchPosts = useCallback(async (): Promise<FeedPost[]> => {
    try {
      const currentUserId = user?.id ?? null;
      // 0. Resolve author search if name provided
      let resolvedAuthorIds: string[] = [];
      if (authorNameFilter && authorNameFilter.trim().length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .ilike("full_name", `%${authorNameFilter.trim()}%`)
          .limit(10);
        if (profiles) resolvedAuthorIds = profiles.map((p) => p.id);
      }

      // 1. Optional: liked-only filter (per user)
      let likedPostIds: string[] | null = null;
      if (filterLikedByUserId) {
        const { data: likedRows, error: likedErr } = await supabase
          .from("profile_post_likes")
          .select("post_id, created_at")
          .eq("user_id", filterLikedByUserId)
          .order("created_at", { ascending: false })
          .limit(200);
        if (likedErr) throw likedErr;
        likedPostIds = (likedRows ?? []).map((r) => r.post_id as string);
        if (likedPostIds.length === 0) {
          return [];
        }
      }

      let commentedOwnPostIds: string[] | null = null;
      if (filterCommentedOwnPosts && currentUserId) {
        const { data: ownPosts, error: ownErr } = await supabase
          .from("profile_posts")
          .select("id")
          .eq("author_id", currentUserId);
        if (ownErr) throw ownErr;
        const ownIds = (ownPosts ?? []).map((p) => p.id as string);
        if (ownIds.length === 0) return [];

        const { data: commentRows, error: commentErr } = await supabase
          .from("profile_post_comments")
          .select("post_id")
          .in("post_id", ownIds);
        if (commentErr) throw commentErr;
        commentedOwnPostIds = [
          ...new Set((commentRows ?? []).map((r) => r.post_id as string)),
        ];
        if (commentedOwnPostIds.length === 0) return [];
      }

      let favoriteAuthorIds: string[] | null = null;
      if (advancedFilters?.favoriteProfilesOnly && currentUserId) {
        const { data: favRows, error: favErr } = await supabase
          .from("profile_favorites")
          .select("favorite_user_id")
          .eq("user_id", currentUserId);
        if (favErr) throw favErr;
        favoriteAuthorIds = (favRows ?? []).map((r) => r.favorite_user_id as string);
        if (favoriteAuthorIds.length === 0) return [];
      }

      const effectiveAuthorId =
        advancedFilters?.myPostsOnly && currentUserId
          ? currentUserId
          : filterAuthorId;

      if (filterAcceptedRequests) {
        if (!currentUserId) return [];

        let jobRequestRows = await fetchAcceptedJobRequestsForFeed(
          currentUserId,
          sortOrder,
        );

        if (effectiveAuthorId) {
          jobRequestRows = jobRequestRows.filter(
            (r) => r.client_id === effectiveAuthorId,
          );
        } else if (favoriteAuthorIds) {
          jobRequestRows = jobRequestRows.filter(
            (r) => r.client_id && favoriteAuthorIds.includes(r.client_id),
          );
        }

        if (advancedFilters) {
          jobRequestRows = jobRequestRows.filter((r) =>
            jobRequestMatchesFeedFilters(r, {
              when: advancedFilters.when,
              budgetMin: advancedFilters.budgetMin,
              budgetMax: advancedFilters.budgetMax,
            }),
          );
        }

        if (jobRequestRows.length === 0) return [];

        const profileIds = new Set<string>([currentUserId]);
        jobRequestRows.forEach((r) => {
          if (r.client_id) profileIds.add(r.client_id);
        });

        const idList = [...profileIds].slice(0, 200);
        const { data: profilesData, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, is_verified, telegram_username, role")
          .in("id", idList);
        if (profErr) throw profErr;

        const profileMap = new Map<string, ProfileSnippet>(
          (profilesData ?? []).map((p) => [p.id as string, p as ProfileSnippet]),
        );

        const jobRequestFeedRaw: JobRequestFeedPost[] = jobRequestRows.map((r) =>
          mapOpenHelpRequestToFeedPost(r, profileMap.get(r.client_id ?? "")),
        );
        const jobRequestEngagement = await fetchJobRequestEngagement(
          jobRequestFeedRaw.map((p) => p.id),
          currentUserId,
        );
        return applyJobRequestEngagement(jobRequestFeedRaw, jobRequestEngagement);
      }

      // 2. Fetch profile posts
      let query = supabase
        .from("profile_posts")
        .select("id, author_id, caption, media_type, storage_path, tagged_user_ids, created_at, post_type_id, post_metadata, custom_category, ai_generated_copy, post_types (id, name, emoji, color)");

      if (filterLikedByUserId && likedPostIds) {
        query = query.in("id", likedPostIds);
      } else if (commentedOwnPostIds) {
        query = query.in("id", commentedOwnPostIds);
      } else {
        let authorIds: string[] | null = null;
        if (userId) {
          authorIds = [userId];
        } else if (authorNameFilter && authorNameFilter.trim().length > 0) {
          if (resolvedAuthorIds.length === 0) return [];
          authorIds = resolvedAuthorIds;
        } else if (effectiveAuthorId && favoriteAuthorIds) {
          authorIds = favoriteAuthorIds.includes(effectiveAuthorId)
            ? [effectiveAuthorId]
            : [];
          if (authorIds.length === 0) return [];
        } else if (effectiveAuthorId) {
          authorIds = [effectiveAuthorId];
        } else if (favoriteAuthorIds) {
          authorIds = favoriteAuthorIds;
        }

        if (authorIds?.length === 1) {
          query = query.eq("author_id", authorIds[0]);
        } else if (authorIds && authorIds.length > 1) {
          query = query.in("author_id", authorIds);
        }
      }

      if (filterTaggedUserId) {
        query = query.contains("tagged_user_ids", [filterTaggedUserId]);
      }

      if (effectivePostTypeFilter?.length) {
        query = query.in("post_type_id", effectivePostTypeFilter);
      } else if (filterPostTypeId) {
        query = query.eq("post_type_id", filterPostTypeId);
      }

      const includesRequestHelp =
        !effectivePostTypeFilter?.length ||
        effectivePostTypeFilter.includes("request_help");
      const hasPostTypeFilter = Boolean(effectivePostTypeFilter?.length);

      const limitPosts = limit ?? (userId ? 50 : 100);
      const limitAvail = limit ?? (userId ? 20 : 50);
      const skipAvailability =
        Boolean(filterLikedByUserId) ||
        Boolean(filterCommentedOwnPosts) ||
        Boolean(advancedFilters?.myPostsOnly) ||
        Boolean(advancedFilters?.favoriteProfilesOnly) ||
        hasPostTypeFilter ||
        (Boolean(filterPostTypeId) && filterPostTypeId !== "request_help") ||
        (advancedFilters?.when !== "any" && !includesRequestHelp) ||
        (advancedFilters?.budgetMin != null && !includesRequestHelp) ||
        (advancedFilters?.budgetMax != null && !includesRequestHelp);

      const skipJobRequests =
        Boolean(userId) ||
        Boolean(filterLikedByUserId) ||
        Boolean(filterCommentedOwnPosts) ||
        Boolean(filterTaggedUserId) ||
        (hasPostTypeFilter && !includesRequestHelp) ||
        (Boolean(filterPostTypeId) &&
          filterPostTypeId !== "request_help" &&
          filterPostTypeId !== null);
      const profilePostsPromise = query
        .order("created_at", { ascending: sortOrder === "oldest" })
        .limit(limitPosts);

      const nowIso = new Date().toISOString();
      const availPromise = !skipAvailability
        ? (() => {
          let availQuery = supabase
            .from("community_posts")
            .select(
              "id, category, title, note, expires_at, availability_payload, created_at, author_id",
            )
            .eq("status", "active")
            .gt("expires_at", nowIso);
          if (userId) {
            availQuery = availQuery.eq("author_id", userId);
          } else if (filterAuthorId) {
            availQuery = availQuery.eq("author_id", filterAuthorId);
          } else if (authorNameFilter && authorNameFilter.trim().length > 0) {
            if (resolvedAuthorIds.length > 0) {
              availQuery = availQuery.in("author_id", resolvedAuthorIds);
            } else {
              availQuery = availQuery.eq(
                "author_id",
                "00000000-0000-0000-0000-000000000000",
              );
            }
          }
          return availQuery
            .order("created_at", { ascending: sortOrder === "oldest" })
            .limit(limitAvail);
        })()
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null });

      const jobRequestsPromise = !skipJobRequests
        ? supabase.rpc("get_discover_open_help_requests", { p_limit: limitPosts })
        : Promise.resolve({ data: [] as DiscoverOpenHelpRequestRow[], error: null });

      const [{ data: profilePostRows, error: ppErr }, availRes, jobRes] =
        await Promise.all([profilePostsPromise, availPromise, jobRequestsPromise]);

      if (ppErr) throw ppErr;
      if (availRes.error) throw availRes.error;
      if (jobRes.error) throw jobRes.error;
      const availRows = !skipAvailability ? (availRes.data ?? []) : [];
      let jobRequestRows = !skipJobRequests
        ? ((jobRes.data ?? []) as DiscoverOpenHelpRequestRow[]).filter((r) => {
            if (r.status == null || r.status === "") return true;
            return isJobOpenForDiscoverListing(String(r.status));
          })
        : [];

      if (currentUserId && hideOwnJobRequests) {
        jobRequestRows = jobRequestRows.filter(
          (r) =>
            !r.client_id ||
            r.client_id !== currentUserId ||
            r.id === normalizedFocusRequestId,
        );
      }

      if (advancedFilters?.myPostsOnly && currentUserId) {
        jobRequestRows = jobRequestRows.filter(
          (r) => r.client_id === currentUserId,
        );
      }

      if (effectiveAuthorId) {
        jobRequestRows = jobRequestRows.filter((r) => r.client_id === effectiveAuthorId);
      } else if (favoriteAuthorIds) {
        jobRequestRows = jobRequestRows.filter(
          (r) => r.client_id && favoriteAuthorIds.includes(r.client_id),
        );
      }

      if (advancedFilters) {
        jobRequestRows = jobRequestRows.filter((r) =>
          jobRequestMatchesFeedFilters(r, {
            when: advancedFilters.when,
            budgetMin: advancedFilters.budgetMin,
            budgetMax: advancedFilters.budgetMax,
          }),
        );
      }

      const rawPosts = (profilePostRows ?? []) as {
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        tagged_user_ids: string[];
        created_at: string;
        post_type_id?: string | null;
        post_types?: any | null;
        post_metadata?: any | null;
        custom_category?: string | null;
        ai_generated_copy?: unknown;
      }[];

      // Keep liked page order stable (by like time) when requested.
      if (filterLikedByUserId && likedPostIds) {
        const idx = new Map(likedPostIds.map((id, i) => [id, i]));
        rawPosts.sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
      }

      // 3. Collect all user IDs to resolve profiles
      const allTaggedIds = new Set<string>();
      rawPosts.forEach((p) => p.tagged_user_ids.forEach((id) => allTaggedIds.add(id)));

      const profileIds = new Set<string>();
      if (userId) profileIds.add(userId);
      if (currentUserId) profileIds.add(currentUserId);

      rawPosts.forEach((p) => profileIds.add(p.author_id));
      availRows.forEach((r) => profileIds.add(r.author_id as string));
      jobRequestRows.forEach((r) => {
        if (r.client_id) profileIds.add(r.client_id);
      });

      const idList = [...profileIds, ...allTaggedIds].slice(0, 200);
      const postIds = rawPosts.map((p) => p.id);
      const eventPostIds = rawPosts
        .filter((p) => p.post_type_id === "event")
        .map((p) => p.id);

      const [profRes, likedRes, engRes, shareRes, fpRes, eventHelperRes] =
        await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, photo_url, is_verified, telegram_username, role")
          .in("id", idList),
        currentUserId && postIds.length > 0
          ? supabase
            .from("profile_post_likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
        postIds.length > 0
          ? supabase.rpc("get_profile_post_engagement_counts", {
            p_post_ids: postIds,
          })
          : Promise.resolve({
            data: [] as {
              post_id: string;
              like_count: number | string;
              comment_count: number | string;
            }[],
            error: null,
          }),
        postIds.length > 0
          ? supabase.rpc("get_profile_post_share_stats", { p_post_ids: postIds })
          : Promise.resolve({ data: [] as unknown[], error: null }),
        idList.length > 0
          ? supabase.from("freelancer_profiles").select("user_id, live_until").in("user_id", idList)
          : Promise.resolve({
            data: [] as { user_id: string; live_until: string | null }[],
            error: null,
          }),
        eventPostIds.length > 0
          ? fetchEventPostHelperCounts(supabase, eventPostIds)
          : Promise.resolve(new Map()),
      ]);

      if (fpRes.error) {
        console.warn("[ProfilePostsFeed] freelancer_profiles live_until:", fpRes.error);
      }

      const liveUntilByUser = new Map<string, string | null>();
      for (const row of fpRes.data ?? []) {
        liveUntilByUser.set(row.user_id as string, (row as { live_until: string | null }).live_until);
      }

      const profilesData = profRes.data;
      const profileMap = new Map<string, ProfileSnippet>(
        (profilesData ?? []).map((p) => {
          const id = p.id as string;
          const snippet: ProfileSnippet = {
            ...(p as ProfileSnippet),
            live_until: liveUntilByUser.get(id) ?? null,
          };
          return [id, snippet];
        }),
      );

      const myLikedPostIds = new Set<string>(
        (likedRes.data ?? []).map((r) => r.post_id as string),
      );

      const likeCountMap = new Map<string, number>();
      const commentCountMap = new Map<string, number>();
      if (engRes.error) {
        console.warn(
          "[ProfilePostsFeed] get_profile_post_engagement_counts",
          engRes.error,
        );
      } else {
        for (const row of engRes.data ?? []) {
          const r = row as {
            post_id: string;
            like_count: number | string;
            comment_count: number | string;
          };
          likeCountMap.set(r.post_id, Number(r.like_count));
          commentCountMap.set(r.post_id, Number(r.comment_count));
        }
      }

      const shareStatsMap = new Map<
        string,
        { click: number; distinct: number }
      >();
      if (shareRes.error) {
        console.warn("[ProfilePostsFeed] get_profile_post_share_stats", shareRes.error);
      } else {
        for (const row of shareRes.data ?? []) {
          const r = row as {
            post_id: string;
            click_count: number | string;
            distinct_user_count: number | string;
          };
          shareStatsMap.set(r.post_id, {
            click: Number(r.click_count),
            distinct: Number(r.distinct_user_count),
          });
        }
      }

      const eventHelperCountMap =
        eventHelperRes instanceof Map
          ? eventHelperRes
          : new Map<string, { accepted_count: number }>();

      // 7. Build profile posts
      const profilePostsFeed: ProfilePost[] = rawPosts.map((p) => ({
        id: p.id,
        author_id: p.author_id,
        caption: p.caption,
        media_type: p.media_type,
        storage_path: p.storage_path,
        tagged_user_ids: p.tagged_user_ids,
        created_at: p.created_at,
        author: profileMap.get(p.author_id),
        like_count: likeCountMap.get(p.id) ?? 0,
        comment_count: commentCountMap.get(p.id) ?? 0,
        share_click_count: shareStatsMap.get(p.id)?.click ?? 0,
        share_distinct_user_count: shareStatsMap.get(p.id)?.distinct ?? 0,
        liked_by_me: myLikedPostIds.has(p.id),
        tagged_profiles: p.tagged_user_ids
          .map((id) => profileMap.get(id))
          .filter(Boolean) as ProfileSnippet[],
        source: "post",
        post_type_id: p.post_type_id,
        post_types: Array.isArray(p.post_types) ? p.post_types[0] : (p.post_types || null),
        post_metadata: mergeProfilePostMetadata(
          p.post_metadata as Record<string, unknown> | null | undefined,
          p.custom_category,
        ),
        ai_generated_copy: parseGeneratedPostCopy(p.ai_generated_copy),
        event_accepted_helpers_count:
          p.post_type_id === "event"
            ? (eventHelperCountMap.get(p.id)?.accepted_count ?? 0)
            : undefined,
      }));

      const filteredProfilePosts = advancedFilters
        ? profilePostsFeed.filter((p) =>
            postMatchesAdvancedFeedFilters(p, advancedFilters),
          )
        : profilePostsFeed;

      // 8. Build availability posts (merged as regular posts)
      const availFeed: AvailabilityPost[] = (availRows ?? []).map((r) => ({
        id: r.id as string,
        author_id: r.author_id as string,
        caption: (r.note as string | null) ?? (r.title as string | null),
        media_type: null,
        storage_path: null,
        tagged_user_ids: [],
        created_at: r.created_at as string,
        author: profileMap.get(r.author_id as string),
        like_count: 0,
        comment_count: 0,
        share_click_count: 0,
        share_distinct_user_count: 0,
        liked_by_me: false,
        tagged_profiles: [],
        source: "availability",
        category: r.category as string,
        availability_payload: (r.availability_payload as AvailabilityPayload | null) ?? null,
      }));

      // 9. Merge job requests (create-flow open help) into global feed
      const jobRequestFeedRaw: JobRequestFeedPost[] = jobRequestRows.map((r) =>
        mapOpenHelpRequestToFeedPost(r, profileMap.get(r.client_id ?? "")),
      );
      const jobRequestEngagement = await fetchJobRequestEngagement(
        jobRequestFeedRaw.map((p) => p.id),
        currentUserId,
      );
      const jobRequestFeed = applyJobRequestEngagement(
        jobRequestFeedRaw,
        jobRequestEngagement,
      );

      // 10. Merge and sort by created_at
      let merged: FeedPost[] = [...filteredProfilePosts, ...availFeed, ...jobRequestFeed].sort(
        (a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return sortOrder === "oldest" ? timeA - timeB : timeB - timeA;
        }
      );

      if (effectivePostTypeFilter?.length) {
        merged = merged.filter((post) => {
          if (post.source === "job_request") {
            return effectivePostTypeFilter.includes("request_help");
          }
          if (post.source === "availability") return false;
          if (post.source === "post") {
            const typeId = post.post_type_id ?? post.post_types?.id ?? null;
            return typeId != null && effectivePostTypeFilter.includes(typeId);
          }
          return false;
        });
      }

      if (limit != null) {
        merged = merged.slice(0, limit);
      }

      return merged;
    } catch (e) {
      console.error("[ProfilePostsFeed] fetchPosts", e);
      return [];
    }
  }, [
    userId,
    user?.id,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    filterLikedByUserId,
    filterPostTypeId,
    effectivePostTypeFilter,
    filterCommentedOwnPosts,
    filterAcceptedRequests,
    advancedFilters,
    limit,
    hideOwnJobRequests,
    normalizedFocusRequestId,
  ]);

  const { data: posts = [], isPending } = useQuery({
    queryKey: qk,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    queryFn: fetchPosts,
  });

  const focusedPostQueryKey = useMemo(
    () => queryKeys.profilePostById(normalizedFocusPostId, user?.id),
    [normalizedFocusPostId, user?.id],
  );

  const {
    data: focusedPost,
    isFetching: focusedPostFetching,
  } = useQuery({
    queryKey: focusedPostQueryKey,
    enabled: Boolean(normalizedFocusPostId),
    staleTime: 60_000,
    queryFn: () =>
      fetchProfilePostById(normalizedFocusPostId!, user?.id ?? null),
  });

  const allowRequestDeepLink =
    Boolean(normalizedFocusRequestId) &&
    (!effectivePostTypeFilter?.length ||
      effectivePostTypeFilter.includes("request_help")) &&
    (!filterPostTypeId || filterPostTypeId === "request_help") &&
    !filterAcceptedRequests;

  const allowPostDeepLink =
    Boolean(normalizedFocusPostId) && !filterAcceptedRequests;

  const handleSidePanelPostOpen = useCallback(
    (postId: string) => {
      if (onSidePanelPostOpen) {
        onSidePanelPostOpen(postId);
        return;
      }
      scrollToProfilePostWhenReady(postId, {
        topInset: appearance === "discover" ? 96 : 12,
      });
    },
    [appearance, onSidePanelPostOpen],
  );

  const {
    data: focusedRequest,
    isFetching: focusedRequestFetching,
  } = useQuery({
    queryKey: queryKeys.jobRequestById(normalizedFocusRequestId, user?.id),
    enabled: allowRequestDeepLink,
    staleTime: 60_000,
    queryFn: () =>
      fetchJobRequestForFeedById(normalizedFocusRequestId!, user?.id ?? null),
  });

  const isFocusedFeedItem = useCallback(
    (post: FeedPost) => {
      if (
        allowPostDeepLink &&
        normalizedFocusPostId &&
        post.id === normalizedFocusPostId &&
        post.source === "post"
      ) {
        return true;
      }
      if (
        allowRequestDeepLink &&
        normalizedFocusRequestId &&
        post.id === normalizedFocusRequestId &&
        post.source === "job_request"
      ) {
        return true;
      }
      return false;
    },
    [
      allowPostDeepLink,
      allowRequestDeepLink,
      normalizedFocusPostId,
      normalizedFocusRequestId,
    ],
  );

  const displayPosts = useMemo(() => {
    let result = posts;

    if (allowPostDeepLink && normalizedFocusPostId) {
      const inFeed = result.find(
        (p) => p.id === normalizedFocusPostId && p.source === "post",
      );
      const focusedCandidate =
        focusedPost?.id === normalizedFocusPostId ? focusedPost : null;
      const match = inFeed ?? focusedCandidate;
      if (match) {
        result = [
          match,
          ...result.filter(
            (p) => !(p.id === normalizedFocusPostId && p.source === "post"),
          ),
        ];
        debugProfilePostDeepLink("displayPosts: pinned shared post", {
          focusPostId: normalizedFocusPostId,
          matchSource: inFeed ? "feed" : "focusedPostQuery",
          displayCount: result.length,
          firstPostId: result[0]?.id ?? null,
        });
      }
    }

    if (allowRequestDeepLink && normalizedFocusRequestId) {
      const match =
        result.find(
          (p) =>
            p.id === normalizedFocusRequestId && p.source === "job_request",
        ) ??
        (focusedRequest?.id === normalizedFocusRequestId ? focusedRequest : null);
      if (match) {
        result = [
          match,
          ...result.filter(
            (p) =>
              !(
                p.id === normalizedFocusRequestId && p.source === "job_request"
              ),
          ),
        ];
      }
    }

    return result;
  }, [
    posts,
    focusedPost,
    focusedRequest,
    normalizedFocusPostId,
    normalizedFocusRequestId,
    allowPostDeepLink,
    allowRequestDeepLink,
    filterPostTypeId,
    effectivePostTypeFilter,
  ]);

  /** Deep link from shared URLs: scroll the matching post into view. */
  useEffect(() => {
    if (!allowPostDeepLink || !normalizedFocusPostId) {
      deepLinkHandledRef.current = null;
      return;
    }

    debugProfilePostDeepLink("deepLink effect: tick", {
      focusPostId: normalizedFocusPostId,
      isPending,
      focusedPostFetching,
      postsCount: posts.length,
      displayPostsCount: displayPosts.length,
      displayFirstId: displayPosts[0]?.id ?? null,
      focusedPostLoaded: Boolean(focusedPost),
      focusedPostId: focusedPost?.id ?? null,
      alreadyHandled: deepLinkHandledRef.current === normalizedFocusPostId,
      feedHasFocusId: posts.some((p) => p.id === normalizedFocusPostId),
    });

    if (isPending) {
      debugProfilePostDeepLink("deepLink effect: wait — feed loading");
      return;
    }

    const post = displayPosts.find(
      (p) => p.id === normalizedFocusPostId && p.source === "post",
    );
    if (!post) {
      if (focusedPostFetching) {
        debugProfilePostDeepLink("deepLink effect: wait — focusedPost query");
        return;
      }
      warnProfilePostDeepLink("deepLink effect: post not in displayPosts", {
        focusPostId: normalizedFocusPostId,
        feedPostIds: posts.map((p) => `${p.id}:${p.source}`).slice(0, 12),
        focusedPostId: focusedPost?.id ?? null,
      });
      return;
    }
    if (deepLinkHandledRef.current === normalizedFocusPostId) {
      debugProfilePostDeepLink("deepLink effect: skip — already handled");
      return;
    }

    debugProfilePostDeepLink("deepLink effect: start scroll", {
      focusPostId: normalizedFocusPostId,
      topInset: appearance === "discover" ? 96 : 12,
      hasMedia: Boolean(post.media_type && post.storage_path),
    });

    const cancelScroll = scrollToProfilePostWhenReady(
      normalizedFocusPostId,
      {
        topInset: appearance === "discover" ? 96 : 12,
        onDone: (found) => {
          debugProfilePostDeepLink("deepLink effect: scroll finished", {
            focusPostId: normalizedFocusPostId,
            found,
          });
          if (found) {
            deepLinkHandledRef.current = normalizedFocusPostId;
          } else {
            warnProfilePostDeepLink("deepLink effect: scroll failed", {
              focusPostId: normalizedFocusPostId,
            });
          }
        },
      },
    );

    return cancelScroll;
  }, [
    allowPostDeepLink,
    normalizedFocusPostId,
    isPending,
    focusedPostFetching,
    displayPosts,
    posts,
    focusedPost,
    appearance,
  ]);

  /** Deep link from shared request URLs: scroll the matching request into view. */
  useEffect(() => {
    if (!allowRequestDeepLink || !normalizedFocusRequestId) {
      requestDeepLinkHandledRef.current = null;
      return;
    }

    if (isPending) return;

    const item = displayPosts.find(
      (p) => p.id === normalizedFocusRequestId && p.source === "job_request",
    );
    if (!item) {
      if (focusedRequestFetching) return;
      return;
    }
    if (requestDeepLinkHandledRef.current === normalizedFocusRequestId) return;

    const cancelScroll = scrollToFeedItemWhenReady(
      normalizedFocusRequestId,
      "job_request",
      {
        topInset: appearance === "discover" ? 96 : 12,
        onDone: (found) => {
          if (found) {
            requestDeepLinkHandledRef.current = normalizedFocusRequestId;
          }
        },
      },
    );

    return cancelScroll;
  }, [
    allowRequestDeepLink,
    normalizedFocusRequestId,
    isPending,
    focusedRequestFetching,
    displayPosts,
    appearance,
  ]);

  /** Scroll to a post after navigating from Discover home (no pin-to-top). */
  useEffect(() => {
    if (!normalizedScrollToPostId) {
      scrollToPostHandledRef.current = null;
      return;
    }
    if (isPending) return;
    if (scrollToPostHandledRef.current === normalizedScrollToPostId) return;

    const cancelScroll = scrollToProfilePostWhenReady(normalizedScrollToPostId, {
      topInset: appearance === "discover" ? 96 : 12,
      onDone: (found) => {
        if (found) {
          scrollToPostHandledRef.current = normalizedScrollToPostId;
          onScrollToPostDone?.();
        }
      },
    });

    return cancelScroll;
  }, [
    normalizedScrollToPostId,
    isPending,
    posts,
    appearance,
    onScrollToPostDone,
  ]);

  function handleLikeToggle(postId: string, newLiked: boolean) {
    queryClient.setQueryData<FeedPost[]>(qk, (prev) =>
      prev?.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: newLiked,
              like_count: Math.max(0, p.like_count + (newLiked ? 1 : -1)),
            }
          : p,
      ),
    );
  }

  function handleDeleted(postId: string) {
    queryClient.setQueryData<FeedPost[]>(qk, (prev) => prev?.filter((p) => p.id !== postId));
  }

  const refreshPostShareStats = useCallback(
    async (postId: string, source: FeedPost["source"] = "post") => {
      if (source === "job_request") {
        const engagement = await fetchJobRequestEngagement(
          [postId],
          user?.id ?? null,
        );
        const stats = engagement.get(postId);
        if (!stats) return;
        queryClient.setQueryData<FeedPost[]>(qk, (prev) =>
          prev?.map((p) =>
            p.id === postId && p.source === "job_request"
              ? { ...p, share_click_count: stats.share_click_count }
              : p,
          ),
        );
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_profile_post_share_stats",
        { p_post_ids: [postId] },
      );
      if (error) {
        console.error("[ProfilePostsFeed] refreshPostShareStats", error);
        return;
      }
      const row = (data ?? [])[0] as
        | {
          post_id: string;
          click_count: number | string;
          distinct_user_count: number | string;
        }
        | undefined;
      const click = Number(row?.click_count ?? 0);
      const distinct = Number(row?.distinct_user_count ?? 0);
      queryClient.setQueryData<FeedPost[]>(qk, (prev) =>
        prev?.map((p) =>
          p.id === postId && p.source === "post"
            ? { ...p, share_click_count: click, share_distinct_user_count: distinct }
            : p,
        ),
      );
    },
    [user?.id, queryClient, qk],
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-8 md:gap-7">
        {[1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "animate-pulse space-y-4 border-0 p-4",
              appearance === "discover"
                ? "rounded-none bg-transparent shadow-none dark:bg-transparent"
                : "rounded-none bg-white shadow-none dark:bg-zinc-950/20 md:rounded-2xl md:shadow-md",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-white/5" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-24 bg-slate-100 dark:bg-white/5 rounded" />
                <div className="h-2 w-16 bg-slate-50 dark:bg-white/5 rounded" />
              </div>
            </div>
            <div
              className={cn(
                "w-full rounded-xl bg-slate-50 dark:bg-white/5",
                appearance === "discover"
                  ? "max-md:h-[min(74dvh,42rem)] md:h-[min(62vh,36rem)]"
                  : appearance === "profile"
                    ? "max-md:h-[min(74dvh,40rem)] md:h-[min(68vh,40rem)]"
                    : "max-md:h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))] md:h-[min(78vh,46rem)]",
              )}
            />
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-50 dark:bg-white/5 rounded" />
              <div className="h-3 w-2/3 bg-slate-50 dark:bg-white/5 rounded" />
            </div>
            <div className="flex gap-4 pt-2">
              <div className="h-4 w-4 bg-slate-50 dark:bg-white/5 rounded" />
              <div className="h-4 w-4 bg-slate-50 dark:bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-7 md:space-y-8", globalFeedLayout && "space-y-4 max-md:pb-[110px] md:space-y-5")}>
      {/* Compose button — own profile only */}
      {isOwnProfile && (
        <div>
          <button
            type="button"
            onClick={openCompose}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-orange-300 dark:border-orange-800/60 bg-orange-50/60 dark:bg-orange-950/20 px-4 py-3.5 text-left transition-colors hover:bg-orange-100/60 dark:hover:bg-orange-950/40 group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-900 transition-colors">
              <Plus className="h-5 w-5 text-orange-600 dark:text-orange-400" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              Share something with your followers…
            </span>
          </button>
        </div>
      )}

      {/* Feed */}
      {displayPosts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <LayoutGrid
            className="h-10 w-10 text-slate-300 dark:text-slate-600"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {userId
              ? isOwnProfile ? "You haven't posted anything yet." : "No posts yet."
              : "The community feed is quiet right now. Check back later!"}
          </p>
          {isOwnProfile && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={openCompose}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create first post
            </Button>
          )}
        </div>
      ) : appearance === "discover" && discoverSidePanel === "favorites" ? (
        // Two-column layout for the whole feed: posts stack on the left,
        // sidebar spans the full feed height on the right (no extra gaps
        // between posts when the sidebar is long).
        <div className="md:flex md:items-start md:justify-start md:gap-5 md:pr-2 lg:gap-8 lg:pr-4 xl:gap-10 xl:pr-8">
          <div className="min-w-0 space-y-7 md:flex-1 md:space-y-8">
            {displayPosts.map((post) => (
              <FeedPostItem
                key={post.id}
                post={post}
                currentUserId={user?.id ?? null}
                onLikeToggle={handleLikeToggle}
                isOwnFeed={isOwnProfile}
                onDeleted={handleDeleted}
                globalVideoUnmuted={globalVideoUnmuted}
                onGlobalVideoUnmutedChange={setGlobalVideoUnmuted}
                refreshPostShareStats={refreshPostShareStats}
                onOpenMediaReels={setReelsOpenPostId}
                hidePostLikeButton={Boolean(filterLikedByUserId)}
                appearance={appearance}
                isFocused={isFocusedFeedItem(post)}
                plainCard={plainCards}
                globalFeedLayout={globalFeedLayout}
                viewerLocation={viewerLocation}
              />
            ))}
          </div>
          <FavoritesPostsSidePanel
            postTypeIds={resolvedSidePanelPostTypeIds}
            fixed={fixedFavoritesSidePanel}
            onPostOpen={handleSidePanelPostOpen}
          />
        </div>
      ) : (
        displayPosts.map((post) => {
          const isDiscover = appearance === "discover";
          const isProfilePost = post.source === "post";
          const isJobRequestPost = post.source === "job_request";
          const shouldShowComments = isDiscover && (isProfilePost || isJobRequestPost);
          const authorName = post.author?.full_name?.trim()
            ? post.author.full_name.trim()
            : "Member";

          if (!shouldShowComments) {
            return (
              <FeedPostItem
                key={post.id}
                post={post}
                currentUserId={user?.id ?? null}
                onLikeToggle={handleLikeToggle}
                isOwnFeed={isOwnProfile}
                onDeleted={handleDeleted}
                globalVideoUnmuted={globalVideoUnmuted}
                onGlobalVideoUnmutedChange={setGlobalVideoUnmuted}
                refreshPostShareStats={refreshPostShareStats}
                onOpenMediaReels={setReelsOpenPostId}
                hidePostLikeButton={Boolean(filterLikedByUserId)}
                appearance={appearance}
                isFocused={isFocusedFeedItem(post)}
                discoverWideLayout={expandDiscoverLayout}
                plainCard={plainCards}
                globalFeedLayout={globalFeedLayout}
                viewerLocation={viewerLocation}
              />
            );
          }

          return (
            <div
              key={post.id}
              className={cn(
                "md:flex md:items-start md:justify-start",
                expandDiscoverLayout ? "md:gap-6 lg:gap-8 xl:gap-10" : "md:gap-10 md:pr-4 lg:pr-8",
              )}
            >
              <div className="min-w-0 md:flex-1">
                <FeedPostItem
                  post={post}
                  currentUserId={user?.id ?? null}
                  onLikeToggle={handleLikeToggle}
                  isOwnFeed={isOwnProfile}
                  onDeleted={handleDeleted}
                  globalVideoUnmuted={globalVideoUnmuted}
                  onGlobalVideoUnmutedChange={setGlobalVideoUnmuted}
                  refreshPostShareStats={refreshPostShareStats}
                  onOpenMediaReels={setReelsOpenPostId}
                  hidePostLikeButton={Boolean(filterLikedByUserId)}
                  appearance={appearance}
                  isFocused={isFocusedFeedItem(post)}
                  discoverWideLayout={expandDiscoverLayout}
                  plainCard={plainCards}
                  globalFeedLayout={globalFeedLayout}
                  viewerLocation={viewerLocation}
                />
              </div>

              {isJobRequestPost ? (
                <JobRequestCommentsSidePanel
                  jobId={post.id}
                  user={user ?? null}
                  authorName={authorName}
                  initialCount={post.comment_count}
                  wideLayout={expandDiscoverLayout}
                />
              ) : (
                <CommentsSidePanel
                  postId={post.id}
                  authorName={authorName}
                  initialCount={post.comment_count}
                  wideLayout={expandDiscoverLayout}
                />
              )}
            </div>
          );
        })
      )}

      {reelsOpenPostId !== null ? (
        <PostMediaReelsViewer
          key={`reels-${reelsOpenPostId}`}
          open
          posts={displayPosts as unknown as ReelFeedPost[]}
          initialPostId={reelsOpenPostId}
          onClose={() => setReelsOpenPostId(null)}
          currentUserId={user?.id ?? null}
          onLikeToggle={handleLikeToggle}
          onRefreshShareStats={refreshPostShareStats}
          onOpenComments={(postId) => setReelCommentsPostId(postId)}
          hideLikeButton={Boolean(filterLikedByUserId)}
        />
      ) : null}

      <CommentsDialog
        postId={reelCommentsPostId ?? ""}
        open={reelCommentsPostId !== null}
        onClose={() => setReelCommentsPostId(null)}
      />

      {/* Compose modal */}
      {isOwnProfile && user && (
        <ComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          onPosted={() => void fetchPosts()}
          authorProfile={authorProfile}
        />
      )}
    </div>
  );
}
