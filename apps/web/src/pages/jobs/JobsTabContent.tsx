import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MapPin, ChevronDown, ChevronUp, Loader2, CheckCircle2,
    Clock, MessageSquare, Sparkles, UtensilsCrossed,
    Truck, Baby, HelpCircle
} from "lucide-react";
import JobMap from "@/components/JobMap";
import JobReviewModal from "@/components/JobReviewModal";
import { StarRating } from "@/components/StarRating";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";

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
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [selectedMapJob, setSelectedMapJob] = useState<JobRequest | null>(null);
    const [selectedJobDetails, setSelectedJobDetails] = useState<JobRequest | null>(null);

    // 1. Fetch cache on mount
    useEffect(() => {
        if (!user) return;
        try {
            const cacheKey = `jobs_tab_cache_${user.id}`;
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
    }, [user]);

    const loadJobs = async () => {
        if (!user) return;
        if (isFirstLoad && loading) {
            // we are already showing cache or initial loader
        } else {
            // if not first load, don't show full page loader? 
            // for now keep it simple to avoid flicker
        }

        try {
            const { data: allJobs, error: jobsError } = await supabase
                .from("job_requests")
                .select("*")
                .or(`client_id.eq.${user.id},selected_freelancer_id.eq.${user.id}`)
                .in("status", ["locked", "active", "completed", "cancelled"])
                .order("created_at", { ascending: false });

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
                const cacheKey = `jobs_tab_cache_${user.id}`;
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
    }, [user]);

    function getJobStatusBadge(status: string) {
        const map: Record<string, { label: string; className: string }> = {
            locked: { label: "In progress", className: "bg-blue-600 text-white shadow-blue-500/20" },
            active: { label: "In progress", className: "bg-blue-600 text-white shadow-blue-500/20" },
            confirmed: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            completed: { label: "Completed", className: "bg-green-600 text-white shadow-green-500/20" },
            cancelled: { label: "Cancelled", className: "bg-slate-500 text-white shadow-slate-500/20" },
        };
        const config = map[status] || { label: status, className: "bg-slate-400 text-white" };
        return { 
            label: config.label, 
            className: cn("h-8 px-3.5 rounded-full text-[11px] uppercase font-black tracking-wider border-none shadow-lg transition-transform hover:scale-105", config.className)
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

    function getServiceIcon(serviceType?: string) {
        switch (serviceType) {
            case 'cleaning': return <Sparkles className="w-4 h-4" />;
            case 'cooking': return <UtensilsCrossed className="w-4 h-4" />;
            case 'pickup_delivery': return <Truck className="w-4 h-4" />;
            case 'nanny': return <Baby className="w-4 h-4" />;
            default: return <HelpCircle className="w-4 h-4" />;
        }
    }


    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <>
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
                <div className="flex flex-nowrap md:block md:space-y-6 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 gap-4 md:gap-0">
                    {activeJobs.map(job => {
                        const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                        const otherParty = otherPartyId ? profiles[otherPartyId] : null;
                        const statusBadge = getJobStatusBadge(job.status);

                        return (
                            <Card key={job.id} className="transition-all duration-300 min-w-[88vw] md:min-w-0 w-full flex-shrink-0 snap-center md:snap-none md:flex-shrink rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-white/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex flex-col h-full group bg-white dark:bg-zinc-900/50 backdrop-blur-sm">
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
                                        <Badge className={statusBadge.className}>
                                            {statusBadge.label}
                                        </Badge>
                                    </div>

                                    {/* Bottom Overlays: Title & Rating */}
                                    <div className="absolute bottom-5 left-6 right-6 flex flex-col gap-2 z-20">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-10 h-10 border-2 border-white/30 shadow-2xl flex-shrink-0">
                                                <AvatarImage src={otherParty?.photo_url || ""} />
                                                <AvatarFallback className="bg-orange-500 text-white font-black text-sm">
                                                    {otherParty?.full_name?.charAt(0) || "C"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <h3 className="text-[24px] font-black text-white truncate tracking-tight drop-shadow-xl">
                                                {otherParty?.full_name || "Client"}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {otherParty?.average_rating ? (
                                                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
                                                    <StarRating rating={otherParty.average_rating} size="sm" />
                                                    <span className="text-[14px] font-black text-white/95">
                                                        {otherParty.average_rating.toFixed(1)}
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

                                        {(job.status === 'active' || job.status === 'locked') && (
                                            <div className="flex items-center gap-2.5 text-[14px] text-orange-400 font-bold tracking-tight">
                                                <Clock className="w-4 h-4 flex-shrink-0" />
                                                <div className="flex items-center gap-1.5">
                                                    <span className="opacity-60 font-medium">In progress since</span>
                                                    <span className="text-slate-600 dark:text-slate-400">{new Date(job.created_at).toLocaleDateString()}</span>
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
                                    <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
                                         <Button variant="outline" className="flex-1 h-12 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-[18px] text-[16px] font-bold transition-all active:scale-[0.96]" onClick={(e) => { e.stopPropagation(); conversations[job.id] ? navigate(`/chat/${conversations[job.id]}`) : navigate(`/client/jobs/${job.id}`); }}>
                                             <MessageSquare className="w-4 h-4 mr-2" /> Message
                                         </Button>
                                         <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-[18px] text-[16px] font-bold shadow-[0_8px_20px_rgba(22,163,74,0.25)] transition-all active:scale-[0.96]" onClick={(e) => {
                                             e.stopPropagation();
                                             if (otherParty) {
                                                 setReviewJob({
                                                     jobId: job.id,
                                                     reviewee: otherParty,
                                                     revieweeRole: otherPartyId === job.client_id ? "client" : "freelancer",
                                                 });
                                             } else {
                                                 supabase.from("job_requests").update({ status: "completed" }).eq("id", job.id).then(() => loadJobs());
                                             }
                                         }}>
                                             <CheckCircle2 className="w-4 h-4 mr-2" /> Done
                                         </Button>
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
                                        <div key={job.id} className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 gap-3 min-h-[100px]">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5 translate-y-2 sm:translate-y-0">
                                                    <span className="font-semibold text-base">{new Date(job.created_at).toLocaleDateString()}</span>
                                                    <span className="text-base text-muted-foreground truncate">{formatJobTitle(job)}</span>
                                                </div>
                                                {otherParty && (
                                                    <div className="flex items-center gap-2 mt-1 mb-2 translate-y-2 sm:translate-y-0 text-slate-900 dark:text-white">
                                                        <Avatar className="w-6 h-6 border bg-background shadow-sm">
                                                            <AvatarImage src={otherParty.photo_url || undefined} className="object-cover" />
                                                            <AvatarFallback className="text-[10px] bg-slate-100">{otherParty.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                                        </Avatar>
                                                        <p className="text-sm font-bold truncate">
                                                            {otherParty.full_name}
                                                        </p>
                                                        {(otherParty.average_rating ?? 0) > 0 && (
                                                            <StarRating rating={otherParty.average_rating ?? 0} totalRatings={otherParty.total_ratings ?? 0} size="sm" showCount={true} />
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* ABSOLUTE POSITIONED BADGE */}
                                            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 h-fit">
                                                <Badge className={cn("px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-none rounded-full", getJobStatusBadge(job.status).className)}>
                                                    {getJobStatusBadge(job.status).label}
                                                </Badge>
                                            </div>

                                            <div className="flex-shrink-0 mt-4 sm:mt-0">
                                                <Button variant="outline" size="sm" className="w-full sm:w-auto h-10 px-6 font-bold border-slate-200 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all duration-300 shadow-sm" onClick={() => navigate(`/jobs/${job.id}/details`)}>
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

