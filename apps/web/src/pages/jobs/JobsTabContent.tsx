import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Calendar, Clock, MapPin, ChevronDown, ChevronUp, MessageCircle, Loader2, CheckCircle2,
    Briefcase, Hourglass, Repeat, Baby, ArrowUpCircle, ArrowDownCircle, Package, Home, AlignLeft,
    Sparkles, UtensilsCrossed, Truck, HelpCircle
} from "lucide-react";
import JobMap from "@/components/JobMap";
import JobReviewModal from "@/components/JobReviewModal";
import { StarRating } from "@/components/StarRating";

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
                {details.from_address && <div className="flex items-start gap-2 col-span-1"><ArrowUpCircle className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm">{details.from_address} (From)</span></div>}
                {details.to_address && <div className="flex items-start gap-2 col-span-1"><ArrowDownCircle className="w-4 h-4 mt-0.5 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground leading-tight text-sm">{details.to_address} (To)</span></div>}
                {details.weight && <div className="flex items-center gap-2 col-span-1"><Package className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.weight)} kg</span></div>}
                {details.custom && <div className="col-span-2 flex flex-col gap-1.5 mt-2 w-full bg-orange-500 rounded-xl px-4 py-3 border-none shadow-sm"><span className="font-bold text-white/90 text-[10px] uppercase tracking-widest flex items-center gap-2 underline underline-offset-4 decoration-white/20">NOTES</span><span className="text-white text-sm font-medium whitespace-pre-wrap">{details.custom}</span></div>}
            </>
        );
    }

    if (serviceType === 'cleaning') {
        return (
            <>
                {details.home_size && <div className="flex items-center gap-2 col-span-1"><Home className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground capitalize text-sm">{formatValue(details.home_size)} size</span></div>}
                {details.custom && <div className="col-span-2 flex flex-col gap-1.5 mt-2 w-full bg-orange-500 rounded-xl px-4 py-3 border-none shadow-sm"><span className="font-bold text-white/90 text-[10px] uppercase tracking-widest flex items-center gap-2 underline underline-offset-4 decoration-white/20">NOTES</span><span className="text-white text-sm font-medium whitespace-pre-wrap">{details.custom}</span></div>}
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
                        <AlignLeft className="w-4 h-4 text-primary/70 flex-shrink-0" />
                        <span className="font-medium text-foreground capitalize text-sm">{formatValue(value)} {key.replace(/_/g, ' ')}</span>
                    </div>
                );
            })}
            {details.custom && (
                <div className="col-span-2 flex flex-col gap-1.5 mt-2 w-full bg-orange-500 rounded-xl px-4 py-3 border-none shadow-sm">
                    <span className="font-bold text-white/90 text-[10px] uppercase tracking-widest flex items-center gap-2 underline underline-offset-4 decoration-white/20">NOTES</span>
                    <span className="text-white text-sm font-medium whitespace-pre-wrap">{details.custom}</span>
                </div>
            )}
        </>
    );
}

