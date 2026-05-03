import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock, Sparkles, UtensilsCrossed, Truck, Baby, Wrench, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  EXPLORE_PAGE_CARD_HOVER,
  EXPLORE_PAGE_CARD_SURFACE,
  EXPLORE_PAGE_CARD_THUMB,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";


function formatJobTitle(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Help request";
}

function serviceHeroImageSrc(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

function acceptedPillClass(accepted: number): string {
  if (accepted > 0)
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  other_help: Wrench,
};

function CategoryIcon({
  serviceType,
  className,
}: {
  serviceType: string | null | undefined;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[(serviceType ?? "").toLowerCase()] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Explore → **My requests**: open client job requests with elapsed timer + accepted-helper count.
 * Card chrome matches {@link ExploreClientHireInterests}.
 */
export function ExploreMyPostedRequests() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useFreelancerRequests(user?.id);
  const jobs = data?.myOpenRequests ?? [];
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (jobs.length === 0) return;
    async function fetchCounts() {
      const jobIds = jobs.map((j: { id: string }) => j.id);
      const { data: comments } = await supabase
        .from("job_request_comments")
        .select("job_request_id");

      if (comments) {
        const counts: Record<string, number> = {};
        for (const c of comments) {
          if (jobIds.includes(c.job_request_id)) {
            counts[c.job_request_id] = (counts[c.job_request_id] || 0) + 1;
          }
        }
        setCommentCounts(counts);
      }
    }
    fetchCounts();
  }, [jobs]);

  if (!user?.id) return null;

  return (
    <section className="space-y-4" aria-label="Your posted requests for help">
      {isLoading ? (
        <div className="rounded-2xl border-0 bg-zinc-50 px-4 py-6 text-sm text-muted-foreground shadow-sm dark:bg-zinc-900">
          Loading your requests…
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border-0 bg-zinc-50 px-4 py-10 text-center shadow-sm dark:bg-zinc-900/50">
          <p className="text-lg font-bold text-foreground">
            No open requests
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Post a request for help to see it here with a live timer and how
            many helpers accepted.
          </p>
          {profile?.role === "client" || profile?.role === "freelancer" ? (
            <Link
              to="/client/create"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Post a request
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map(
            (job: {
              id: string;
              service_type?: string;
              location_city?: string | null;
              created_at: string;
              acceptedCount?: number;
            }) => {
              const accepted =
                typeof job.acceptedCount === "number" ? job.acceptedCount : 0;
              const title = formatJobTitle(job);
              const loc =
                (job.location_city ?? "").trim() || "Location not set";
              const imgSrc = serviceHeroImageSrc(job);

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(`/client/jobs/${job.id}/live`)}
                  className={cn(
                    "group relative w-full rounded-2xl pt-2 px-4 pb-4 text-left",
                    EXPLORE_PAGE_CARD_SURFACE,
                    EXPLORE_PAGE_CARD_HOVER,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/20">
                        <CategoryIcon
                          serviceType={job.service_type}
                          className="h-3 w-3 shrink-0 text-white/90"
                        />
                        {title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide",
                          acceptedPillClass(accepted),
                        )}
                        aria-label={`${accepted} accepted helper${accepted === 1 ? "" : "s"}`}
                      >
                        {accepted} accepted
                      </span>
                      {commentCounts[job.id] > 0 && (
                        <span className="shrink-0 flex items-center gap-1 rounded-full bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {commentCounts[job.id]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className={EXPLORE_PAGE_CARD_THUMB} aria-hidden>
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/50">
                          <Clock
                            className="h-8 w-8 text-emerald-600/45 dark:text-emerald-400/50"
                            strokeWidth={2}
                          />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-black/15" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-800 sm:text-sm dark:text-zinc-300">
                        {loc}
                      </p>
                      <div
                        className="mt-1.5 flex items-center gap-1.5 text-[15px] font-medium text-slate-500 sm:text-sm dark:text-zinc-400"
                        role="status"
                        aria-live="polite"
                      >
                        <Clock
                          className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                        <span>Posted {timeAgo(job.created_at)}</span>
                      </div>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                      strokeWidth={2}
                    />
                  </div>
                </button>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}
