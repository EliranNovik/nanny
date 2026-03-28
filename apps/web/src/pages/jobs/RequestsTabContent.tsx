import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Bell, Clock, XCircle, CheckCircle2, Loader2,
    Hourglass, ClipboardList, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import JobMap from "@/components/JobMap";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { LiveTimer } from "@/components/LiveTimer";
import { useJobCardEdgeOverlay } from "@/hooks/useJobCardEdgeOverlay";
import { useIsMinMd } from "@/hooks/useIsMinMd";
import { JobCardLocationBar } from "@/components/jobs/JobCardLocationBar";
import { JobAttachedPhotosStrip, jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";

interface JobRequest {
    id: string;
    client_id: string;
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

interface InboundNotification {
    id: string;
    job_id: string;
    status: string;
    created_at: string;
    isConfirmed?: boolean;
    isDeclined?: boolean;
    job_requests: JobRequest & { profiles?: { full_name: string; photo_url: string | null; average_rating?: number; total_ratings?: number; } };
}


interface RequestsTabContentProps {
    activeTab: 'my_requests' | 'requests' | 'pending';
}

function serviceHeroImageSrc(job: { service_type?: string }) {
    if (job.service_type === "cleaning") return "/cleaning-mar22.png";
    if (job.service_type === "cooking") return "/cooking-mar22.png";
    if (job.service_type === "pickup_delivery") return "";
    if (job.service_type === "nanny") return "/nanny-mar22.png";
    if (job.service_type === "other_help") return "/other-mar22.png";
    return "/nanny-mar22.png";
}

export default function RequestsTabContent({ activeTab }: RequestsTabContentProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isMinMd = useIsMinMd();

    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const [myOpenRequests, setMyOpenRequests] = useState<JobRequest[]>([]);
    const [inboundNotifications, setInboundNotifications] = useState<InboundNotification[]>([]);
    const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);
    const [selectedJobDetails, setSelectedJobDetails] = useState<JobRequest | null>(null);
    const edgeOverlayKey = useMemo(
        () => `${activeTab}-${inboundNotifications.length}-${myOpenRequests.length}-${loading ? 1 : 0}`,
        [activeTab, inboundNotifications.length, myOpenRequests.length, loading]
    );
    const clippedCardIds = useJobCardEdgeOverlay(edgeOverlayKey);

    // 1. Fetch cache on mount
    useEffect(() => {
        if (!user) return;
        try {
            const cacheKey = `requests_tab_cache_${user.id}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                // Use cache if less than 1 hour old
                if (Date.now() - timestamp < 3600000) {
                    setMyOpenRequests(data.myOpenRequests || []);
                    setInboundNotifications(data.inboundNotifications || []);
                    setLoading(false); // Show cached data
                }
            }
        } catch (e) {
            console.error("Cache load error:", e);
        }
    }, [user]);

    const loadRequests = async () => {
        if (!user) return;
        
        try {
            // Stage 1: Parallel fetch independent top-level data
            const [openJobsRes, notifsRes] = await Promise.all([
                supabase
                    .from("job_requests")
                    .select("*")
                    .eq("client_id", user.id)
                    .in("status", ["ready", "notifying", "confirmations_closed"])
                    .order("created_at", { ascending: false }),
                supabase
                    .from("job_candidate_notifications")
                    .select(`
                        id, job_id, status, created_at,
                        job_requests (
                          id, client_id, service_type, care_type, children_count, children_age_group, location_city, start_at, service_details, time_duration, care_frequency, created_at,
                          profiles!job_requests_client_id_fkey ( full_name, photo_url, average_rating, total_ratings )
                        )
                    `)
                    .eq("freelancer_id", user.id)
                    .in("status", ["pending", "opened"])
                    .order("created_at", { ascending: false }),
            ]);

            const openJobs = openJobsRes.data || [];
            const notificationsData = notifsRes.data || [];

            setMyOpenRequests(openJobs);

            // Stage 2: Parallel fetch dependent data (confirmations and conversations)
            const [confsRes, openJobCountsRes] = await Promise.all([
                supabase
                    .from("job_confirmations")
                    .select("job_id, status")
                    .eq("freelancer_id", user.id),
                supabase
                    .from("job_confirmations")
                    .select("job_id")
                    .in("job_id", openJobs.map(j => j.id))
                    .eq("status", "available")
            ]);

            // Map counts
            const countsMap = (openJobCountsRes.data || []).reduce((acc: any, curr: any) => {
                acc[curr.job_id] = (acc[curr.job_id] || 0) + 1;
                return acc;
            }, {});

            const processedOpenJobs = openJobs.map((job: any) => ({
                ...job,
                acceptedCount: countsMap[job.id] || 0
            }));

            setMyOpenRequests(processedOpenJobs);

            // Process notifications with confirmations
            const confirmedJobIds = new Set((confsRes.data || []).filter(c => c.status === "available").map(c => c.job_id));
            const declinedJobIds = new Set((confsRes.data || []).filter(c => c.status === "declined").map(c => c.job_id));

            const validNotifications = notificationsData
                .filter((n: any) => n.job_requests)
                .map((n: any) => ({
                    ...n,
                    isConfirmed: confirmedJobIds.has(n.job_id),
                    isDeclined: declinedJobIds.has(n.job_id)
                }));

            setInboundNotifications(validNotifications as InboundNotification[]);

            // Update cache
            const cacheKey = `requests_tab_cache_${user.id}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: {
                    myOpenRequests: processedOpenJobs,
                    inboundNotifications: validNotifications
                }
            }));

        } catch (e) {
            console.error("Error loading requests:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, [user]);

    async function handleConfirm(jobId: string, notifId: string) {
        setConfirming(notifId);
        try {
            await apiPost(`/api/jobs/${jobId}/notifications/${notifId}/open`, {});
            await apiPost(`/api/jobs/${jobId}/confirm`, {});

            setInboundNotifications((prev) =>
                prev.map((n) =>
                    n.id === notifId ? { ...n, isConfirmed: true } : n
                )
            );

            addToast({
                title: "Job Accepted!",
                description: "It's been moved to Pending Jobs while we wait for the client's final confirmation.",
                variant: "success",
            });
        } catch (err: any) {
            console.error("Error confirming availability:", err);
            addToast({
                title: "Failed to accept",
                description: err?.message || "Failed to confirm availability. Please try again.",
                variant: "error",
            });
        } finally {
            setConfirming(null);
        }
    }

    async function handleDecline(notifId: string) {
        setDeleting(notifId);
        try {
            const { error } = await supabase
                .from("job_candidate_notifications")
                .delete()
                .eq("id", notifId);

            if (error) throw error;

            setInboundNotifications((prev) => prev.filter((n) => n.id !== notifId));

            addToast({
                title: "Request Declined",
                description: "The job request has been removed.",
                variant: "success",
            });
        } catch (err: any) {
            console.error("Error deleting notification:", err);
            addToast({
                title: "Failed to decline",
                description: "Could not decline the request. Please try again.",
                variant: "error",
            });
        } finally {
            setDeleting(null);
        }
    }

    function getJobStatusBadge(status: string) {
        const map: Record<string, { label: string; className: string }> = {
            ready: { label: "Waiting", className: "bg-amber-500 text-white shadow-amber-500/20" },
            notifying: { label: "In Progress", className: "bg-slate-500 text-white shadow-slate-500/20" },
            confirmations_closed: { label: "Waiting", className: "bg-amber-500 text-white shadow-amber-500/20" },
            confirmed: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
        };
        const config = map[status] || { label: status, className: "bg-slate-400 text-white" };
        return <Badge className={cn("h-7 px-3 rounded-full text-[10px] uppercase font-black tracking-wide border-none shadow-md transition-transform hover:scale-105", config.className)}>{config.label}</Badge>;
    }

    function formatJobTitle(job: JobRequest) {
        if (job.service_type === 'cleaning') return 'Cleaning';
        if (job.service_type === 'cooking') return 'Cooking';
        if (job.service_type === 'pickup_delivery') return 'Pickup & Delivery';
        if (job.service_type === 'nanny') return 'Nanny';
        if (job.service_type === 'other_help') return 'Other Help';
        return "Service Request";
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

    const incomingItems = inboundNotifications.filter((n) => !n.isConfirmed);
    const pendingItems = inboundNotifications.filter((n) => n.isConfirmed);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <>
            <div className="space-y-8">

                {/* SECTION: INCOMING REQUESTS (Requests Tab) */}
                {activeTab === 'requests' && (
                    <div className="space-y-8">
                        <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                            <span className="flex items-center gap-2.5">
                                <Bell className="w-6 h-6 text-orange-500" /> Incoming Requests
                            </span>
                            <Badge variant="secondary" className="h-7 min-w-[1.75rem] justify-center rounded-full px-2.5 text-[12px] font-bold tabular-nums">
                                {incomingItems.length}
                            </Badge>
                        </h2>
                        {incomingItems.length > 0 ? (
                            <>
                            <div className="mt-3 space-y-8">
                                {incomingItems.map((notif) => {
                                const job = notif.job_requests;
                                const isConfirmed = notif.isConfirmed;
                                const isDeclined = notif.isDeclined;

                                return (
                                        <Card 
                                            key={notif.id} 
                                            id={`card-${notif.id}`}
                                            data-job-card
                                            onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                            className={cn(
                                                "transition-all duration-500 w-full max-w-3xl mx-auto rounded-[32px] overflow-hidden border border-black/5 dark:border-white/10 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-white dark:bg-zinc-900/50 backdrop-blur-sm group relative",
                                                !isMinMd && "cursor-pointer",
                                                isMinMd && "md:cursor-default",
                                                isDeclined && "opacity-60"
                                            )}
                                        >
                                        <div
                                            className={cn(isMinMd && "cursor-pointer")}
                                            onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                        >
                                        <JobCardLocationBar
                                            location={job.location_city}
                                            trailing={
                                                <Badge
                                                    className={cn(
                                                        "h-7 shrink-0 rounded-full border-none px-2.5 text-[9px] font-black uppercase leading-tight tracking-wide shadow-md sm:px-3 sm:text-[10px]",
                                                        isDeclined ? "bg-slate-200 text-slate-600" : isConfirmed ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                                                    )}
                                                >
                                                    {isDeclined ? "Declined" : isConfirmed ? "Confirmed" : "Waiting"}
                                                </Badge>
                                            }
                                        />
                                        </div>
                                        <div className="relative flex min-h-0 flex-1 flex-col">
                                        {/* Smart Mobile Scroll Overlay */}
                                        <div className={cn(
                                            "absolute inset-0 bg-zinc-900/20 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none md:hidden z-[100]",
                                            clippedCardIds.has(`card-${notif.id}`) ? "opacity-100" : "opacity-0"
                                        )} />
                                        {/* Mobile: left thumb + compact header */}
                                        <div className="flex gap-3 p-3 md:hidden">
                                            <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-800 dark:ring-white/10 pointer-events-none">
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
                                                    onClick={(e) => goToPublicProfile(e, job.client_id)}
                                                    disabled={!job.client_id}
                                                >
                                                    <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-zinc-600">
                                                        <AvatarImage src={job.profiles?.photo_url || ""} />
                                                        <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white">
                                                            {job.profiles?.full_name?.charAt(0) || "C"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <h3 className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">{job.profiles?.full_name || "Client"}</h3>
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
                                                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatJobTitle(job)}</span>
                                            </div>
                                            <div className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden>
                                                <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
                                            </div>
                                        </div>
                                        {/* Desktop hero */}
                                        <div
                                            className="relative hidden h-36 w-full overflow-hidden group/img sm:h-40 md:block"
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
                                            <div className="absolute inset-0 z-10 bg-black/40" />
                                            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                            <div className="absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/40 to-transparent" />
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
                                            <div className="pointer-events-none absolute bottom-3 left-6 right-6 z-[40] flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    className="pointer-events-auto flex min-w-0 max-w-full items-center gap-3 rounded-xl text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-100"
                                                    onClick={(e) => goToPublicProfile(e, job.client_id)}
                                                    disabled={!job.client_id}
                                                >
                                                    <Avatar className="h-20 w-20 flex-shrink-0 border-2 border-white/30 shadow-2xl transition-transform duration-500 group-hover:scale-110">
                                                        <AvatarImage src={job.profiles?.photo_url || ""} />
                                                        <AvatarFallback className="bg-orange-500 text-sm font-black text-white">{job.profiles?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                    </Avatar>
                                                    <h3 className="min-w-0 flex-1 text-[24px] font-black tracking-tight text-white drop-shadow-xl">{job.profiles?.full_name || "Client"}</h3>
                                                </button>
                                                <div className="flex flex-col gap-1.5 pointer-events-none">
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
                                                    <span className="w-full text-center text-[15px] font-black uppercase tracking-[0.14em] text-white/95 drop-shadow-md sm:text-[16px]">
                                                        {formatJobTitle(job)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <JobAttachedPhotosStrip images={jobAttachmentImageUrls(job)} />

                                        <CardContent
                                            className={cn(
                                                "flex flex-1 flex-col gap-5 p-4 pt-2 md:gap-6 md:p-6 md:pt-6",
                                                isMinMd && "md:cursor-pointer"
                                            )}
                                            onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                        >
                                            {/* Info Segments */}
                                            <div className="flex flex-col gap-6">
                                                <div className="grid grid-cols-2 gap-x-6">
                                                    {job.time_duration && (
                                                        <div className="flex items-center gap-3 text-[17px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
                                                            <Clock className="w-6 h-6 text-slate-400 flex-shrink-0" />
                                                            <span className="truncate">{job.time_duration.replace(/_/g, '-')}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {job.created_at && !isConfirmed && !isDeclined && (
                                                    <div className="flex items-center gap-3 text-[16px] text-orange-400 font-bold tracking-tight">
                                                        <Clock className="w-5 h-5 flex-shrink-0" />
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="opacity-60 font-medium">Expires in</span>
                                                            <LiveTimer createdAt={job.created_at} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Buttons Area - Standardized CTA Hierarchy */}
                                            {!isConfirmed && !isDeclined && (
                                                <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-12 rounded-[18px] border-slate-200 dark:border-white/10 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 transition-all active:scale-[0.96] font-bold"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDecline(notif.id);
                                                        }}
                                                        disabled={deleting === notif.id || confirming === notif.id}
                                                    >
                                                        {deleting === notif.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                        Decline
                                                    </Button>
                                                    <Button
                                                        className="flex-1 h-12 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] transition-all active:scale-[0.96] font-bold"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleConfirm(job.id, notif.id);
                                                        }}
                                                        disabled={deleting === notif.id || confirming === notif.id}
                                                    >
                                                        {confirming === notif.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                        Accept
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                        </>
                    ) : (
                        <Card className="border-0 shadow-sm border-dashed bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
                            <CardContent className="p-6 text-center text-muted-foreground">
                                <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-sm">No new incoming requests right now.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
                )}

                {/* SECTION: PENDING JOBS (Pending Tab) */}
                {activeTab === 'pending' && (
                    <div className="space-y-8">
                        <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                            <span className="flex items-center gap-2.5">
                                <Hourglass className="w-6 h-6 text-orange-500" /> Pending Jobs
                            </span>
                            <Badge variant="secondary" className="h-7 min-w-[1.75rem] justify-center rounded-full px-2.5 text-[12px] font-bold tabular-nums">
                                {pendingItems.length}
                            </Badge>
                        </h2>
                        {pendingItems.length > 0 ? (
                            <>
                            <div className="mt-3 space-y-8">
                                {pendingItems.map((n) => {
                                    const job = n.job_requests;
                                    return (
                                        <Card 
                                            key={n.id} 
                                            id={`card-${n.id}`}
                                            data-job-card
                                            onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                            className={cn(
                                                "transition-all duration-500 w-full max-w-3xl mx-auto rounded-[32px] overflow-hidden border border-black/5 dark:border-white/10 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-white dark:bg-zinc-900/50 backdrop-blur-sm group relative",
                                                !isMinMd && "cursor-pointer",
                                                isMinMd && "md:cursor-default"
                                            )}
                                        >
                                            <div
                                                className={cn(isMinMd && "cursor-pointer")}
                                                onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                            >
                                            <JobCardLocationBar
                                                location={job.location_city}
                                                trailing={
                                                    <Badge className="h-7 shrink-0 rounded-full border-none bg-amber-500 px-2.5 text-[9px] font-black uppercase leading-tight tracking-wide text-white shadow-md shadow-amber-500/20 sm:px-3 sm:text-[10px]">
                                                        Pending
                                                    </Badge>
                                                }
                                            />
                                            </div>
                                            <div className="relative flex min-h-0 flex-1 flex-col">
                                            {/* Smart Mobile Scroll Overlay */}
                                            <div className={cn(
                                                "absolute inset-0 bg-zinc-900/20 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none md:hidden z-[100]",
                                                clippedCardIds.has(`card-${n.id}`) ? "opacity-100" : "opacity-0"
                                            )} />
                                            <div className="flex gap-3 p-3 md:hidden">
                                                <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-800 dark:ring-white/10 pointer-events-none">
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
                                                        onClick={(e) => goToPublicProfile(e, job.client_id)}
                                                        disabled={!job.client_id}
                                                    >
                                                        <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-zinc-600">
                                                            <AvatarImage src={job.profiles?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white">{job.profiles?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                        </Avatar>
                                                        <h3 className="truncate text-[15px] font-black leading-tight text-slate-900 dark:text-white">{job.profiles?.full_name || "Client"}</h3>
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
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatJobTitle(job)}</span>
                                                </div>
                                                <div className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden>
                                                    <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
                                                </div>
                                            </div>
                                            <div
                                                className="relative hidden h-36 w-full overflow-hidden group/img sm:h-40 md:block"
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
                                                <div className="absolute inset-0 z-10 bg-black/40" />
                                                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
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
                                                <div className="pointer-events-none absolute bottom-3 left-6 right-6 z-[40] flex flex-col gap-2">
                                                    <button
                                                        type="button"
                                                        className="pointer-events-auto flex min-w-0 max-w-full items-center gap-3 rounded-xl text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-100"
                                                        onClick={(e) => goToPublicProfile(e, job.client_id)}
                                                        disabled={!job.client_id}
                                                    >
                                                        <Avatar className="h-20 w-20 flex-shrink-0 border-2 border-white/30 shadow-2xl transition-transform duration-500 group-hover:scale-110">
                                                            <AvatarImage src={job.profiles?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-sm font-black text-white">{job.profiles?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                        </Avatar>
                                                        <h3 className="min-w-0 flex-1 text-[24px] font-black tracking-tight text-white drop-shadow-xl">{job.profiles?.full_name || "Client"}</h3>
                                                    </button>
                                                    <div className="flex flex-col gap-1.5 pointer-events-none">
                                                        <div className="flex items-center gap-3">
                                                            {job.profiles?.average_rating ? (
                                                                <div className="flex items-center gap-2 px-0.5">
                                                                    <StarRating
                                                                        rating={job.profiles.average_rating}
                                                                        size="sm"
                                                                        showCount={false}
                                                                        starClassName="text-white"
                                                                        emptyStarClassName="text-white/30"
                                                                        numberClassName="text-[14px] text-white drop-shadow-md"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-[14px] font-bold italic text-white/80 drop-shadow-md">New Client</span>
                                                            )}
                                                        </div>
                                                        <span className="w-full text-center text-[15px] font-black uppercase tracking-[0.14em] text-white/95 drop-shadow-md sm:text-[16px]">
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
                                                <div className="flex flex-col gap-6">
                                                    <div className="flex w-full items-center justify-between gap-2 text-[14px] font-bold leading-snug tracking-tight text-orange-500 dark:text-orange-400">
                                                        <div className="flex min-w-0 flex-1 items-start gap-2">
                                                            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
                                                            <span className="min-w-0">
                                                                Waiting for{" "}
                                                                <button
                                                                    type="button"
                                                                    className="inline font-bold underline decoration-orange-500/40 underline-offset-2 transition-colors hover:text-orange-600 hover:decoration-orange-500 dark:hover:text-orange-300"
                                                                    onClick={(e) => goToPublicProfile(e, job.client_id)}
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
                                                </div>
                                            </CardContent>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                            </>
                        ) : (
                            <Card className="border-0 shadow-sm border-dashed bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
                                <CardContent className="p-6 text-center text-muted-foreground">
                                    <Hourglass className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                    <p className="text-sm">No pending jobs at the moment.</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* SECTION: MY OUTBOUND REQUESTS (My Requests Tab) */}
                {activeTab === 'my_requests' && (
                    <div className="space-y-8">
                        <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                            <span className="flex items-center gap-2.5">
                                <ClipboardList className="w-6 h-6 text-orange-500" /> My Posted Requests
                            </span>
                            <Badge variant="secondary" className="h-7 min-w-[1.75rem] justify-center rounded-full px-2.5 text-[12px] font-bold tabular-nums">
                                {myOpenRequests.length}
                            </Badge>
                        </h2>
                    {myOpenRequests.length > 0 ? (
                        <>
                        <div className="mt-3 space-y-8">
                            {myOpenRequests.map((job) => (
                                <Card 
                                    key={job.id} 
                                    id={`card-${job.id}`}
                                    data-job-card
                                    onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                    className={cn(
                                        "transition-all duration-500 w-full max-w-3xl mx-auto rounded-[32px] overflow-hidden border border-black/5 dark:border-white/10 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-white dark:bg-zinc-900/50 backdrop-blur-sm group relative",
                                        !isMinMd && "cursor-pointer",
                                        isMinMd && "md:cursor-default"
                                    )}
                                >
                                    <div
                                        className={cn(isMinMd && "cursor-pointer")}
                                        onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                    >
                                    <JobCardLocationBar
                                        location={job.location_city}
                                        trailing={getJobStatusBadge(job.status)}
                                    />
                                    </div>
                                    <div className="relative flex min-h-0 flex-1 flex-col">
                                    {/* Smart Scroll Overlay */}
                                    <div className={cn(
                                        "absolute inset-0 bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none z-[100]",
                                        clippedCardIds.has(`card-${job.id}`) ? "opacity-100" : "opacity-0"
                                    )} />
                                    <div className="flex gap-3 p-3 md:hidden">
                                        <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-800 dark:ring-white/10 pointer-events-none">
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
                                            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                                                Posted {new Date(job.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                                {formatJobTitle(job)}
                                            </span>
                                            {job.created_at && (
                                                <div className="mt-1 flex w-full min-w-0 items-center justify-between gap-2 border-t border-slate-200/80 pt-1.5 dark:border-white/10">
                                                    <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-orange-500 dark:text-orange-400">
                                                        <Clock className="h-4 w-4 shrink-0" aria-hidden />
                                                        <span>Active</span>
                                                    </div>
                                                    <LiveTimer
                                                        createdAt={job.created_at}
                                                        render={({ time }) => (
                                                            <span className="shrink-0 tabular-nums text-[13px] font-bold text-red-600 dark:text-red-400">
                                                                {time}
                                                            </span>
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden>
                                            <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
                                        </div>
                                    </div>
                                    <div
                                        className="relative hidden h-36 w-full overflow-hidden group/img sm:h-40 md:block"
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
                                        <div className="absolute inset-0 z-10 bg-black/40" />
                                        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                        <div className="absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/40 to-transparent" />
                                        <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2">
                                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white backdrop-blur-md">
                                                <ChevronRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                        <div className="absolute bottom-3 left-6 right-6 z-20 flex flex-col gap-2">
                                            <div className="flex flex-col items-center gap-1 text-center">
                                                <span className="text-[14px] font-bold italic text-white/80 drop-shadow-md">
                                                    Posted {new Date(job.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="text-[15px] font-black uppercase tracking-[0.14em] text-white/95 drop-shadow-md sm:text-[16px]">
                                                    {formatJobTitle(job)}
                                                </span>
                                            </div>
                                            {job.created_at && (
                                                <div className="flex w-full items-center justify-between gap-2 border-t border-white/20 pt-2 text-[15px] font-bold">
                                                    <div className="flex min-w-0 items-center gap-2 text-orange-200">
                                                        <Clock className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
                                                        <span>Active</span>
                                                    </div>
                                                    <LiveTimer
                                                        createdAt={job.created_at}
                                                        render={({ time }) => (
                                                            <span className="shrink-0 tabular-nums text-[15px] font-bold text-red-300 drop-shadow-md">
                                                                {time}
                                                            </span>
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            className="absolute inset-0 z-[30] cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openJobPreview(job);
                                            }}
                                            aria-hidden
                                        />
                                    </div>

                                    <JobAttachedPhotosStrip images={jobAttachmentImageUrls(job)} />

                                    <CardContent
                                        className={cn(
                                            "flex flex-1 flex-col gap-5 p-4 pt-2 md:gap-6 md:p-6 md:pt-6",
                                            isMinMd && "md:cursor-pointer"
                                        )}
                                        onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                    >
                                        <div className="mt-auto flex flex-col gap-4 border-t border-slate-100 pt-6 dark:border-white/5">
                                            <div className="relative group/btn w-full">
                                                <Button
                                                    className="w-full h-12 rounded-[18px] bg-orange-500 hover:bg-orange-600 text-white shadow-[0_8px_20px_rgba(249,115,22,0.2)] transition-all active:scale-[0.96] font-bold text-[17px] flex items-center justify-between px-6"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/client/jobs/${job.id}/confirmed`);
                                                    }}
                                                >
                                                    <span>Check Status</span>
                                                    
                                                    {/* Integrated Acceptance Count */}
                                                    {typeof (job as any).acceptedCount === 'number' && (
                                                        <div className={cn(
                                                            "flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-[13px] font-black bg-white ring-4 ring-orange-500/10",
                                                            (job as any).acceptedCount > 0 ? "text-orange-600" : "text-slate-400 opacity-50"
                                                        )}>
                                                            {(job as any).acceptedCount}
                                                        </div>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                    </div>
                                </Card>
                            ))}
                        </div>
                        </>
                    ) : (
                        <Card className="border-0 shadow-sm border-dashed bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
                            <CardContent className="p-6 text-center text-muted-foreground">
                                <p className="text-sm mb-3">You haven't posted any requests yet.</p>
                                <Button variant="outline" size="sm" onClick={() => navigate("/client/create")}>
                                    Post a Request
                                </Button>
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
                onConfirm={selectedMapJob ? () => {
                    const notif = inboundNotifications.find(n => n.job_id === selectedMapJob.id);
                    if (notif) handleConfirm(selectedMapJob.id, notif.id);
                } : undefined}
                isConfirming={confirming !== null}
                showAcceptButton={selectedMapJob ? inboundNotifications.some(n => n.job_id === selectedMapJob.id && !n.isConfirmed && !n.isDeclined) : false}
            />

            <JobDetailsModal
                isOpen={!!selectedJobDetails}
                onOpenChange={(open) => !open && setSelectedJobDetails(null)}
                job={selectedJobDetails}
                formatJobTitle={formatJobTitle}
                isOwnRequest={selectedJobDetails?.client_id === user?.id}
                onConfirm={selectedJobDetails ? () => {
                    const notif = inboundNotifications.find(n => n.job_id === selectedJobDetails.id);
                    if (notif) handleConfirm(selectedJobDetails.id, notif.id);
                } : undefined}
                isConfirming={confirming !== null}
                showAcceptButton={selectedJobDetails ? inboundNotifications.some(n => n.job_id === selectedJobDetails.id && !n.isConfirmed && !n.isDeclined) : false}
            />
        </>
    );
}