export default function JobsTabContent() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
    const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [conversations, setConversations] = useState<Record<string, string>>({});
    const [pastJobsExpanded, setPastJobsExpanded] = useState(false);
    const [reviewJob, setReviewJob] = useState<{
        jobId: string;
        reviewee: Profile;
        revieweeRole: "client" | "freelancer";
    } | null>(null);

    const loadJobs = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: allJobs } = await supabase
                .from("job_requests")
                .select("*")
                .or(`client_id.eq.${user.id},selected_freelancer_id.eq.${user.id}`)
                .in("status", ["locked", "active", "completed", "cancelled"])
                .order("created_at", { ascending: false });

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

                if (profileIds.size > 0) {
                    const { data: profileData } = await supabase
                        .from("profiles")
                        .select("id, full_name, photo_url, average_rating, total_ratings")
                        .in("id", Array.from(profileIds));

                    if (profileData) {
                        const pMap: Record<string, Profile> = {};
                        profileData.forEach(p => pMap[p.id] = p);
                        setProfiles(pMap);
                    }
                }

                if (active.length > 0) {
                    const { data: convs } = await supabase
                        .from("conversations")
                        .select("id, job_id")
                        .in("job_id", active.map(a => a.id));

                    if (convs) {
                        const convMap: Record<string, string> = {};
                        convs.forEach(c => {
                            if (c.job_id) convMap[c.job_id] = c.id;
                        });
                        setConversations(convMap);
                    }
                }

            }
        } catch (e) {
            console.error("Error loading jobs:", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadJobs();
    }, [user]);

    function getJobStatusBadge(status: string) {
        const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
            locked: { label: "In progress", variant: "default" },
            active: { label: "In progress", variant: "default" },
            completed: { label: "Completed", variant: "outline" },
            cancelled: { label: "Cancelled", variant: "destructive" },
        };
        return map[status] || { label: status, variant: "outline" };
    }

    function formatJobTitle(job: JobRequest) {
        if (job.service_type === 'cleaning') return 'Cleaning';
        if (job.service_type === 'cooking') return 'Cooking';
        if (job.service_type === 'pickup_delivery') return 'Pickup & Delivery';
        if (job.service_type === 'nanny') return 'Nanny';
        if (job.service_type === 'other_help') return 'Other Help';
        return `Nanny – ${Number(job.children_count) || 0} kid(s)`;
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
        <div className="space-y-6 mt-2">
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

            {/* Active jobs – horizontal scroll on mobile, vertical stack on md+ */}
            <div className="flex flex-nowrap md:block md:space-y-6 overflow-x-auto pb-2 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0">
                {activeJobs.map(job => {
                    const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                    const otherParty = otherPartyId ? profiles[otherPartyId] : null;

                    return (
                        <Card key={job.id} className="transition-all min-w-[85vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-2xl overflow-hidden border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <CardContent className="p-0">
                                <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        {job.status === 'locked' ? <Calendar className="w-4 h-4 text-slate-900 dark:text-slate-100" /> : job.status === 'active' ? <Clock className="w-4 h-4 text-slate-900 dark:text-slate-100" /> : <CheckCircle2 className="w-4 h-4 text-slate-900 dark:text-slate-100" />}
                                        <span className="text-sm font-bold capitalize text-slate-900 dark:text-slate-100 tracking-tight">
                                            {getJobStatusBadge(job.status).label}
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="flex items-center gap-1 text-xs px-2.5 py-1 font-bold border-0 bg-primary text-white shadow-sm">{getServiceIcon(job.service_type)}{formatJobTitle(job)}</Badge>
                                </div>

                                <div className="bg-white dark:bg-zinc-900">
                                    {otherParty && (
                                        <div className="px-5 py-4">
                                            <div className="flex items-center gap-3.5">
                                                <Avatar className="w-16 h-16 border-2 border-primary/10 shadow-sm relative">
                                                    <AvatarImage src={otherParty.photo_url || undefined} className="object-cover" />
                                                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-2xl">{otherParty.full_name?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col gap-1">
                                                    <p className="font-bold text-xl leading-tight text-slate-900 dark:text-slate-100">{otherParty.full_name || "User"}</p>
                                                    <div className="flex items-center flex-wrap gap-2 mt-0.5">
                                                        {job.location_city && (
                                                            <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm font-medium">
                                                                <MapPin className="w-4 h-4 mr-1 text-primary/70" /> {job.location_city}
                                                            </div>
                                                        )}
                                                        {(otherParty.average_rating ?? 0) > 0 && (
                                                            <StarRating rating={otherParty.average_rating ?? 0} totalRatings={otherParty.total_ratings ?? 0} size="sm" showCount={true} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Extended Job Details */}
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
                                            {!otherParty && job.location_city && (
                                                <div className="flex items-center gap-2 col-span-1">
                                                    <MapPin className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{job.location_city}</span>
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
                                    {(job.service_type === 'pickup_delivery' || (!otherParty && job.location_city)) && job.status !== 'completed' && job.status !== 'cancelled' ? (
                                        <div className="mt-2 overflow-hidden">
                                            <JobMap job={job} />
                                        </div>
                                    ) : null}

                                    <div className="px-5 pb-5 pt-1 flex gap-3">
                                        <Button className="flex-1 h-12 text-base font-semibold border-0 bg-primary/10 text-primary hover:bg-primary/20" variant="outline" onClick={() => conversations[job.id] ? navigate(`/chat/${conversations[job.id]}`) : navigate(`/client/jobs/${job.id}`)}>
                                            <MessageCircle className="w-5 h-5 mr-2" />
                                            Job Details
                                        </Button>
                                        <Button
                                            className="flex-1 h-12 text-base font-semibold shadow-md btn-animate bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => {
                                                const otherPartyIdLocal = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                                                const otherPartyLocal = otherPartyIdLocal ? profiles[otherPartyIdLocal] : null;
                                                if (otherPartyLocal) {
                                                    setReviewJob({
                                                        jobId: job.id,
                                                        reviewee: otherPartyLocal,
                                                        revieweeRole: otherPartyIdLocal === job.client_id ? "client" : "freelancer",
                                                    });
                                                } else {
                                                    supabase.from("job_requests").update({ status: "completed" }).eq("id", job.id).then(() => loadJobs());
                                                }
                                            }}
                                        >
                                            <CheckCircle2 className="w-5 h-5 mr-2" />
                                            Job Done
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Past Jobs – always stacks vertically below active cards */}
            {pastJobs.length > 0 && (
                <Card className="rounded-2xl border-none shadow-none">
                    <CardHeader className="cursor-pointer px-5 py-4" onClick={() => setPastJobsExpanded(!pastJobsExpanded)}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold">Past Jobs</CardTitle>
                            {pastJobsExpanded ? <ChevronUp className="w-6 h-6 text-muted-foreground" /> : <ChevronDown className="w-6 h-6 text-muted-foreground" />}
                        </div>
                    </CardHeader>
                    {pastJobsExpanded && (
                        <CardContent className="space-y-3 px-5 pb-5 pt-0">
                            {pastJobs.map(job => {
                                const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                                const otherParty = otherPartyId ? profiles[otherPartyId] : null;

                                return (
                                    <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="font-semibold text-base">{new Date(job.created_at).toLocaleDateString()}</span>
                                                <span className="text-base text-muted-foreground truncate">{formatJobTitle(job)}</span>
                                            </div>
                                            {otherParty && (
                                                <div className="flex items-center gap-2 mt-1 mb-2">
                                                    <Avatar className="w-6 h-6 border bg-background">
                                                        <AvatarImage src={otherParty.photo_url || undefined} className="object-cover" />
                                                        <AvatarFallback className="text-[10px]">{otherParty.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                                    </Avatar>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {otherParty.full_name}
                                                    </p>
                                                    {(otherParty.average_rating ?? 0) > 0 && (
                                                        <StarRating rating={otherParty.average_rating ?? 0} totalRatings={otherParty.total_ratings ?? 0} size="sm" showCount={true} />
                                                    )}
                                                </div>
                                            )}
                                            <Badge variant={getJobStatusBadge(job.status).variant} className="text-xs px-2.5 py-0.5">
                                                {getJobStatusBadge(job.status).label}
                                            </Badge>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <Button variant="outline" size="sm" className="w-full sm:w-auto mt-2 sm:mt-0 font-semibold" onClick={() => conversations[job.id] ? navigate(`/chat/${conversations[job.id]}`) : navigate(`/client/jobs/${job.id}`)}>
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}

