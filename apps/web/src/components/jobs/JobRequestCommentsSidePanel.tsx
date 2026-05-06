import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ProfileSnippet = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

type JobComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles?: ProfileSnippet | null;
};

export function JobRequestCommentsSidePanel({
  jobId,
  user,
  initialCount,
  className,
}: {
  jobId: string;
  user: User | null;
  initialCount?: number;
  className?: string;
}) {
  const { addToast } = useToast();
  const [comments, setComments] = useState<JobComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [count, setCount] = useState<number | null>(
    typeof initialCount === "number" ? initialCount : null,
  );

  const fetchCount = useCallback(async () => {
    try {
      const { count: n, error } = await supabase
        .from("job_request_comments")
        .select("*", { count: "exact", head: true })
        .eq("job_request_id", jobId);
      if (error) throw error;
      setCount(n ?? 0);
    } catch {
      setCount(null);
    }
  }, [jobId]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("job_request_comments")
        .select("id, body, created_at, author_id")
        .eq("job_request_id", jobId)
        .order("created_at", { ascending: true })
        .limit(120);
      if (error) throw error;
      const list = (rows ?? []) as Omit<JobComment, "profiles">[];
      if (list.length === 0) {
        setComments([]);
        return;
      }

      const ids = [...new Set(list.map((r) => r.author_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id as string, p]));
      setComments(list.map((r) => ({ ...r, profiles: map.get(r.author_id) ?? null })));
    } catch (e) {
      console.error("[JobRequestCommentsSidePanel] fetch", e);
      addToast({ title: "Could not load comments", variant: "error" });
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, jobId]);

  useEffect(() => {
    void fetchCount();
    void fetchComments();
  }, [fetchCount, fetchComments]);

  const headerLabel = useMemo(() => {
    if (count == null) return "Comments";
    return `${count} Comments`;
  }, [count]);

  async function submit() {
    const text = draft.trim();
    if (!text || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("job_request_comments")
        .insert({
          job_request_id: jobId,
          author_id: user.id,
          body: text,
        })
        .select("id, body, created_at, author_id")
        .single();
      if (error) throw error;

      const { data: me } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .eq("id", user.id)
        .single();

      setComments((prev) => [...prev, { ...(inserted as any), profiles: (me as any) ?? null }]);
      setDraft("");
      void fetchCount();
    } catch (e) {
      console.error("[JobRequestCommentsSidePanel] submit", e);
      addToast({ title: "Could not post comment", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      className={cn(
        "hidden md:flex w-[320px] lg:w-[360px] xl:w-[400px] 2xl:w-[440px] flex-col",
        className,
      )}
      aria-label="Job comments"
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <div className="truncate text-base font-black text-foreground">
            {headerLabel}
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No comments yet. Be the first!
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {comments.map((c) => {
              const name = c.profiles?.full_name?.trim() || "Member";
              const initial = name.charAt(0).toUpperCase();
              return (
                <div key={c.id} className="flex gap-3 py-4">
                  <Link
                    to={`/profile/${c.author_id}`}
                    className="shrink-0 rounded-full outline-none hover:opacity-90"
                    aria-label={`View ${name} profile`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.profiles?.photo_url ?? undefined} />
                      <AvatarFallback className="text-xs font-bold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-bold text-foreground">
                        {name}
                      </span>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
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

      <div className="border-t border-border/60 bg-background/80 px-1 pt-3 pb-2">
        {user ? (
          <div className="flex items-end gap-2">
            <input
              type="text"
              placeholder="Write a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="min-h-[2.5rem] flex-1 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
              disabled={submitting}
            />
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={submitting || !draft.trim()}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "↵"}
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-semibold text-emerald-600 underline underline-offset-2">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}
      </div>
    </aside>
  );
}

