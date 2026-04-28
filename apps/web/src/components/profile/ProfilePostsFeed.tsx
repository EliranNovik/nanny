import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  MessageCircle,
  Share2,
  Plus,
  X,
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  AtSign,
  Trash2,
  LayoutGrid,
  Sparkles,
  SendHorizontal,
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
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
  open,
  onClose,
}: {
  postId: string;
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
        .select("id, full_name, photo_url")
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
      <DialogContent className="flex max-h-[min(90vh,580px)] flex-col gap-0 p-0 sm:max-w-md rounded-2xl overflow-hidden">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <MessageCircle className="h-5 w-5 text-orange-500" strokeWidth={2} />
            Comments
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5">
          <div className="space-y-5 py-4">
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
                    <Avatar className="h-8 w-8 shrink-0 ring-2 ring-background">
                      <AvatarImage src={c.author?.photo_url ?? undefined} />
                      <AvatarFallback className="text-xs font-bold">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const tagTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    setCaption("");
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
    setTagQuery("");
    setTagResults([]);
    setTaggedUsers([]);
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
  }

  useEffect(() => {
    if (!tagQuery.trim()) { setTagResults([]); return; }
    if (tagTimeoutRef.current) clearTimeout(tagTimeoutRef.current);
    tagTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .ilike("full_name", `%${tagQuery.trim()}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      setTagResults((data ?? []) as ProfileSnippet[]);
    }, 280);
  }, [tagQuery, user?.id]);

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
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-lg rounded-2xl overflow-hidden max-h-[min(92vh,660px)]">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-orange-500" strokeWidth={2} />
            New post
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 px-5 py-4">
            {/* Author row */}
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 ring-2 ring-orange-200 dark:ring-orange-900">
                <AvatarImage src={authorProfile.photo_url ?? undefined} />
                <AvatarFallback className="font-bold text-sm">
                  {(authorProfile.full_name ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm text-foreground">
                {authorProfile.full_name ?? "You"}
              </span>
            </div>

            {/* Caption */}
            <Textarea
              placeholder="What's on your mind?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={2200}
              rows={4}
              className="resize-none bg-transparent border-none shadow-none focus-visible:ring-0 text-base p-0 placeholder:text-muted-foreground/60"
              disabled={submitting}
            />

            {/* Media preview */}
            {mediaPreview && (
              <div className="relative overflow-hidden rounded-xl bg-black">
                {mediaKind === "image" ? (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full max-h-64 object-cover"
                  />
                ) : (
                  <video
                    src={mediaPreview}
                    controls
                    playsInline
                    muted
                    className="w-full max-h-64"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                    setMediaKind(null);
                  }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Tag users */}
            <div className="space-y-2">
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tag someone…"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
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

        {/* Footer actions */}
        <div className="border-t border-border/60 bg-muted/20 px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleMedia(f, "image");
                e.target.value = "";
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleMedia(f, "video");
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={submitting || !!mediaFile}
              onClick={() => imageInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-orange-600 transition-colors disabled:opacity-40"
              title="Add photo"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={submitting || !!mediaFile}
              onClick={() => videoInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-orange-600 transition-colors disabled:opacity-40"
              title="Add video"
            >
              <VideoIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting || (!caption.trim() && !mediaFile)}
              onClick={() => void handleSubmit()}
              className="rounded-full bg-orange-600 hover:bg-orange-700 text-white w-10 h-10 p-0 flex items-center justify-center shadow-lg shadow-orange-500/20"
              title="Share post"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4 translate-x-0.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  isOwnFeed,
  onDeleted,
}: {
  post: FeedPost;
  currentUserId: string | null;
  onLikeToggle: (postId: string, liked: boolean) => void;
  isOwnFeed: boolean;
  onDeleted: (postId: string) => void;
}) {
  const { addToast } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const mediaUrl =
    post.media_type && post.storage_path
      ? publicProfileMediaPublicUrl(post.storage_path)
      : null;

  async function toggleLike() {
    if (!currentUserId) {
      addToast({ title: "Sign in to like posts", variant: "warning" });
      return;
    }
    if (post.source !== "post") return; // availability posts don't have likes for now
    setLiking(true);
    try {
      if (post.liked_by_me) {
        await supabase
          .from("profile_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("profile_post_likes").insert({ post_id: post.id, user_id: currentUserId });
      }
      onLikeToggle(post.id, !post.liked_by_me);
    } catch (e) {
      console.error("[PostCard] toggleLike", e);
    } finally {
      setLiking(false);
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
      // ignore cancelled share
    }
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

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300",
        "bg-white dark:bg-zinc-950/20",
        "md:rounded-2xl md:border md:border-border/60 md:shadow-md", // Card on desktop
        "border-b border-slate-100 dark:border-white/5 shadow-none" // Divider on mobile
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link to={`/profile/${post.author_id}`} className="shrink-0">
          <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
            <AvatarImage src={post.author?.photo_url ?? undefined} className="object-cover" />
            <AvatarFallback className="font-bold text-sm">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/profile/${post.author_id}`}
            className="font-bold text-sm text-foreground hover:underline underline-offset-2"
          >
            {authorName}
          </Link>
          <div className="flex items-center gap-1.5 flex-wrap">
            <time className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </time>
            {isSource && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                <Sparkles className="h-2.5 w-2.5" />
                {categoryLabel((post as AvailabilityPost).category)}
              </span>
            )}
          </div>
        </div>
        {/* Delete button — own posts only */}
        {isOwnFeed && post.source === "post" && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50 dark:hover:bg-red-950/40"
            aria-label="Delete post"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Media */}
      {mediaUrl && post.media_type === "image" && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block w-full mt-2 overflow-hidden focus-visible:outline-none"
          aria-label="View image full screen"
        >
          <img
            src={mediaUrl}
            alt=""
            className="w-full max-h-[360px] object-cover"
            loading="lazy"
          />
        </button>
      )}
      {mediaUrl && post.media_type === "video" && (
        <div className="mt-2 overflow-hidden bg-black">
          <video
            src={mediaUrl}
            controls
            playsInline
            muted
            preload="metadata"
            className="w-full max-h-[360px] object-contain"
          />
        </div>
      )}

      {/* Lightbox (simple full-screen overlay) */}
      {lightboxOpen && mediaUrl && post.media_type === "image" && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxOpen(false)}
        >
          <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Caption */}
      {post.caption?.trim() && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-sm leading-relaxed text-foreground">
            {renderCaptionWithMentions(post.caption)}
          </p>
        </div>
      )}

      {/* Tagged users */}
      {post.tagged_profiles.length > 0 && (
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

      {/* Action bar */}
      <div className="flex items-center gap-0 px-2 py-2 border-t border-border/40 mt-3">
        {/* Like */}
        <button
          type="button"
          disabled={liking || post.source === "availability"}
          onClick={() => void toggleLike()}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all",
            post.liked_by_me
              ? "text-rose-500"
              : "text-muted-foreground hover:bg-muted/60 hover:text-rose-500",
            (liking || post.source === "availability") && "opacity-50 pointer-events-none",
          )}
          aria-label={post.liked_by_me ? "Unlike" : "Like"}
        >
          <Heart
            className={cn("h-5 w-5 transition-transform", post.liked_by_me && "fill-rose-500 scale-110")}
            strokeWidth={2}
          />
          {post.like_count > 0 && (
            <span className="min-w-[1ch] tabular-nums">{post.like_count}</span>
          )}
        </button>

        {/* Comment */}
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-orange-600 transition-colors"
          aria-label="Comments"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={2} />
          {commentCount > 0 && (
            <span className="min-w-[1ch] tabular-nums">{commentCount}</span>
          )}
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-orange-600 transition-colors"
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {/* Comments dialog */}
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
}

