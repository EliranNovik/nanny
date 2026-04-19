import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Clock,
  Hourglass,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import JobMap from "@/components/JobMap";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { LiveTimer } from "@/components/LiveTimer";
import { useJobCardEdgeOverlay } from "@/hooks/useJobCardEdgeOverlay";
import { useIsMinMd } from "@/hooks/useIsMinMd";
import { JobCardLocationBar } from "@/components/jobs/JobCardLocationBar";
import {
  JobCardsCarousel,
  jobCardCarouselItemClass,
} from "@/components/jobs/JobCardsCarousel";
import {
  JOB_CARD_COMPACT_ROW,
  JOB_CARD_EMPTY_PANEL,
  JOB_CARD_SHELL,
  JOB_CARD_THUMB,
  JOB_CARD_THUMB_BUTTON,
} from "@/components/jobs/jobCardSharedClasses";
import {
  IncomingJobRequestCard,
  type IncomingJobRequestCardJob,
} from "@/components/jobs/IncomingJobRequestCard";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { matchesCommunityRequestsIncoming } from "@/lib/communityRequestsNotificationFilter";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/data/keys";
interface JobRequest {
  id: string;
  client_id: string;
  status: string;
  /** Set when job was created from a public community “Hire now” action */
  community_post_id?: string | null;
  /** Snapshot of community_posts.expires_at at hire time */
  community_post_expires_at?: string | null;
  service_type?: string;
  care_type?: string;
  children_count?: number;
  children_age_group?: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  service_details?: any;
  time_duration?: string | null;
  care_frequency?: string | null;
  shift_hours?: string | null;
  languages_pref?: string[] | null;
  requirements?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
  notes?: string | null;
  stage?: string | null;
  offered_hourly_rate?: number | null;
  price_offer_status?: string | null;
  schedule_confirmed?: boolean | null;
}

interface InboundNotification {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  isConfirmed?: boolean;
  isDeclined?: boolean;
  job_requests: JobRequest & {
    profiles?: {
      full_name: string;
      photo_url: string | null;
      average_rating?: number;
      total_ratings?: number;
    };
  };
}

interface RequestsTabContentProps {
  activeTab: "my_requests" | "requests" | "pending";
}

