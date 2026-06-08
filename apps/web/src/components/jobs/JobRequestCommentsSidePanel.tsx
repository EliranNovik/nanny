import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import { Loader2, Send } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { GuestAwareProfileLink } from "@/components/GuestAwareProfileLink";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import {
  bidirectionalInputProps,
  bidirectionalTextProps,
} from "@/lib/textDirection";
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
  authorName,
  initialCount,
  wideLayout = false,
  className,
}: {
  jobId: string;
  user: User | null;
  authorName?: string;
  initialCount?: number;
  wideLayout?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();
  const dateLocale = dateFnsLocaleFor(i18n.language);
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
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
        .limit(250);
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
      const map = new Map((profs ?? []).map((p) => [p.id as string, p as ProfileSnippet]));
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
    if (count == null) return t("common.comments");
    return t("feed.commentsCount", { count });
  }, [count, t]);

  async function submitComment() {
    const body = draft.trim();
    if (!body) return;
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("job_request_comments")
        .insert({
          job_request_id: jobId,
          author_id: user.id,
          body,
        })
        .select("id, body, created_at, author_id")
        .single();
      if (error) throw error;

      const { data: me } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .eq("id", user.id)
        .single();

      setComments((prev) => [
        ...prev,
        { ...(inserted as JobComment), profiles: (me as ProfileSnippet) ?? null },
      ]);
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
        "hidden md:flex flex-col shrink-0",
        wideLayout
          ? "min-w-[320px] flex-1 max-w-[640px]"
          : "w-[380px] lg:w-[460px] xl:w-[520px] 2xl:w-[600px]",
        className,
      )}
      aria-label="Request comments"
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <div className="truncate text-base font-black text-foreground">{headerLabel}</div>
          <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {authorName ? t("feed.onAuthorsRequest", { name: authorName }) : " "}
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
                const name = c.profiles?.full_name?.trim() || "Member";
                return (
                  <div key={c.id} className="flex gap-3 py-4">
                    <GuestAwareProfileLink
                      userId={c.author_id}
                      className="shrink-0 rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={`View ${name} profile`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.profiles?.photo_url ?? undefined} />
                        <AvatarFallback className="text-xs font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </GuestAwareProfileLink>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <GuestAwareProfileLink
                          userId={c.author_id}
                          className="truncate text-[13px] font-bold text-foreground hover:underline underline-offset-2"
                          aria-label={`View ${name} profile`}
                        >
                          {name}
                        </GuestAwareProfileLink>
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
