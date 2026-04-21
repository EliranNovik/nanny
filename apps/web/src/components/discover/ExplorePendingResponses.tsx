import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

type InboundNotif = {
  id: string;
  created_at: string;
  isConfirmed?: boolean;
  job_id: string;
  job_requests: {
    id: string;
    service_type?: string | null;
    location_city?: string | null;
    created_at: string;
    profiles?: { full_name?: string | null } | null;
  };
};

function formatJobTitle(job: { service_type?: string | null }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Help request";
}

function serviceHeroImageSrc(job: { service_type?: string | null }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

export function ExplorePendingResponses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useFreelancerRequests(user?.id);
  const inbound = (data?.inboundNotifications ?? []) as InboundNotif[];

  const pending = useMemo(
    () => inbound.filter((n) => Boolean(n.isConfirmed)),
    [inbound],
  );

  const viewAllHref = useMemo(
    () => buildJobsUrl("freelancer", "pending"),
    [],
  );

  if (!user?.id) return null;

  return (
    <section className="space-y-4" aria-label="Pending response">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate(viewAllHref)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card/30 px-4 py-6 text-sm text-muted-foreground">
          Loading pending…
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/20 px-4 py-10 text-center">
          <p className="text-base font-semibold text-foreground">
            No pending responses
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            When you accept a request, it will show here while you wait for the
            client to confirm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pending.map((n) => {
            const job = n.job_requests;
            const title = formatJobTitle(job);
            const loc = (job.location_city ?? "").trim() || "Location not set";
            const imgSrc = serviceHeroImageSrc(job);
            const clientName =
              String(job.profiles?.full_name ?? "").trim() || "Client";

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => navigate(viewAllHref)}
                className={cn(
                  "group relative w-full rounded-2xl p-4 text-left",
                  EXPLORE_PAGE_CARD_SURFACE,
                  INTERACTIVE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {title}
                  </p>
                  <span className="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Pending
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-muted/40 shadow-sm ring-1 ring-black/5 dark:border-white/10 dark:ring-white/10"
                    aria-hidden
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted/50">
                        <Clock className="h-8 w-8 text-muted-foreground/50" strokeWidth={2} aria-hidden />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-black/10" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-muted-foreground">
                      {loc}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      With {clientName}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <Clock
                        className="h-3.5 w-3.5 shrink-0 text-amber-700/70 dark:text-amber-300/70"
                        aria-hidden
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Waiting
                      </span>
                      <LiveTimer
                        createdAt={n.created_at || job.created_at}
                        render={({ time }) => (
                          <span className="!font-mono text-[11px] font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                            {time}
                          </span>
                        )}
                      />
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

