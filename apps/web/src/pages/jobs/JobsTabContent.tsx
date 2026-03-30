import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    CheckCircle2, Loader2, MessageSquare, Briefcase,
    Calendar, ChevronRight
} from "lucide-react";
import JobMap from "@/components/JobMap";
import JobReviewModal from "@/components/JobReviewModal";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { useJobCardEdgeOverlay } from "@/hooks/useJobCardEdgeOverlay";
import { useIsMinMd } from "@/hooks/useIsMinMd";
import { JobCardLocationBar } from "@/components/jobs/JobCardLocationBar";
import { JobAttachedPhotosStrip, jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";
import { JobCardsCarousel, jobCardCarouselItemClass } from "@/components/jobs/JobCardsCarousel";
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

function serviceHeroImageSrc(job: { service_type?: string; children_count?: number }) {
    if (job.service_type === "cleaning") return "/cleaning-mar22.png";
    if (job.service_type === "cooking") return "/cooking-mar22.png";
    if (job.service_type === "pickup_delivery") return ""; // map
    if (job.service_type === "nanny") return "/nanny-mar22.png";
    if (job.service_type === "other_help") return "/other-mar22.png";
    return "/nanny-mar22.png";
}

export default function JobsTabContent({ activeTab, perspective }: JobsTabContentProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMinMd = useIsMinMd();

    const [loading, setLoading] = useState(true);
    const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
    const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [conversations, setConversations] = useState<Record<string, string>>({});
    const [reviewJob, setReviewJob] = useState<{
        jobId: string;
        reviewee: Profile;
        revieweeRole: "client" | "freelancer";
    } | null>(null);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);
    const [selectedJobDetails, setSelectedJobDetails] = useState<JobRequest | null>(null);
    const edgeOverlayKey = useMemo(
        () => `${perspective}-${activeTab}-${activeJobs.length}-${pastJobs.length}-${loading ? 1 : 0}`,
        [perspective, activeTab, activeJobs.length, pastJobs.length, loading]
    );
    const clippedCardIds = useJobCardEdgeOverlay(edgeOverlayKey);

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
                { ascending: false }
            );

            if (jobsError) throw jobsError;

            if (allJobs) {
                const active = allJobs.filter(j => j.status === "locked" || j.status === "active");
                const past = allJobs.filter(j => j.status === "completed" || j.status === "cancelled");

                setActiveJobs(active);
                setPastJobs(past);

                // Get the opposing party profiles
                const profileIds = new Set<string>();
                allJobs.forEach(j => {
                    if (j.client_id !== user.id) profileIds.add(j.client_id);
                    if (j.selected_freelancer_id && j.selected_freelancer_id !== user.id) profileIds.add(j.selected_freelancer_id);
                });

                let pMap: Record<string, Profile> = {};
                let convMap: Record<string, string> = {};

                const [profRes, convRes] = await Promise.all([
                    profileIds.size > 0
                        ? supabase.from("profiles").select("id, full_name, photo_url, average_rating, total_ratings").in("id", Array.from(profileIds))
                        : Promise.resolve({ data: [] }),
                    active.length > 0
                        ? supabase.from("conversations").select("id, job_id").in("job_id", active.map(a => a.id))
                        : Promise.resolve({ data: [] })
                ]);

                if (profRes.data) {
                    (profRes.data as any[]).forEach(p => pMap[p.id] = p);
                }
                if (convRes.data) {
                    (convRes.data as any[]).forEach(c => {
                        if (c.job_id) convMap[c.job_id] = c.id;
                    });
                }

                setProfiles(pMap);
                setConversations(convMap);

                // Update cache
                const cacheKey = `jobs_tab_cache_${user.id}_${perspective}`;
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: {
                        activeJobs: active,
                        pastJobs: past,
                        profiles: pMap,
                        conversations: convMap
                    }
                }));
            }
        } catch (e) {
            console.error("Error loading jobs:", e);
        } finally {
            setLoading(false);
            setIsFirstLoad(false);
        }
    }

    useEffect(() => {
        loadJobs();
    }, [user, perspective]);

    function getJobStatusBadge(status: string) {
        const map: Record<string, { label: string; className: string }> = {
            locked: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            active: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            confirmed: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            completed: { label: "Completed", className: "bg-blue-600 text-white shadow-blue-500/25 dark:bg-blue-500" },
            cancelled: { label: "Cancelled", className: "bg-slate-500 text-white shadow-slate-500/20" },
        };
        const config = map[status] || { label: status, className: "bg-slate-400 text-white" };
        return { 
            label: config.label, 
            className: cn("h-7 px-3 rounded-full text-[10px] uppercase font-black tracking-wide border-none shadow-md transition-transform hover:scale-105", config.className)
        };
    }

    function formatJobTitle(job: JobRequest) {
        if (job.service_type === 'cleaning') return 'Cleaning';
        if (job.service_type === 'cooking') return 'Cooking';
        if (job.service_type === 'pickup_delivery') return 'Pickup & Delivery';
        if (job.service_type === 'nanny') return 'Nanny';
        if (job.service_type === 'other_help') return 'Other Help';
        return `Nanny – ${Number(job.children_count) || 0} kid(s)`;
    }

    function openJobPreview(job: JobRequest) {
        if (job.service_type === "pickup_delivery") setSelectedMapJob(job);
        else setSelectedJobDetails(job);
    }

    function goToPublicProfile(e: React.MouseEvent, userId: string | null | undefined) {
        e.stopPropagation();
        if (!userId) return;
        navigate(`/profile/${userId}`);
    }



    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

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

                {/* LIVE JOBS SECTION */}
                {activeTab === 'jobs' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100">
                                <Briefcase className="w-6 h-6 text-orange-500" /> Active Jobs
                            </h2>
                            <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                                {liveSectionSubtitle}
                            </p>
                        </div>
                        {activeJobs.length > 0 ? (
                            <JobCardsCarousel>
                                {activeJobs.map(job => {
                                    const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                                    const otherParty = otherPartyId ? profiles[otherPartyId] : null;
                                    const statusBadge = getJobStatusBadge(job.status);

                                    return (
                                        <Card 
                                            key={job.id} 
                                            id={`card-${job.id}`}
                                            data-job-card
                                            onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                            className={cn(
                                                "transition-all duration-500 w-full rounded-[32px] overflow-hidden border border-slate-300/45 dark:border-zinc-500/35 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-card backdrop-blur-sm group relative",
                                                !isMinMd && "cursor-pointer",
                                                isMinMd && "md:cursor-default",
                                                jobCardCarouselItemClass
                                            )}
                                        >
                                            <div
                                                className={cn(isMinMd && "cursor-pointer")}
                                                onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                            >
                                                <div className="md:hidden">
                                                    <JobCardLocationBar
                                                        location={job.location_city}
                                                        trailing={<Badge className={statusBadge.className}>{statusBadge.label}</Badge>}
                                                    />
                                                </div>
                                            </div>
                                            <div className="relative flex min-h-0 flex-1 flex-col">
                                            {/* Smart Scroll Overlay */}
                                            <div className={cn(
                                                "absolute inset-0 bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none z-[100]",
                                                clippedCardIds.has(`card-${job.id}`) ? "opacity-100" : "opacity-0"
                                            )} />
                                            {/* Mobile: left square thumb + compact header */}
                                            <div className="flex gap-3 p-3 md:hidden">
                                                <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-border/40 dark:bg-muted dark:ring-white/10 pointer-events-none">
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
                                                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="flex min-w-0 max-w-full items-center gap-2 rounded-xl text-left outline-none transition-colors hover:bg-slate-100/80 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-100"
                                                        onClick={(e) => goToPublicProfile(e, otherPartyId)}
                                                        disabled={!otherPartyId}
                                                    >
                                                        <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-zinc-600">
                                                            <AvatarImage src={otherParty?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white">{otherParty?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                        </Avatar>
                                                        <h3 className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">{otherParty?.full_name || "Client"}</h3>
                                                    </button>
                                                    {otherParty?.average_rating ? (
                                                        <StarRating
                                                            rating={otherParty.average_rating}
                                                            size="sm"
                                                            showCount={false}
                                                            className="scale-90 origin-left"
                                                            starClassName="text-slate-900 dark:text-neutral-200"
                                                            emptyStarClassName="text-slate-900/25 dark:text-neutral-500/35"
                                                        />
                                                    ) : (
                                                        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">New client</span>
                                                    )}
                                                    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatJobTitle(job)}</span>
                                                </div>
                                                <div className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden>
                                                    <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
                                                </div>
                                            </div>
                                            {/* Desktop: hero height capped so cards don’t dominate the viewport */}
                                            <div
                                                className="relative hidden h-32 w-full overflow-hidden group/img sm:h-36 md:block md:h-36 lg:h-40"
                                            >
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
                                                <div className="pointer-events-none absolute right-4 top-4 z-[45] [&>*]:md:min-h-[2.25rem] [&>*]:md:px-4 [&>*]:md:text-[11px] [&>*]:md:leading-tight">
                                                    <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                                                </div>
                                                <div className="absolute inset-0 bg-black/40 z-10" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-20" />
                                                <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 pointer-events-none">
                                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white backdrop-blur-md">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </span>
                                                </div>
                                                <div
                                                    className="absolute inset-0 z-[30] cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openJobPreview(job);
                                                    }}
                                                    aria-hidden
                                                />
                                                <div className="pointer-events-none absolute bottom-2 left-4 right-4 z-[40] flex flex-col gap-1.5 sm:bottom-3 sm:left-5 sm:right-5 md:gap-2">
                                                    <button
                                                        type="button"
                                                        className="pointer-events-auto flex min-w-0 max-w-full items-start gap-2.5 rounded-xl text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-100 sm:gap-3"
                                                        onClick={(e) => goToPublicProfile(e, otherPartyId)}
                                                        disabled={!otherPartyId}
                                                    >
                                                        <Avatar className="h-14 w-14 flex-shrink-0 border-2 border-white/30 shadow-lg transition-transform duration-500 group-hover:scale-105 md:h-16 md:w-16">
                                                            <AvatarImage src={otherParty?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white md:text-sm">{otherParty?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-lg font-black leading-tight tracking-tight text-white drop-shadow-xl md:text-xl lg:text-2xl">{otherParty?.full_name || "Client"}</h3>
                                                            <p className="mt-0.5 text-[13px] font-semibold text-white/90 drop-shadow-md md:text-sm">
                                                                {job.location_city?.trim() || "Location not set"}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex flex-col gap-1 pointer-events-none">
                                                        <div className="flex items-center gap-2 px-0.5">
                                                            {otherParty?.average_rating ? (
                                                                <StarRating
                                                                    rating={otherParty.average_rating}
                                                                    size="sm"
                                                                    showCount={false}
                                                                    starClassName="text-white"
                                                                    emptyStarClassName="text-white/30"
                                                                    numberClassName="text-white drop-shadow-md text-[12px] md:text-[13px]"
                                                                />
                                                            ) : (
                                                                <span className="text-[12px] font-bold text-white/80 italic drop-shadow-md md:text-[13px]">New Client</span>
                                                            )}
                                                        </div>
                                                        <span className="w-full text-center text-[13px] font-black uppercase tracking-[0.12em] text-white/95 drop-shadow-md md:text-[14px] lg:text-[15px]">
                                                            {formatJobTitle(job)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <JobAttachedPhotosStrip images={jobAttachmentImageUrls(job)} />
                                            <CardContent
                                                className={cn(
                                                    "flex flex-1 flex-col gap-5 p-4 pt-2 md:gap-7 md:p-7 md:pt-7",
                                                    isMinMd && "md:cursor-pointer"
                                                )}
                                                onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                            >
                                                <div className="flex gap-4 mt-auto border-t border-slate-100 pt-6 dark:border-white/5">
                                                    <Button variant="outline" className="flex-1 h-12 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-[18px] text-[16px] font-bold transition-all active:scale-[0.96]" onClick={(e) => { e.stopPropagation(); conversations[job.id] ? navigate(`/chat/${conversations[job.id]}`) : navigate(`/client/jobs/${job.id}`); }}><MessageSquare className="w-4 h-4 mr-2" /> Message</Button>
                                                    <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-[18px] text-[16px] font-bold shadow-[0_8px_20px_rgba(22,163,74,0.25)] transition-all active:scale-[0.96]" onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (otherParty) { setReviewJob({ jobId: job.id, reviewee: otherParty, revieweeRole: otherPartyId === job.client_id ? "client" : "freelancer" }); }
                                                        else { supabase.from("job_requests").update({ status: "completed" }).eq("id", job.id).then(() => loadJobs()); }
                                                    }}><CheckCircle2 className="w-4 h-4 mr-2" /> Done</Button>
                                                </div>
                                            </CardContent>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </JobCardsCarousel>
                        ) : (
                            <Card className="border border-dashed border-slate-300/50 dark:border-zinc-500/35 shadow-sm bg-muted/30">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-lg font-bold">No active jobs right now.</p>
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

                {/* PAST JOBS SECTION */}
                {activeTab === 'past' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                                <span className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-6 h-6 text-orange-500" /> Past Jobs
                                </span>
                            </h2>
                            <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                                {pastSectionSubtitle}
                            </p>
                        </div>
                        {pastJobs.length > 0 ? (
                            <JobCardsCarousel>
                                {pastJobs.map(job => {
                                    const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                                    const otherParty = otherPartyId ? profiles[otherPartyId] : null;
                                    const statusBadge = getJobStatusBadge(job.status);
                                    return (
                                        <Card
                                            key={job.id}
                                            id={`card-${job.id}`}
                                            data-job-card
                                            onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                            className={cn(
                                                "transition-all duration-500 w-full rounded-[32px] overflow-hidden border border-slate-300/45 dark:border-zinc-500/35 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-card backdrop-blur-sm group relative",
                                                !isMinMd && "cursor-pointer",
                                                isMinMd && "md:cursor-default",
                                                jobCardCarouselItemClass
                                            )}
                                        >
                                            <div
                                                className={cn(isMinMd && "cursor-pointer")}
                                                onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                            >
                                                <div className="md:hidden">
                                                    <JobCardLocationBar
                                                        location={job.location_city}
                                                        trailing={<Badge className={statusBadge.className}>{statusBadge.label}</Badge>}
                                                    />
                                                </div>
                                            </div>
                                            <div className="relative flex min-h-0 flex-1 flex-col">
                                            <div className={cn(
                                                "absolute inset-0 bg-zinc-900/25 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none md:hidden z-[100]",
                                                clippedCardIds.has(`card-${job.id}`) ? "opacity-100" : "opacity-0"
                                            )} />
                                            {/* Mobile: thumb + profile block + arrow (matches Pending Jobs) */}
                                            <div className="flex gap-3 p-3 md:hidden">
                                                <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-border/40 dark:bg-muted dark:ring-white/10 pointer-events-none">
                                                    {job.service_type === "pickup_delivery" ? (
                                                        <div className="absolute inset-0 z-0">
                                                            <JobMap job={job} />
                                                        </div>
                                                    ) : (
                                                        <img src={serviceHeroImageSrc(job)} alt={formatJobTitle(job)} className="h-full w-full object-cover" />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                                                </div>
                                                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="flex min-w-0 max-w-full items-center gap-2 rounded-xl text-left outline-none transition-colors hover:bg-slate-100/80 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-100"
                                                        onClick={(e) => goToPublicProfile(e, otherPartyId)}
                                                        disabled={!otherPartyId}
                                                    >
                                                        <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-zinc-600">
                                                            <AvatarImage src={otherParty?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white">{otherParty?.full_name?.charAt(0) || "U"}</AvatarFallback>
                                                        </Avatar>
                                                        <h3 className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">{otherParty?.full_name || "User"}</h3>
                                                    </button>
                                                    {otherParty?.average_rating ? (
                                                        <StarRating
                                                            rating={otherParty.average_rating}
                                                            size="sm"
                                                            showCount={false}
                                                            className="origin-left scale-90"
                                                            starClassName="text-slate-950 dark:text-neutral-200"
                                                            emptyStarClassName="text-slate-900/30 dark:text-neutral-500/40"
                                                            numberClassName="text-slate-900 dark:text-white font-black text-[14px]"
                                                        />
                                                    ) : (
                                                        <span className="text-[12px] font-semibold text-slate-500">New client</span>
                                                    )}
                                                    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatJobTitle(job)}</span>
                                                </div>
                                                <div className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden>
                                                    <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
                                                </div>
                                            </div>
                                            {/* Desktop hero — capped height */}
                                            <div
                                                className="relative hidden h-32 w-full overflow-hidden group/img sm:h-36 md:block md:h-36 lg:h-40"
                                            >
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
                                                <div className="pointer-events-none absolute right-4 top-4 z-[45] [&>*]:md:min-h-[2.25rem] [&>*]:md:px-4 [&>*]:md:text-[11px] [&>*]:md:leading-tight">
                                                    <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                                                </div>
                                                <div className="absolute inset-0 z-10 bg-black/40" />
                                                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                                <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 pointer-events-none">
                                                    <span className="inline-flex items-center justify-center p-1.5 text-white drop-shadow-md">
                                                        <ChevronRight className="h-7 w-7" strokeWidth={2.25} aria-hidden />
                                                    </span>
                                                </div>
                                                <div
                                                    className="absolute inset-0 z-[30] cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openJobPreview(job);
                                                    }}
                                                    aria-hidden
                                                />
                                                <div className="pointer-events-none absolute bottom-2 left-4 right-4 z-[40] flex flex-col gap-1.5 sm:bottom-3 sm:left-5 sm:right-5 md:gap-2">
                                                    <button
                                                        type="button"
                                                        className="pointer-events-auto flex min-w-0 max-w-full items-start gap-2.5 rounded-xl text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-100 sm:gap-3"
                                                        onClick={(e) => goToPublicProfile(e, otherPartyId)}
                                                        disabled={!otherPartyId}
                                                    >
                                                        <Avatar className="h-14 w-14 flex-shrink-0 border-2 border-white/30 shadow-lg transition-transform duration-500 group-hover:scale-105 md:h-16 md:w-16">
                                                            <AvatarImage src={otherParty?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white md:text-sm">{otherParty?.full_name?.charAt(0) || "U"}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-lg font-black leading-tight tracking-tight text-white drop-shadow-xl md:text-xl lg:text-2xl">{otherParty?.full_name || "User"}</h3>
                                                            <p className="mt-0.5 text-[13px] font-semibold text-white/90 drop-shadow-md md:text-sm">
                                                                {job.location_city?.trim() || "Location not set"}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex flex-col gap-1 pointer-events-none">
                                                        <div className="flex items-center gap-3">
                                                            {otherParty?.average_rating ? (
                                                                <div className="flex items-center gap-2 px-0.5">
                                                                    <StarRating
                                                                        rating={otherParty.average_rating}
                                                                        size="sm"
                                                                        showCount={false}
                                                                        starClassName="text-white"
                                                                        emptyStarClassName="text-white/30"
                                                                        numberClassName="text-[12px] text-white drop-shadow-md font-black md:text-[13px]"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-[12px] font-bold italic text-white/80 drop-shadow-md md:text-[13px]">New Client</span>
                                                            )}
                                                        </div>
                                                        <span className="w-full text-center text-[13px] font-black uppercase tracking-[0.12em] text-white/95 drop-shadow-md md:text-[14px] lg:text-[15px]">
                                                            {formatJobTitle(job)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <JobAttachedPhotosStrip images={jobAttachmentImageUrls(job)} />
                                            <CardContent
                                                className={cn(
                                                    "flex flex-1 flex-col gap-4 p-4 pt-2 md:gap-6 md:p-6 md:pt-6",
                                                    isMinMd && "md:cursor-pointer"
                                                )}
                                                onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                            >
                                                <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-600 dark:text-slate-300">
                                                    <Calendar className="h-5 w-5 flex-shrink-0 text-slate-400" />
                                                    <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </CardContent>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </JobCardsCarousel>
                        ) : (
                            <Card className="border border-dashed border-slate-300/50 dark:border-zinc-500/35 shadow-sm bg-muted/30">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-lg font-bold">No past jobs yet.</p>
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
            />

            <JobDetailsModal
                job={selectedJobDetails}
                isOpen={!!selectedJobDetails}
                onOpenChange={(open) => !open && setSelectedJobDetails(null)}
                formatJobTitle={formatJobTitle}
            />
        </>
    );
}

