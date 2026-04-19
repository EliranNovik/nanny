import { Link } from "react-router-dom";
import {
  Clock,
  XCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import JobMap from "@/components/JobMap";
import { StarRating } from "@/components/StarRating";
import { LiveTimer } from "@/components/LiveTimer";
import { JobCardLocationBar } from "@/components/jobs/JobCardLocationBar";
import { jobCardCarouselItemClass } from "@/components/jobs/JobCardsCarousel";
import {
  JOB_CARD_COMPACT_ROW,
  JOB_CARD_SHELL,
  JOB_CARD_THUMB,
  JOB_CARD_THUMB_BUTTON,
} from "@/components/jobs/jobCardSharedClasses";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";

/** Job shape required by incoming-request cards (matches Requests tab + Discover fetch). */
export type IncomingJobRequestCardJob = {
  id: string;
  client_id: string;
  community_post_id?: string | null;
  community_post_expires_at?: string | null;
  service_type?: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  notes?: string | null;
  care_type?: string | null;
  care_frequency?: string | null;
  children_count?: number | null;
  children_age_group?: string | null;
  shift_hours?: string | null;
  languages_pref?: string[] | null;
  requirements?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
  stage?: string | null;
  offered_hourly_rate?: number | null;
  price_offer_status?: string | null;
  schedule_confirmed?: boolean | null;
  service_details?: { images?: unknown };
  profiles?: {
    full_name: string;
    photo_url: string | null;
    average_rating?: number;
    total_ratings?: number;
    city?: string | null;
  };
};

export type IncomingJobRequestCardNotif = {
  id: string;
  job_id: string;
  job_requests: IncomingJobRequestCardJob;
  isConfirmed?: boolean;
  isDeclined?: boolean;
};

function serviceHeroImageSrc(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

export function IncomingJobRequestCard({
  notif,
  isMinMd,
  clippedCardIds,
  deleting,
  confirming,
  formatJobTitle,
  onDecline,
  onConfirm,
  onOpenPreview,
  onProfileClick,
}: {
  notif: IncomingJobRequestCardNotif;
  isMinMd: boolean;
  clippedCardIds: ReadonlySet<string>;
  deleting: string | null;
  confirming: string | null;
  formatJobTitle: (job: { service_type?: string }) => string;
  onDecline: (notifId: string) => void;
  onConfirm: (jobId: string, notifId: string) => void;
  onOpenPreview: (job: IncomingJobRequestCardJob) => void;
  onProfileClick: (
    e: React.MouseEvent,
    userId: string | null | undefined,
  ) => void;
}) {
  const job = notif.job_requests;
  const isConfirmed = Boolean(notif.isConfirmed);
  const isDeclined = Boolean(notif.isDeclined);

  return (
    <Card
      id={`card-${notif.id}`}
      data-job-card
      onClick={isMinMd ? undefined : () => onOpenPreview(job)}
      className={cn(
        JOB_CARD_SHELL,
        !isMinMd && "cursor-pointer",
        isMinMd && "md:cursor-default",
        isDeclined && "opacity-60",
        jobCardCarouselItemClass,
      )}
    >
      <div
        className={cn(isMinMd && "cursor-pointer")}
        onClick={isMinMd ? () => onOpenPreview(job) : undefined}
      >
        <JobCardLocationBar location={job.location_city} />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[100] bg-zinc-900/20 backdrop-blur-[0.5px] transition-opacity duration-500 md:hidden",
            clippedCardIds.has(`card-${notif.id}`)
              ? "opacity-100"
              : "opacity-0",
          )}
        />
        <div className={JOB_CARD_COMPACT_ROW}>
          <button
            type="button"
            className={cn(JOB_CARD_THUMB, JOB_CARD_THUMB_BUTTON)}
            aria-label={`Open job preview: ${formatJobTitle(job)}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview(job);
            }}
          >
            {job.service_type === "pickup_delivery" ? (
              <div className="pointer-events-none absolute inset-0 z-0">
                <JobMap job={job} />
              </div>
            ) : (
              <img
                src={serviceHeroImageSrc(job)}
                alt=""
                className="pointer-events-none h-full w-full object-cover"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <button
              type="button"
              className="flex max-w-full min-w-0 items-center gap-2 rounded-xl text-left outline-none transition-colors hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-100 dark:hover:bg-white/5"
              onClick={(e) => onProfileClick(e, job.client_id)}
              disabled={!job.client_id}
            >
              <Avatar className="h-12 w-12 shrink-0 border border-slate-200 dark:border-zinc-600 md:h-14 md:w-14">
                <AvatarImage src={job.profiles?.photo_url || ""} />
                <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white md:text-sm">
                  {job.profiles?.full_name?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <h3 className="truncate text-base font-black leading-tight text-slate-900 dark:text-white md:text-lg">
                {job.profiles?.full_name || "Client"}
              </h3>
            </button>
            {job.profiles?.average_rating ? (
              <StarRating
                rating={job.profiles.average_rating}
                size="sm"
                showCount={false}
                className="origin-left scale-90 md:scale-100"
                starClassName="text-slate-900 dark:text-neutral-200"
                emptyStarClassName="text-slate-900/25 dark:text-neutral-500/35"
              />
            ) : (
              <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 md:text-sm">
                New client
              </span>
            )}
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 md:text-sm">
              {formatJobTitle(job)}
            </span>
          </div>
          <div
            className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none"
            aria-hidden
          >
            <ChevronRight
              className="h-7 w-7 md:h-8 md:w-8"
              strokeWidth={2.25}
            />
          </div>
        </div>

        <CardContent
          className={cn(
            "border-t border-slate-100 p-4 dark:border-white/5 md:p-5",
            isMinMd && "md:cursor-pointer",
          )}
          onClick={isMinMd ? () => onOpenPreview(job) : undefined}
        >
          <div className="flex flex-col gap-4">
            {!isConfirmed &&
              !isDeclined &&
              job.community_post_id &&
              job.community_post_expires_at && (
                <div className="flex w-full items-center justify-between gap-2 text-[14px] font-bold leading-snug tracking-tight text-orange-500 dark:text-orange-400">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Clock
                      className="mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                      aria-hidden
                    />
                    <span className="min-w-0 font-medium opacity-90">
                      Post expires
                    </span>
                  </div>
                  <ExpiryCountdown
                    expiresAtIso={job.community_post_expires_at}
                    endedLabel="Post ended"
                    compact
                    className="shrink-0 tabular-nums text-[13px] font-bold text-orange-600 dark:text-orange-300"
                  />
                </div>
              )}
            {!isConfirmed &&
              !isDeclined &&
              !job.community_post_id &&
              job.created_at && (
                <div className="flex w-full items-center justify-between gap-2 text-[14px] font-bold leading-snug tracking-tight text-orange-500 dark:text-orange-400">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Clock
                      className="mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                      aria-hidden
                    />
                    <span className="min-w-0 font-medium opacity-90">
                      Time since invite
                    </span>
                  </div>
                  <LiveTimer
                    createdAt={job.created_at}
                    render={({ time }) => (
                      <span className="shrink-0 tabular-nums text-[13px] font-bold text-orange-600 dark:text-orange-300">
                        {time}
                      </span>
                    )}
                  />
                </div>
              )}
          </div>

          {job.community_post_id && (
            <Link
              to={`/public/posts?post=${job.community_post_id}`}
              className="inline-flex text-[13px] font-bold text-orange-600 underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View related community post
            </Link>
          )}

          {!isConfirmed && !isDeclined && (
            <div className="mt-2 flex gap-4 border-t border-slate-100 pt-4 dark:border-white/5">
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-[18px] border-slate-200 font-bold transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-[0.96] dark:border-white/10 dark:hover:bg-red-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline(notif.id);
                }}
                disabled={deleting === notif.id || confirming === notif.id}
              >
                {deleting === notif.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Decline
              </Button>
              <Button
                className="h-12 flex-1 rounded-[18px] bg-emerald-600 font-bold text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] transition-all hover:bg-emerald-700 active:scale-[0.96]"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm(job.id, notif.id);
                }}
                disabled={deleting === notif.id || confirming === notif.id}
              >
                {confirming === notif.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Accept
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
