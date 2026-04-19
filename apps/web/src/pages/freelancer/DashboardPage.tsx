import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MapPin,
  Bell,
  Briefcase,
  MessageCircle,
  Calendar,
  ChevronRight,
  Clock,
  ClipboardList,
} from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import JobMap from "@/components/JobMap";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { LiveTimer } from "@/components/LiveTimer";
import DashboardLiveJobCard from "@/components/DashboardLiveJobCard";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { useActiveJobs } from "@/hooks/data/useActiveJobs";
import { useInvitations } from "@/hooks/data/useInvitations";
import { useClientRequests } from "@/hooks/data/useClientRequests";
import { useRecentMessages } from "@/hooks/data/useRecentMessages";
import { PageFrame, PageHeader, PageRealtimeChip } from "@/components/page-frame";
import {
  recordFirstMeaningfulAction,
  trackCtaClick,
} from "@/lib/sessionConversionAnalytics";

interface JobRequest {
  id: string;
  status: string;
  client_id: string;
  selected_freelancer_id: string | null;
  care_type?: string;
  children_count?: number;
  children_age_group?: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  service_type?: string;
  service_details?: any;
  time_duration?: string;
  care_frequency?: string;
}



function serviceHeroImageSrc(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

export default function FreelancerDashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: jobsData, isLoading: jobsLoading } = useActiveJobs(user?.id);
  const { data: invitesData, isLoading: invitesLoading } = useInvitations(user?.id);
  const { data: myReqsData, isLoading: myReqsLoading } = useClientRequests(user?.id, 3);
  const { data: recentMessages = [], isLoading: msgsLoading } = useRecentMessages(user?.id, 3);

  const activeJobs = jobsData?.activeJobs || [];
  const clientProfiles = jobsData?.clientProfiles || {};
  const activeConversationIds = jobsData?.activeConversationIds || {};

  const invitations = invitesData?.invitations || [];
  const incomingKpiCount = invitesData?.incomingKpiCount || 0;

  const myRequests = myReqsData?.myRequests || [];
  const confirmedCounts = myReqsData?.confirmedCounts || {};

  const [requestsTab, setRequestsTab] = useState<"invitations" | "my">("invitations");
  const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);

  /** Incoming tab: invitations you still need to accept (excludes pending / declined). */
  const incomingInvitationsOnly = useMemo(
    () => invitations.filter((n) => !n.isConfirmed && !n.isDeclined),
    [invitations],
  );

  const loading = !user || jobsLoading || invitesLoading || myReqsLoading || msgsLoading;

  function formatJobTitle(job: JobRequest) {
    if (job.service_type === "cleaning") return "Cleaning";
    if (job.service_type === "cooking") return "Cooking";
    if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
    if (job.service_type === "nanny") return "Nanny";
    if (job.service_type === "other_help") return "Other Help";
    return "Service Request";
  }

  const dashboardPrimary = useMemo(() => {
    if (incomingInvitationsOnly.length > 0) {
      return {
        label: "Review invitations",
        onClick: () => {
          recordFirstMeaningfulAction("dashboard_primary", {
            kind: "invitations",
          });
          trackCtaClick("dashboard_primary_invites", "dashboard", profile?.role);
          navigate(buildJobsUrl("freelancer", "pending"));
        },
      };
    }
    if (incomingKpiCount > 0) {
      return {
        label: "Review community requests",
        onClick: () => {
          recordFirstMeaningfulAction("dashboard_primary", {
            kind: "community",
          });
          trackCtaClick("dashboard_primary_community", "dashboard", profile?.role);
          navigate(buildJobsUrl("freelancer", "requests"));
        },
      };
    }
    return {
      label: "Go live now",
      onClick: () => {
        recordFirstMeaningfulAction("dashboard_primary", { kind: "post_now" });
        trackCtaClick("dashboard_primary_post_now", "dashboard", profile?.role);
        navigate("/availability/post-now");
      },
    };
  }, [
    incomingInvitationsOnly.length,
    incomingKpiCount,
    navigate,
    profile?.role,
  ]);

  function renderRequestThumb(job: JobRequest) {
    return (
      <div
        className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-border/40 dark:bg-muted dark:ring-white/10 pointer-events-none"
        aria-hidden
      >
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-background pb-6 md:pb-8">
        <div className="app-desktop-shell pt-8 space-y-6">
          <div className="mb-4 px-1">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="space-y-6 mt-8">
             <div className="flex items-center gap-3 mb-4">
                 <Skeleton className="h-8 w-40" />
             </div>
             <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageFrame>
      <div className="app-desktop-shell pt-8 space-y-6">
        <PageHeader
          title={`Welcome back, ${profile?.full_name?.split(" ")[0] || "User"}`}
          description={`Overview of your activity today${
            profile?.average_rating != null
              ? ` · ${profile.average_rating.toFixed(1)}★ (${profile.total_ratings ?? 0} reviews)`
              : ""
          }`}
          realtimeSlot={
            <>
              <PageRealtimeChip label="Helping now" value={activeJobs.length} />
              <PageRealtimeChip
                label="Invites pending"
                value={incomingInvitationsOnly.length}
                live={incomingInvitationsOnly.length > 0}
              />
              <PageRealtimeChip
                label="Community"
                value={incomingKpiCount}
                live={incomingKpiCount > 0}
              />
            </>
          }
          primaryAction={
            <Button
              type="button"
              size="lg"
              className="w-full rounded-xl font-bold shadow-md sm:w-auto"
              onClick={dashboardPrimary.onClick}
            >
              {dashboardPrimary.label}
            </Button>
          }
          secondaryActions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full font-semibold"
                onClick={() => {
                  trackCtaClick("dashboard_jobs", "dashboard", profile?.role);
                  navigate(buildJobsUrl("freelancer", "jobs"));
                }}
              >
                Jobs
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full font-semibold"
                onClick={() => {
                  trackCtaClick("dashboard_messages", "dashboard", profile?.role);
                  navigate("/messages");
                }}
              >
                Messages
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Card
            className="border border-slate-200/50 dark:border-white/5 shadow-sm rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
            onClick={() => navigate(buildJobsUrl("freelancer", "jobs"))}
          >
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                  Helping now
                </span>
                <Briefcase
                  className="hidden md:block h-5 w-5 shrink-0 text-primary"
                  aria-hidden
                />
              </div>
              <p className="text-[32px] font-bold text-slate-900 dark:text-white leading-none mb-2">
                {activeJobs.length}
              </p>
              <span className="text-[11px] font-medium text-slate-400 mt-auto">
                Ongoing now
              </span>
            </CardContent>
          </Card>

          <Card
            className="border border-slate-200/50 dark:border-white/5 shadow-sm rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
            onClick={() => navigate(buildJobsUrl("client", "my_requests"))}
          >
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                  My Requests
                </span>
                <ClipboardList
                  className="hidden md:block h-5 w-5 shrink-0 text-primary"
                  aria-hidden
                />
              </div>
              <p className="text-[32px] font-bold text-slate-900 dark:text-white leading-none mb-2">
                {myRequests.length}
              </p>
              <span className="text-[11px] font-medium text-slate-400 mt-auto">
                Pending review
              </span>
            </CardContent>
          </Card>

          <Card
            className="border border-slate-200/50 dark:border-white/5 shadow-sm rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
            onClick={() => navigate(buildJobsUrl("freelancer", "requests"))}
          >
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                  Community&apos;s requests
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {incomingKpiCount > 0 && (
                    <Badge className="bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-500 border-none text-[9px] font-black h-4 px-1.5 rounded-full">
                      NEW
                    </Badge>
                  )}
                  <Bell
                    className="hidden md:block h-5 w-5 text-primary"
                    aria-hidden
                  />
                </div>
              </div>
              <p className="text-[32px] font-bold text-slate-900 dark:text-white leading-none mb-2">
                {incomingKpiCount}
              </p>
              <span className="text-[11px] font-medium text-slate-400 mt-auto">
                New invitations
              </span>
            </CardContent>
          </Card>
        </div>

        {/* PRO-LEVEL ACTIVE JOB SECTION */}
        {activeJobs.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                <Briefcase className="w-6 h-6 text-primary" />
                HELPING NOW
              </h2>
              <Badge className="bg-primary/10 text-primary border-none font-black px-2.5 py-0.5 rounded-lg text-[14px]">
                {activeJobs.length}
              </Badge>
            </div>

            <div className="relative -mx-4 group/carousel">
              <div className="flex overflow-x-auto gap-4 px-4 pb-8 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {activeJobs.map((job) => (
                  <div
                    key={job.id}
                    className="min-w-[85vw] md:min-w-[420px] snap-center"
                  >
                    <DashboardLiveJobCard
                      job={job}
                      participant={{
                        full_name:
                          clientProfiles[job.client_id]?.full_name || "Client",
                        photo_url:
                          clientProfiles[job.client_id]?.photo_url || undefined,
                        average_rating:
                          clientProfiles[job.client_id]?.average_rating,
                        total_ratings:
                          clientProfiles[job.client_id]?.total_ratings,
                      }}
                      onMapClick={() => setSelectedMapJob(job)}
                      onChatClick={() =>
                        activeConversationIds[job.id]
                          ? navigate(`/chat/${activeConversationIds[job.id]}`)
                          : navigate("/messages")
                      }
                      onDetailsClick={() => navigate(`/jobs/${job.id}/details`)}
                      onNavigateClick={() => {
                        if (
                          job.service_type === "pickup_delivery" &&
                          job.service_details?.from_address &&
                          job.service_details?.to_address
                        ) {
                          const origin = encodeURIComponent(
                            job.service_details.from_address,
                          );
                          const destination = encodeURIComponent(
                            job.service_details.to_address,
                          );
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`,
                            "_blank",
                          );
                        } else {
                          const query = encodeURIComponent(
                            job.location_city || "",
                          );
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${query}`,
                            "_blank",
                          );
                        }
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Optional: Indicator that there are more cards */}
              {activeJobs.length > 1 && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity pointer-events-none md:flex">
                  <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg">
                    <ChevronRight className="w-6 h-6 text-white animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                <MessageCircle className="w-6 h-6 text-primary" />
                MESSAGES
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold text-primary"
                onClick={() => navigate("/messages")}
              >
                View All
              </Button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {recentMessages.length > 0 ? (
                recentMessages.map((msg) => (
                  <Card
                    key={msg.id}
                    className="border-none shadow-[0_4px_15px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => {
                      navigate(`/chat/${msg.id}`);
                    }}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-12 h-12 shadow-sm flex-shrink-0">
                          <AvatarImage
                            src={msg.otherPhoto || undefined}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">
                            {msg.otherName?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        {msg.isUnread && (
                          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-bold text-[16px]">
                            {msg.otherName}
                          </p>
                          <span className="text-[12px] font-medium text-muted-foreground">
                            {msg.lastMessageTime
                              ? new Date(
                                msg.lastMessageTime,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : ""}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-[14px] truncate",
                            msg.isUnread
                              ? "font-bold text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {msg.lastMessage}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[10px] font-bold text-primary hover:bg-primary/5 rounded-full px-3 border border-primary/10"
                        >
                          REPLY
                        </Button>
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm italic">
                  No recent messages
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100">
                <Bell
                  className="w-6 h-6 shrink-0 text-orange-500"
                  aria-hidden
                />
                <span className="md:hidden">
                  {requestsTab === "my"
                    ? "My Requests"
                    : "Community's requests"}
                </span>
                <span className="hidden md:inline uppercase">REQUESTS</span>
              </h2>
              <div className="flex items-center gap-4">
                {/* Segmented control — pill track + floating thumb */}
                <div
                  className="inline-flex items-center gap-0.5 rounded-full bg-slate-200/70 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] dark:bg-zinc-800/90 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
                  role="tablist"
                  aria-label="Requests filter"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={requestsTab === "invitations"}
                    aria-label="Community's requests"
                    onClick={() => {
                      setRequestsTab("invitations");
                      navigate(buildJobsUrl("freelancer", "requests"));
                    }}
                    className={cn(
                      "flex items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ease-out",
                      "min-h-9 min-w-9 p-2 md:min-h-0 md:min-w-0 md:px-4 md:py-1.5",
                      requestsTab === "invitations"
                        ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)] dark:bg-zinc-600 dark:text-white dark:shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                        : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                    )}
                  >
                    <Bell className="h-4 w-4 shrink-0 md:hidden" aria-hidden />
                    <span className="hidden md:inline">
                      Community&apos;s requests
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={requestsTab === "my"}
                    aria-label="My requests"
                    onClick={() => setRequestsTab("my")}
                    className={cn(
                      "flex items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ease-out",
                      "min-h-9 min-w-9 p-2 md:min-h-0 md:min-w-0 md:px-4 md:py-1.5",
                      requestsTab === "my"
                        ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)] dark:bg-zinc-600 dark:text-white dark:shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                        : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                    )}
                  >
                    <ClipboardList
                      className="h-4 w-4 shrink-0 md:hidden"
                      aria-hidden
                    />
                    <span className="hidden md:inline">My Requests</span>
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-bold text-primary"
                  onClick={() =>
                    navigate(
                      requestsTab === "invitations"
                        ? "/jobs?tab=requests"
                        : "/jobs?tab=my_requests",
                    )
                  }
                >
                  View All
                </Button>
              </div>
            </div>

            {/* Content - Fragmented Cards */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {requestsTab === "invitations" ? (
                incomingInvitationsOnly.length > 0 ? (
                  incomingInvitationsOnly.map((notif: any) => {
                    const job = notif.job_requests;
                    const isDeclined = notif.isDeclined;
                    const isConfirmed = notif.isConfirmed;
                    return (
                      <Card
                        key={notif.id}
                        className={cn(
                          "border border-black/[0.03] dark:border-white/[0.03] shadow-[0_4px_15px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer",
                          isDeclined && "opacity-60",
                        )}
                        onClick={() =>
                          navigate(buildJobsUrl("freelancer", "requests"))
                        }
                      >
                        <CardContent className="px-5 py-4 flex items-center gap-4">
                          {job ? renderRequestThumb(job) : null}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[16px] text-slate-900 dark:text-slate-100">
                              {formatJobTitle(job)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[14px] text-slate-600 dark:text-slate-400">
                              <MapPin className="w-3 h-3" />{" "}
                              {job?.location_city}
                              {job?.start_at && (
                                <>
                                  <Calendar className="w-3 h-3 ml-1" />
                                  {new Date(job.start_at).toLocaleDateString()}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 ml-auto">
                            <Badge
                              variant={
                                isDeclined
                                  ? "destructive"
                                  : isConfirmed
                                    ? "default"
                                    : "secondary"
                              }
                              className={cn(
                                "text-[12px] flex-shrink-0",
                                !isDeclined &&
                                !isConfirmed &&
                                "bg-white/10 text-slate-600 dark:text-slate-400 border-black/10 dark:border-white/10",
                              )}
                            >
                              {isDeclined
                                ? "Declined"
                                : isConfirmed
                                  ? "Waiting for confirmation"
                                  : "Pending"}
                            </Badge>
                            {!isDeclined && !isConfirmed && job?.created_at && (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-500/20">
                                <Clock className="w-3 h-3" />
                                <LiveTimer createdAt={job.created_at} />
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600/40 dark:text-slate-400/40 flex-shrink-0" />
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="px-5 py-10 text-center text-slate-600/60 dark:text-slate-400/60">
                    <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No community requests right now</p>
                  </div>
                )
              ) : myRequests.length > 0 ? (
                myRequests.map((req) => (
                  <Card
                    key={req.id}
                    className="border border-black/[0.03] dark:border-white/[0.03] shadow-[0_4px_15px_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    onClick={() =>
                      navigate(buildJobsUrl("client", "my_requests"))
                    }
                  >
                    <CardContent className="px-5 py-4 flex items-center gap-4">
                      {renderRequestThumb(req)}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[16px] text-slate-900 dark:text-slate-100">
                          {formatJobTitle(req)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[14px] text-slate-600 dark:text-slate-400">
                          <MapPin className="w-3 h-3" /> {req.location_city}
                          {req.start_at && (
                            <>
                              <Calendar className="w-3 h-3 ml-1" />
                              {new Date(req.start_at).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </div>
                      {req.created_at && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-500/20 mr-2">
                          <Clock className="w-3 h-3" />
                          <LiveTimer createdAt={req.created_at} />
                        </div>
                      )}
                      <div className="flex items-center gap-3 ml-auto">
                        {confirmedCounts[req.id] > 0 && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[11px] font-black px-3 py-1 rounded-full shadow-md transition-all">
                            {confirmedCounts[req.id]}{" "}
                            {confirmedCounts[req.id] === 1
                              ? "Helper"
                              : "Helpers"}{" "}
                            Accepted
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-600/40 dark:text-slate-400/40 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="px-5 py-10 text-center text-slate-600/60 dark:text-slate-400/60">
                  <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No open requests at the moment</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-white/5"
                    onClick={() => navigate("/client/create")}
                  >
                    Post a Request
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Welcome empty state */}
        {activeJobs.length === 0 &&
          invitations.length === 0 &&
          myRequests.length === 0 && (
            <Card className="border-0 shadow-lg text-center py-12 bg-card">
              <CardContent>
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 mx-auto mb-4 flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Welcome!</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Complete your profile to start receiving job requests.
                </p>
                <Button onClick={() => navigate("/freelancer/profile")}>
                  Complete Profile
                </Button>
              </CardContent>
            </Card>
          )}

        <FullscreenMapModal
          job={selectedMapJob}
          isOpen={!!selectedMapJob}
          onClose={() => setSelectedMapJob(null)}
        />
      </div>
    </PageFrame>
  );
}
