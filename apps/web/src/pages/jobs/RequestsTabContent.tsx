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
    Briefcase, Hourglass, Repeat, Baby, ArrowUpCircle, ArrowDownCircle, Package, Home, AlignLeft
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
    if (typeof details === 'string') return <div className="col-span-2 flex items-start gap-2 text-foreground font-medium"><AlignLeft className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" /> {details}</div>;

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
                {details.from_address && <div className="flex items-start gap-2 col-span-2 xl:col-span-1"><ArrowUpCircle className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight">{details.from_address} (From)</span></div>}
                {details.to_address && <div className="flex items-start gap-2 col-span-2 xl:col-span-1"><ArrowDownCircle className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight">{details.to_address} (To)</span></div>}
                {details.weight && <div className="flex items-start sm:items-center gap-2 col-span-2 xl:col-span-1"><Package className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize">{formatValue(details.weight)} kg weight</span></div>}
                {details.custom && <div className="col-span-2 flex flex-col gap-1 mt-1 border-t border-border/20 pt-2 w-full"><span className="font-semibold text-foreground/70 text-sm">Notes:</span><span className="text-foreground font-medium whitespace-pre-wrap">{details.custom}</span></div>}
            </>
        );
    }

    if (serviceType === 'cleaning') {
        return (
            <>
                {details.home_size && <div className="flex items-center gap-2 col-span-2 xl:col-span-1"><Home className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize">{formatValue(details.home_size)} size</span></div>}
                {details.custom && <div className="col-span-2 flex flex-col gap-1 mt-1 border-t border-border/20 pt-2 w-full"><span className="font-semibold text-foreground/70 text-sm">Notes:</span><span className="text-foreground font-medium whitespace-pre-wrap">{details.custom}</span></div>}
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
                    <div key={key} className="flex items-start sm:items-center gap-2 col-span-2 xl:col-span-1">
                        <AlignLeft className="w-4 h-4 text-primary/70 flex-shrink-0" />
                        <span className="font-medium text-foreground capitalize">{formatValue(value)} {key.replace(/_/g, ' ')}</span>
                    </div>
                );
            })}
            {details.custom && (
                <div className="col-span-2 flex flex-col gap-1 mt-1 border-t border-border/20 pt-2 w-full">
                    <span className="font-semibold text-foreground/70 text-sm">Notes:</span>
                    <span className="text-foreground font-medium whitespace-pre-wrap">{details.custom}</span>
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

    useEffect(() => {
        async function loadRequests() {
            if (!user) return;
            try {
                // 1. Fetch Outbound ("My Open Requests") -> Jobs where I am the client and status is open
                const { data: openJobs } = await supabase
                    .from("job_requests")
                    .select("*")
                    .eq("client_id", user.id)
                    .in("status", ["ready", "notifying", "confirmations_closed"])
                    .order("created_at", { ascending: false });

                setMyOpenRequests(openJobs || []);

                // 2. Fetch Inbound -> Notifications where I am the candidate
                const { data: notificationsData } = await supabase
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
                    .order("created_at", { ascending: false });

                if (notificationsData) {
                    // Check confirmations to see what's confirmed or declined
                    const { data: confirmationsData } = await supabase
                        .from("job_confirmations")
                        .select("job_id, status")
                        .eq("freelancer_id", user.id);

                    const confirmedJobIds = new Set((confirmationsData || []).filter(c => c.status === "available").map(c => c.job_id));
                    const declinedJobIds = new Set((confirmationsData || []).filter(c => c.status === "declined").map(c => c.job_id));

                    const validNotifications = notificationsData
                        .filter((n: any) => n.job_requests)
                        .map((n: any) => ({
                            ...n,
                            isConfirmed: confirmedJobIds.has(n.job_id),
                            isDeclined: declinedJobIds.has(n.job_id)
                        }));

                    setInboundNotifications(validNotifications as InboundNotification[]);
                }

                // Add conversation fetching
                const allJobIds = [
                    ...(openJobs || []).map(j => j.id),
                    ...(notificationsData || []).map((n: any) => n.job_id)
                ];

                if (allJobIds.length > 0) {
                    const { data: convs } = await supabase
                        .from("conversations")
                        .select("id, job_id, client_id, freelancer_id")
                        .in("job_id", allJobIds)
                        .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

                    if (convs) {
                        const convMap: Record<string, string> = {};
                        convs.forEach(c => {
                            if (c.job_id) convMap[c.job_id] = c.id;
                        });
                    }
                }
            } catch (e) {
                console.error("Error loading requests:", e);
            } finally {
                setLoading(false);
            }
        }
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
                                <Card key={notif.id} className={cn("border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all min-w-[85vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-2xl overflow-hidden bg-background", isDeclined && "opacity-60")}>
                                    <CardContent className="p-0">
                                        <div className={cn(
                                            "px-5 py-3 flex items-center justify-between border-b border-border/30",
                                            isDeclined ? "bg-red-500/10" : isConfirmed ? "bg-emerald-500/10" : "bg-primary/5"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                {isDeclined ? (
                                                    <><XCircle className="w-5 h-5 text-red-500" /><span className="text-base font-bold text-red-600">Declined</span></>
                                                ) : isConfirmed ? (
                                                    <><CheckCircle2 className="w-5 h-5 text-emerald-500" /><span className="text-base font-bold text-emerald-600">Confirmed!</span></>
                                                ) : (
                                                    <><Clock className="w-5 h-5 text-primary" /><span className="text-base font-bold text-primary">Pending Response</span></>
                                                )}
                                            </div>
                                            <Badge variant={isDeclined ? "destructive" : "default"} className="text-sm px-3 py-1 shadow-sm font-semibold">{formatJobTitle(job)}</Badge>
                                        </div>

                                        <div className="px-5 py-4 border-b border-border/40">
                                            {job.profiles && (
                                                <div className="flex items-center gap-3.5">
                                                    <Avatar className="w-16 h-16 border-2 border-primary/10 shadow-sm relative">
                                                        <AvatarImage src={job.profiles.photo_url || undefined} className="object-cover" />
                                                        <AvatarFallback className="bg-primary/5 text-primary font-bold text-2xl">{job.profiles.full_name?.charAt(0).toUpperCase() || "C"}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-bold text-xl leading-tight text-foreground">{job.profiles.full_name || "Client"}</p>
                                                        <div className="flex items-center flex-wrap gap-2 mt-0.5">
                                                            <div className="flex items-center text-muted-foreground text-sm font-medium">
                                                                <MapPin className="w-4 h-4 mr-1 text-primary/70" /> {job.location_city}
                                                            </div>
                                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
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
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-base text-muted-foreground">
                                                {job.start_at && (
                                                    <div className="flex flex-wrap items-center gap-2 col-span-2 bg-muted/30 px-3.5 py-2.5 rounded-xl mb-1 border border-border/40">
                                                        <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                                                        <span className="font-bold text-foreground">{new Date(job.start_at).toLocaleDateString()}</span>
                                                        <span className="text-muted-foreground font-medium">at</span>
                                                        <span className="font-bold text-foreground">{new Date(job.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                )}
                                                {job.care_type && (
                                                    <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                        <Briefcase className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize">{job.care_type.replace('_', ' ')} type</span>
                                                    </div>
                                                )}
                                                {job.time_duration && (
                                                    <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                        <Hourglass className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground">{job.time_duration.replace(/_/g, '-')} duration</span>
                                                    </div>
                                                )}
                                                {job.care_frequency && (
                                                    <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                        <Repeat className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize">{job.care_frequency.replace(/_/g, ' ')} frequency</span>
                                                    </div>
                                                )}
                                                {job.children_count ? (
                                                    <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                        <Baby className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground">{job.children_count} {job.children_age_group ? `(${job.children_age_group})` : ''} kids</span>
                                                    </div>
                                                ) : null}
                                                {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                            </div>
                                        </div>

                                        {/* Job Map */}
                                        {(job.service_type === 'pickup_delivery' || job.location_city) ? (
                                            <div className="px-5 pb-4 mt-2">
                                                <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm">
                                                    <JobMap job={job} />
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="px-5 pb-5 pt-1 flex flex-col gap-3">

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
                                                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                        disabled={confirming === notif.id || deleting === notif.id}
                                                        onClick={() => handleDecline(notif.id)}
                                                    >
                                                        {deleting === notif.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                        Decline
                                                    </Button>
                                                </div>
                                            )}
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
                            <Card key={job.id} className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all min-w-[85vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-2xl overflow-hidden bg-background">
                                <CardContent className="p-0">
                                    <div className="px-5 py-3 flex items-center justify-between border-b border-border/30 bg-primary/5">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-primary" />
                                            <span className="text-base font-bold text-primary">{getJobStatusBadge(job.status)}</span>
                                        </div>
                                        <Badge variant="default" className="text-sm px-3 py-1 shadow-sm font-semibold">{formatJobTitle(job)}</Badge>
                                    </div>
                                    <div className="px-5 py-4 border-b border-border/40">
                                        <div className="flex items-center gap-3.5">
                                            <Avatar className="w-16 h-16 border-2 border-primary/10 shadow-sm relative">
                                                <AvatarImage src={user?.user_metadata?.avatar_url || undefined} className="object-cover" />
                                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-2xl">{user?.email?.charAt(0).toUpperCase() || "M"}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col gap-1">
                                                <p className="font-bold text-xl leading-tight text-foreground">My Request</p>
                                                <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground font-medium">
                                                    <MapPin className="w-4 h-4 text-primary/70" /> {job.location_city}
                                                    <span className="mx-1 opacity-50">•</span>
                                                    <Clock className="w-4 h-4 text-primary/70" /> {new Date(job.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Extended Job Details */}
                                    <div className="px-5 pt-4 pb-2">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-base text-muted-foreground">
                                            {job.start_at && (
                                                <div className="flex flex-wrap items-center gap-2 col-span-2 bg-muted/30 px-3.5 py-2.5 rounded-xl mb-1 border border-border/40">
                                                    <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                                                    <span className="font-bold text-foreground">{new Date(job.start_at).toLocaleDateString()}</span>
                                                    <span className="text-muted-foreground font-medium">at</span>
                                                    <span className="font-bold text-foreground">{new Date(job.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                            {job.care_type && (
                                                <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                    <Briefcase className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize">{job.care_type.replace('_', ' ')} type</span>
                                                </div>
                                            )}
                                            {job.time_duration && (
                                                <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                    <Hourglass className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground">{job.time_duration.replace(/_/g, '-')} duration</span>
                                                </div>
                                            )}
                                            {job.care_frequency && (
                                                <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                    <Repeat className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize">{job.care_frequency.replace(/_/g, ' ')} frequency</span>
                                                </div>
                                            )}
                                            {job.children_count ? (
                                                <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                                    <Baby className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground">{job.children_count} {job.children_age_group ? `(${job.children_age_group})` : ''} kids</span>
                                                </div>
                                            ) : null}
                                            {job.service_details && formatServiceDetails(job.service_details, job.service_type)}
                                        </div>
                                    </div>

                                    {/* Job Map */}
                                    {(job.service_type === 'pickup_delivery' || job.location_city) ? (
                                        <div className="px-5 pb-4 mt-2">
                                            <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm">
                                                <JobMap job={job} />
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="px-5 pb-5 pt-1 flex gap-3">
                                        <Button className="flex-1 h-12 text-base font-semibold shadow-md btn-animate" onClick={() => navigate(`/client/jobs/${job.id}/confirmed`)}>
                                            <CheckCircle2 className="w-5 h-5 mr-2" /> View Helpers
                                        </Button>
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
    );
}