export function ProfilePostsFeed({
  userId,
  isOwnProfile = false,
  filterTaggedUserId,
  filterAuthorId,
  authorNameFilter,
  sortOrder = "newest",
}: ProfilePostsFeedProps) {
  const { user, profile: currentProfile } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  // Realtime subscription for live feed updates
  useRealtimeSubscription(
    { table: "profile_posts", event: "INSERT", enabled: !userId }, 
    () => setRefreshKey((prev) => prev + 1)
  );
  useRealtimeSubscription(
    { table: "community_posts", event: "INSERT", enabled: !userId }, 
    () => setRefreshKey((prev) => prev + 1)
  );

  const authorProfile: ProfileSnippet = {
    id: user?.id ?? "",
    full_name: currentProfile?.full_name ?? null,
    photo_url: currentProfile?.photo_url ?? null,
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
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

      // 1. Fetch profile posts
      let query = supabase
        .from("profile_posts")
        .select("id, author_id, caption, media_type, storage_path, tagged_user_ids, created_at");

      if (userId) {
        query = query.eq("author_id", userId);
      } else if (filterAuthorId) {
        query = query.eq("author_id", filterAuthorId);
      } else if (authorNameFilter && authorNameFilter.trim().length > 0) {
        if (resolvedAuthorIds.length === 0) {
          setPosts([]);
          setLoading(false);
          return;
        }
        query = query.in("author_id", resolvedAuthorIds);
      }

      if (filterTaggedUserId) {
        query = query.contains("tagged_user_ids", [filterTaggedUserId]);
      }

      const { data: profilePostRows, error: ppErr } = await query
        .order("created_at", { ascending: sortOrder === "oldest" })
        .limit(userId ? 50 : 100);

      if (ppErr) throw ppErr;
      const rawPosts = (profilePostRows ?? []) as {
        id: string;
        author_id: string;
        caption: string | null;
        media_type: "image" | "video" | null;
        storage_path: string | null;
        tagged_user_ids: string[];
        created_at: string;
      }[];

      // 2. Fetch availability/community posts
      const nowIso = new Date().toISOString();
      let availQuery = supabase
        .from("community_posts")
        .select("id, category, title, note, expires_at, availability_payload, created_at, author_id")
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
          // No profiles found, but we still need to run a query that returns nothing or handle it.
          // Since we already checked resolvedAuthorIds for the main posts, we can skip or force no results.
          availQuery = availQuery.eq("author_id", "00000000-0000-0000-0000-000000000000"); // guaranteed empty
        }
      }

      const { data: availRows } = await availQuery
        .order("created_at", { ascending: sortOrder === "oldest" })
        .limit(userId ? 20 : 50);

      // 3. Collect all user IDs to resolve profiles
      const allTaggedIds = new Set<string>();
      rawPosts.forEach((p) => p.tagged_user_ids.forEach((id) => allTaggedIds.add(id)));

      const profileIds = new Set<string>();
      if (userId) profileIds.add(userId);
      if (currentUserId) profileIds.add(currentUserId);
      
      // Also add all authors
      rawPosts.forEach(p => profileIds.add(p.author_id));
      (availRows ?? []).forEach(r => profileIds.add(r.author_id as string));

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", [...profileIds, ...allTaggedIds].slice(0, 200));

      const profileMap = new Map<string, ProfileSnippet>(
        (profilesData ?? []).map((p) => [p.id as string, p as ProfileSnippet]),
      );

      // 4. Resolve likes for current user
      let myLikedPostIds = new Set<string>();
      if (currentUserId && rawPosts.length > 0) {
        const postIds = rawPosts.map((p) => p.id);
        const { data: likedRows } = await supabase
          .from("profile_post_likes")
          .select("post_id")
          .eq("user_id", currentUserId)
          .in("post_id", postIds);
        myLikedPostIds = new Set((likedRows ?? []).map((r) => r.post_id as string));
      }

      // 5. Get like counts
      const likeCountMap = new Map<string, number>();
      if (rawPosts.length > 0) {
        const postIds = rawPosts.map((p) => p.id);
        // Batch count via individual queries for simplicity  
        await Promise.all(
          postIds.map(async (pid) => {
            const { count } = await supabase
              .from("profile_post_likes")
              .select("*", { count: "exact", head: true })
              .eq("post_id", pid);
            likeCountMap.set(pid, count ?? 0);
          }),
        );
      }

      // 6. Get comment counts
      const commentCountMap = new Map<string, number>();
      if (rawPosts.length > 0) {
        const postIds = rawPosts.map((p) => p.id);
        await Promise.all(
          postIds.map(async (pid) => {
            const { count } = await supabase
              .from("profile_post_comments")
              .select("*", { count: "exact", head: true })
              .eq("post_id", pid);
            commentCountMap.set(pid, count ?? 0);
          }),
        );
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

      setPosts(merged);
    } catch (e) {
      console.error("[ProfilePostsFeed] fetchPosts", e);
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    user?.id,
    filterTaggedUserId,
    filterAuthorId,
    authorNameFilter,
    sortOrder,
    refreshKey,
    supabase,
  ]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  function handleLikeToggle(postId: string, newLiked: boolean) {
    setPosts((prev) =>
      prev.map((p) =>
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
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-950/20 md:rounded-2xl border-b md:border border-slate-100 dark:border-white/5 p-4 space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-white/5" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-24 bg-slate-100 dark:bg-white/5 rounded" />
                <div className="h-2 w-16 bg-slate-50 dark:bg-white/5 rounded" />
              </div>
            </div>
            <div className="aspect-[4/3] w-full bg-slate-50 dark:bg-white/5 rounded-xl" />
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
    <div className="space-y-4">
      {/* Compose button — own profile only */}
      {isOwnProfile && (
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
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id ?? null}
            onLikeToggle={handleLikeToggle}
            isOwnFeed={isOwnProfile}
            onDeleted={handleDeleted}
          />
        ))
      )}

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
