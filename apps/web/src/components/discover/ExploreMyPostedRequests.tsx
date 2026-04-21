import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import {
  EXPLORE_PAGE_CARD_SURFACE,
  INTERACTIVE_CARD_HOVER,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { LiveTimer } from "@/components/LiveTimer";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

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

/**
 * Explore → **My requests**: open client job requests with elapsed timer + accepted-helper count.
 * Card chrome matches {@link ExploreClientHireInterests}.
 */
export function ExploreMyPostedRequests() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data, isLoading } = useFreelancerRequests(user?.id);
  const jobs = data?.myOpenRequests ?? [];

  const viewAllHref = buildJobsUrl("client", "my_requests");

  if (!user?.id) return null;

  return (
    <section className="space-y-4" aria-label="Your posted requests for help">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          to={viewAllHref}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card/30 px-4 py-6 text-sm text-muted-foreground">
          Loading your requests…
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/20 px-4 py-10 text-center">
          <p className="text-base font-semibold text-foreground">
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
                  onClick={() =>
                    navigate(`/client/jobs/${encodeURIComponent(job.id)}/live`)
                  }
                  className={cn(
                    "group relative w-full rounded-2xl p-4 text-left",
                    EXPLORE_PAGE_CARD_SURFACE,
                    INTERACTIVE_CARD_HOVER,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {title}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide",
                        acceptedPillClass(accepted),
                      )}
                      aria-label={`${accepted} accepted helper${accepted === 1 ? "" : "s"}`}
                    >
                      {accepted} accepted
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-emerald-500/20 bg-muted/40 shadow-sm ring-1 ring-emerald-500/15"
                      aria-hidden
                    >
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
                      <p className="truncate text-sm font-semibold text-muted-foreground">
                        {loc}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Posted{" "}
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                      <div
                        className="mt-1 flex min-w-0 items-center gap-1.5"
                        role="status"
                        aria-live="polite"
                      >
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Open
                        </span>
                        <LiveTimer
                          createdAt={job.created_at}
                          render={({ time }) => (
                            <span className="!font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {time}
                            </span>
                          )}
                        />
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