function serviceHeroImageSrc(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

export default function RequestsTabContent({
  activeTab,
}: RequestsTabContentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceFilterRaw = searchParams.get("service");
  const serviceFilter = isServiceCategoryId(serviceFilterRaw)
    ? serviceFilterRaw
    : null;
  const { addToast } = useToast();
  const isMinMd = useIsMinMd();
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] =
    useState<JobRequest | null>(null);

  const { data, isLoading: loading } = useFreelancerRequests(user?.id);
  const myOpenRequests: JobRequest[] = data?.myOpenRequests ?? [];
  const inboundNotifications: InboundNotification[] = data?.inboundNotifications ?? [];

  const edgeOverlayKey = useMemo(
    () =>
      `${activeTab}-${inboundNotifications.length}-${myOpenRequests.length}-${loading ? 1 : 0}`,
    [activeTab, inboundNotifications.length, myOpenRequests.length, loading],
  );
  const clippedCardIds = useJobCardEdgeOverlay(edgeOverlayKey);

  async function handleConfirm(jobId: string, notifId: string) {
    setConfirming(notifId);
    try {
      await apiPost(`/api/jobs/${jobId}/notifications/${notifId}/open`, {});
      await apiPost(`/api/jobs/${jobId}/confirm`, {});
      // Invalidate so React Query refetches with correct isConfirmed state
      void queryClient.invalidateQueries({ queryKey: queryKeys.freelancerRequests(user?.id) });
      addToast({
        title: "Job Accepted!",
        description:
          "It's been moved to Pending response while we wait for the client's final confirmation.",
        variant: "success",
      });
    } catch (err: any) {
      console.error("Error confirming availability:", err);
      addToast({
        title: "Failed to accept",
        description:
          err?.message || "Failed to confirm availability. Please try again.",
        variant: "error",
      });
    } finally {
      setConfirming(null);
    }
  }

  async function handleDecline(notifId: string): Promise<boolean> {
    setDeleting(notifId);
    try {
      const { error } = await supabase
        .from("job_candidate_notifications")
        .delete()
        .eq("id", notifId);
      if (error) throw error;
      void queryClient.invalidateQueries({ queryKey: queryKeys.freelancerRequests(user?.id) });
      addToast({
        title: "Request Declined",
        description: "The job request has been removed.",
        variant: "success",
      });
      return true;
    } catch (err: any) {
      console.error("Error deleting notification:", err);
      addToast({
        title: "Failed to decline",
        description: "Could not decline the request. Please try again.",
        variant: "error",
      });
      return false;
    } finally {
      setDeleting(null);
    }
  }

  function formatJobTitle(job: { service_type?: string }) {
    if (job.service_type === "cleaning") return "Cleaning";
    if (job.service_type === "cooking") return "Cooking";
    if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
    if (job.service_type === "nanny") return "Nanny";
    if (job.service_type === "other_help") return "Other Help";
    return "Service Request";
  }

  function openJobPreview(job: IncomingJobRequestCardJob) {
    if (job.service_type === "pickup_delivery")
      setSelectedMapJob(job as JobRequest);
    else setSelectedJobDetails(job as JobRequest);
  }

  function goToPublicProfile(
    e: React.MouseEvent,
    userId: string | null | undefined,
  ) {
    e.stopPropagation();
    if (!userId) return;
    navigate(`/profile/${userId}`);
  }

  function jobMatchesServiceFilter(
    job: { service_type?: string } | null | undefined,
  ) {
    if (!serviceFilter || !job) return true;
    return job.service_type === serviceFilter;
  }

  const incomingItems = inboundNotifications.filter((n) =>
    matchesCommunityRequestsIncoming(n, {
      serviceFilter: serviceFilter ?? null,
    }),
  );
  /** For empty-state copy when category filter hides all rows */
  const incomingCountIgnoringCategory = inboundNotifications.filter((n) =>
    matchesCommunityRequestsIncoming(n, {}),
  ).length;
  const pendingItems = inboundNotifications.filter(
    (n) =>
      Boolean(n.isConfirmed) && jobMatchesServiceFilter(n.job_requests),
  );
  const pendingCountIgnoringCategory = inboundNotifications.filter((n) =>
    Boolean(n.isConfirmed),
  ).length;
  const filteredMyOpenRequests = myOpenRequests.filter(jobMatchesServiceFilter);

  const clearServiceFilter = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("service");
        return next;
      },
      { replace: true },
    );
  };

  if (loading)
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="relative -mx-4">
          <div className="flex gap-4 px-4 pb-8 overflow-hidden">
            {[1, 2].map((i) => (
              <div key={i} className="min-w-[85vw] md:min-w-[420px] shrink-0">
                <Card className="border border-slate-200/70 dark:border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 px-4 py-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                  <div className="flex items-center gap-4 px-4 py-4">
                    <Skeleton className="h-[5.25rem] w-[5.25rem] shrink-0 rounded-2xl" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  </div>
                  <div className="flex gap-3 px-4 pb-4">
                    <Skeleton className="h-12 flex-1 rounded-[18px]" />
                    <Skeleton className="h-12 flex-1 rounded-[18px]" />
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  const serviceFilterBanner = serviceFilter ? (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm">
      <span className="font-semibold text-slate-800 dark:text-slate-100">
        Category: {serviceCategoryLabel(serviceFilter)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-full border-orange-500/40 text-xs font-bold"
        onClick={clearServiceFilter}
      >
        Clear
      </Button>
    </div>
  ) : null;

  return (
    <>
      <div className="space-y-8">
        {serviceFilterBanner}

        {/* SECTION: Community's requests (Requests tab) */}
        {activeTab === "requests" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                <span className="flex items-center gap-2.5">
                  <Bell className="w-6 h-6 text-slate-500 dark:text-slate-400 md:text-orange-500" />{" "}
                  Community&apos;s requests
                </span>
              </h2>
              <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                New jobs from clients who want you—accept or decline each one.
              </p>
            </div>
            {incomingItems.length > 0 ? (
              <>
                <JobCardsCarousel className="mt-3">
                  {incomingItems.map((notif) => (
                    <IncomingJobRequestCard
                      key={notif.id}
                      notif={notif}
                      isMinMd={isMinMd}
                      clippedCardIds={clippedCardIds}
                      deleting={deleting}
                      confirming={confirming}
                      formatJobTitle={formatJobTitle}
                      onDecline={handleDecline}
                      onConfirm={handleConfirm}
                      onOpenPreview={openJobPreview}
                      onProfileClick={goToPublicProfile}
                    />
                  ))}
                </JobCardsCarousel>
              </>
            ) : (
              <Card className={JOB_CARD_EMPTY_PANEL}>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm">
                    {serviceFilter && incomingCountIgnoringCategory > 0
                      ? "No community requests in this category."
                      : "No new community requests right now."}
                  </p>
                  {serviceFilter && incomingCountIgnoringCategory > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={clearServiceFilter}
                    >
                      Clear filter
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* SECTION: PENDING JOBS (Pending Tab) */}
        {activeTab === "pending" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                <span className="flex items-center gap-2.5">
                  <Hourglass className="w-6 h-6 text-slate-500 dark:text-slate-400 md:text-orange-500" />{" "}
                  Pending response
                </span>
              </h2>
              <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                You said yes—now we wait for the client to confirm the booking.
              </p>
            </div>
            {pendingItems.length > 0 ? (
              <>
                <JobCardsCarousel className="mt-3">
                  {pendingItems.map((n) => {
                    const job = n.job_requests;
                    return (
                      <Card
                        key={n.id}
                        id={`card-${n.id}`}
                        data-job-card
                        onClick={
                          isMinMd ? undefined : () => openJobPreview(job)
                        }
                        className={cn(
                          JOB_CARD_SHELL,
                          !isMinMd && "cursor-pointer",
                          isMinMd && "md:cursor-default",
                          jobCardCarouselItemClass,
                        )}
                      >
                        <div
                          className={cn(isMinMd && "cursor-pointer")}
                          onClick={
                            isMinMd ? () => openJobPreview(job) : undefined
                          }
                        >
                          <JobCardLocationBar location={job.location_city} />
                        </div>
                        <div className="relative flex min-h-0 flex-1 flex-col">
                          {/* Smart Mobile Scroll Overlay */}
                          <div
                            className={cn(
                              "pointer-events-none absolute inset-0 z-[100] bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 md:hidden",
                              clippedCardIds.has(`card-${n.id}`)
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className={JOB_CARD_COMPACT_ROW}>
                            <button
                              type="button"
                              className={cn(
                                JOB_CARD_THUMB,
                                JOB_CARD_THUMB_BUTTON,
                              )}
                              aria-label={`Open job preview: ${formatJobTitle(job)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openJobPreview(job);
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
                            <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                              <button
                                type="button"
                                className="flex min-w-0 max-w-full items-center gap-2 rounded-xl text-left outline-none transition-colors hover:bg-slate-100/80 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-100"
                                onClick={(e) =>
                                  goToPublicProfile(e, job.client_id)
                                }
                                disabled={!job.client_id}
                              >
                                <Avatar className="h-12 w-12 shrink-0 border border-slate-200 dark:border-zinc-600 md:h-14 md:w-14">
                                  <AvatarImage
                                    src={job.profiles?.photo_url || ""}
                                  />
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
                            onClick={
                              isMinMd ? () => openJobPreview(job) : undefined
                            }
                          >
                            <div className="flex w-full items-center justify-between gap-2 text-[14px] font-bold leading-snug tracking-tight text-orange-500 dark:text-orange-400">
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
                                  <span className="min-w-0">
                                    Waiting for{" "}
                                    <button
                                      type="button"
                                      className="inline font-bold underline decoration-orange-500/40 underline-offset-2 transition-colors hover:text-orange-600 hover:decoration-orange-500 dark:hover:text-orange-300"
                                      onClick={(e) =>
                                        goToPublicProfile(e, job.client_id)
                                      }
                                    >
                                      {job.profiles?.full_name || "other user"}
                                    </button>
                                    …
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
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
                </JobCardsCarousel>
              </>
            ) : (
              <Card className={JOB_CARD_EMPTY_PANEL}>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Hourglass className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm">
                    {serviceFilter && pendingCountIgnoringCategory > 0
                      ? "No pending jobs in this category."
                      : "No pending jobs at the moment."}
                  </p>
                  {serviceFilter && pendingCountIgnoringCategory > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={clearServiceFilter}
                    >
                      Clear filter
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* SECTION: MY OUTBOUND REQUESTS (My Requests Tab) */}
        {activeTab === "my_requests" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                <span className="flex items-center gap-2.5">
                  <ClipboardList className="w-6 h-6 text-slate-500 dark:text-slate-400 md:text-orange-500" />{" "}
                  My Posted Requests
                </span>
              </h2>
              <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                Requests you posted for helpers—track who responded and what
                happens next.
              </p>
            </div>
            {filteredMyOpenRequests.length > 0 ? (
              <>
                <JobCardsCarousel className="mt-3">
                  {filteredMyOpenRequests.map((job) => {
                    const rawAccepted = (job as { acceptedCount?: number })
                      .acceptedCount;
                    const acceptedCount =
                      typeof rawAccepted === "number" ? rawAccepted : null;
                    const goConfirmed = () =>
                      navigate(`/client/jobs/${job.id}/live`);
                    return (
                    <Card
                      key={job.id}
                      id={`card-${job.id}`}
                      data-job-card
                      role="button"
                      tabIndex={0}
                      onClick={goConfirmed}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goConfirmed();
                        }
                      }}
                      className={cn(
                        JOB_CARD_SHELL,
                        "cursor-pointer",
                        jobCardCarouselItemClass,
                      )}
                    >
                      {acceptedCount !== null ? (
                        <span
                          className={cn(
                            "absolute right-2.5 top-2.5 z-[2] inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full px-2 text-[13px] font-black tabular-nums leading-none shadow-sm",
                            acceptedCount > 0
                              ? "bg-gradient-to-r from-orange-500 to-red-600 text-white ring-1 ring-orange-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                              : "border border-slate-200/90 bg-slate-100/90 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-400",
                          )}
                          aria-label={`${acceptedCount} accepted helper${acceptedCount === 1 ? "" : "s"}`}
                        >
                          {acceptedCount}
                        </span>
                      ) : null}
                      <div>
                        <JobCardLocationBar location={job.location_city} />
                      </div>
                      <div className="relative flex min-h-0 flex-1 flex-col">
                        {/* Smart Scroll Overlay */}
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 z-[100] bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 md:hidden",
                            clippedCardIds.has(`card-${job.id}`)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div className={JOB_CARD_COMPACT_ROW}>
                          <button
                            type="button"
                            className={cn(
                              JOB_CARD_THUMB,
                              JOB_CARD_THUMB_BUTTON,
                            )}
                            aria-label={`Open confirmed helpers: ${formatJobTitle(job)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              goConfirmed();
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
                          <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                            <span className="text-base font-bold leading-snug text-slate-800 dark:text-slate-100 md:text-lg">
                              Posted{" "}
                              {new Date(job.created_at).toLocaleDateString()}
                            </span>
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
                      </div>
                    </Card>
                    );
                  })}
                </JobCardsCarousel>
              </>
            ) : (
              <Card className={JOB_CARD_EMPTY_PANEL}>
                <CardContent className="p-6 text-center text-muted-foreground">
                  {serviceFilter && myOpenRequests.length > 0 ? (
                    <>
                      <p className="text-sm mb-3">
                        No posted requests in this category.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearServiceFilter}
                      >
                        Clear category filter
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm mb-3">
                        You haven&apos;t posted any requests yet.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/client/create")}
                      >
                        Post a Request
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <FullscreenMapModal
        job={selectedMapJob}
        isOpen={!!selectedMapJob}
        onClose={() => setSelectedMapJob(null)}
        onConfirm={
          selectedMapJob
            ? () => {
                const notif = inboundNotifications.find(
                  (n) => n.job_id === selectedMapJob.id,
                );
                if (notif) handleConfirm(selectedMapJob.id, notif.id);
              }
            : undefined
        }
        isConfirming={confirming !== null}
        showAcceptButton={
          selectedMapJob
            ? inboundNotifications.some(
                (n) =>
                  n.job_id === selectedMapJob.id &&
                  !n.isConfirmed &&
                  !n.isDeclined,
              )
            : false
        }
      />

      <JobDetailsModal
        isOpen={!!selectedJobDetails}
        onOpenChange={(open) => !open && setSelectedJobDetails(null)}
        job={selectedJobDetails}
        formatJobTitle={formatJobTitle}
        isOwnRequest={selectedJobDetails?.client_id === user?.id}
        onConfirm={
          selectedJobDetails
            ? () => {
                const notif = inboundNotifications.find(
                  (n) => n.job_id === selectedJobDetails.id,
                );
                if (notif) handleConfirm(selectedJobDetails.id, notif.id);
              }
            : undefined
        }
        isConfirming={confirming !== null}
        showAcceptButton={
          selectedJobDetails
            ? inboundNotifications.some(
                (n) =>
                  n.job_id === selectedJobDetails.id &&
                  !n.isConfirmed &&
                  !n.isDeclined,
              )
            : false
        }
        onDecline={
          selectedJobDetails
            ? async () => {
                const notif = inboundNotifications.find(
                  (n) => n.job_id === selectedJobDetails.id,
                );
                if (!notif) return;
                const ok = await handleDecline(notif.id);
                if (ok) setSelectedJobDetails(null);
              }
            : undefined
        }
        isDeclining={
          selectedJobDetails != null &&
          deleting ===
            inboundNotifications.find((n) => n.job_id === selectedJobDetails.id)
              ?.id
        }
      />
    </>
  );
}
