import { useEffect, useState } from "react";
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
    Bell, Clock, MapPin, CheckCircle2, Loader2, MessageSquare, 
    Sparkles, UtensilsCrossed, Truck, HelpCircle, Baby, XCircle
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
    const [userProfile, setUserProfile] = useState<{ full_name: string; photo_url: string | null } | null>(null);
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
            const [openJobsRes, notifsRes, profileRes] = await Promise.all([
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
                supabase
                    .from("profiles")
                    .select("full_name, photo_url")
                    .eq("id", user.id)
                    .single()
            ]);

            const openJobs = openJobsRes.data || [];
            const notificationsData = notifsRes.data || [];
            if (profileRes.data) setUserProfile(profileRes.data);

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
        const map: Record<string, { label: string; className: string }> = {
            ready: { label: "Waiting", className: "bg-amber-500 text-white shadow-amber-500/20" },
            notifying: { label: "Checking availability", className: "bg-slate-500 text-white shadow-slate-500/20" },
            confirmations_closed: { label: "Waiting", className: "bg-amber-500 text-white shadow-amber-500/20" },
            confirmed: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
        };
        const config = map[status] || { label: status, className: "bg-slate-400 text-white" };
        return <Badge className={cn("h-8 px-3.5 rounded-full text-[11px] uppercase font-black tracking-wider border-none shadow-lg transition-transform hover:scale-105", config.className)}>{config.label}</Badge>;
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

                {/* SECTION: INCOMING REQUESTS */}
                <div className="space-y-4">
                    <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100">
                        <Bell className="w-6 h-6 text-orange-500" /> Incoming Requests
                    </h2>
                    {inboundNotifications.length > 0 ? (
                        <div className="flex flex-nowrap md:block md:space-y-4 overflow-x-auto pb-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0 mt-2">
                            {inboundNotifications.map((notif) => {
                                const job = notif.job_requests;
                                const isConfirmed = notif.isConfirmed;
                                const isDeclined = notif.isDeclined;

                                return (
                                    <Card key={notif.id} className={cn("transition-all duration-300 min-w-[88vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-white/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex flex-col h-full bg-white dark:bg-zinc-900/50 backdrop-blur-sm group", isDeclined && "opacity-60")}>
                                        <div 
                                            className="relative w-full h-56 overflow-hidden group/img cursor-pointer"
                                            onClick={() => job.service_type === 'pickup_delivery' ? setSelectedMapJob(job) : setSelectedJobDetails(job)}
                                        >
                                            {job.service_type === 'pickup_delivery' ? (
                                                <div className="absolute inset-0 z-0">
                                                    <JobMap job={job} />
                                                </div>
                                            ) : (
                                                <img 
                                                    src={job.service_type === 'cleaning' ? "/cleaning-mar22.png" : job.service_type === 'cooking' ? "/cooking-mar22.png" : job.service_type === 'nanny' ? "/nanny-mar22.png" : "/other-mar22.png"} 
                                                    alt={formatJobTitle(job)} 
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" 
                                                />
                                            )}
                                            {/* Modern Gradient Overlays */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                                            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent z-10" />
                                            
                                            {/* Top Overlays */}
                                            <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                                                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full h-8 px-3.5 shadow-lg">
                                                    <div className="text-orange-400">
                                                        {getServiceIcon(job.service_type)}
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
                                                        {formatJobTitle(job)}
                                                    </span>
                                                </div>
                                                <Badge className={cn("h-8 px-3.5 rounded-full text-[11px] uppercase font-black tracking-wider border-none shadow-lg transition-transform", 
                                                    isDeclined ? "bg-slate-200 text-slate-600" :
                                                    isConfirmed ? "bg-emerald-500 text-white" :
                                                    "bg-amber-500 text-white"
                                                )}>
                                                    {isDeclined ? "Declined" : isConfirmed ? "Confirmed" : "Waiting"}
                                                </Badge>
                                            </div>

                                            {/* Bottom Overlays: Title & Rating */}
                                            <div className="absolute bottom-5 left-6 right-6 flex flex-col gap-2 z-20">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="w-10 h-10 border-2 border-white/30 shadow-2xl flex-shrink-0">
                                                        <AvatarImage src={job.profiles?.photo_url || ""} />
                                                        <AvatarFallback className="bg-orange-500 text-white font-black text-sm">
                                                            {job.profiles?.full_name?.charAt(0) || "C"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <h3 className="text-[24px] font-black text-white truncate tracking-tight drop-shadow-xl">
                                                        {job.profiles?.full_name || "Client"}
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {job.profiles?.average_rating ? (
                                                        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
                                                            <StarRating rating={job.profiles.average_rating} size="sm" />
                                                            <span className="text-[14px] font-black text-white/95">
                                                                {job.profiles.average_rating.toFixed(1)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[14px] font-bold text-white/80 italic drop-shadow-md">New Client</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <CardContent 
                                            className="p-6 flex-1 flex flex-col gap-6 cursor-pointer"
                                            onClick={() => setSelectedJobDetails(job)}
                                        >
                                            {/* Info Segments */}
                                            <div className="flex flex-col gap-4">
                                                <div className="grid grid-cols-2 gap-x-4">
                                                    {job.time_duration && (
                                                        <div className="flex items-center gap-2.5 text-[15px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
                                                            <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                                            <span className="truncate">{job.time_duration.replace(/_/g, '-')}</span>
                                                        </div>
                                                    )}
                                                    {job.location_city && (
                                                        <div className="flex items-center gap-2.5 text-[15px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
                                                            <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                                            <span className="truncate">{job.location_city}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {job.created_at && !isConfirmed && !isDeclined && (
                                                    <div className="flex items-center gap-2.5 text-[14px] text-orange-400 font-bold tracking-tight">
                                                        <Clock className="w-4 h-4 flex-shrink-0" />
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="opacity-60 font-medium">Expires in</span>
                                                            <LiveTimer createdAt={job.created_at} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Content Blocks: Notes */}
                                            {job.service_details?.custom && (
                                                <div className="pt-5 border-t border-slate-100 dark:border-white/5">
                                                    <div className="bg-slate-50 dark:bg-white/5 rounded-[20px] px-5 py-4 border border-slate-100 dark:border-white/5 flex flex-col gap-2">
                                                        <div className="font-black text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-[0.15em] flex items-center gap-2 opacity-80">
                                                            <MessageSquare className="w-3.5 h-3.5" /> Note
                                                        </div>
                                                        <p className="text-[15px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed italic">
                                                            "{job.service_details.custom}"
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Buttons Area - Standardized CTA Hierarchy */}
                                            {!isConfirmed && !isDeclined && (
                                                <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-12 rounded-[18px] border-slate-200 dark:border-white/10 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 transition-all active:scale-[0.96] font-bold"
                                                        onClick={() => handleDecline(notif.id)}
                                                        disabled={deleting === notif.id || confirming === notif.id}
                                                    >
                                                        {deleting === notif.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                        Decline
                                                    </Button>
                                                    <Button
                                                        className="flex-1 h-12 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_8px_20px_rgba(5,150,105,0.2)] transition-all active:scale-[0.96] font-bold"
                                                        onClick={() => handleConfirm(job.id, notif.id)}
                                                        disabled={deleting === notif.id || confirming === notif.id}
                                                    >
                                                        {confirming === notif.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                        Accept
                                                    </Button>
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
                    <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100 mt-4">
                        <Clock className="w-6 h-6 text-orange-500" /> My Posted Requests
                    </h2>
                    {myOpenRequests.length > 0 ? (
                        <div className="flex flex-nowrap md:block md:space-y-4 overflow-x-auto pb-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0 mt-2">
                            {myOpenRequests.map((job) => (
                                <Card key={job.id} className="transition-all duration-300 min-w-[88vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-white/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex flex-col h-full bg-white dark:bg-zinc-900/50 backdrop-blur-sm group">
                                    <div 
                                        className="relative w-full h-56 overflow-hidden group/img cursor-pointer"
                                        onClick={() => job.service_type === 'pickup_delivery' ? setSelectedMapJob(job) : setSelectedJobDetails(job)}
                                    >
                                        {job.service_type === 'pickup_delivery' ? (
                                            <div className="absolute inset-0 z-0">
                                                <JobMap job={job} />
                                            </div>
                                        ) : (
                                            <img 
                                                src={job.service_type === 'cleaning' ? "/cleaning-mar22.png" : job.service_type === 'cooking' ? "/cooking-mar22.png" : job.service_type === 'nanny' ? "/nanny-mar22.png" : "/other-mar22.png"} 
                                                alt={formatJobTitle(job)} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" 
                                            />
                                        )}
                                        {/* Modern Gradient Overlays */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                                        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent z-10" />
                                        
                                        {/* Top Overlays */}
                                        <div className="absolute top-4 left-4 right-4 flex justify-end items-start z-20">
                                            <div className="drop-shadow-lg scale-100 hover:scale-105 transition-transform duration-300">
                                                {/* Status badge handled by getJobStatusBadge */}
                                                {getJobStatusBadge(job.status)}
                                            </div>
                                        </div>

                                        {/* Bottom Overlays: Title */}
                                        <div className="absolute bottom-5 left-6 right-6 flex flex-col gap-2 z-20">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="w-10 h-10 border-2 border-white/30 shadow-2xl flex-shrink-0">
                                                    <AvatarImage src={userProfile?.photo_url || ""} />
                                                    <AvatarFallback className="bg-orange-500 text-white font-black text-sm">
                                                        {userProfile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <h3 className="text-[24px] font-black text-white truncate tracking-tight drop-shadow-xl">
                                                    {formatJobTitle(job)} Request
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[14px] text-white/80 font-medium drop-shadow-md">
                                                Posted {new Date(job.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <CardContent 
                                        className="p-6 flex-1 flex flex-col gap-6 cursor-pointer"
                                        onClick={() => setSelectedJobDetails(job)}
                                    >
                                        {/* Info Segments */}
                                        <div className="flex flex-col gap-4">
                                            <div className="grid grid-cols-2 gap-x-4">
                                                {job.time_duration && (
                                                    <div className="flex items-center gap-2.5 text-[15px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
                                                        <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">{job.time_duration.replace(/_/g, '-')}</span>
                                                    </div>
                                                )}
                                                {job.location_city && (
                                                    <div className="flex items-center gap-2.5 text-[15px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
                                                        <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">{job.location_city}</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {job.created_at && (
                                                <div className="flex items-center gap-2.5 text-[14px] text-orange-400 font-bold tracking-tight">
                                                    <Clock className="w-4 h-4 flex-shrink-0" />
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="opacity-60 font-medium">Active for</span>
                                                        <LiveTimer createdAt={job.created_at} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Content Blocks: Notes */}
                                        {job.service_details?.custom && (
                                            <div className="pt-5 border-t border-slate-100 dark:border-white/5">
                                                <div className="bg-slate-50 dark:bg-white/5 rounded-[20px] px-5 py-4 border border-slate-100 dark:border-white/5 flex flex-col gap-2">
                                                    <div className="font-black text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-[0.15em] flex items-center gap-2 opacity-80">
                                                        <MessageSquare className="w-3.5 h-3.5" /> Note
                                                    </div>
                                                    <p className="text-[15px] text-slate-700 dark:text-slate-200 font-medium leading-relaxed italic">
                                                        "{job.service_details.custom}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-auto flex flex-col gap-4 pt-6 border-t border-slate-100 dark:border-white/5">
                                            <div className="relative group/btn w-full">
                                                <Button
                                                    className="w-full h-12 rounded-[18px] bg-orange-500 hover:bg-orange-600 text-white shadow-[0_8px_20px_rgba(249,115,22,0.2)] transition-all active:scale-[0.96] font-bold text-[17px] flex items-center justify-between px-6"
                                                    onClick={() => navigate(`/client/jobs/${job.id}/confirmed`)}
                                                >
                                                    <span>View Helpers</span>
                                                    
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
