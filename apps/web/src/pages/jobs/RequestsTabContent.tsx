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
    /** Confirmed helpers (available confirmations) per open request — up to 5 for avatar strip. */
    const [confirmedHelperAvatarsByJobId, setConfirmedHelperAvatarsByJobId] = useState<
        Record<string, { id: string; photo_url: string | null; full_name: string | null }[]>
    >({});
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
                    setConfirmedHelperAvatarsByJobId(data.confirmedHelperAvatarsByJobId || {});
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

            // Stage 2: Parallel fetch — my confirmations (for inbound tab) + open-job confirmations with
            // embedded profiles (one round trip: counts + avatars; avoids late-loading badge/photos).
            type ConfRow = {
                job_id: string;
                freelancer_id: string;
                created_at: string;
                profiles: { id: string; photo_url: string | null; full_name: string | null } | null;
            };
            const [confsRes, openJobDetailConfsRes] = await Promise.all([
                supabase
                    .from("job_confirmations")
                    .select("job_id, status")
                    .eq("freelancer_id", user.id),
                openJobs.length === 0
                    ? Promise.resolve({ data: [] as ConfRow[] })
                    : supabase
                          .from("job_confirmations")
                          .select(
                              `
              job_id,
              freelancer_id,
              created_at,
              profiles!job_confirmations_freelancer_id_fkey ( id, photo_url, full_name )
            `
                          )
                          .in("job_id", openJobs.map((j) => j.id))
                          .eq("status", "available")
                          .order("created_at", { ascending: true }),
            ]);

            const jobConfsData = (openJobDetailConfsRes.data || []) as ConfRow[];
            const countsMap = jobConfsData.reduce((acc: Record<string, number>, curr) => {
                acc[curr.job_id] = (acc[curr.job_id] || 0) + 1;
                return acc;
            }, {});

            const avatarMap: Record<string, { id: string; photo_url: string | null; full_name: string | null }[]> = {};
            jobConfsData.forEach((c) => {
                if (!avatarMap[c.job_id]) avatarMap[c.job_id] = [];
                if (avatarMap[c.job_id].length >= 5) return;
                const p = c.profiles;
                avatarMap[c.job_id].push(
                    p
                        ? { id: p.id, photo_url: p.photo_url, full_name: p.full_name }
                        : { id: c.freelancer_id, photo_url: null, full_name: null }
                );
            });
            setConfirmedHelperAvatarsByJobId(avatarMap);

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
                    confirmedHelperAvatarsByJobId: avatarMap,
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
            notifying: {
                label: "In Progress",
                className:
                    "bg-slate-200 text-slate-700 shadow-sm border border-slate-300/70 dark:bg-zinc-600 dark:text-zinc-100 dark:border-zinc-500/40",
            },
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
                        <div>
                            <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                                <span className="flex items-center gap-2.5">
                                    <Bell className="w-6 h-6 text-orange-500" /> Incoming Requests
                                </span>
                            </h2>
                            <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                                New jobs from clients who want you—accept or decline each one.
                            </p>
                        </div>
                        {incomingItems.length > 0 ? (
                            <>
                            <div className="mx-auto mt-3 grid w-full max-w-6xl grid-cols-1 gap-6 md:max-w-7xl md:grid-cols-2 md:gap-7 lg:grid-cols-3 lg:gap-8">
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
                                                "transition-all duration-500 w-full rounded-[32px] overflow-hidden border border-slate-300/45 dark:border-zinc-500/35 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-card backdrop-blur-sm group relative",
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
                                                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatJobTitle(job)}</span>
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
                                                    <span className="w-full text-center text-[16px] font-black uppercase tracking-[0.14em] text-white/95 drop-shadow-md sm:text-[17px]">
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
                        <Card className="border border-dashed border-slate-300/50 dark:border-zinc-500/35 shadow-sm bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
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
                        <div>
                            <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                                <span className="flex items-center gap-2.5">
                                    <Hourglass className="w-6 h-6 text-orange-500" /> Pending Jobs
                                </span>
                            </h2>
                            <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                                You said yes—now we wait for the client to confirm the booking.
                            </p>
                        </div>
                        {pendingItems.length > 0 ? (
                            <>
                            <div className="mx-auto mt-3 grid w-full max-w-6xl grid-cols-1 gap-6 md:max-w-7xl md:grid-cols-2 md:gap-7 lg:grid-cols-3 lg:gap-8">
                                {pendingItems.map((n) => {
                                    const job = n.job_requests;
                                    return (
                                        <Card 
                                            key={n.id} 
                                            id={`card-${n.id}`}
                                            data-job-card
                                            onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                            className={cn(
                                                "transition-all duration-500 w-full rounded-[32px] overflow-hidden border border-slate-300/45 dark:border-zinc-500/35 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-card backdrop-blur-sm group relative",
                                                !isMinMd && "cursor-pointer",
                                                isMinMd && "md:cursor-default"
                                            )}
                                        >
                                            <div
                                                className={cn(isMinMd && "cursor-pointer")}
                                                onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                            >
                                            <div className="md:hidden">
                                            <JobCardLocationBar
                                                location={job.location_city}
                                                trailing={
                                                    <Badge className="h-7 shrink-0 rounded-full border-none bg-amber-500 px-2.5 text-[9px] font-black uppercase leading-tight tracking-wide text-white shadow-md shadow-amber-500/20 sm:px-3 sm:text-[10px]">
                                                        Pending
                                                    </Badge>
                                                }
                                            />
                                            </div>
                                            </div>
                                            <div className="relative flex min-h-0 flex-1 flex-col">
                                            {/* Smart Mobile Scroll Overlay */}
                                            <div className={cn(
                                                "absolute inset-0 bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none z-[100] md:hidden",
                                                clippedCardIds.has(`card-${n.id}`) ? "opacity-100" : "opacity-0"
                                            )} />
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
                                                    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{formatJobTitle(job)}</span>
                                                </div>
                                                <div className="flex shrink-0 items-center self-center text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden>
                                                    <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
                                                </div>
                                            </div>
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
                                                    <Badge className="h-7 shrink-0 rounded-full border-none bg-amber-500 px-2.5 text-[9px] font-black uppercase leading-tight tracking-wide text-white shadow-md shadow-amber-500/20 sm:px-3 sm:text-[10px] md:min-h-[2.25rem] md:px-4 md:text-[11px]">
                                                        Pending
                                                    </Badge>
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
                                                        onClick={(e) => goToPublicProfile(e, job.client_id)}
                                                        disabled={!job.client_id}
                                                    >
                                                        <Avatar className="h-14 w-14 flex-shrink-0 border-2 border-white/30 shadow-lg transition-transform duration-500 group-hover:scale-105 md:h-16 md:w-16">
                                                            <AvatarImage src={job.profiles?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-[11px] font-black text-white md:text-sm">{job.profiles?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-lg font-black leading-tight tracking-tight text-white drop-shadow-xl md:text-xl lg:text-2xl">{job.profiles?.full_name || "Client"}</h3>
                                                            <p className="mt-0.5 text-[13px] font-semibold text-white/90 drop-shadow-md md:text-sm">
                                                                {job.location_city?.trim() || "Location not set"}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex flex-col gap-1 pointer-events-none">
                                                        <div className="flex items-center gap-2 px-0.5">
                                                            {job.profiles?.average_rating ? (
                                                                <StarRating
                                                                    rating={job.profiles.average_rating}
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
                            <Card className="border border-dashed border-slate-300/50 dark:border-zinc-500/35 shadow-sm bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
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
                        <div>
                            <h2 className="text-[22px] font-black flex flex-wrap items-center gap-2 tracking-tight text-slate-900 dark:text-slate-100">
                                <span className="flex items-center gap-2.5">
                                    <ClipboardList className="w-6 h-6 text-orange-500" /> My Posted Requests
                                </span>
                            </h2>
                            <p className="mt-1.5 max-w-none text-sm leading-relaxed text-muted-foreground">
                                Requests you posted for helpers—track who responded and what happens next.
                            </p>
                        </div>
                    {myOpenRequests.length > 0 ? (
                        <>
                        <div className="mx-auto mt-3 grid w-full max-w-6xl grid-cols-1 gap-6 md:max-w-7xl md:grid-cols-2 md:gap-7 lg:grid-cols-3 lg:gap-8">
                            {myOpenRequests.map((job) => (
                                <Card 
                                    key={job.id} 
                                    id={`card-${job.id}`}
                                    data-job-card
                                    onClick={isMinMd ? undefined : () => openJobPreview(job)}
                                    className={cn(
                                        "transition-all duration-500 w-full rounded-[32px] overflow-hidden border border-slate-300/45 dark:border-zinc-500/35 shadow-none md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2 flex flex-col h-full bg-card backdrop-blur-sm group relative",
                                        !isMinMd && "cursor-pointer",
                                        isMinMd && "md:cursor-default"
                                    )}
                                >
                                    <div
                                        className={cn(isMinMd && "cursor-pointer")}
                                        onClick={isMinMd ? () => openJobPreview(job) : undefined}
                                    >
                                    <div className="md:hidden">
                                    <JobCardLocationBar
                                        location={job.location_city}
                                        trailing={getJobStatusBadge(job.status)}
                                    />
                                    </div>
                                    </div>
                                    <div className="relative flex min-h-0 flex-1 flex-col">
                                    {/* Smart Scroll Overlay */}
                                    <div className={cn(
                                        "absolute inset-0 bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none z-[100] md:hidden",
                                        clippedCardIds.has(`card-${job.id}`) ? "opacity-100" : "opacity-0"
                                    )} />
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
                                            <span className="text-[15px] font-bold leading-snug text-slate-800 dark:text-slate-100">
                                                Posted {new Date(job.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                                {formatJobTitle(job)}
                                            </span>
                                            {job.created_at && (
                                                <div className="mt-1 flex w-full min-w-0 items-center justify-between gap-2 border-t border-slate-200/80 pt-1.5 dark:border-white/10">
                                                    <div className="flex min-w-0 items-center gap-2 text-[16px] font-bold text-slate-500 dark:text-slate-400">
                                                        <Clock className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
                                                        <span>Active</span>
                                                    </div>
                                                    <LiveTimer
                                                        createdAt={job.created_at}
                                                        render={({ time }) => (
                                                            <span className="shrink-0 tabular-nums text-[16px] font-bold text-slate-500 dark:text-slate-400">
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
                                            {getJobStatusBadge(job.status)}
                                        </div>
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
                                        <div className="pointer-events-none absolute bottom-2 left-4 right-4 z-[40] flex flex-col gap-1.5 sm:bottom-3 sm:left-5 sm:right-5 md:gap-2">
                                            <div className="min-w-0 text-left">
                                                <h3 className="text-lg font-black leading-tight tracking-tight text-white drop-shadow-xl md:text-xl lg:text-2xl">
                                                    {formatJobTitle(job)}
                                                </h3>
                                                <p className="mt-0.5 text-[13px] font-semibold text-white/90 drop-shadow-md md:text-sm">
                                                    {job.location_city?.trim() || "Location not set"}
                                                </p>
                                                <p className="mt-1 text-[12px] font-semibold text-white/75 drop-shadow-md md:text-[13px]">
                                                    Posted {new Date(job.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            {job.created_at && (
                                                <div className="flex w-full items-center justify-between gap-2 border-t border-white/20 pt-2 text-[14px] font-bold text-white/90 md:text-[15px]">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <Clock className="h-4 w-4 shrink-0 opacity-95 md:h-[1.125rem] md:w-[1.125rem]" aria-hidden />
                                                        <span>Active</span>
                                                    </div>
                                                    <LiveTimer
                                                        createdAt={job.created_at}
                                                        render={({ time }) => (
                                                            <span className="shrink-0 tabular-nums text-[14px] font-bold text-white/90 drop-shadow-md md:text-[15px]">
                                                                {time}
                                                            </span>
                                                        )}
                                                    />
                                                </div>
                                            )}
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
                                        <div className="mt-auto flex flex-col gap-4 border-t border-slate-100 pt-6 dark:border-white/5">
                                            <div className="relative w-full md:pt-2">
                                                {(() => {
                                                    const accepted = (job as { acceptedCount?: number }).acceptedCount ?? 0;
                                                    const helpers = confirmedHelperAvatarsByJobId[job.id] ?? [];
                                                    if (accepted <= 0 || helpers.length === 0) return null;
                                                    const overflow = Math.max(0, accepted - helpers.length);
                                                    return (
                                                        <div
                                                            className="mb-3 hidden flex-row items-center justify-center gap-0 md:flex"
                                                            aria-label={`${accepted} confirmed helper${accepted === 1 ? "" : "s"}`}
                                                        >
                                                            {helpers.map((p, i) => {
                                                                const initials =
                                                                    p.full_name
                                                                        ?.split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")
                                                                        .toUpperCase()
                                                                        .slice(0, 2) || "?";
                                                                return (
                                                                    <Avatar
                                                                        key={p.id}
                                                                        className={cn(
                                                                            "h-14 w-14 overflow-hidden shadow-md",
                                                                            i > 0 && "-ml-3"
                                                                        )}
                                                                        title={p.full_name || undefined}
                                                                    >
                                                                        <AvatarImage
                                                                            src={p.photo_url || undefined}
                                                                            alt=""
                                                                            className="object-cover"
                                                                        />
                                                                        <AvatarFallback className="bg-orange-500 text-sm font-black text-white">
                                                                            {initials}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                );
                                                            })}
                                                            {overflow > 0 && (
                                                                <div
                                                                    className="-ml-3 flex h-14 min-w-[2.75rem] items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-black tabular-nums text-slate-700 shadow-md dark:bg-zinc-700 dark:text-zinc-100"
                                                                    title={`${overflow} more`}
                                                                >
                                                                    +{overflow}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
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
                                                                "flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-[13px] font-black bg-card ring-4 ring-orange-500/10",
                                                                (job as any).acceptedCount > 0 ? "text-orange-600" : "text-slate-400 opacity-50"
                                                            )}>
                                                                {(job as any).acceptedCount}
                                                            </div>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    </div>
                                </Card>
                            ))}
                        </div>
                        </>
                    ) : (
                        <Card className="border border-dashed border-slate-300/50 dark:border-zinc-500/35 shadow-sm bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
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
