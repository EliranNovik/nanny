import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Bell, Clock, MapPin, CheckCircle2, Loader2, XCircle, Users,
    Briefcase, Hourglass, Repeat, Baby, ArrowUpCircle, ArrowDownCircle, Package, Home, AlignLeft,
    Sparkles, UtensilsCrossed, Truck, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import JobMap from "@/components/JobMap";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";

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

function formatServiceDetails(details: any, serviceType?: string) {
    if (!details) return null;
    if (typeof details === 'string') return <div className="col-span-2 flex items-start gap-2 text-foreground font-medium"><AlignLeft className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> {details}</div>;

    const formatValue = (val: any) => {
        if (typeof val !== 'string') return String(val);
        // Replace underscores between digits with a hyphen for ranges (e.g., "1_4" -> "1-4")
        let formatted = val.replace(/(\d)_(\d)/g, '$1-$2').replace(/_/g, ' ');
        // For special keys, 'plus' -> '+' 
        if (formatted.includes('plus')) {
            formatted = formatted.replace('plus', '+');
        }
        return formatted;
    };

    if (serviceType === 'pickup_delivery') {
        return (
            <>
                {details.from_address && <div className="flex items-start gap-2"><ArrowUpCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm truncate">{details.from_address}</span></div>}
                {details.to_address && <div className="flex items-start gap-2"><ArrowDownCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm truncate">{details.to_address}</span></div>}
                {details.weight && <div className="flex items-center gap-2"><Package className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.weight)} kg</span></div>}
            </>
        );
    }

    if (serviceType === 'cleaning') {
        return (
            <>
                {details.home_size && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.home_size)} size</span></div>}
            </>
        )
    }

    // fallback for generic JSON object
    return (
        <>
            {Object.entries(details).map(([key, value]) => {
                if (key === 'custom') return null; // handled separately below
                // hide raw coordinates if they exist
                if (key === 'from_lat' || key === 'from_lng' || key === 'to_lat' || key === 'to_lng') return null;
                return (
                    <div key={key} className="flex items-center gap-2 col-span-1">
                        <AlignLeft className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <span className="font-medium text-foreground capitalize text-sm">{formatValue(value)} {key.replace(/_/g, ' ')}</span>
                    </div>
                );
            })}
        </>
    );
}

