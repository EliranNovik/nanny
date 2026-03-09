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
    Briefcase, Hourglass, Repeat, Baby, ArrowUpCircle, ArrowDownCircle, Package, Home, AlignLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import JobMap from "@/components/JobMap";

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

export default function JobsTabContent() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
    const [pastJobs, setPastJobs] = useState<JobRequest[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [conversations, setConversations] = useState<Record<string, string>>({});
    const [pastJobsExpanded, setPastJobsExpanded] = useState(false);

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
                        .select("id, full_name, photo_url")
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

    const handleCompleteJob = async (jobId: string) => {
        try {
            await supabase
                .from("job_requests")
                .update({ status: "completed" })
                .eq("id", jobId);

            // Reload the jobs list to reflect the new state
            loadJobs();
        } catch (error) {
            console.error("Error completing job:", error);
        }
    };

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

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="flex flex-nowrap md:block md:space-y-6 overflow-x-auto pb-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0 mt-2">
            {activeJobs.map(job => {
                const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                const otherParty = otherPartyId ? profiles[otherPartyId] : null;

                return (
                    <Card key={job.id} className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all min-w-[85vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-2xl overflow-hidden bg-background">
                        <CardContent className="p-0">
                            <div className="px-5 py-3 flex items-center justify-between border-b border-border/30 bg-primary/5">
                                <div className="flex items-center gap-2">
                                    {job.status === 'locked' ? <Calendar className="w-5 h-5 text-primary" /> : job.status === 'active' ? <Clock className="w-5 h-5 text-emerald-500" /> : <CheckCircle2 className="w-5 h-5 text-muted-foreground" />}
                                    <span className={cn("text-base font-bold capitalize", job.status === 'locked' ? 'text-primary' : job.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground')}>
                                        {getJobStatusBadge(job.status).label}
                                    </span>
                                </div>
                                <Badge variant="default" className="text-sm px-3 py-1 shadow-sm font-semibold">{formatJobTitle(job)}</Badge>
                            </div>

                            {otherParty && (
                                <div className="px-5 py-4 border-b border-border/40">
                                    <div className="flex items-center gap-3.5">
                                        <Avatar className="w-16 h-16 border-2 border-primary/10 shadow-sm relative">
                                            <AvatarImage src={otherParty.photo_url || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-primary/5 text-primary font-bold text-2xl">{otherParty.full_name?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col gap-1">
                                            <p className="font-bold text-xl leading-tight text-foreground">{otherParty.full_name || "User"}</p>
                                            <div className="flex items-center flex-wrap gap-2 mt-0.5">
                                                <div className="flex items-center text-muted-foreground text-sm font-medium">
                                                    <span className="text-muted-foreground/70 mr-1.5">With</span> {otherPartyId === job.client_id ? 'Client' : 'Freelancer'}
                                                </div>
                                                <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                                {job.location_city && (
                                                    <div className="flex items-center text-muted-foreground text-sm font-medium">
                                                        <MapPin className="w-4 h-4 mr-1 text-primary/70" /> {job.location_city}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                    {!otherParty && job.location_city && (
                                        <div className="flex items-center gap-2 col-span-2 xl:col-span-1">
                                            <MapPin className="w-4 h-4 text-primary/70 flex-shrink-0" /> <span className="font-medium text-foreground">{job.location_city}</span>
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
                            {(job.service_type === 'pickup_delivery' || (!otherParty && job.location_city)) && job.status !== 'completed' && job.status !== 'cancelled' ? (
                                <div className="px-5 pb-4 mt-2">
                                    <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm">
                                        <JobMap job={job} />
                                    </div>
                                </div>
                            ) : null}

                            <div className="px-5 pb-5 pt-1 flex gap-3">
                                <Button className="flex-1 h-12 text-base font-semibold border-2" variant="outline" onClick={() => conversations[job.id] ? navigate(`/chat/${conversations[job.id]}`) : navigate(`/client/jobs/${job.id}`)}>
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Job Details
                                </Button>
                                <Button className="flex-1 h-12 text-base font-semibold shadow-md btn-animate bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleCompleteJob(job.id)}>
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Job Done
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {pastJobs.length > 0 && (
                <Card className="border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl mx-4 md:mx-0 mt-6">
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

            {activeJobs.length === 0 && pastJobs.length === 0 && (
                <Card className="border-0 shadow-lg text-center py-12">
                    <CardContent>
                        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                            <Calendar className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">No Jobs Yet</h3>
                        <p className="text-muted-foreground mb-4">You don't have any active or past jobs.</p>
                        <Button onClick={() => navigate("/client/create")}>Find a Helper</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
