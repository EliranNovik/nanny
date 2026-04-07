import { Link } from "react-router-dom";
import { Clock, XCircle, CheckCircle2, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import JobMap from "@/components/JobMap";
import { StarRating } from "@/components/StarRating";
import { LiveTimer } from "@/components/LiveTimer";
import { JobCardLocationBar } from "@/components/jobs/JobCardLocationBar";
import { JobAttachedPhotosStrip, jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";
import { jobCardCarouselItemClass } from "@/components/jobs/JobCardsCarousel";
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
  time_duration?: string | null;
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
  /** When false, hides client-uploaded photos from `service_details.images` (e.g. Discover home). */
  showUserAttachments = true,
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
  onProfileClick: (e: React.MouseEvent, userId: string | null | undefined) => void;
  showUserAttachments?: boolean;
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
        "group relative flex h-full w-full flex-col overflow-hidden rounded-[32px] border-0 bg-transparent shadow-none transition-all duration-500 md:border md:border-slate-300/45 md:bg-card md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:backdrop-blur-sm md:dark:border-zinc-500/35 md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:-translate-y-2 md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)]",
        !isMinMd && "cursor-pointer",
        isMinMd && "md:cursor-default",
        isDeclined && "opacity-60",
        jobCardCarouselItemClass
      )}
    >
      <div
        className={cn(isMinMd && "cursor-pointer")}
        onClick={isMinMd ? () => onOpenPreview(job) : undefined}
      >
        <JobCardLocationBar
          location={job.location_city}
          trailing={
            <Badge
              className={cn(
                "h-7 shrink-0 rounded-full border-none px-2.5 text-[9px] font-black uppercase leading-tight tracking-wide shadow-md sm:px-3 sm:text-[10px]",
                isDeclined
                  ? "bg-slate-200 text-slate-600"
                  : isConfirmed
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white"
              )}
            >
              {isDeclined ? "Declined" : isConfirmed ? "Confirmed" : "Waiting"}
            </Badge>
          }
        />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[100] bg-zinc-900/20 backdrop-blur-[0.5px] transition-opacity duration-500 md:hidden",
            clippedCardIds.has(`card-${notif.id}`) ? "opacity-100" : "opacity-0"
          )}
        />
        <div className="flex gap-3 p-3 md:hidden">
          <div className="pointer-events-none relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-border/40 dark:bg-muted dark:ring-white/10">
            {job.service_type === "pickup_delivery" ? (
              <div className="absolute inset-0 z-0">
                <JobMap job={job} />
              </div>
            ) : (
              <img
                src={serviceHeroImageSrc(job)}
                alt={formatJobTitle(job)}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <button
              type="button"
              className="flex max-w-full min-w-0 items-center gap-2 rounded-xl text-left outline-none transition-colors hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-100 dark:hover:bg-white/5"
              onClick={(e) => onProfileClick(e, job.client_id)}
              disabled={!job.client_id}
            >
              <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-zinc-600">
                <AvatarImage src={job.profiles?.photo_url || ""} />
                <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white">
                  {job.profiles?.full_name?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <h3 className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">
                {job.profiles?.full_name || "Client"}
              </h3>
            </button>
            {job.profiles?.average_rating ? (
              <StarRating
                rating={job.profiles.average_rating}
                size="sm"
                showCount={false}
                className="origin-left scale-90"
                starClassName="text-slate-900 dark:text-neutral-200"
                emptyStarClassName="text-slate-900/25 dark:text-neutral-500/35"
              />
            ) : (
              <span className="text-[12px] font-semibold text-slate-500">New client</span>
            )}
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {formatJobTitle(job)}
            </span>
          </div>
          <div
            className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none"
            aria-hidden
          >
            <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
          </div>
        </div>
        <div className="relative hidden h-36 w-full overflow-hidden group/img sm:h-40 md:block">
          {job.service_type === "pickup_delivery" ? (
            <div className="absolute inset-0 z-0">
              <JobMap job={job} />
            </div>
          ) : (
            <img
              src={serviceHeroImageSrc(job)}
              alt={formatJobTitle(job)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover/img:scale-110"
            />
          )}
          <div className="absolute inset-0 z-10 bg-black/40" />
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/40 to-transparent" />
          <div className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white backdrop-blur-md">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <div
            className="absolute inset-0 z-[30] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview(job);
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute bottom-3 left-6 right-6 z-[40] flex flex-col gap-2">
            <button
              type="button"
              className="pointer-events-auto flex max-w-full min-w-0 items-center gap-3 rounded-xl text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-100"
              onClick={(e) => onProfileClick(e, job.client_id)}
              disabled={!job.client_id}
            >
              <Avatar className="h-20 w-20 flex-shrink-0 border-2 border-white/30 shadow-2xl transition-transform duration-500 group-hover:scale-110">
                <AvatarImage src={job.profiles?.photo_url || ""} />
                <AvatarFallback className="bg-orange-500 text-sm font-black text-white">
                  {job.profiles?.full_name?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <h3 className="min-w-0 flex-1 text-[24px] font-black tracking-tight text-white drop-shadow-xl">
                {job.profiles?.full_name || "Client"}
              </h3>
            </button>
            <div className="pointer-events-none flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-0.5">
                {job.profiles?.average_rating ? (
                  <StarRating
                    rating={job.profiles.average_rating}
                    size="sm"
                    showCount={false}
                    starClassName="text-white"
                    emptyStarClassName="text-white/30"
                    numberClassName="text-[14px] text-white drop-shadow-md"
                  />
                ) : (
                  <span className="text-[14px] font-bold italic text-white/80 drop-shadow-md">New Client</span>
                )}
              </div>
              <span className="w-full text-center text-[16px] font-black uppercase tracking-[0.14em] text-white/95 drop-shadow-md sm:text-[17px]">
                {formatJobTitle(job)}
              </span>
            </div>
          </div>
        </div>

        {showUserAttachments ? (
          <JobAttachedPhotosStrip images={jobAttachmentImageUrls(job)} />
        ) : null}

        <CardContent
          className={cn(
            "flex flex-1 flex-col gap-5 p-4 pt-2 md:gap-6 md:p-6 md:pt-6",
            isMinMd && "md:cursor-pointer"
          )}
          onClick={isMinMd ? () => onOpenPreview(job) : undefined}
        >
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-x-6">
              {job.time_duration && (
                <div className="flex items-center gap-3 text-[17px] font-semibold tracking-tight text-slate-700 dark:text-slate-300">
                  <Clock className="h-6 w-6 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{job.time_duration.replace(/_/g, "-")}</span>
                </div>
              )}
            </div>

            {!isConfirmed && !isDeclined && job.community_post_id && job.community_post_expires_at && (
              <div className="flex flex-wrap items-center gap-2 text-[15px] font-bold tracking-tight text-orange-500">
                <Clock className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium opacity-80">Post expires</span>
                <ExpiryCountdown
                  expiresAtIso={job.community_post_expires_at}
                  endedLabel="Post ended"
                  className="text-[15px] font-black text-orange-600 dark:text-orange-400"
                />
              </div>
            )}
            {!isConfirmed && !isDeclined && !job.community_post_id && job.created_at && (
              <div className="flex items-center gap-3 text-[16px] font-bold tracking-tight text-orange-400">
                <Clock className="h-5 w-5 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="font-medium opacity-60">Time since invite</span>
                  <LiveTimer createdAt={job.created_at} />
                </div>
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
            <div className="mt-auto flex gap-4 border-t border-slate-100 pt-6 max-md:border-t-0 max-md:pt-3 dark:border-white/5">
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