const LiveTimer = ({ createdAt, render }: { createdAt: string; render?: (props: { time: string; expired: boolean }) => React.ReactNode }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(createdAt).getTime();
        const update = () => {
            const now = Date.now();
            setElapsed(Math.floor((now - start) / 1000));
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    const formatElapsedTime = (seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) {
            return `${days}d ${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const timeStr = formatElapsedTime(elapsed);
    const expired = elapsed > 90; // Default threshold

    if (render) {
        return <>{render({ time: timeStr, expired })}</>;
    }

    return <>{timeStr}</>;
};

export default function RequestsTabContent() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const [myOpenRequests, setMyOpenRequests] = useState<JobRequest[]>([]);
    const [inboundNotifications, setInboundNotifications] = useState<InboundNotification[]>([]);
    const [myProfile, setMyProfile] = useState<{ photo_url: string | null; full_name: string | null } | null>(null);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);
    const [selectedJobDetails, setSelectedJobDetails] = useState<JobRequest | null>(null);

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
                    setMyProfile(data.myProfile || null);
                    setLoading(false); // Show cached data
                }
            }
        } catch (e) {
            console.error("Cache load error:", e);
        }
    }, [user]);

    const loadRequests = async () => {
        if (!user) return;
        if (isFirstLoad && loading) {
            // showing cache or initial loader
        }

        try {
            // Stage 1: Parallel fetch independent top-level data
            const [openJobsRes, profileRes, notifsRes] = await Promise.all([
                supabase
                    .from("job_requests")
                    .select("*")
                    .eq("client_id", user.id)
                    .in("status", ["ready", "notifying", "confirmations_closed"])
                    .order("created_at", { ascending: false }),
                supabase
                    .from("profiles")
                    .select("photo_url, full_name")
                    .eq("id", user.id)
                    .single(),
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
                    .order("created_at", { ascending: false })
            ]);

            const openJobs = openJobsRes.data || [];
            const profileData = profileRes.data || null;
            const notificationsData = notifsRes.data || [];

            setMyOpenRequests(openJobs);
            setMyProfile(profileData);

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
            setMyProfile(profileData);

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
                    myOpenRequests: openJobs,
                    inboundNotifications: validNotifications,
                    myProfile: profileData
                }
            }));

        } catch (e) {
            console.error("Error loading requests:", e);
        } finally {
            setLoading(false);
            setIsFirstLoad(false);
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
                title: "Job Accepted",
                description: "You have confirmed your availability for this job.",
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
        const map: Record<string, string> = {
            ready: "Ready",
            notifying: "Checking availability",
            confirmations_closed: "Waiting for confirmations",
        };
        return map[status] || status;
    }

    function formatJobTitle(job: JobRequest) {
        if (job.service_type === 'cleaning') return 'Cleaning';
        if (job.service_type === 'cooking') return 'Cooking';
        if (job.service_type === 'pickup_delivery') return 'Pickup & Delivery';
        if (job.service_type === 'nanny') return 'Nanny';
        if (job.service_type === 'other_help') return 'Other Help';
        return "Service Request";
    }

    function getServiceIcon(serviceType?: string) {
        if (serviceType === 'cleaning') return <Sparkles className="w-3.5 h-3.5" />;
        if (serviceType === 'cooking') return <UtensilsCrossed className="w-3.5 h-3.5" />;
        if (serviceType === 'pickup_delivery') return <Truck className="w-3.5 h-3.5" />;
        if (serviceType === 'nanny') return <Baby className="w-3.5 h-3.5" />;
        if (serviceType === 'other_help') return <HelpCircle className="w-3.5 h-3.5" />;
        return <Baby className="w-3.5 h-3.5" />;
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <>
            <div className="space-y-6">

                {/* SECTION: INBOUND NOTIFICATIONS */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" /> Invitations to Job
                    </h2>
                    {inboundNotifications.length > 0 ? (
                        <div className="flex flex-nowrap md:block md:space-y-4 overflow-x-auto pb-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0 mt-2">
                            {inboundNotifications.map((notif) => {
                                const job = notif.job_requests;
                                const isConfirmed = notif.isConfirmed;
                                const isDeclined = notif.isDeclined;

                                return (
                                    <Card key={notif.id} className={cn("transition-all min-w-[85vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-2xl overflow-hidden border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-full", isDeclined && "opacity-60")}>
                                        <CardContent className="p-0 flex-1 flex flex-col">
                                            <div className={cn(
                                                "relative px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm",
                                                isDeclined && "opacity-80"
                                            )}>
                                                <div className="flex items-center gap-2 relative z-10 w-1/3">
                                                    {isDeclined ? (
                                                        <><XCircle className="w-4 h-4 text-slate-900 dark:text-slate-100" /><span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Declined</span></>
                                                    ) : isConfirmed ? (
                                                        <><CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /><span className="text-sm font-bold text-emerald-600 dark:text-emerald-500 tracking-tight">Waiting for confirmation</span></>
                                                    ) : (
                                                        <><Clock className="w-4 h-4 text-slate-900 dark:text-slate-100" /><span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Pending Response</span></>
                                                    )}
                                                </div>

                                                <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 text-orange-600 dark:text-orange-500 py-1 px-3 bg-orange-50 dark:bg-orange-500/10 rounded-full border border-orange-100 dark:border-orange-500/20 z-10">
                                                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                                                    <span className="text-sm font-black uppercase tracking-tight">
                                                        <LiveTimer createdAt={job.created_at} />
                                                    </span>
                                                </div>

                                                <div className="relative z-10 w-1/3 flex justify-end">
                                                    <Badge variant="outline" className={cn(
                                                        "flex items-center gap-1 text-xs px-2.5 py-1 shadow-sm font-bold border-0 bg-orange-100 text-orange-500",
                                                        isDeclined && "opacity-80"
                                                    )}>{getServiceIcon(job.service_type)}{formatJobTitle(job)}</Badge>
                                                </div>
                                            </div>

                                            {['pickup_delivery', 'cleaning', 'cooking', 'nanny', 'other_help'].includes(job.service_type || '') ? (
                                                <div className="flex-1 flex flex-col p-4 bg-white dark:bg-zinc-900 overflow-hidden">
                                                    {/* Top Row: Map/Image + Info */}
                                                    <div className="flex flex-row gap-4 mb-4">
                                                        {/* Left: Square Preview */}
                                                        <div
                                                            className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer border border-black/5 dark:border-white/5 shadow-inner group"
                                                            onClick={() => {
                                                                if (job.service_type === 'pickup_delivery') {
                                                                    setSelectedMapJob(job);
                                                                } else {
                                                                    setSelectedJobDetails(job);
                                                                }
                                                            }}
                                                        >
                                                            <div className="absolute inset-0 z-0">
                                                                {job.service_type === 'pickup_delivery' ? (
                                                                    <JobMap job={job} />
                                                                ) : (
                                                                    <img
                                                                        src={
                                                                            job.service_type === 'cleaning' ? "/cleaning-mar22.png" :
                                                                                job.service_type === 'cooking' ? "/cooking-mar22.png" :
                                                                                    job.service_type === 'nanny' ? "/nanny-mar22.png" :
                                                                                        "/other-mar22.png"
                                                                        }
                                                                        alt={formatJobTitle(job)}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10" />
                                                            <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/20 to-transparent z-20">
                                                                <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit">
                                                                    {job.service_type === 'pickup_delivery' ? (
                                                                        <MapPin className="w-2 h-2 text-primary" />
                                                                    ) : job.service_type === 'cleaning' ? (
                                                                        <Sparkles className="w-2 h-2 text-primary" />
                                                                    ) : job.service_type === 'cooking' ? (
                                                                        <UtensilsCrossed className="w-2 h-2 text-primary" />
                                                                    ) : job.service_type === 'nanny' ? (
                                                                        <Baby className="w-2 h-2 text-primary" />
                                                                    ) : (
                                                                        <HelpCircle className="w-2 h-2 text-primary" />
                                                                    )}
                                                                    {job.service_type === 'pickup_delivery' ? "Live" : "Service"}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Info Area */}
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border border-primary/10 flex-shrink-0">
                                                                        <AvatarImage src={job.profiles?.photo_url || undefined} className="object-cover" />
                                                                        <AvatarFallback className="bg-primary/5 text-primary text-xs sm:text-sm font-bold">
                                                                            {job.profiles?.full_name?.charAt(0) || "C"}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                                                                            {job.profiles?.full_name || "Client"}
                                                                        </p>
                                                                        <div className="flex items-center gap-1">
                                                                            {(job.profiles?.average_rating ?? 0) > 0 && (
                                                                                <StarRating rating={job.profiles?.average_rating || 0} size="md" />
                                                                            )}
                                                                            <span className="text-[10px] sm:text-xs font-bold text-slate-400">({job.profiles?.total_ratings || 0})</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="hidden md:grid md:grid-cols-2 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
                                                                {job.time_duration && (
                                                                    <div className="flex items-center gap-1 text-slate-500 py-0.5 sm:mt-1">
                                                                        <Briefcase className="w-2.5 h-2.5 text-primary" />
                                                                        <span className="text-sm font-bold uppercase tracking-tight text-foreground">{job.time_duration.replace(/_/g, '-')}</span>
                                                                    </div>
                                                                )}
                                                                {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Full Width Notes (if any) */}
                                                    {job.service_details?.custom && (
                                                        <div className="mb-4 w-full bg-slate-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 border border-black/5 dark:border-white/5 shadow-sm">
                                                            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-1.5 underline decoration-primary/30 underline-offset-4">NOTES</span>
                                                            <span className="text-slate-700 dark:text-slate-200 text-sm font-medium whitespace-pre-wrap leading-relaxed">{job.service_details.custom}</span>
                                                        </div>
                                                    )}

                                                    <div className="mt-auto flex flex-col gap-4">
                                                        {job.location_city && (
                                                            <div className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-full border border-black/5 dark:border-white/5 w-fit mx-auto">
                                                                <MapPin className="w-4 h-4 text-primary" />
                                                                <span className="text-sm font-bold text-foreground/80 uppercase tracking-tight">{job.location_city}</span>
                                                            </div>
                                                        )}
                                                        {!isConfirmed && !isDeclined && (
                                                            <div className="flex gap-3">
                                                                <Button
                                                                    variant="default"
                                                                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm"
                                                                    disabled={confirming === notif.id || deleting === notif.id}
                                                                    onClick={() => handleConfirm(job.id, notif.id)}
                                                                >
                                                                    {confirming === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                                    Accept
                                                                </Button>
                                                                <div className="flex-1 relative">
                                                                    <Button
                                                                        variant="outline"
                                                                        className="w-full h-11 border-0 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl text-xs sm:text-sm font-bold shadow-sm"
                                                                        disabled={confirming === notif.id || deleting === notif.id}
                                                                        onClick={() => handleDecline(notif.id)}
                                                                    >
                                                                        {deleting === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                                        Decline
                                                                    </Button>
                                                                    {/* Live Timer Badge */}
                                                                    {job.created_at && !isConfirmed && !isDeclined && (
                                                                        <LiveTimer createdAt={job.created_at} render={({ time, expired }: { time: string; expired: boolean }) => (
                                                                            <div className={cn(
                                                                                "absolute -top-3 -right-2 text-white font-black shadow-lg border-2 border-white dark:border-zinc-900 animate-in zoom-in duration-300 flex items-center shadow-emerald-500/20",
                                                                                expired 
                                                                                    ? "bg-emerald-500 px-2 py-1 rounded-full text-[10px] gap-1" 
                                                                                    : "bg-red-500 px-2.5 py-1 rounded-full text-xs gap-1.5"
                                                                            )}>
                                                                                <Clock className={cn(expired ? "w-2.5 h-2.5" : "w-3 h-3")} />
                                                                                {expired ? `Open ${time}` : time}
                                                                            </div>
                                                                        )} />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Default Vertical Layout */
                                                <div className="bg-white dark:bg-zinc-900 flex-1 flex flex-col">
                                                    <div className="px-5 py-4">
                                                        {job.profiles && (
                                                            <div className="flex items-center gap-3.5">
                                                                <Avatar className="w-16 h-16 border-2 border-primary/10 shadow-sm relative">
                                                                    <AvatarImage src={job.profiles.photo_url || undefined} className="object-cover" />
                                                                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-2xl">{job.profiles.full_name?.charAt(0).toUpperCase() || "C"}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col gap-1">
                                                                    <p className="font-bold text-xl leading-tight text-slate-900 dark:text-slate-100">{job.profiles.full_name || "Client"}</p>
                                                                    <div className="flex items-center flex-wrap gap-2 mt-0.5">
                                                                        <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm font-medium">
                                                                            <MapPin className="w-4 h-4 mr-1 text-primary/70" /> {job.location_city}
                                                                        </div>
                                                                        <span className="text-slate-600/30 dark:text-slate-400/30 hidden sm:inline">•</span>
                                                                        <StarRating
                                                                            rating={job.profiles.average_rating || 0}
                                                                            totalRatings={job.profiles.total_ratings || 0}
                                                                            size="sm"
                                                                            showCount={true}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="px-5 pt-4 pb-2">
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-base text-slate-600 dark:text-slate-400">
                                                            <div className="flex flex-wrap items-center gap-2 col-span-2 bg-orange-50 dark:bg-orange-500/5 px-3.5 py-3 rounded-2xl mb-1 border border-orange-200/50 dark:border-orange-500/10">
                                                                <Clock className="w-5 h-5 text-orange-500 flex-shrink-0 animate-pulse" />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] uppercase font-black text-orange-600/70 dark:text-orange-400/70 tracking-widest leading-none mb-1">Request Timer</span>
                                                                    <span className="font-black text-orange-600 dark:text-orange-500 text-xl tabular-nums leading-none tracking-tighter">
                                                                        <LiveTimer createdAt={job.created_at} />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {job.care_type && (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Briefcase className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_type.replace('_', ' ')} type</span>
                                                                </div>
                                                            )}
                                                            {job.time_duration && (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Hourglass className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.time_duration.replace(/_/g, '-')}</span>
                                                                </div>
                                                            )}
                                                            {job.care_frequency && (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Repeat className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_frequency.replace(/_/g, ' ')}</span>
                                                                </div>
                                                            )}
                                                            {job.children_count ? (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Baby className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.children_count} {job.children_age_group ? `(${job.children_age_group})` : ''} kids</span>
                                                                </div>
                                                            ) : null}
                                                            {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                                        </div>
                                                    </div>

                                                    {/* Job Map */}
                                                    {(job.service_type === 'pickup_delivery' || job.location_city) ? (
                                                        <div
                                                            className="mt-2 overflow-hidden relative cursor-pointer group"
                                                            onClick={() => setSelectedMapJob(job)}
                                                        >
                                                            <JobMap job={job} />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-black/5 dark:border-white/5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 pointer-events-none">
                                                                    <MapPin className="w-3 h-3 text-primary" />
                                                                    Expand View
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    <div className="px-5 pb-5 pt-1 flex flex-col gap-3 mt-auto">
                                                        {!isConfirmed && !isDeclined && (
                                                            <div className="flex gap-2 w-full mt-2">
                                                                <Button
                                                                    variant="default"
                                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-11"
                                                                    disabled={confirming === notif.id || deleting === notif.id}
                                                                    onClick={() => handleConfirm(job.id, notif.id)}
                                                                >
                                                                    {confirming === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                                    Accept
                                                                </Button>
                                                                <div className="flex-1 relative">
                                                                    <Button
                                                                        variant="outline"
                                                                        className="w-full border-0 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-2xl h-11 text-xs sm:text-sm font-bold"
                                                                        disabled={confirming === notif.id || deleting === notif.id}
                                                                        onClick={() => handleDecline(notif.id)}
                                                                    >
                                                                        {deleting === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                                        Decline
                                                                    </Button>
                                                                    {/* Live Timer Badge */}
                                                                    {job.created_at && !isConfirmed && !isDeclined && (
                                                                        <div className="absolute -top-2.5 -right-1.5 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border-2 border-white dark:border-zinc-900 animate-in zoom-in duration-300 flex items-center gap-1">
                                                                            <Clock className="w-2.5 h-2.5" />
                                                                            <LiveTimer createdAt={job.created_at} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card className="border-0 shadow-sm border-dashed bg-muted/30 mr-4 md:mr-0 min-w-[85vw] md:min-w-0">
                            <CardContent className="p-6 text-center text-muted-foreground">
                                <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-sm">No new invitations right now.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* SECTION: MY OUTBOUND REQUESTS */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" /> My Posted Requests
                    </h2>
                    {myOpenRequests.length > 0 ? (
                        <div className="flex flex-nowrap md:block md:space-y-4 overflow-x-auto pb-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0 mt-2">
                            {myOpenRequests.map((job) => (
                                <Card key={job.id} className="transition-all min-w-[85vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-2xl overflow-hidden border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-full">
                                    <CardContent className="p-0 flex-1 flex flex-col">
                                        <div className="relative px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
                                            <div className="flex items-center gap-2 relative z-10 w-1/3">
                                                <Clock className="w-4 h-4 text-slate-900 dark:text-slate-100" />
                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{getJobStatusBadge(job.status)}</span>
                                            </div>

                                            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 text-orange-600 dark:text-orange-500 py-1 px-3 bg-orange-50 dark:bg-orange-500/10 rounded-full border border-orange-100 dark:border-orange-500/20 z-10">
                                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                                <span className="text-sm font-black uppercase tracking-tight">
                                                    <LiveTimer createdAt={job.created_at} />
                                                </span>
                                            </div>

                                            <div className="relative z-10 w-1/3 flex justify-end">
                                                <Badge variant="outline" className="flex items-center gap-1 text-xs px-2.5 py-1 font-bold border-0 bg-orange-100 text-orange-500 truncate shadow-sm">{getServiceIcon(job.service_type)}{formatJobTitle(job)}</Badge>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-900 flex-1 flex flex-col">
                                            {['pickup_delivery', 'cleaning', 'cooking', 'nanny', 'other_help'].includes(job.service_type || '') ? (
                                                <div className="flex-1 flex flex-col p-4 bg-white dark:bg-zinc-900 overflow-hidden">
                                                    {/* Top Row: Map/Image + Info */}
                                                    <div className="flex flex-row gap-4 mb-4">
                                                        {/* Left: Square Preview */}
                                                        <div
                                                            className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer border border-black/5 dark:border-white/5 shadow-inner group"
                                                            onClick={() => {
                                                                if (job.service_type === 'pickup_delivery') {
                                                                    setSelectedMapJob(job);
                                                                } else {
                                                                    setSelectedJobDetails(job);
                                                                }
                                                            }}
                                                        >
                                                            <div className="absolute inset-0 z-0">
                                                                {job.service_type === 'pickup_delivery' ? (
                                                                    <JobMap job={job} />
                                                                ) : (
                                                                    <img
                                                                        src={
                                                                            job.service_type === 'cleaning' ? "/cleaning-mar22.png" :
                                                                                job.service_type === 'cooking' ? "/cooking-mar22.png" :
                                                                                    job.service_type === 'nanny' ? "/nanny-mar22.png" :
                                                                                        "/other-mar22.png"
                                                                        }
                                                                        alt={formatJobTitle(job)}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10" />
                                                            <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/20 to-transparent z-20">
                                                                <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit">
                                                                    {job.service_type === 'pickup_delivery' ? (
                                                                        <MapPin className="w-2 h-2 text-primary" />
                                                                    ) : job.service_type === 'cleaning' ? (
                                                                        <Sparkles className="w-2 h-2 text-primary" />
                                                                    ) : job.service_type === 'cooking' ? (
                                                                        <UtensilsCrossed className="w-2 h-2 text-primary" />
                                                                    ) : job.service_type === 'nanny' ? (
                                                                        <Baby className="w-2 h-2 text-primary" />
                                                                    ) : (
                                                                        <HelpCircle className="w-2 h-2 text-primary" />
                                                                    )}
                                                                    {job.service_type === 'pickup_delivery' ? "Live" : "Service"}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Info Area (Notes or Location) */}
                                                        <div className="flex-1 flex flex-col min-w-0 justify-center">
                                                            {job.service_details?.custom && (
                                                                <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 border border-black/5 dark:border-white/5 shadow-sm">
                                                                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-1.5 underline decoration-primary/30 underline-offset-4">NOTES</span>
                                                                    <span className="text-slate-700 dark:text-slate-200 text-sm font-medium whitespace-pre-wrap leading-relaxed line-clamp-3">{job.service_details.custom}</span>
                                                                </div>
                                                            )}

                                                            <div className="hidden md:grid md:grid-cols-2 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400 mt-2">
                                                                {job.time_duration && (
                                                                    <div className="flex items-center gap-1 text-slate-500 py-0.5">
                                                                        <Briefcase className="w-2.5 h-2.5 text-primary" />
                                                                        <span className="text-sm font-bold uppercase tracking-tight text-foreground">{job.time_duration.replace(/_/g, '-')}</span>
                                                                    </div>
                                                                )}
                                                                {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto flex flex-col gap-4">
                                                        {job.location_city && (
                                                            <div className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-full border border-black/5 dark:border-white/5 w-fit mx-auto">
                                                                <MapPin className="w-4 h-4 text-primary" />
                                                                <span className="text-sm font-bold text-foreground/80 uppercase tracking-tight">{job.location_city}</span>
                                                            </div>
                                                        )}

                                                        {/* Full Width Button */}
                                                        <div className="relative group/btn">
                                                            <Button
                                                                className="w-full h-11 text-xs sm:text-sm font-bold shadow-sm bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                                                onClick={() => navigate(`/client/jobs/${job.id}/confirmed`)}
                                                            >
                                                                <Users className="w-4 h-4" />
                                                                View Helpers
                                                            </Button>

                                                            {/* Acceptance Count Badge */}
                                                            {typeof (job as any).acceptedCount === 'number' && (
                                                                <div className={`absolute -top-3 -right-3 ${(job as any).acceptedCount > 0 ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-slate-400 ring-slate-400/20'} text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-lg animate-in zoom-in duration-300 ring-4`}>
                                                                    {(job as any).acceptedCount}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Default Vertical Layout for other service types */
                                                <>
                                                    <div className="px-5 py-4">
                                                        <div className="flex items-center gap-3.5">
                                                            <Avatar className="w-16 h-16 border-2 border-primary/10 shadow-sm relative">
                                                                <AvatarImage src={myProfile?.photo_url || undefined} className="object-cover" />
                                                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-2xl">{(myProfile?.full_name || user?.email || "M").charAt(0).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                                                    <MapPin className="w-4 h-4 text-primary/70" /> {job.location_city}
                                                                    <span className="mx-1 opacity-50">•</span>
                                                                    <Clock className="w-4 h-4 text-primary/70" /> {new Date(job.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="px-5 pt-4 pb-2">
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-base text-slate-600 dark:text-slate-400">
                                                            <div className="flex flex-wrap items-center gap-2 col-span-2 bg-orange-50 dark:bg-orange-500/5 px-3.5 py-3 rounded-2xl mb-1 border border-orange-200/50 dark:border-orange-500/10">
                                                                <Clock className="w-5 h-5 text-orange-500 flex-shrink-0 animate-pulse" />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] uppercase font-black text-orange-600/70 dark:text-orange-400/70 tracking-widest leading-none mb-1">Request Timer</span>
                                                                    <span className="font-black text-orange-600 dark:text-orange-500 text-xl tabular-nums leading-none tracking-tighter">
                                                                        <LiveTimer createdAt={job.created_at} />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {job.care_type && (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Briefcase className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_type.replace('_', ' ')} type</span>
                                                                </div>
                                                            )}
                                                            {job.time_duration && (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Hourglass className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.time_duration.replace(/_/g, '-')}</span>
                                                                </div>
                                                            )}
                                                            {job.care_frequency && (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Repeat className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_frequency.replace(/_/g, ' ')}</span>
                                                                </div>
                                                            )}
                                                            {job.children_count ? (
                                                                <div className="flex items-center gap-2 col-span-1 border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/20 px-2 py-1.5 rounded-lg">
                                                                    <Baby className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.children_count} {job.children_age_group ? `(${job.children_age_group})` : ''} kids</span>
                                                                </div>
                                                            ) : null}
                                                            {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                                        </div>
                                                    </div>

                                                    <div className="px-5 pb-6 pt-1 flex flex-col gap-3 mt-auto relative group/btn">
                                                        <Button className="w-full h-11 text-base font-bold shadow-lg btn-animate bg-orange-500 hover:bg-orange-600 text-white rounded-2xl transition-all active:scale-[0.98]" onClick={() => navigate(`/client/jobs/${job.id}/confirmed`)}>
                                                            <CheckCircle2 className="w-5 h-5 mr-2" /> View Helpers
                                                        </Button>

                                                        {/* Acceptance Count Badge */}
                                                        {typeof (job as any).acceptedCount === 'number' && (
                                                            <div className={`absolute top-[-8px] right-[8px] ${(job as any).acceptedCount > 0 ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-slate-400 ring-slate-400/20'} text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-lg animate-in zoom-in duration-300 ring-4`}>
                                                                {(job as any).acceptedCount}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
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
            </div>

            <FullscreenMapModal
                job={selectedMapJob}
                isOpen={!!selectedMapJob}
                onClose={() => setSelectedMapJob(null)}
            />

            <JobDetailsModal
                isOpen={!!selectedJobDetails}
                onOpenChange={(open) => !open && setSelectedJobDetails(null)}
                job={selectedJobDetails}
                formatJobTitle={formatJobTitle}
                isOwnRequest={selectedJobDetails?.client_id === user?.id}
            />
        </>
    );
}
