import { useEffect, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CommentAuthor {
  id: string;
  full_name: string | null;
  photo_url: string | null;
}

interface JobComment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles?: CommentAuthor | null;
}

export function JobRequestCommentsModal({
  jobId,
  isOpen,
  onClose,
  onCommentAdded,
}: {
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded?: (jobId: string) => void;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState<JobComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!isOpen || !jobId) {
      setComments([]);
      return;
    }

    async function fetchComments() {
      setLoading(true);
      try {
        // Fetch comments
        const { data: commentsData, error: commentsErr } = await supabase
          .from("job_request_comments")
          .select(`
            id,
            body,
            created_at,
            author_id
          `)
          .eq("job_request_id", jobId)
          .order("created_at", { ascending: true });

        if (commentsErr) throw commentsErr;

        if (commentsData && commentsData.length > 0) {
          const authorIds = [...new Set(commentsData.map((c) => c.author_id))];
          
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url")
            .in("id", authorIds);

          const profMap = new Map((profilesData || []).map((p) => [p.id, p]));

          const enriched = commentsData.map((c) => ({
            ...c,
            profiles: profMap.get(c.author_id) || null,
          }));

          setComments(enriched);
        } else {
          setComments([]);
        }
      } catch (err) {
        console.error("Error fetching comments:", err);
        addToast({ title: "Failed to load comments", variant: "error" });
      } finally {
        setLoading(false);
      }
    }

    void fetchComments();
  }, [isOpen, jobId, addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !user?.id || !newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("job_request_comments")
        .insert({
          job_request_id: jobId,
          author_id: user.id,
          body: newComment.trim(),
        })
        .select(`
          id,
          body,
          created_at,
          author_id
        `)
        .single();

      if (error) throw error;

      // Fetch viewer profile details
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .eq("id", user.id)
        .single();

      const fullComment: JobComment = {
        ...inserted,
        profiles: profile || null,
      };

      try {
        const { data: jobData } = await supabase
          .from("job_requests")
          .select("client_id")
          .eq("id", jobId)
          .single();

        if (jobData && jobData.client_id && jobData.client_id !== user.id) {
          const { data: existingConvo } = await supabase
            .from("conversations")
            .select("id")
            .eq("client_id", jobData.client_id)
            .eq("freelancer_id", user.id)
            .is("job_id", null)
            .maybeSingle();

          let conversationId = existingConvo?.id;
          if (!conversationId) {
            const { data: createdConvo } = await supabase
              .from("conversations")
              .insert({
                client_id: jobData.client_id,
                freelancer_id: user.id,
                job_id: null,
              })
              .select("id")
              .single();
            if (createdConvo) conversationId = createdConvo.id;
          }

          if (conversationId) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              sender_id: user.id,
              body: `I left a comment on your request: "${newComment.trim()}"`,
            });
          }
        } else if (jobData && jobData.client_id && jobData.client_id === user.id) {
          const { data: notifications } = await supabase
            .from("job_candidate_notifications")
            .select("freelancer_id")
            .eq("job_id", jobId);

          const { data: allComments } = await supabase
            .from("job_request_comments")
            .select("author_id")
            .eq("job_request_id", jobId);

          const freelancerIds = new Set<string>();
          if (notifications) {
            for (const n of notifications) freelancerIds.add(n.freelancer_id);
          }
          if (allComments) {
            for (const c of allComments) {
              if (c.author_id !== user.id) freelancerIds.add(c.author_id);
            }
          }

          if (freelancerIds.size > 0) {
            for (const fid of Array.from(freelancerIds)) {
              const { data: existingConvo } = await supabase
                .from("conversations")
                .select("id")
                .eq("client_id", user.id)
                .eq("freelancer_id", fid)
                .is("job_id", null)
                .maybeSingle();

              let conversationId = existingConvo?.id;
              if (!conversationId) {
                const { data: createdConvo } = await supabase
                  .from("conversations")
                  .insert({
                    client_id: user.id,
                    freelancer_id: fid,
                    job_id: null,
                  })
                  .select("id")
                  .single();
                if (createdConvo) conversationId = createdConvo.id;
              }

              if (conversationId) {
                await supabase.from("messages").insert({
                  conversation_id: conversationId,
                  sender_id: user.id,
                  body: `I replied back in comments on my request: "${newComment.trim()}"`,
                });
              }
            }
          }
        }
      } catch (dmErr) {
        console.warn("[JobRequestCommentsModal] could not link direct message:", dmErr);
      }

      setComments((prev) => [...prev, fullComment]);
      setNewComment("");
      onCommentAdded?.(jobId);
    } catch (err) {
      console.error("Error submitting comment:", err);
      addToast({ title: "Could not add comment", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex h-[70vh] w-full flex-col rounded-t-[24px] bg-white p-0 shadow-2xl animate-in slide-in-from-bottom-6 duration-300 dark:bg-zinc-900 md:h-[600px] md:max-w-md md:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h3 className="text-base font-black text-zinc-900 dark:text-white">
            Comments ({comments.length})
          </h3>
          <button
            type="button"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="mt-2 text-xs font-semibold">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-zinc-400 text-center">
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">No comments yet</p>
              <p className="mt-1 text-xs text-zinc-400">Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const initials =
                  comment.profiles?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?";

                return (
                  <div key={comment.id} className="flex items-start gap-3">
                    <Avatar 
                      className="h-8 w-8 ring-1 ring-black/5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        onClose();
                        navigate(`/profile/${comment.author_id}`);
                      }}
                    >
                      <AvatarImage src={comment.profiles?.photo_url || undefined} />
                      <AvatarFallback className="text-[10px] font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-2xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
                      <p className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                        {comment.profiles?.full_name || "Member"}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Input */}
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Write a comment..."
              className="flex-1 rounded-full border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-sm font-medium text-zinc-800 placeholder-zinc-400 focus:border-emerald-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submitting}
            />
            <button
              type="submit"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:bg-zinc-200"
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
