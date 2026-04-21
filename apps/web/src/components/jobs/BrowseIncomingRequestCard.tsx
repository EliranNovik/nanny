import { useMemo } from "react";
import { Check, ChevronRight, Clock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IncomingJobRequestCardJob } from "@/components/jobs/IncomingJobRequestCard";
import { LiveTimer } from "@/components/LiveTimer";
import { JobCardLocationBar } from "@/components/jobs/JobCardLocationBar";

function serviceHeroImageSrc(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "/pickup-mar22.png";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

const glassCta = cn(
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px]",
  "bg-black/30 text-white shadow-lg backdrop-blur-2xl transition-colors",
  "hover:bg-black/40 active:scale-[0.98]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
  "disabled:pointer-events-none disabled:opacity-55",
);

export type BrowseIncomingRequestCardNotif = {
  id: string;
  job_id: string;
  created_at: string;
  status?: string;
  isConfirmed?: boolean;
  isDeclined?: boolean;
  job_requests: IncomingJobRequestCardJob;
};

export function BrowseIncomingRequestCard({
  notif,
  confirming,
  declining,
  formatJobTitle,
  onConfirm,
  onDecline,
  onOpenPreview,
}: {
  notif: BrowseIncomingRequestCardNotif;
  confirming: string | null;
  declining: string | null;
  formatJobTitle: (job: { service_type?: string }) => string;
  onConfirm: (jobId: string, notifId: string) => void;
  onDecline: (jobId: string, notifId: string) => void;
  onOpenPreview: (job: IncomingJobRequestCardJob) => void;
}) {
  const job = notif.job_requests;
  const isConfirmed = Boolean(notif.isConfirmed);
  const isDeclined = Boolean(notif.isDeclined);
  const busy = confirming === notif.id || declining === notif.id;

  const heroImg = useMemo(() => serviceHeroImageSrc(job), [job]);

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[22px] border border-white/10",
        "bg-zinc-950 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/[0.06]",
        "transition-all duration-500 ease-out",
        "max-md:snap-start max-md:scroll-mb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] max-md:scroll-mt-2",
        "hover:-translate-y-1 hover:border-emerald-400/25 hover:shadow-emerald-500/15 hover:shadow-2xl",
        (isConfirmed || isDeclined) && "opacity-70 hover:-translate-y-0",
      )}
      onClick={() => onOpenPreview(job)}
      data-request-card=""
    >
      <div className="relative aspect-[4/5] min-h-[17.5rem] w-full sm:min-h-[19rem]">
        <img
          src={heroImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          draggable={false}
        />

        {/* bottom-only scrim */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black via-black/75 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38%] bg-gradient-to-tr from-emerald-500/12 to-transparent opacity-90 mix-blend-soft-light"
          aria-hidden
        />

        <div className="absolute inset-x-0 top-0 z-[5]">
          <JobCardLocationBar location={job.location_city} />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-[6] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[18px] font-black leading-tight tracking-tight text-white">
                {formatJobTitle(job)}
              </p>
              <div className="mt-1 flex items-center gap-2 text-white/85">
                <Clock className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <LiveTimer
                  createdAt={notif.created_at || job.created_at}
                  render={({ time }) => (
                    <span className="text-[12px] font-semibold tabular-nums">
                      {time}
                    </span>
                  )}
                />
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/25 text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/15">
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </div>
          </div>

          {!isConfirmed && !isDeclined ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(glassCta, "hover:bg-black/45")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline(job.id, notif.id);
                }}
                disabled={busy}
                aria-label="Decline request"
              >
                <X className="h-4 w-4" aria-hidden />
                Decline
              </button>
              <button
                type="button"
                className={cn(glassCta, "bg-emerald-600/85 hover:bg-emerald-600")}
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm(job.id, notif.id);
                }}
                disabled={busy}
                aria-label="Accept request"
              >
                <Check className="h-4 w-4" aria-hidden />
                Accept
              </button>
            </div>
          ) : (
            <CardContent className="px-0 pb-0 pt-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                {isConfirmed ? "Accepted" : "Declined"}
              </p>
            </CardContent>
          )}
        </div>
      </div>
    </Card>
  );
}

