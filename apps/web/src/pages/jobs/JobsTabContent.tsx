import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, MessageSquare, Briefcase, ChevronRight } from "lucide-react";
import JobMap from "@/components/JobMap";
import JobReviewModal from "@/components/JobReviewModal";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
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
import type { JobsPerspective } from "@/components/jobs/jobsPerspective";

interface JobRequest {
  id: string;
  client_id: string;
  selected_freelancer_id: string | null;
  status: string;
  service_type?: string;
  care_type?: string;
  children_count?: number;
  children_age_group?: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  service_details?: any;
  time_duration?: string;
  care_frequency?: string;
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

interface Profile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  average_rating?: number;
  total_ratings?: number;
}

interface JobsTabContentProps {
  activeTab: "jobs" | "past";
  /** My Helpers = jobs you posted; Helping others = jobs where you were the assigned helper */
  perspective: JobsPerspective;
}

function serviceHeroImageSrc(job: {
  service_type?: string;
  children_count?: number;
}) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return ""; // map
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

export default function JobsTabContent({
  activeTab,
  perspective,
}: JobsTabContentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMinMd = useIsMinMd();

  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conversations, setConversations] = useState<Record<string, string>>(
    {},
  );
  const [reviewJob, setReviewJob] = useState<{
    jobId: string;
    reviewee: Profile;
    revieweeRole: "client" | "freelancer";
  } | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] =
    useState<JobRequest | null>(null);
  const edgeOverlayKey = useMemo(
    () =>
      `${perspective}-${activeTab}-${activeJobs.length}-${pastJobs.length}-${loading ? 1 : 0}`,
    [perspective, activeTab, activeJobs.length, pastJobs.length, loading],
  );
  const clippedCardIds = useJobCardEdgeOverlay(edgeOverlayKey);

  const highlightJobId = searchParams.get("highlightJob");

  useEffect(() => {
    if (activeTab !== "jobs" || loading || !highlightJobId) return;
    const hasCard = activeJobs.some((j) => j.id === highlightJobId);
    if (!hasCard) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`card-${highlightJobId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setSearchParams(
        (prev: URLSearchParams) => {
          const n = new URLSearchParams(prev);
          n.delete("highlightJob");
          return n;
        },
        { replace: true },
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    loading,
    highlightJobId,
    activeJobs,
    setSearchParams,
  ]);

  // 1. Fetch cache on mount
  useEffect(() => {
    if (!user) return;
    try {
      const cacheKey = `jobs_tab_cache_${user.id}_${perspective}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          setActiveJobs(data.activeJobs || []);
          setPastJobs(data.pastJobs || []);
          setProfiles(data.profiles || {});
          setConversations(data.conversations || {});
          setLoading(false); // Show cached data
        }
      }
    } catch (e) {
      console.error("Cache load error:", e);
    }
  }, [user, perspective]);

  const loadJobs = async () => {
    if (!user) return;
    if (isFirstLoad && loading) {
      // we are already showing cache or initial loader
    } else {
      // if not first load, don't show full page loader?
      // for now keep it simple to avoid flicker
    }

    try {
      setLoading(true);
      let jobsQuery = supabase
        .from("job_requests")
        .select("*")
        .in("status", ["locked", "active", "completed", "cancelled"]);

      if (perspective === "client") {
        jobsQuery = jobsQuery.eq("client_id", user.id);
      } else {
        jobsQuery = jobsQuery.eq("selected_freelancer_id", user.id);
      }

      const { data: allJobs, error: jobsError } = await jobsQuery.order(
        "created_at",
        { ascending: false },
      );

      if (jobsError) throw jobsError;

      if (allJobs) {
        const active = allJobs.filter(
          (j) => j.status === "locked" || j.status === "active",
        );
        const past = allJobs.filter(
          (j) => j.status === "completed" || j.status === "cancelled",
        );

        setActiveJobs(active);
        setPastJobs(past);

        // Get the opposing party profiles
        const profileIds = new Set<string>();
        allJobs.forEach((j) => {
          if (j.client_id !== user.id) profileIds.add(j.client_id);
          if (j.selected_freelancer_id && j.selected_freelancer_id !== user.id)
            profileIds.add(j.selected_freelancer_id);
        });

        let pMap: Record<string, Profile> = {};
        let convMap: Record<string, string> = {};

        const [profRes, convRes] = await Promise.all([
          profileIds.size > 0
            ? supabase
                .from("profiles")
                .select(
                  "id, full_name, photo_url, average_rating, total_ratings",
                )
                .in("id", Array.from(profileIds))
            : Promise.resolve({ data: [] }),
          active.length > 0
            ? supabase
                .from("conversations")
                .select("id, job_id")
                .in(
                  "job_id",
                  active.map((a) => a.id),
                )
            : Promise.resolve({ data: [] }),
        ]);

        if (profRes.data) {
          (profRes.data as any[]).forEach((p) => (pMap[p.id] = p));
        }
        if (convRes.data) {
          (convRes.data as any[]).forEach((c) => {
            if (c.job_id) convMap[c.job_id] = c.id;
          });
        }

        setProfiles(pMap);
        setConversations(convMap);

        // Update cache
        const cacheKey = `jobs_tab_cache_${user.id}_${perspective}`;
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data: {
              activeJobs: active,
              pastJobs: past,
              profiles: pMap,
              conversations: convMap,
            },
          }),
        );
      }
    } catch (e) {
      console.error("Error loading jobs:", e);
    } finally {
      setLoading(false);
      setIsFirstLoad(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [user, perspective]);

  function getJobStatusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
      locked: {
        label: "Confirmed",
        className: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25",
      },
      active: {
        label: "Confirmed",
        className: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25",
      },
      confirmed: {
        label: "Confirmed",
        className: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25",
      },
      completed: {
        label: "Completed",
        className: "bg-blue-500 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600",
      },
      cancelled: {
        label: "Cancelled",
        className: "bg-slate-400 text-white shadow-md shadow-slate-400/20 dark:bg-slate-500",
      },
    };
    const config = map[status] || {
      label: status,
      className: "bg-slate-400 text-white",
    };
    return {
      label: config.label,
      className: cn(
        "h-7 px-3 rounded-full text-[11px] uppercase font-black tracking-wide border-none shadow-md transition-transform hover:scale-105",
        config.className,
      ),
    };
  }

  function formatJobTitle(job: JobRequest) {
    if (job.service_type === "cleaning") return "Cleaning";
    if (job.service_type === "cooking") return "Cooking";
    if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
    if (job.service_type === "nanny") return "Nanny";
    if (job.service_type === "other_help") return "Other Help";
    return `Nanny – ${Number(job.children_count) || 0} kid(s)`;
  }

  function openJobPreview(job: JobRequest) {
    if (job.service_type === "pickup_delivery") setSelectedMapJob(job);
    else setSelectedJobDetails(job);
  }

  function goToPastJobDetails(job: JobRequest) {
    navigate(`/jobs/${job.id}/details`);
  }

  function goToPublicProfile(
    e: React.MouseEvent,
    userId: string | null | undefined,
  ) {
    e.stopPropagation();
    if (!userId) return;
    navigate(`/profile/${userId}`);
  }

  if (loading)
    return (
      <div className="space-y-8">
        {/* Section heading skeleton */}
        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-80" />
          </div>
          {/* Vertical list skeleton */}
          <div className="flex flex-col gap-4 pb-4">
            {[1, 2].map((i) => (
              <Card
                key={i}
                className="overflow-hidden rounded-[20px] border border-slate-200/70 dark:border-white/10"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-white/5">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex items-center gap-4 px-4 py-4">
                  <Skeleton className="h-[5.25rem] w-[5.25rem] shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                </div>
                <div className="flex gap-3 border-t border-slate-100 px-4 py-4 dark:border-white/5">
                  <Skeleton className="h-12 flex-1 rounded-[18px]" />
                  <Skeleton className="h-12 flex-1 rounded-[18px]" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );

  const liveSectionSubtitle =
    perspective === "client"
      ? "Jobs you posted with an assigned helper—message them or mark the job done when finished."
      : "Jobs where you’re the assigned helper—stay in touch with the client until the work is finished.";

  const pastSectionSubtitle =
    perspective === "client"
      ? "Jobs you posted as a client that finished or were cancelled."
      : "Jobs where you worked as the helper that finished or were cancelled.";

  return (
    <>
      <div className="space-y-8">
        {reviewJob && (
          <JobReviewModal
            open={!!reviewJob}
            jobId={reviewJob.jobId}
            reviewee={reviewJob.reviewee}
            revieweeRole={reviewJob.revieweeRole}
            onClose={() => setReviewJob(null)}
            onConfirmed={() => {
              setReviewJob(null);
              loadJobs();
            }}
          />
        )}

        {/* HELPING NOW SECTION */}
        {activeTab === "jobs" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100">
                <Briefcase className="w-6 h-6 text-slate-500 dark:text-slate-400 md:text-orange-500" />{" "}
                {perspective === "client" ? "Helping me now" : "Helping now"}
              </h2>
              <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                {liveSectionSubtitle}
              </p>
            </div>
            {activeJobs.length > 0 ? (
              <JobCardsCarousel>
                {activeJobs.map((job) => {
                  const otherPartyId =
                    job.client_id === user?.id
                      ? job.selected_freelancer_id
                      : job.client_id;
                  const otherParty = otherPartyId
                    ? profiles[otherPartyId]
                    : null;
                  const statusBadge = getJobStatusBadge(job.status);

                  return (
                    <Card
                      key={job.id}
                      id={`card-${job.id}`}
                      data-job-card
                      onClick={isMinMd ? undefined : () => openJobPreview(job)}
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
                        <JobCardLocationBar
                          location={job.location_city}
                          trailing={
                            <Badge className={statusBadge.className}>
                              {statusBadge.label}
                            </Badge>
                          }
                        />
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
                        {/* Compact row: same layout as mobile, larger on desktop */}
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
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          </button>
                          <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                            <button
                              type="button"
                              className="flex min-w-0 max-w-full items-center gap-2 rounded-xl text-left outline-none transition-colors hover:bg-slate-100/80 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-100"
                              onClick={(e) =>
                                goToPublicProfile(e, otherPartyId)
                              }
                              disabled={!otherPartyId}
                            >
                              <Avatar className="h-12 w-12 shrink-0 border border-slate-200 dark:border-zinc-600 md:h-14 md:w-14">
                                <AvatarImage
                                  src={otherParty?.photo_url || ""}
                                />
                                <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white md:text-sm">
                                  {otherParty?.full_name?.charAt(0) || "C"}
                                </AvatarFallback>
                              </Avatar>
                              <h3 className="truncate text-base font-black leading-tight text-slate-900 dark:text-white md:text-lg">
                                {otherParty?.full_name || "Client"}
                              </h3>
                            </button>
                            {otherParty?.average_rating ? (
                              <StarRating
                                rating={otherParty.average_rating}
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
                          <div className="flex gap-4 md:gap-5">
                            <Button
                              variant="outline"
                              className="flex-1 h-12 rounded-[18px] border-slate-200 text-[16px] font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.96] dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 md:h-14 md:text-[17px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                conversations[job.id]
                                  ? navigate(`/chat/${conversations[job.id]}`)
                                  : navigate(`/client/jobs/${job.id}`);
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4 md:h-5 md:w-5" />{" "}
                              Message
                            </Button>
                            <Button
                              className="flex-1 h-12 rounded-[18px] bg-green-600 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)] transition-all hover:bg-green-700 active:scale-[0.96] md:h-14 md:text-[17px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (otherParty) {
                                  setReviewJob({
                                    jobId: job.id,
                                    reviewee: otherParty,
                                    revieweeRole:
                                      otherPartyId === job.client_id
                                        ? "client"
                                        : "freelancer",
                                  });
                                } else {
                                  supabase
                                    .from("job_requests")
                                    .update({ status: "completed" })
                                    .eq("id", job.id)
                                    .then(() => loadJobs());
                                }
                              }}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Done
                            </Button>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  );
                })}
              </JobCardsCarousel>
            ) : (
              <Card className={JOB_CARD_EMPTY_PANEL}>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-bold">
                    {perspective === "client"
                      ? "Nothing in Helping me now yet."
                      : "Nothing in Helping now yet."}
                  </p>
                  <p className="text-sm">
                    {perspective === "client"
                      ? "When a helper is confirmed on your request, it will show up here."
                      : "When you’re assigned to a job, it will appear here."}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* HISTORY OF HELP SECTION */}
        {activeTab === "past" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                <span className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6 text-slate-500 dark:text-slate-400 md:text-orange-500" />{" "}
                  History of help
                </span>
              </h2>
              <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                {pastSectionSubtitle}
              </p>
            </div>
            {pastJobs.length > 0 ? (
              <JobCardsCarousel>
                {pastJobs.map((job) => {
                  const otherPartyId =
                    job.client_id === user?.id
                      ? job.selected_freelancer_id
                      : job.client_id;
                  const otherParty = otherPartyId
                    ? profiles[otherPartyId]
                    : null;
                  const statusBadge = getJobStatusBadge(job.status);
                  return (
                    <Card
                      key={job.id}
                      id={`card-${job.id}`}
                      data-job-card
                      onClick={isMinMd ? undefined : () => openJobPreview(job)}
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
                        <JobCardLocationBar
                          location={job.location_city}
                          trailing={
                            <Badge className={statusBadge.className}>
                              {statusBadge.label}
                            </Badge>
                          }
                        />
                      </div>
                      <div className="relative flex min-h-0 flex-1 flex-col">
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 z-[100] bg-zinc-900/25 backdrop-blur-[0.5px] transition-opacity duration-500 md:hidden",
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
                            aria-label={`View past job: ${formatJobTitle(job)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              goToPastJobDetails(job);
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
                                goToPublicProfile(e, otherPartyId)
                              }
                              disabled={!otherPartyId}
                            >
                              <Avatar className="h-12 w-12 shrink-0 border border-slate-200 dark:border-zinc-600 md:h-14 md:w-14">
                                <AvatarImage
                                  src={otherParty?.photo_url || ""}
                                />
                                <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white md:text-sm">
                                  {otherParty?.full_name?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <h3 className="truncate text-base font-black leading-tight text-slate-900 dark:text-white md:text-lg">
                                {otherParty?.full_name || "User"}
                              </h3>
                            </button>
                            {otherParty?.average_rating ? (
                              <StarRating
                                rating={otherParty.average_rating}
                                size="sm"
                                showCount={false}
                                className="origin-left scale-90 md:scale-100"
                                starClassName="text-slate-950 dark:text-neutral-200"
                                emptyStarClassName="text-slate-900/30 dark:text-neutral-500/40"
                                numberClassName="text-slate-900 dark:text-white font-black text-[14px] md:text-[15px]"
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
                      </div>
                    </Card>
                  );
                })}
              </JobCardsCarousel>
            ) : (
              <Card className={JOB_CARD_EMPTY_PANEL}>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-bold">No history of help yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <FullscreenMapModal
        job={selectedMapJob}
        isOpen={!!selectedMapJob}
        sheetPresentation
        onClose={() => setSelectedMapJob(null)}
      />

      <JobDetailsModal
        job={selectedJobDetails}
        isOpen={!!selectedJobDetails}
        onOpenChange={(open) => !open && setSelectedJobDetails(null)}
        formatJobTitle={formatJobTitle}
        sheetPresentation
        isOwnRequest={selectedJobDetails?.client_id === user?.id}
      />
    </>
  );
}
