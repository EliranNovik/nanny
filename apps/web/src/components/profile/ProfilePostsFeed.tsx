import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/data/keys";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  MessageCircle,
  Send,
  Plus,
  X,
  Image as ImageIcon,
  Loader2,
  AtSign,
  Trash2,
  LayoutGrid,
  Sparkles,
  BadgeCheck,
  VolumeX,
  Volume2,
  Bookmark,
  ChevronUp,
  ChevronDown,
  ListChecks,
  FileText,
  Megaphone,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PUBLIC_PROFILE_MEDIA_BUCKET,
  publicProfileMediaPublicUrl,
} from "@/lib/publicProfileMedia";
import type { AvailabilityPayload } from "@/lib/availabilityPosts";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { FavoritesPostsSidePanel } from "@/components/discover/FavoritesPostsSidePanel";
import {
  PostMediaReelsViewer,
  type ReelFeedPost,
} from "@/components/profile/PostMediaReelsViewer";
import { PostMediaDesktopViewer } from "@/components/profile/PostMediaDesktopViewer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  is_verified?: boolean | null;
  /** Active 24h go-live window end (from `freelancer_profiles`), if any. */
  live_until?: string | null;
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

export type FeedPost = ProfilePost | AvailabilityPost;

export type PostComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author?: ProfileSnippet;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function categoryLabel(cat: string): string {
  return isServiceCategoryId(cat)
    ? serviceCategoryLabel(cat as ServiceCategoryId)
    : cat.replace(/_/g, " ");
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

function CommentsDialog({
  postId,
  caption,
  authorName,
  authorPhotoUrl,
  open,
  onClose,
}: {
  postId: string;
  caption?: React.ReactNode;
  authorName?: string;
  authorPhotoUrl?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (!body || !user?.id) return;
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          // Desktop / large screens: centered modal
          "sm:max-w-md sm:rounded-2xl sm:max-h-[min(90vh,580px)]",
          // Mobile: bottom sheet
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto",
          "max-md:h-[78vh] max-md:max-h-[78vh]",
          "max-md:translate-x-0 max-md:translate-y-0",
          "max-md:rounded-t-[22px] max-md:rounded-b-none",
        )}
      >
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <MessageCircle className="h-5 w-5 text-orange-500" strokeWidth={2} />
            Comments
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5">
          <div className="space-y-5 py-4">
            {caption ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    Post
                  </div>
                  {authorName ? (
                    <div className="inline-flex items-center gap-2">
                      <Avatar className="h-6 w-6 ring-1 ring-border/50">
                        <AvatarImage src={authorPhotoUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] font-black">
                          {authorName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-xs font-bold text-foreground/80">
                        Written by {authorName}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                  {caption}
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No comments yet. Be the first!
              </p>
            ) : (
              comments.map((c) => {
                const name = c.author?.full_name?.trim() || "Member";
                return (
                  <div key={c.id} className="flex gap-3">
                    <Link
                      to={c.author?.id ? `/profile/${c.author.id}` : "#"}
                      className={cn(
                        "shrink-0 rounded-full outline-none transition-opacity",
                        c.author?.id
                          ? "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          : "pointer-events-none opacity-60",
                      )}
                      aria-label={c.author?.id ? `View ${name} profile` : undefined}
                      onClick={() => {
                        // Close sheet on navigation for a smoother mobile flow.
                        onClose();
                      }}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.author?.photo_url ?? undefined} />
                        <AvatarFallback className="text-xs font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-foreground">{name}</span>
                        <time className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </time>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
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

        <div className="border-t border-border/60 bg-muted/30 px-4 py-3">
          {user ? (
            <div className="flex items-end gap-2">
              <Textarea
                placeholder="Write a comment…"
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
                className="min-h-[2.5rem] flex-1 resize-none bg-background text-sm"
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
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-semibold text-orange-600 underline underline-offset-2">
                Sign in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentsSidePanel({
  postId,
  caption,
  authorName,
  authorPhotoUrl,
  initialCount,
}: {
  postId: string;
  caption?: React.ReactNode;
  authorName?: string;
  authorPhotoUrl?: string | null;
  initialCount?: number | null;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState<number | null>(
    typeof initialCount === "number" ? initialCount : null,
  );

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
    if (!body || !user?.id) return;
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
    <aside className="hidden md:flex w-[380px] lg:w-[460px] xl:w-[520px] 2xl:w-[600px] flex-col">
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-base font-black text-foreground">
              {count == null ? "Comments" : `${count} Comments`}
            </div>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {authorName ? `on ${authorName}'s post` : " "}
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
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-1 pb-5">
          {caption ? (
            <div className="pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={authorPhotoUrl ?? undefined} />
                  <AvatarFallback className="text-xs font-bold">
                    {(authorName ?? "M").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">
                    {authorName ?? "Member"}
                  </div>
                  <div className="truncate text-xs font-semibold text-muted-foreground">
                    Post caption
                  </div>
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {caption}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {comments.map((c) => {
                const name = c.author?.full_name?.trim() || "Member";
                return (
                  <div key={c.id} className="flex gap-3 py-4">
                  <Link
                    to={c.author?.id ? `/profile/${c.author.id}` : "#"}
                    className={cn(
                      "shrink-0 rounded-full outline-none transition-opacity",
                      c.author?.id
                        ? "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        : "pointer-events-none opacity-60",
                    )}
                    aria-label={
                      c.author?.id ? `View ${name} profile` : undefined
                    }
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.author?.photo_url ?? undefined} />
                      <AvatarFallback className="text-xs font-bold">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-bold text-foreground">
                        {name}
                      </span>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
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
              placeholder="Write a comment…"
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
              className="min-h-[2.5rem] flex-1 resize-none bg-muted/30 text-sm rounded-2xl border border-border/60 px-4 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
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
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="font-semibold text-orange-600 underline underline-offset-2"
            >
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}
      </div>
    </aside>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────

export function ComposeModal({
  open,
  onClose,
  onPosted,
  authorProfile,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  authorProfile: ProfileSnippet;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<ProfileSnippet[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<ProfileSnippet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /** Bottom "Add to your post" tray — expanded shows the full action grid; collapsed shows a thin icon row. */
  const [addToPostExpanded, setAddToPostExpanded] = useState(true);
  /** True from the moment a file is picked until the <img>/<video> finishes loading the local blob URL. */
  const [mediaLoading, setMediaLoading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaPreviewRef = useRef<HTMLDivElement>(null);
  const tagTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagBoxRef = useRef<HTMLDivElement>(null);

  /** Whenever new media is added, smoothly scroll the preview into view so it's immediately visible. */
  useEffect(() => {
    if (!mediaPreview) return;
    const t = window.setTimeout(() => {
      mediaPreviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [mediaPreview]);

  function reset() {
    setCaption("");
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
    setMediaLoading(false);
    setTagQuery("");
    setTagResults([]);
    setTaggedUsers([]);
    setAddToPostExpanded(true);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleMedia(file: File, kind: "image" | "video") {
    setMediaFile(file);
    setMediaKind(kind);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
    // Show a skeleton until the <img>/<video> reports it's done loading the local blob.
    setMediaLoading(true);
    // Auto-collapse the bottom tray so the freshly added preview is immediately visible.
    setAddToPostExpanded(false);
  }

  /** Single-input picker that auto-detects whether the file is an image or video (combined Photo/Video button). */
  function handlePhotoVideoPick(file: File) {
    const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    handleMedia(file, kind);
  }

  /** Stub for not-yet-implemented post types (Gif, Poll, Adoption, Lost Notice, Event). */
  function comingSoon(label: string) {
    addToast({
      title: `${label} coming soon`,
      description: "We're working on this — stay tuned!",
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
    if (!caption.trim() && !mediaFile) {
      addToast({ title: "Add a caption or media", variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      let storagePath: string | null = null;

      if (mediaFile && mediaKind) {
        const ext = mediaFile.name.split(".").pop()?.toLowerCase() ?? (mediaKind === "image" ? "jpg" : "mp4");
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PUBLIC_PROFILE_MEDIA_BUCKET)
          .upload(path, mediaFile, { upsert: false, contentType: mediaFile.type || undefined });
        if (upErr) throw upErr;
        storagePath = path;
      }

      const { error } = await supabase.from("profile_posts").insert({
        author_id: user.id,
        caption: caption.trim() || null,
        media_type: mediaKind ?? null,
        storage_path: storagePath,
        tagged_user_ids: taggedUsers.map((u) => u.id),
      });
      if (error) throw error;

      addToast({ title: "Post shared!", variant: "success" });
      reset();
      onPosted();
      onClose();
    } catch (e) {
      console.error("[ComposeModal] submit", e);
      addToast({ title: "Could not post", description: e instanceof Error ? e.message : "Try again.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          // Desktop / large screens: centered modal
          "sm:max-w-lg sm:rounded-2xl sm:max-h-[min(92vh,720px)]",
          // Mobile: bottom sheet
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto",
          "max-md:h-[92vh] max-md:max-h-[92vh]",
          "max-md:translate-x-0 max-md:translate-y-0",
          "max-md:rounded-t-[22px] max-md:rounded-b-none",
        )}
      >
        {/* Custom header — X (left), "Create Post" (center), Post button (right) */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-3 sm:px-4">
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
            disabled={submitting || (!caption.trim() && !mediaFile)}
            className={cn(
              "h-9 min-w-[72px] rounded-full px-4 text-sm font-bold transition-all",
              submitting || (!caption.trim() && !mediaFile)
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

        <ScrollArea className="flex-1">
          <div className="space-y-3 px-5 py-4">
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

            {/* Caption */}
            <Textarea
              placeholder="What do you want to talk about?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={2200}
              rows={4}
              className="resize-none bg-transparent border-none shadow-none focus-visible:ring-0 text-[15px] p-0 placeholder:text-muted-foreground/60"
              disabled={submitting}
            />

            {/* Media preview — shown immediately as media is added; skeleton overlays it until the file finishes loading */}
            {mediaPreview && (
              <div
                ref={mediaPreviewRef}
                className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-border/40 shadow-sm animate-in fade-in zoom-in-95 duration-200"
              >
                {mediaKind === "image" ? (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className={cn(
                      "w-full max-h-[22rem] object-cover transition-opacity duration-200",
                      mediaLoading ? "opacity-0" : "opacity-100",
                    )}
                    onLoad={() => setMediaLoading(false)}
                    onError={() => setMediaLoading(false)}
                  />
                ) : (
                  <video
                    src={mediaPreview}
                    controls
                    playsInline
                    autoPlay
                    muted
                    className={cn(
                      "w-full max-h-[22rem] bg-black transition-opacity duration-200",
                      mediaLoading ? "opacity-0" : "opacity-100",
                    )}
                    onLoadedData={() => setMediaLoading(false)}
                    onError={() => setMediaLoading(false)}
                  />
                )}

                {/* Loading skeleton — overlays the preview until the file finishes loading */}
                {mediaLoading ? (
                  <div
                    className="absolute inset-0 flex h-full min-h-[14rem] w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800"
                    aria-busy="true"
                    aria-label={`Loading ${mediaKind === "image" ? "photo" : "video"}`}
                  >
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
                    <div className="relative flex flex-col items-center gap-2.5">
                      <Loader2 className="h-7 w-7 animate-spin text-orange-500" strokeWidth={2.5} />
                      <span className="text-[12px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                        {mediaKind === "image" ? "Loading photo…" : "Loading video…"}
                      </span>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                    setMediaKind(null);
                    setMediaLoading(false);
                  }}
                  className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/80 active:scale-95"
                  aria-label="Remove media"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
                {!mediaLoading ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md backdrop-blur-md">
                    {mediaKind === "image" ? "Photo" : "Video"}
                  </span>
                ) : null}
              </div>
            )}

            {/* Tag users */}
            <div className="space-y-2">
              <div ref={tagBoxRef} className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tag someone…"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  onBlur={() => {
                    // Allow click on dropdown items before closing.
                    window.setTimeout(() => setTagResults([]), 120);
                  }}
                  className="w-full h-10 rounded-full border border-input bg-muted/40 pl-9 pr-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:bg-zinc-800/60"
                  disabled={submitting}
                />

                {/* Tag results dropdown — opens upward to avoid clipping at modal bottom */}
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

              {/* Tagged users chips */}
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
          </div>
        </ScrollArea>

        {/* "Add to your post" tray — single combined Photo/Video picker + extra options */}
        <div className="shrink-0 border-t border-border/60 bg-background">
          {/* Hidden file input — accepts image OR video from the same picker */}
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoVideoPick(f);
              e.target.value = "";
            }}
          />

          {addToPostExpanded ? (
            <div className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              {/* Drag handle (decorative) */}
              <button
                type="button"
                onClick={() => setAddToPostExpanded(false)}
                aria-label="Collapse add to post"
                className="mx-auto mb-2 block h-1 w-10 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/50"
              />
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-bold text-foreground">
                  Add to your post
                </p>
                <button
                  type="button"
                  onClick={() => setAddToPostExpanded(false)}
                  aria-label="Collapse"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* 3×2 grid of action cards */}
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <AddPostOptionCard
                  icon={<ImageIcon className="h-5 w-5" strokeWidth={2.25} />}
                  label="Photo/Video"
                  iconBgClass="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300"
                  disabled={submitting || !!mediaFile}
                  onClick={() => mediaInputRef.current?.click()}
                />
                <AddPostOptionCard
                  icon={
                    <span className="text-[11px] font-black tracking-tight">
                      GIF
                    </span>
                  }
                  label="Gif"
                  iconBgClass="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                  disabled={submitting}
                  onClick={() => comingSoon("Gif")}
                />
                <AddPostOptionCard
                  icon={<ListChecks className="h-5 w-5" strokeWidth={2.25} />}
                  label="Poll"
                  iconBgClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                  disabled={submitting}
                  onClick={() => comingSoon("Poll")}
                />
                <AddPostOptionCard
                  icon={<FileText className="h-5 w-5" strokeWidth={2.25} />}
                  label="Adoption"
                  iconBgClass="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
                  disabled={submitting}
                  onClick={() => comingSoon("Adoption")}
                />
                <AddPostOptionCard
                  icon={<Megaphone className="h-5 w-5" strokeWidth={2.25} />}
                  label="Lost Notice"
                  iconBgClass="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                  disabled={submitting}
                  onClick={() => comingSoon("Lost Notice")}
                />
                <AddPostOptionCard
                  icon={<CalendarDays className="h-5 w-5" strokeWidth={2.25} />}
                  label="Event"
                  iconBgClass="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"
                  disabled={submitting}
                  onClick={() => comingSoon("Event")}
                />
              </div>
            </div>
          ) : (
            /* Collapsed: thin row of icons + chevron up */
            <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
              <div className="flex items-center gap-1">
                <AddPostOptionIcon
                  icon={<ImageIcon className="h-4 w-4" strokeWidth={2.25} />}
                  iconBgClass="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300"
                  label="Photo/Video"
                  disabled={submitting || !!mediaFile}
                  onClick={() => mediaInputRef.current?.click()}
                />
                <AddPostOptionIcon
                  icon={<span className="text-[9px] font-black">GIF</span>}
                  iconBgClass="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                  label="Gif"
                  disabled={submitting}
                  onClick={() => comingSoon("Gif")}
                />
                <AddPostOptionIcon
                  icon={<ListChecks className="h-4 w-4" strokeWidth={2.25} />}
                  iconBgClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                  label="Poll"
                  disabled={submitting}
                  onClick={() => comingSoon("Poll")}
                />
                <AddPostOptionIcon
                  icon={<FileText className="h-4 w-4" strokeWidth={2.25} />}
                  iconBgClass="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
                  label="Adoption"
                  disabled={submitting}
                  onClick={() => comingSoon("Adoption")}
                />
                <AddPostOptionIcon
                  icon={<Megaphone className="h-4 w-4" strokeWidth={2.25} />}
                  iconBgClass="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                  label="Lost Notice"
                  disabled={submitting}
                  onClick={() => comingSoon("Lost Notice")}
                />
                <AddPostOptionIcon
                  icon={<CalendarDays className="h-4 w-4" strokeWidth={2.25} />}
                  iconBgClass="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"
                  label="Event"
                  disabled={submitting}
                  onClick={() => comingSoon("Event")}
                />
              </div>
              <button
                type="button"
                onClick={() => setAddToPostExpanded(true)}
                aria-label="Expand add to post"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
              >
                <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Card-style action button used in the expanded "Add to your post" grid. */
function AddPostOptionCard({
  icon,
  label,
  iconBgClass,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  iconBgClass: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/25 px-3 py-2.5 text-left transition-all",
        "hover:bg-muted/40 active:scale-[0.98] dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60",
        "disabled:opacity-40 disabled:hover:bg-muted/25 disabled:active:scale-100",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            iconBgClass,
          )}
          aria-hidden
        >
          {icon}
        </span>
        <span className="truncate text-[14px] font-bold text-foreground">
          {label}
        </span>
      </div>
      <Plus
        className="h-4 w-4 shrink-0 text-muted-foreground"
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  );
}

/** Compact icon-only button used in the collapsed row. */
function AddPostOptionIcon({
  icon,
  label,
  iconBgClass,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  iconBgClass: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
        "hover:scale-110 active:scale-95",
        "disabled:opacity-40 disabled:hover:scale-100",
        iconBgClass,
      )}
    >
      {icon}
    </button>
  );
}

/** Author avatar with green gradient ring during active 24h go-live (`live_until` in the future). */
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
  const showLiveRing = isFreelancerInActive24hLiveWindow({ live_until: liveUntil ?? null });
  const fallbackClass =
    variant === "overlay"
      ? "bg-black/50 text-sm font-bold text-white"
      : "font-bold text-sm";

  const avatar = (
    <Avatar className="h-11 w-11 shrink-0">
      <AvatarImage src={photoUrl} className="object-cover" alt="" />
      <AvatarFallback className={fallbackClass}>
        {authorName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  if (!showLiveRing) return avatar;

  const innerShell =
    variant === "overlay"
      ? "rounded-full overflow-hidden ring-1 ring-black/30"
      : "rounded-full overflow-hidden bg-background ring-1 ring-border/50";

  return (
    <span
      className="inline-flex shrink-0 rounded-full bg-gradient-to-br from-lime-400 via-emerald-500 to-green-700 p-[2.5px] shadow-[0_0_14px_rgba(34,197,94,0.35)]"
      title="Live now (24h availability)"
    >
      <span className={innerShell}>{avatar}</span>
    </span>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

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
}: {
  post: FeedPost;
  currentUserId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => void;
  isOwnFeed: boolean;
  onDeleted: (postId: string) => void;
  globalVideoUnmuted: boolean;
  onGlobalVideoUnmutedChange: (next: boolean) => void;
  refreshPostShareStats: (postId: string) => void;
  onOpenMediaReels: (postId: string) => void;
  /** Liked-posts-only feed (e.g. Saved / Liked) — hide redundant like control. */
  hidePostLikeButton?: boolean;
  appearance: "default" | "discover";
}) {
  const { addToast } = useToast();
  const { profile: viewerProfile } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [authorSaved, setAuthorSaved] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [saveNoticeOpen, setSaveNoticeOpen] = useState(false);
  const saveNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const canSaveAuthor =
    Boolean(currentUserId) && post.author_id !== currentUserId;

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

  const saveBadgeHeaderClass = cn(
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-md backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
    authorSaved
      ? "border-amber-300/70 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-amber-950/55 dark:text-amber-200 dark:hover:bg-amber-950/75"
      : "border-border/80 bg-muted/85 text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-zinc-800/90 dark:hover:bg-zinc-800",
  );


  const videoMuteMediaClass =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45";

  const isLandscape = mediaOrientation === "landscape";
  const isDiscover = appearance === "discover";
  const mediaAspectStyle: React.CSSProperties | undefined = mediaAspectRatio
    ? { aspectRatio: String(mediaAspectRatio) }
    : undefined;
  // Mobile media sizing:
  // - Portrait: near full screen (Instagram-like); discover feeds use a shorter cap
  // - Landscape: size to the media's real aspect ratio to avoid excessive zoom
  const mobilePortraitMaxHeight = isDiscover
    ? "max-md:max-h-[min(62dvh,38rem)]"
    : "max-md:max-h-[min(80dvh,50rem)]";
  const mobilePortraitFallbackHeight = isDiscover
    ? "max-md:h-[min(60dvh,36rem)]"
    : "max-md:h-[min(76dvh,46rem)]";
  const mobileMediaBoxClass = mediaAspectRatio
    ? cn(
        "max-md:mx-1.5 max-md:w-[calc(100%-12px)] max-md:rounded-[20px]",
        // Portrait media can otherwise become extremely tall when width is full.
        !isLandscape && mobilePortraitMaxHeight,
      )
    : isLandscape
      ? "max-md:mx-1.5 max-md:w-[calc(100%-12px)] max-md:rounded-[20px]"
      : cn(
          "max-md:mx-1.5 max-md:w-[calc(100%-12px)] max-md:rounded-[20px]",
          mobilePortraitFallbackHeight,
        );
  const mobileMediaStyle: React.CSSProperties | undefined = mediaAspectStyle;

  // Desktop media sizing:
  // - Portrait: height-capped box with width derived from aspect ratio (no side letterboxing)
  // - Landscape: full width, sized to the media's real aspect ratio
  const portraitDesktopSizingClass = isDiscover
    ? "md:h-[min(62vh,36rem)] md:max-h-[min(62vh,36rem)] md:w-auto md:max-w-full"
    : "md:h-[min(82vh,52rem)] md:max-h-[min(82vh,52rem)] md:w-auto md:max-w-full";
  const desktopMediaBoxClass = mediaAspectRatio
    ? cn(
        "md:rounded-xl",
        isLandscape ? "md:w-full" : portraitDesktopSizingClass,
      )
    : isLandscape
      ? "md:w-full md:rounded-xl"
      : cn("md:rounded-xl", portraitDesktopSizingClass);
  const portraitMediaObjectClass = "object-cover";
  const landscapeMediaObjectClass = "object-contain";
  const mediaBoxBgClass = isLandscape ? "bg-black" : "bg-transparent";
  // Discover card width: portrait shrinks to media; landscape spans the column up to a cap.
  const desktopDiscoverCardWidthClass = isDiscover
    ? isLandscape
      ? "md:w-full md:max-w-[820px]"
      : "md:w-fit md:max-w-[520px]"
    : null;
  const desktopMediaStyle: React.CSSProperties | undefined = mediaAspectStyle;

  async function toggleLike() {
    if (!currentUserId) {
      addToast({ title: "Sign in to like posts", variant: "warning" });
      return;
    }
    if (post.source !== "post") return; // availability posts don't have likes for now
    setLiking(true);
    try {
      if (post.liked_by_me) {
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
        title: "Could not like post",
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
      addToast({ title: "Sign in to save profiles", variant: "warning" });
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

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Check this post", url });
      } else {
        await navigator.clipboard.writeText(url);
        addToast({ title: "Link copied!", variant: "success" });
      }
    } catch {
      // User cancelled native share or clipboard failed
      return;
    }

    if (post.source !== "post" || !currentUserId) return;

    const { error } = await supabase.from("profile_post_shares").insert({
      post_id: post.id,
      user_id: currentUserId,
    });
    if (error) {
      console.error("[PostCard] profile_post_shares insert", error);
      return;
    }
    void refreshPostShareStats(post.id);
  }

  async function handleDelete() {
    if (!currentUserId || post.source !== "post") return;
    setDeleting(true);
    try {
      if (post.storage_path) {
        await supabase.storage.from(PUBLIC_PROFILE_MEDIA_BUCKET).remove([post.storage_path]);
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
  const isSource = post.source === "availability";
  const hasMedia = Boolean(mediaUrl);

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
    () => formatDistanceToNow(new Date(post.created_at), { addSuffix: true }),
    [post.created_at],
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
    const btnPad = hasMedia ? "py-1.5" : "py-2.5";
    return (
      <div
        className={cn(
          "flex items-center gap-0 bg-transparent px-2 md:px-3",
          hasMedia ? "pb-0 pt-0.5 md:pt-1 md:pb-0" : "py-1 md:mt-0.5 md:py-2",
        )}
      >
        {!hidePostLikeButton ? (
        <button
          type="button"
          disabled={liking || post.source === "availability"}
          onClick={() => void toggleLike()}
          className={cn(
            "flex items-center gap-2 rounded-full px-3.5 text-base font-semibold transition-all",
            btnPad,
            post.liked_by_me
              ? "text-rose-500"
              : "text-muted-foreground hover:bg-muted/60 hover:text-rose-500 dark:text-white dark:hover:text-rose-400",
            (liking || post.source === "availability") && "pointer-events-none opacity-50",
          )}
          aria-label={post.liked_by_me ? "Unlike" : "Like"}
        >
          <Heart
            className={cn("h-6 w-6 transition-transform", post.liked_by_me && "scale-110 fill-rose-500")}
            strokeWidth={2.75}
          />
          {post.like_count > 0 && (
            <span className="min-w-[1ch] tabular-nums">{post.like_count}</span>
          )}
        </button>
        ) : null}
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-full px-3.5 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-orange-600 dark:text-white dark:hover:text-orange-400",
            btnPad,
          )}
          aria-label="Comments"
        >
          <MessageCircle className="h-6 w-6" strokeWidth={2.75} />
          {commentCount > 0 && (
            <span className="min-w-[1ch] tabular-nums">{commentCount}</span>
          )}
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
            "flex items-center gap-2 rounded-full px-3.5 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-orange-600 dark:text-white dark:hover:text-orange-400",
            btnPad,
          )}
          aria-label="Share"
        >
          <Send className="h-6 w-6" strokeWidth={2.75} />
          {post.source === "post" && post.share_click_count > 0 ? (
            <span className="min-w-[1ch] tabular-nums">{post.share_click_count}</span>
          ) : null}
        </button>
      </div>
    );
  }



  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300",
        "bg-white dark:bg-zinc-950/20",
        "md:rounded-2xl md:shadow-md",
        "border-0 shadow-none",

        isDiscover &&
          "md:bg-transparent md:shadow-none md:ring-0 md:outline-none",
        desktopDiscoverCardWidthClass,
      )}
    >
      {/* Header — always rendered outside the media block */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <Link to={`/profile/${post.author_id}`} className="shrink-0 self-start">
            <PostAuthorAvatar
              authorName={authorName}
              photoUrl={post.author?.photo_url ?? undefined}
              liveUntil={post.author?.live_until}
              variant="card"
            />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col gap-0.5 pt-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <Link
                to={`/profile/${post.author_id}`}
                className="truncate font-black text-xl leading-tight text-foreground hover:underline underline-offset-2"
              >
                {authorName}
              </Link>
              {post.author?.is_verified ? (
                <BadgeCheck
                  className="h-[18px] w-[18px] shrink-0"
                  fill="#0ea5e9"
                  color="#ffffff"
                  aria-label="Verified"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <time className="text-[13px] font-semibold tabular-nums text-muted-foreground">{postedLabel}</time>
              {isSource && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                  <Sparkles className="h-3 w-3" />
                  {categoryLabel((post as AvailabilityPost).category)}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start pt-0.5">
            {canSaveAuthor ? (
              <button
                type="button"
                disabled={favoriteBusy}
                onClick={(e) => void toggleSaveAuthor(e)}
                title={authorSaved ? "Remove from saved profiles" : "Save profile"}
                aria-label={authorSaved ? "Remove author from saved profiles" : "Save author to saved profiles"}
                aria-pressed={authorSaved}
                className={saveBadgeHeaderClass}
              >
                {favoriteBusy ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                ) : (
                  <Bookmark
                    className={cn(
                      "h-6 w-6",
                      authorSaved && "fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-200",
                    )}
                    strokeWidth={authorSaved ? 0 : 2}
                    aria-hidden
                  />
                )}
              </button>
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
      {/* Media */}
      {mediaUrl && post.media_type === "image" && (
        <div
          className={cn(
            "relative mt-0 overflow-hidden",
            mediaBoxBgClass,
            mobileMediaBoxClass,
            desktopMediaBoxClass,
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



          {/* Tagged users — bottom-left overlay on media */}
          {post.tagged_profiles.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[3] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
              <span className="pointer-events-none inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/12">
                <AtSign className="h-4 w-4" aria-hidden />
              </span>
              {(showAllTagged ? post.tagged_profiles : post.tagged_profiles.slice(0, 3)).map((t) => (
                <Link
                  key={t.id}
                  to={`/profile/${t.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-black/35 px-2.5 py-1.5 text-[12px] font-bold text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/12 hover:bg-black/45"
                  aria-label={`View tagged user ${t.full_name ?? "member"}`}
                >
                  <Avatar className="h-6 w-6 shrink-0 ring-1 ring-white/15">
                    <AvatarImage src={t.photo_url ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-[10px] font-black text-white">
                      {(t.full_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{t.full_name ?? "Member"}</span>
                </Link>
              ))}
              {!showAllTagged && post.tagged_profiles.length > 3 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllTagged(true);
                  }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 text-[12px] font-bold text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/12 hover:bg-black/45"
                  aria-label="Show all tagged users"
                >
                  <Plus className="h-4 w-4" strokeWidth={3} aria-hidden />
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

          {/* Tagged users — bottom-left overlay on media */}
          {post.tagged_profiles.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[3] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
              <span className="pointer-events-none inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/12">
                <AtSign className="h-4 w-4" aria-hidden />
              </span>
              {(showAllTagged ? post.tagged_profiles : post.tagged_profiles.slice(0, 3)).map((t) => (
                <Link
                  key={t.id}
                  to={`/profile/${t.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-black/35 px-2.5 py-1.5 text-[12px] font-bold text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/12 hover:bg-black/45"
                  aria-label={`View tagged user ${t.full_name ?? "member"}`}
                >
                  <Avatar className="h-6 w-6 shrink-0 ring-1 ring-white/15">
                    <AvatarImage src={t.photo_url ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-[10px] font-black text-white">
                      {(t.full_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{t.full_name ?? "Member"}</span>
                </Link>
              ))}
              {!showAllTagged && post.tagged_profiles.length > 3 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllTagged(true);
                  }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 text-[12px] font-bold text-white shadow-md backdrop-blur-md ring-1 ring-inset ring-white/12 hover:bg-black/45"
                  aria-label="Show all tagged users"
                >
                  <Plus className="h-4 w-4" strokeWidth={3} aria-hidden />
                  {post.tagged_profiles.length - 3}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Like / comment / share — directly under media (matches Instagram-style feed) */}
      {hasMedia ? renderEngagementRow() : null}

      {/* Caption */}
      {post.caption?.trim() && (
        <div
          className={cn(
            "px-4 pb-0",
            hasMedia ? "pt-0 md:pt-0.5 md:pb-1" : "pt-2 md:pt-3 md:pb-1",
          )}
        >
          <div className="flex items-end justify-between gap-3">
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="flex-1 text-left"
              aria-label="Open full post text"
            >
              <p className="line-clamp-2 text-[17px] leading-relaxed text-foreground">
                <span className="text-[18px] font-black lowercase">{authorName}</span>{" "}
                <span className="mx-1 inline-block align-middle text-[13px] text-muted-foreground">•</span>{" "}
                {renderCaptionWithMentions(post.caption)}
              </p>
            </button>
            {post.caption.trim().length > 120 || post.caption.includes("\n") ? (
              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className="shrink-0 text-base font-black text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                aria-label="Show full text"
              >
                More
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Tagged users (only when there is no media overlay) */}
      {!hasMedia && post.tagged_profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
          <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {post.tagged_profiles.map((t) => (
            <Link
              key={t.id}
              to={`/profile/${t.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-orange-50 dark:bg-orange-950/50 px-3 py-1.5 text-sm font-black text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors shadow-sm"
            >
              <Avatar className="h-7 w-7 border border-orange-200/50 dark:border-orange-800/30 shadow-inner">
                <AvatarImage src={t.photo_url ?? undefined} />
                <AvatarFallback className="text-[11px] font-bold">{(t.full_name ?? "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="pr-1">{t.full_name}</span>
            </Link>
          ))}
        </div>
      )}

      {!hasMedia ? renderEngagementRow() : null}

      {/* Comments dialog */}
      <CommentsDialog
        postId={post.id}
        caption={post.caption?.trim() ? renderCaptionWithMentions(post.caption) : undefined}
        authorName={authorName}
        authorPhotoUrl={post.author?.photo_url ?? null}
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
  appearance?: "default" | "discover";
  /**
   * What to render in the right-side panel when `appearance === "discover"`.
   *  - "comments" (default): per-post live comments (used by Community Feed page)
   *  - "favorites": YouTube-style "From your favorites" + "Most liked" sidebar
   *    rendered once next to the first post (used by Discovery Home)
   */
  discoverSidePanel?: "comments" | "favorites";
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
}: ProfilePostsFeedProps) {
  const { user, profile: currentProfile } = useAuth();
  const [globalVideoUnmuted, setGlobalVideoUnmuted] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [reelsOpenPostId, setReelsOpenPostId] = useState<string | null>(null);
  const [reelCommentsPostId, setReelCommentsPostId] = useState<string | null>(null);
  /**
   * Track viewport width so we can render the desktop full-size viewer
   * (`PostMediaDesktopViewer`) on md+ screens and the mobile reels viewer
   * (`PostMediaReelsViewer`) on smaller screens. Reacts live to resize so the
   * correct variant always reflects the current viewport.
   */
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopViewport((e as MediaQueryList).matches ?? false);
    };
    setIsDesktopViewport(mql.matches);
    if ("addEventListener" in mql) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback
    (mql as MediaQueryList).addListener(onChange);
    return () => (mql as MediaQueryList).removeListener(onChange);
  }, []);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable query key — used to invalidate/update the cache in realtime handlers.
  const qk = useMemo(() => queryKeys.profilePostsFeed({
    userId,
    viewerUserId: user?.id,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    filterLikedByUserId,
    limit,
  }), [userId, user?.id, filterTaggedUserId, filterAuthorId, authorNameFilter, sortOrder, filterLikedByUserId, limit]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
    realtimeRefreshTimeoutRef.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: qk });
    }, 250);
  }, [queryClient, qk]);

  // Realtime subscription for live feed updates.
  // We keep it conservative: refresh the feed for post changes, but apply likes/comments in-place.
  const realtimeEnabled =
    !authorNameFilter && !filterTaggedUserId && !filterAuthorId && !filterLikedByUserId;

  useRealtimeSubscription(
    {
      table: "profile_posts",
      event: "*",
      filter: userId ? `author_id=eq.${userId}` : undefined,
      enabled: realtimeEnabled,
    },
    () => scheduleRealtimeRefresh(),
  );

  useRealtimeSubscription(
    {
      table: "community_posts",
      event: "*",
      filter: userId ? `author_id=eq.${userId}` : undefined,
      enabled: realtimeEnabled,
    },
    () => scheduleRealtimeRefresh(),
  );

  useRealtimeSubscription(
    { table: "profile_post_likes", event: "*", enabled: realtimeEnabled },
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
          scheduleRealtimeRefresh();
          return prev;
        }
        return next;
      });
    },
  );

  useRealtimeSubscription(
    { table: "profile_post_comments", event: "*", enabled: realtimeEnabled },
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
          scheduleRealtimeRefresh();
          return prev;
        }
        return next;
      });
    },
  );

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

      // 2. Fetch profile posts
      let query = supabase
        .from("profile_posts")
        .select("id, author_id, caption, media_type, storage_path, tagged_user_ids, created_at");

      if (filterLikedByUserId && likedPostIds) {
        query = query.in("id", likedPostIds);
      } else if (userId) {
        query = query.eq("author_id", userId);
      } else if (filterAuthorId) {
        query = query.eq("author_id", filterAuthorId);
      } else if (authorNameFilter && authorNameFilter.trim().length > 0) {
        if (resolvedAuthorIds.length === 0) {
          return [];
        }
        query = query.in("author_id", resolvedAuthorIds);
      }

      if (filterTaggedUserId) {
        query = query.contains("tagged_user_ids", [filterTaggedUserId]);
      }

      const limitPosts = limit ?? (userId ? 50 : 100);
      const limitAvail = limit ?? (userId ? 20 : 50);
      const profilePostsPromise = query
        .order("created_at", { ascending: sortOrder === "oldest" })
        .limit(limitPosts);

      const nowIso = new Date().toISOString();
      const availPromise = !filterLikedByUserId
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

      const [{ data: profilePostRows, error: ppErr }, availRes] =
        await Promise.all([profilePostsPromise, availPromise]);

      if (ppErr) throw ppErr;
      if (availRes.error) throw availRes.error;
      const availRows = !filterLikedByUserId ? (availRes.data ?? []) : [];

      const rawPosts = (profilePostRows ?? []) as {
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        tagged_user_ids: string[];
        created_at: string;
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

      const idList = [...profileIds, ...allTaggedIds].slice(0, 200);
      const postIds = rawPosts.map((p) => p.id);

      const [profRes, likedRes, engRes, shareRes, fpRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, photo_url, is_verified")
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
      }));

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

      // 9. Merge and sort by created_at
      const merged: FeedPost[] = [...profilePostsFeed, ...availFeed].sort(
        (a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return sortOrder === "oldest" ? timeA - timeB : timeB - timeA;
        }
      );

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
    supabase,
  ]);

  const { data: posts = [], isLoading: loading } = useQuery({
    queryKey: qk,
    staleTime: 3 * 60 * 1000, // 3 minutes — served from cache on revisit
    gcTime: 10 * 60 * 1000,   // keep in cache 10 min after unmount
    queryFn: fetchPosts,
  });

  function handleLikeToggle(postId: string, newLiked: boolean) {
    queryClient.setQueryData<FeedPost[]>(qk, (prev) =>
      prev?.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: newLiked, like_count: Math.max(0, p.like_count + (newLiked ? 1 : -1)) }
          : p,
      ),
    );
  }

  function handleDeleted(postId: string) {
    queryClient.setQueryData<FeedPost[]>(qk, (prev) => prev?.filter((p) => p.id !== postId));
  }

  const reelCommentsPost = useMemo(() => {
    if (!reelCommentsPostId) return undefined;
    const p = posts.find((x) => x.id === reelCommentsPostId);
    return p?.source === "post" ? (p as ProfilePost) : undefined;
  }, [posts, reelCommentsPostId]);

  const refreshPostShareStats = useCallback(
    async (postId: string) => {
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
    [supabase, queryClient, qk],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-8 md:gap-7">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse space-y-4 rounded-none border-0 bg-white p-4 shadow-none dark:bg-zinc-950/20 md:rounded-2xl md:shadow-md">
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
                  ? "max-md:h-[min(60dvh,36rem)] md:h-[min(62vh,36rem)]"
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
    <div className="space-y-3 md:space-y-2">
      {/* Compose button — own profile only */}
      {isOwnProfile && (
        <div>
          <button
            type="button"
            onClick={() => {
              if (!user) { navigate("/login"); return; }
              setComposeOpen(true);
            }}
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
      {posts.length === 0 ? (
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
              onClick={() => setComposeOpen(true)}
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
        <div className="md:flex md:items-start md:justify-start md:gap-10 md:pr-4 lg:pr-8">
          <div className="min-w-0 space-y-3 md:flex-1 md:space-y-2">
            {posts.map((post) => (
              <PostCard
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
              />
            ))}
          </div>
          <FavoritesPostsSidePanel />
        </div>
      ) : (
        posts.map((post) => {
          const isDiscover = appearance === "discover";
          const isProfilePost = post.source === "post";
          const shouldShowComments = isDiscover && isProfilePost;
          const authorName = post.author?.full_name?.trim()
            ? post.author.full_name.trim()
            : "Member";
          const caption =
            isProfilePost && post.caption?.trim()
              ? renderCaptionWithMentions(post.caption)
              : undefined;

          if (!shouldShowComments) {
            return (
              <PostCard
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
              />
            );
          }

          return (
            <div
              key={post.id}
              className={cn(
                "md:flex md:items-start md:justify-start md:gap-10",
                "md:pr-4 lg:pr-8",
              )}
            >
              <div className="min-w-0 md:flex-1">
                <PostCard
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
                />
              </div>

              <CommentsSidePanel
                postId={post.id}
                caption={caption}
                authorName={authorName}
                authorPhotoUrl={post.author?.photo_url ?? null}
                initialCount={post.comment_count}
              />
            </div>
          );
        })
      )}

      {reelsOpenPostId !== null ? (
        isDesktopViewport ? (
          <PostMediaDesktopViewer
            key={`desktop-${reelsOpenPostId}`}
            open
            posts={posts as unknown as ReelFeedPost[]}
            initialPostId={reelsOpenPostId}
            onClose={() => setReelsOpenPostId(null)}
            currentUserId={user?.id ?? null}
            onLikeToggle={handleLikeToggle}
            onRefreshShareStats={refreshPostShareStats}
            hideLikeButton={Boolean(filterLikedByUserId)}
          />
        ) : (
          <PostMediaReelsViewer
            key={`reels-${reelsOpenPostId}`}
            open
            posts={posts as unknown as ReelFeedPost[]}
            initialPostId={reelsOpenPostId}
            onClose={() => setReelsOpenPostId(null)}
            currentUserId={user?.id ?? null}
            onLikeToggle={handleLikeToggle}
            onRefreshShareStats={refreshPostShareStats}
            onOpenComments={(postId) => setReelCommentsPostId(postId)}
            hideLikeButton={Boolean(filterLikedByUserId)}
          />
        )
      ) : null}

      <CommentsDialog
        postId={reelCommentsPostId ?? ""}
        caption={
          reelCommentsPost?.caption?.trim()
            ? renderCaptionWithMentions(reelCommentsPost.caption)
            : undefined
        }
        authorName={
          reelCommentsPost?.author?.full_name?.trim()
            ? reelCommentsPost.author.full_name.trim()
            : undefined
        }
        authorPhotoUrl={reelCommentsPost?.author?.photo_url ?? null}
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
