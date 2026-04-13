import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ProfileSnippet = {
  full_name: string | null;
  photo_url: string | null;
};

export type CommunityPostComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: ProfileSnippet | null;
};

type CommunityPostCommentsControlProps = {
  postId: string;
  loginRedirect: string;
  user: User | null;
  /** Match tap targets on public post cards */
  largeIcon?: boolean;
  className?: string;
};

export function CommunityPostCommentsControl({
  postId,
  loginRedirect,
  user,
  largeIcon = false,
  className,
}: CommunityPostCommentsControlProps) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [comments, setComments] = useState<CommunityPostComment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");

  const fetchCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const { count: n, error } = await supabase
        .from("community_post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      if (error) throw error;
      setCount(n ?? 0);
    } catch (e) {
      console.error("[CommunityPostCommentsControl] count", e);
      setCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [postId]);

  const fetchComments = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data: rows, error } = await supabase
        .from("community_post_comments")
        .select("id, body, created_at, author_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const list = rows ?? [];
      if (list.length === 0) {
        setComments([]);
        return;
      }
      let withProfiles: CommunityPostComment[] = list.map((r) => ({
        ...r,
        profiles: null,
      }));
      if (user?.id) {
        const ids = [...new Set(list.map((r) => r.author_id as string))];
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", ids);
        if (!pErr && profs?.length) {
          const map = new Map(profs.map((p) => [p.id as string, p]));
          withProfiles = list.map((r) => ({
            ...r,
            profiles: map.get(r.author_id as string) ?? null,
          }));
        }
      }
      setComments(withProfiles);
    } catch (e) {
      console.error("[CommunityPostCommentsControl] list", e);
      addToast({
        title: "Could not load comments",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
      setComments([]);
    } finally {
      setLoadingList(false);
    }
  }, [postId, addToast, user?.id]);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (open) void fetchComments();
  }, [open, fetchComments]);

  const onSubmit = async () => {
    const text = draft.trim();
    if (!text || !user?.id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("community_post_comments").insert({
        post_id: postId,
        author_id: user.id,
        body: text,
      });
      if (error) throw error;
      setDraft("");
      void fetchComments();
      void fetchCount();
      addToast({ title: "Comment posted", variant: "success" });
    } catch (e) {
      addToast({
        title: "Could not post",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const iconClass = largeIcon ? "h-6 w-6" : "h-5 w-5";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "shrink-0 gap-1.5 px-2 text-muted-foreground hover:bg-transparent hover:text-foreground",
          largeIcon ? "h-12 min-w-[3.25rem] px-2.5" : "h-10 min-w-[2.75rem]",
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={`Comments${count != null ? `, ${count}` : ""}`}
      >
        <MessageCircle className={iconClass} strokeWidth={2} aria-hidden />
        <span
          className={cn(
            "min-w-[1ch] tabular-nums text-muted-foreground",
            largeIcon ? "text-sm font-semibold" : "text-xs font-semibold"
          )}
        >
          {loadingCount ? "…" : count ?? "–"}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,560px)] flex-col gap-0 p-0 sm:max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageCircle className="h-5 w-5 text-orange-500" strokeWidth={2} aria-hidden />
              Comments
              {count != null && (
                <span className="text-sm font-normal text-muted-foreground">({count})</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[min(50vh,320px)] px-4">
            <div className="space-y-4 py-3 pr-3">
              {loadingList ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No comments yet. Be the first to say something.
                </p>
              ) : (
                comments.map((c) => {
                  const prof = c.profiles;
                  const name = prof?.full_name?.trim() || "Member";
                  const initial = name.charAt(0).toUpperCase();
                  return (
                    <div key={c.id} className="flex gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={prof?.photo_url ?? undefined} alt="" />
                        <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                          <span className="text-sm font-semibold text-foreground">{name}</span>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={c.created_at}
                            title={new Date(c.created_at).toISOString()}
                          >
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border bg-muted/30 px-4 py-3">
            {user ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Write a comment…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                  className="min-h-[88px] resize-none bg-background"
                  disabled={submitting}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setDraft("")}
                    disabled={submitting || !draft.trim()}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600"
                    disabled={submitting || !draft.trim()}
                    onClick={() => void onSubmit()}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Post"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
                  className="font-semibold text-orange-600 underline underline-offset-2 hover:text-orange-700"
                >
                  Sign in
                </Link>{" "}
                to join the conversation.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
