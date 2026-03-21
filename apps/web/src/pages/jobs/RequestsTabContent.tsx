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
    Bell, Clock, MapPin, CheckCircle2, Loader2, XCircle,
    Briefcase, Hourglass, Repeat, Baby, ArrowUpCircle, ArrowDownCircle, Package, Home, AlignLeft,
    Sparkles, UtensilsCrossed, Truck, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import JobMap from "@/components/JobMap";
import { StarRating } from "@/components/StarRating";

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
        // Replace underscore between digits with a hyphen, rest of underscores with spaces
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
                {details.from_address && <div className="flex items-start gap-2"><ArrowUpCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm truncate">{details.from_address} (From)</span></div>}
                {details.to_address && <div className="flex items-start gap-2"><ArrowDownCircle className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm truncate">{details.to_address} (To)</span></div>}
                {details.weight && <div className="flex items-center gap-2"><Package className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.weight)} kg</span></div>}
                {details.custom && <div className="col-span-2 flex flex-col gap-1.5 mt-2 w-full bg-muted rounded-xl px-4 py-3 border-none shadow-sm"><span className="font-bold text-muted-foreground text-[10px] uppercase tracking-widest flex items-center gap-2">NOTES</span><span className="text-foreground text-sm font-medium whitespace-pre-wrap">{details.custom}</span></div>}
            </>
        );
    }

    if (serviceType === 'cleaning') {
        return (
            <>
                {details.home_size && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.home_size)} size</span></div>}
                {details.custom && <div className="col-span-2 flex flex-col gap-1.5 mt-2 w-full bg-muted rounded-xl px-4 py-3 border-none shadow-sm"><span className="font-bold text-muted-foreground text-[10px] uppercase tracking-widest flex items-center gap-2">NOTES</span><span className="text-foreground text-sm font-medium whitespace-pre-wrap">{details.custom}</span></div>}
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
            {details.custom && (
                <div className="col-span-2 flex flex-col gap-1.5 mt-2 w-full bg-muted rounded-xl px-4 py-3 border-none shadow-sm">
                    <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-widest flex items-center gap-2">NOTES</span>
                    <span className="text-foreground text-sm font-medium whitespace-pre-wrap">{details.custom}</span>
                </div>
            )}
        </>
    );
}

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
                          id, client_id, service_type, care_type, children_count, children_age_group, location_city, start_at, service_details, time_duration, care_frequency,
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


            const [confsRes] = await Promise.all([
                supabase
                    .from("job_confirmations")
                    .select("job_id, status")
                    .eq("freelancer_id", user.id)
            ]);

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
                                            "px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm",
                                            isDeclined && "opacity-80",
                                            isConfirmed && "bg-emerald-50 dark:bg-emerald-900/10"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                {isDeclined ? (
                                                    <><XCircle className="w-4 h-4 text-slate-900 dark:text-slate-100" /><span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Declined</span></>
                                                ) : isConfirmed ? (
                                                    <><CheckCircle2 className="w-4 h-4 text-slate-900 dark:text-slate-100" /><span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Confirmed!</span></>
                                                ) : (
                                                    <><Clock className="w-4 h-4 text-slate-900 dark:text-slate-100" /><span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Pending Response</span></>
                                                )}
                                            </div>
                                            <Badge variant="outline" className={cn(
                                                "flex items-center gap-1 text-xs px-2.5 py-1 shadow-sm font-bold border-0 bg-orange-100 text-orange-500",
                                                isDeclined && "opacity-80"
                                            )}>{getServiceIcon(job.service_type)}{formatJobTitle(job)}</Badge>
                                        </div>

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
                                                    {job.start_at && (
                                                        <div className="flex flex-wrap items-center gap-2 col-span-2 bg-slate-100 dark:bg-zinc-800 px-3.5 py-2.5 rounded-xl mb-1 border border-black/5 dark:border-white/5">
                                                            <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                                                            <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(job.start_at).toLocaleDateString()}</span>
                                                            <span className="text-slate-600 dark:text-slate-400 font-medium">at</span>
                                                            <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(job.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    )}
                                                    {job.care_type && (
                                                        <div className="flex items-center gap-2 col-span-1">
                                                            <Briefcase className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_type.replace('_', ' ')} type</span>
                                                        </div>
                                                    )}
                                                    {job.time_duration && (
                                                        <div className="flex items-center gap-2 col-span-1">
                                                            <Hourglass className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.time_duration.replace(/_/g, '-')}</span>
                                                        </div>
                                                    )}
                                                    {job.care_frequency && (
                                                        <div className="flex items-center gap-2 col-span-1">
                                                            <Repeat className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_frequency.replace(/_/g, ' ')}</span>
                                                        </div>
                                                    )}
                                                    {job.children_count ? (
                                                        <div className="flex items-center gap-2 col-span-1">
                                                            <Baby className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.children_count} {job.children_age_group ? `(${job.children_age_group})` : ''} kids</span>
                                                        </div>
                                                    ) : null}
                                                    {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                                </div>
                                            </div>

                                            {/* Job Map */}
                                            {(job.service_type === 'pickup_delivery' || job.location_city) ? (
                                                <div className="mt-2 overflow-hidden">
                                                    <JobMap job={job} />
                                                </div>
                                            ) : null}

                                            <div className="px-5 pb-5 pt-1 flex flex-col gap-3 mt-auto">

                                                {!isConfirmed && !isDeclined && (
                                                    <div className="flex gap-2 w-full mt-2">
                                                        <Button
                                                            variant="default"
                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            disabled={confirming === notif.id || deleting === notif.id}
                                                            onClick={() => handleConfirm(job.id, notif.id)}
                                                        >
                                                            {confirming === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                            Accept
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1 border-0 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                                                            disabled={confirming === notif.id || deleting === notif.id}
                                                            onClick={() => handleDecline(notif.id)}
                                                        >
                                                            {deleting === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                            Decline
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
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
                                    <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-900 dark:text-slate-100" />
                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{getJobStatusBadge(job.status)}</span>
                                        </div>
                                        <Badge variant="outline" className="flex items-center gap-1 text-xs px-2.5 py-1 font-bold border-0 bg-orange-100 text-orange-500 truncate shadow-sm">{getServiceIcon(job.service_type)}{formatJobTitle(job)}</Badge>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-900 flex-1 flex flex-col">
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

                                        {/* Extended Job Details */}
                                        <div className="px-5 pt-4 pb-2">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-base text-slate-600 dark:text-slate-400">
                                                {job.start_at && (
                                                    <div className="flex flex-wrap items-center gap-2 col-span-2 bg-slate-100 dark:bg-zinc-800 px-3.5 py-2.5 rounded-xl mb-1 border border-black/5 dark:border-white/5">
                                                        <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                                        <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(job.start_at).toLocaleDateString()}</span>
                                                        <span className="text-slate-600 dark:text-slate-400 font-medium">at</span>
                                                        <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(job.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                )}
                                                {job.care_type && (
                                                    <div className="flex items-center gap-2 col-span-1">
                                                        <Briefcase className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_type.replace('_', ' ')} type</span>
                                                    </div>
                                                )}
                                                {job.time_duration && (
                                                    <div className="flex items-center gap-2 col-span-1">
                                                        <Hourglass className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.time_duration.replace(/_/g, '-')}</span>
                                                    </div>
                                                )}
                                                {job.care_frequency && (
                                                    <div className="flex items-center gap-2 col-span-1">
                                                        <Repeat className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 capitalize text-sm">{job.care_frequency.replace(/_/g, ' ')}</span>
                                                    </div>
                                                )}
                                                {job.children_count ? (
                                                    <div className="flex items-center gap-2 col-span-1">
                                                        <Baby className="w-4 h-4 text-orange-500 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.children_count} {job.children_age_group ? `(${job.children_age_group})` : ''} kids</span>
                                                    </div>
                                                ) : null}
                                                {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                            </div>
                                        </div>

                                        {/* Job Map - Nested Look */}
                                        {job.service_type === 'pickup_delivery' ? (
                                            <div className="mt-2 mx-4 mb-4 overflow-hidden h-28 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                                                <JobMap job={job} />
                                            </div>
                                        ) : null}

                                        <div className="px-5 pb-6 pt-1 flex gap-3 mt-auto">
                                            <Button className="flex-1 h-14 text-base font-bold shadow-lg btn-animate bg-orange-500 hover:bg-orange-600 text-white rounded-2xl" onClick={() => navigate(`/client/jobs/${job.id}/confirmed`)}>
                                                <CheckCircle2 className="w-5 h-5 mr-2" /> View Helpers
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
        </div >
    );
}
