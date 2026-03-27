import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MapPin, CheckCircle2, Loader2, MessageSquare, Briefcase, Clock,
    Sparkles, Utensils, Baby, Calendar, ChevronRight
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


interface JobsTabContentProps {
    activeTab: 'jobs' | 'past';
}

export default function JobsTabContent({ activeTab }: JobsTabContentProps) {
    const { user } = useAuth();
    const navigate = useNavigate();

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
    const [activeId, setActiveId] = useState<string | null>(null);

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

    // Smart Mobile Scroll Focus Logic
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    setActiveId(entry.target.id);
                }
            });
        }, { 
            threshold: 0.5,
            rootMargin: '-15% 0px -15% 0px'
        });

        const cards = document.querySelectorAll('[data-job-card]');
        cards.forEach(card => observer.observe(card));
        
        return () => observer.disconnect();
    }, [activeJobs, pastJobs, activeTab]);

    function getJobStatusBadge(status: string) {
        const map: Record<string, { label: string; className: string }> = {
            locked: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            active: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            confirmed: { label: "Confirmed", className: "bg-emerald-500 text-white shadow-emerald-500/20" },
            completed: { label: "Completed", className: "bg-green-600 text-white shadow-green-500/20" },
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



    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <>
            <div className="space-y-10">
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
                    <div className="space-y-14">
                        <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100">
                            <Briefcase className="w-6 h-6 text-orange-500" /> Active Jobs
                        </h2>
                        {activeJobs.length > 0 ? (
                            <div className="space-y-14">
                                {activeJobs.map(job => {
                                    const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                                    const otherParty = otherPartyId ? profiles[otherPartyId] : null;
                                    const statusBadge = getJobStatusBadge(job.status);

                                    return (
                                        <Card 
                                            key={job.id} 
                                            id={`card-${job.id}`}
                                            data-job-card
                                            className="transition-all duration-500 w-[82vw] max-w-[82vw] shrink-0 snap-start md:w-full md:max-w-3xl md:mx-auto md:shrink rounded-[32px] overflow-hidden border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] hover:-translate-y-2 flex flex-col h-full group bg-white dark:bg-zinc-900/50 backdrop-blur-sm relative"
                                        >
                                            {/* Smart Scroll Overlay */}
                                            <div className={cn(
                                                "absolute inset-0 bg-zinc-900/40 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none z-[100]",
                                                activeId && activeId !== `card-${job.id}` ? "opacity-100" : "opacity-0"
                                            )} />
                                            <div 
                                                className="relative h-36 w-full overflow-hidden group/img cursor-pointer sm:h-40"
                                                onClick={() => job.service_type === 'pickup_delivery' ? setSelectedMapJob(job) : setSelectedJobDetails(job)}
                                            >
                                                {job.service_type === 'pickup_delivery' ? (
                                                    <div className="absolute inset-0 z-0"><JobMap job={job} /></div>
                                                ) : (
                                                    <img src={job.service_type === 'cleaning' ? "/cleaning-mar22.png" : job.service_type === 'cooking' ? "/cooking-mar22.png" : job.service_type === 'nanny' ? "/nanny-mar22.png" : "/other-mar22.png"} alt={formatJobTitle(job)} className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 z-10" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-20" />
                                                <div className="absolute top-4 right-4 z-20"><Badge className={statusBadge.className}>{statusBadge.label}</Badge></div>
                                                <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 md:hidden">
                                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white backdrop-blur-md">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </span>
                                                </div>
                                                <div className="absolute bottom-3 left-6 right-6 flex flex-col gap-2 z-20">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-16 h-16 border-2 border-white/30 shadow-2xl flex-shrink-0 transition-transform duration-500 group-hover:scale-110">
                                                            <AvatarImage src={otherParty?.photo_url || ""} />
                                                            <AvatarFallback className="bg-orange-500 text-white font-black text-sm">{otherParty?.full_name?.charAt(0) || "C"}</AvatarFallback>
                                                        </Avatar>
                                                        <h3 className="text-[24px] font-black text-white truncate tracking-tight drop-shadow-xl">{otherParty?.full_name || "Client"}</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2 px-0.5">
                                                        {otherParty?.average_rating ? (
                                                            <StarRating 
                                                                rating={otherParty.average_rating} 
                                                                size="sm" 
                                                                showCount={false}
                                                                starClassName="text-white"
                                                                emptyStarClassName="text-white/30"
                                                                numberClassName="text-white drop-shadow-md text-[14px]"
                                                            />
                                                        ) : <span className="text-[14px] font-bold text-white/80 italic drop-shadow-md">New Client</span>}
                                                        <span className="text-[12px] font-black text-white/90 uppercase tracking-[0.15em] drop-shadow-md ml-auto">{formatJobTitle(job)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <CardContent className="p-7 flex-1 flex flex-col gap-7 cursor-pointer" onClick={() => setSelectedJobDetails(job)}>
                                                <div className="flex flex-col gap-6">
                                                    <div className="grid grid-cols-2 gap-x-6">
                                                        {job.time_duration && (<div className="flex items-center gap-3 text-[17px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight"><Clock className="w-6 h-6 text-slate-400 flex-shrink-0" /><span className="truncate">{job.time_duration.replace(/_/g, '-')}</span></div>)}
                                                        {job.location_city && (<div className="flex items-center gap-3 text-[17px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight"><MapPin className="w-6 h-6 text-slate-400 flex-shrink-0" /><span className="truncate">{job.location_city}</span></div>)}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[16px] text-orange-400 font-bold tracking-tight">
                                                        <Clock className="w-5 h-5 flex-shrink-0" />
                                                        <div className="flex items-center gap-1.5"><span className="opacity-60 font-medium">Confirmed since</span><span className="text-slate-600 dark:text-slate-400">{new Date(job.created_at).toLocaleDateString()}</span></div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
                                                    <Button variant="outline" className="flex-1 h-12 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-[18px] text-[16px] font-bold transition-all active:scale-[0.96]" onClick={(e) => { e.stopPropagation(); conversations[job.id] ? navigate(`/chat/${conversations[job.id]}`) : navigate(`/client/jobs/${job.id}`); }}><MessageSquare className="w-4 h-4 mr-2" /> Message</Button>
                                                    <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-[18px] text-[16px] font-bold shadow-[0_8px_20px_rgba(22,163,74,0.25)] transition-all active:scale-[0.96]" onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (otherParty) { setReviewJob({ jobId: job.id, reviewee: otherParty, revieweeRole: otherPartyId === job.client_id ? "client" : "freelancer" }); }
                                                        else { supabase.from("job_requests").update({ status: "completed" }).eq("id", job.id).then(() => loadJobs()); }
                                                    }}><CheckCircle2 className="w-4 h-4 mr-2" /> Done</Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="border-0 shadow-sm border-dashed bg-muted/30">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-lg font-bold">No active jobs right now.</p>
                                    <p className="text-sm">When you accept a request, it will appear here.</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* PAST JOBS SECTION */}
                {activeTab === 'past' && (
                    <div className="space-y-14">
                        <h2 className="text-[22px] font-black flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-slate-100">
                            <CheckCircle2 className="w-6 h-6 text-orange-500" /> Past Jobs
                        </h2>
                        {pastJobs.length > 0 ? (
                            <div className="space-y-14">
                                {pastJobs.map(job => {
                                    const otherPartyId = job.client_id === user?.id ? job.selected_freelancer_id : job.client_id;
                                    const otherParty = otherPartyId ? profiles[otherPartyId] : null;
                                    const statusBadge = getJobStatusBadge(job.status);
                                    return (
                                        <div 
                                            key={job.id} 
                                            id={`card-${job.id}`}
                                            data-job-card
                                            className="group relative w-full flex flex-col sm:flex-row sm:items-center justify-between p-7 rounded-[32px] border border-black/[0.05] dark:border-white/5 bg-white dark:bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] hover:-translate-y-2 transition-all duration-500 gap-6 overflow-hidden"
                                        >
                                            <div className={cn(
                                                "absolute inset-0 bg-zinc-900/25 backdrop-blur-[0.5px] transition-opacity duration-500 pointer-events-none md:hidden z-[10]",
                                                activeId && activeId !== `card-${job.id}` ? "opacity-100" : "opacity-0"
                                            )} />
                                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                                <div className="relative">
                                                    <Avatar className="w-16 h-16 border-2 border-white dark:border-zinc-800 shadow-2xl flex-shrink-0 transition-transform duration-500 group-hover:scale-110">
                                                        <AvatarImage src={otherParty?.photo_url || ""} />
                                                        <AvatarFallback className="bg-slate-100 text-slate-500 font-bold text-sm">{otherParty?.full_name?.charAt(0) || "U"}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm border border-black/[0.05]">
                                                        {job.service_type === 'cleaning' ? <Sparkles className="w-3 h-3 text-blue-500" /> : 
                                                         job.service_type === 'cooking' ? <Utensils className="w-3 h-3 text-orange-500" /> : 
                                                         job.service_type === 'nanny' ? <Baby className="w-3 h-3 text-pink-500" /> : 
                                                         <Briefcase className="w-3 h-3 text-slate-500" />}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-black text-[18px] text-slate-900 dark:text-white truncate tracking-tight">{otherParty?.full_name || "User"}</h4>
                                                        {otherParty?.average_rating && (
                                                            <div className="flex items-center gap-1 ml-1 scale-90 origin-left">
                                                                <StarRating 
                                                                    rating={otherParty.average_rating} 
                                                                    size="sm" 
                                                                    showCount={false}
                                                                    starClassName="text-slate-900 dark:text-white"
                                                                    emptyStarClassName="text-slate-900/20 dark:text-white/20"
                                                                    numberClassName="text-slate-900 dark:text-white font-black text-[14px]"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <span className="text-[13px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{formatJobTitle(job)}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                                                        <span className="text-[15px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                                            <Calendar className="w-4 h-4 opacity-50" /> {new Date(job.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 sm:flex-shrink-0">
                                                <Badge className={cn("h-7 px-3 rounded-full text-[11px] uppercase font-black tracking-widest border-none shadow-sm", statusBadge.className)}>
                                                    {statusBadge.label}
                                                </Badge>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-11 px-6 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-2xl group/btn"
                                                    onClick={() => navigate(`/jobs/${job.id}/details`)}
                                                >
                                                    View Details <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Card className="border-0 shadow-sm border-dashed bg-muted/30">
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

