import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ChevronRight, Sparkles, Star, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

type ReviewRow = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  } | null;
  reviewee: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  } | null;
};

function initials(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  if (!t) return "??";
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : (parts[0]?.[1] ?? "");
  const s = (first + last).toUpperCase();
  return s || "??";
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export function DiscoverHomeLatestReviews({ limit = 6 }: { limit?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  const gradients = useMemo(
    () => [
      "from-blue-400 to-purple-500",
      "from-green-400 to-teal-500",
      "from-orange-400 to-pink-500",
      "from-red-400 to-indigo-500",
      "from-purple-400 to-blue-500",
      "from-emerald-400 to-cyan-500",
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const q = supabase
        .from("job_reviews")
        .select(
          `
            id,
            rating,
            review_text,
            created_at,
            reviewer:profiles!reviewer_id (
              id,
              full_name,
              photo_url
            ),
            reviewee:profiles!reviewee_id (
              id,
              full_name,
              photo_url
            )
          `
        )
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(20, limit)));

      // Avoid showing reviews about the current user when possible.
      const res = user?.id ? await q.neq("reviewee_id", user.id) : await q;
      if (cancelled) return;
      if (res.error) {
        console.warn("[DiscoverHomeLatestReviews] job_reviews:", res.error);
        setRows([]);
        setLoading(false);
        return;
      }
      const data = (res.data ?? []) as any[];
      const normalized = data.map((r) => ({
        ...r,
        reviewer: r.reviewer || { id: "", full_name: "Anonymous", photo_url: null },
        reviewee: r.reviewee || null,
      })) as ReviewRow[];
      setRows(normalized);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, user?.id]);

  const visible = useMemo(() => rows.slice(0, Math.max(1, Math.min(20, limit))), [rows, limit]);
  const preview = visible[0] ?? null;

  if (loading && visible.length === 0) {
    return (
      <section className="w-full" aria-label="Latest reviews">
        <div className="flex items-center justify-between gap-3 pb-3 pt-1">
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight text-stone-900 sm:text-xl dark:text-white">Latest reviews</h2>
            <p className="text-sm font-medium text-muted-foreground">Loading…</p>
          </div>
        </div>
      </section>
    );
  }

  if (!preview) return null;

  const renderReviewCard = (r: ReviewRow, idx: number, variant: "preview" | "modal") => {
    const reviewerName = r.reviewer?.full_name?.trim() || "Anonymous";
    const revieweeName = r.reviewee?.full_name?.trim() || "Profile";
    const text = (r.review_text || "").trim();
    const clampedText = variant === "preview" ? "line-clamp-2" : "line-clamp-5";

    const reviewerId = r.reviewer?.id?.trim() || "";
    const revieweeId = r.reviewee?.id?.trim() || "";
    const gradient = gradients[idx % gradients.length] ?? gradients[0];

    return (
      <article
        className={cn(
          "group relative w-full rounded-3xl border border-slate-200/90 bg-white p-6 pt-12 text-left",
          "shadow-md shadow-slate-950/5 transition-all duration-300 hover:shadow-lg",
          "dark:border-border/50 dark:bg-zinc-900 dark:shadow-black/20 dark:hover:shadow-lg"
        )}
      >
        {/* Floating avatar (PublicProfile-style) */}
        <div
          className={cn(
            "absolute -top-10 left-6 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl",
            "transition-transform duration-300 group-hover:scale-110",
            gradient
          )}
        >
          <button
            type="button"
            disabled={!reviewerId}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!reviewerId) return;
              setIsOpen(false);
              navigate(`/profile/${encodeURIComponent(reviewerId)}`);
            }}
            className={cn(
              "block h-full w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              !reviewerId && "pointer-events-none"
            )}
            aria-label={reviewerId ? `Open ${reviewerName} profile` : "Reviewer profile unavailable"}
          >
            <Avatar className="h-full w-full border-4 border-white dark:border-zinc-900">
              <AvatarImage src={r.reviewer?.photo_url || undefined} className="object-cover" />
              <AvatarFallback className="bg-transparent text-white font-black text-lg">
                {initials(reviewerName)}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <h4 className="truncate text-xl font-black text-gray-900 transition-colors dark:text-white">
                {reviewerName}
              </h4>
              <p className="mt-1 truncate text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                for{" "}
                <button
                  type="button"
                  disabled={!revieweeId}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!revieweeId) return;
                    setIsOpen(false);
                    navigate(`/profile/${encodeURIComponent(revieweeId)}`);
                  }}
                  className={cn(
                    "inline-flex max-w-[14rem] items-center truncate text-left font-black text-slate-800 underline-offset-2 hover:underline dark:text-slate-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
                    !revieweeId && "pointer-events-none no-underline font-semibold text-slate-500 dark:text-slate-400"
                  )}
                  aria-label={revieweeId ? `Open ${revieweeName} profile` : "Reviewee profile unavailable"}
                >
                  {revieweeName}
                </button>
                {r.created_at ? <span className="text-slate-500/90 dark:text-slate-400/90"> · {formatReviewDate(r.created_at)}</span> : null}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
              <span className="text-[12px] font-black text-yellow-700 dark:text-yellow-500">
                {Math.max(0, Math.min(5, Number(r.rating) || 0)).toFixed(1).replace(/\.0$/, "")}
              </span>
            </div>
          </div>

          {text ? (
            <p
              className={cn(
                "text-[15px] italic leading-relaxed text-gray-700 dark:text-slate-300",
                clampedText,
                "sm:text-base"
              )}
            >
              “{text}”
            </p>
          ) : null}
        </div>

        {variant === "preview" ? (
          <ChevronRight className="absolute right-5 top-6 h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
        ) : null}
      </article>
    );
  };

  return (
    <section className="w-full" aria-label="Latest reviews">
      <div className="flex items-center justify-between gap-3 pb-4 pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-1.5 py-1 text-left transition-colors hover:bg-emerald-500/5 active:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Open all latest reviews"
        >
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-stone-900 sm:text-xl dark:text-white">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Sparkles className="h-6 w-6" strokeWidth={2.25} aria-hidden />
              </span>
              <span>Latest reviews</span>
            </h2>
          </div>
        </button>
      </div>

      {/* Mobile: show 1 card only. sm+: show up to 5 in a horizontal strip */}
      <div
        className={cn(
          "flex gap-4 overflow-x-hidden overflow-y-visible pb-1 pt-10",
          "sm:overflow-x-auto sm:overflow-y-visible sm:overscroll-x-contain sm:[-webkit-overflow-scrolling:touch]",
          "sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden",
          "sm:snap-x sm:snap-mandatory sm:touch-pan-x"
        )}
      >
        {visible.map((r, idx) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setIsOpen(true)}
            className={cn(
              idx > 0 && "hidden sm:block",
              "w-full sm:w-[min(92vw,24rem)] sm:shrink-0 sm:snap-start",
              "text-left transition-transform active:scale-[0.99] overflow-visible"
            )}
            aria-label="Open all latest reviews"
          >
            {renderReviewCard(r, idx, "preview")}
          </button>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[100vw] w-full h-[100dvh] p-0 border-none bg-background gap-0 overflow-hidden flex flex-col sm:rounded-none">
          <div className="relative flex h-full w-full flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/5 bg-background/90 px-5 py-4 backdrop-blur-md dark:border-white/5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600/90 dark:text-orange-400/90">
                  Latest
                </p>
                <h3 className="truncate text-lg font-black tracking-tight text-stone-900 dark:text-white">
                  Reviews
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="group rounded-full border border-black/5 bg-card/90 p-3 shadow-2xl backdrop-blur-sm transition-all hover:bg-card active:scale-[0.98] dark:border-white/5 dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-900 transition-transform group-hover:scale-110 dark:text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
              <div className="flex flex-col gap-14 pt-6">
                {visible.slice(0, 6).map((r, idx) => (
                  <div key={`modal-${r.id}`}>{renderReviewCard(r, idx, "modal")}</div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

