import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MessageCircle,
    Loader2,
    MapPin,
    Calendar,
    CheckCircle2,
    XCircle,
    Hourglass,
    Baby,
    Home,
    AlignLeft,
    ArrowUpCircle,
    ArrowDownCircle,
    Package,
    Sparkles,
    UtensilsCrossed,
    Truck,
    HelpCircle,
    Star
} from "lucide-react";
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
    confirm_starts_at?: string | null;
    confirm_ends_at?: string | null;
    created_at: string;
    service_details?: any;
    time_duration?: string;
    care_frequency?: string;
}

interface Profile {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    bio?: string | null;
    average_rating?: number;
    total_ratings?: number;
}

export default function PastJobDetailsPage() {
    const { jobId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [job, setJob] = useState<JobRequest | null>(null);
    /** Always set when the job has a counterparty id (so UI can link even if profile fetch fails). */
    const [otherUserId, setOtherUserId] = useState<string | null>(null);
    const [otherParty, setOtherParty] = useState<Profile | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            if (!jobId || !user) return;

            try {
                // 1. Fetch Job Details
                const { data: jobData, error: jobError } = await supabase
                    .from("job_requests")
                    .select("*")
                    .eq("id", jobId)
                    .single();

                if (jobError) throw jobError;
                setJob(jobData);

                // 2. Fetch Other Party Profile
                const otherPartyId = jobData.client_id === user.id ? jobData.selected_freelancer_id : jobData.client_id;
                if (otherPartyId && typeof otherPartyId === "string") {
                    setOtherUserId(otherPartyId);
                    const { data: profileData, error: profileError } = await supabase
                        .from("profiles")
                        // Note: `bio` is stored in `freelancer_profiles`, not `profiles`.
                        .select("id, full_name, photo_url, average_rating, total_ratings")
                        .eq("id", otherPartyId)
                        .single();

                    if (profileError) console.warn("[PastJobDetailsPage] profile fetch:", profileError);

                    // Optional bio (helpers) lives on freelancer_profiles.
                    const { data: freelancerData } = await supabase
                        .from("freelancer_profiles")
                        .select("bio")
                        .eq("user_id", otherPartyId)
                        .maybeSingle();

                    if (profileData)
                        setOtherParty({
                            ...(profileData as Profile),
                            bio: freelancerData?.bio ?? null,
                        });
                    else
                        setOtherParty({
                            id: otherPartyId,
                            full_name: null,
                            photo_url: null,
                            bio: freelancerData?.bio ?? null,
                            average_rating: undefined,
                            total_ratings: undefined,
                        });
                } else {
                    setOtherUserId(null);
                    setOtherParty(null);
                }

                // 3. Fetch Conversation ID
                const { data: convoData } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("job_id", jobId)
                    .maybeSingle();
                
                if (convoData) setConversationId(convoData.id);

            } catch (err) {
                console.error("Error loading past job details:", err);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [jobId, user]);

    function formatServiceDetails(details: any, serviceType?: string) {
        if (!details) return null;
        if (typeof details === 'string') return <div className="flex items-start gap-2 text-foreground font-medium"><AlignLeft className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" /> {details}</div>;

        const formatValue = (val: any) => {
            if (typeof val !== 'string') return String(val);
            return val.replace(/(\d)_(\d)/g, '$1-$2').replace(/_/g, ' ');
        };

        if (serviceType === 'pickup_delivery') {
            return (
                <div className="space-y-3">
                    {details.from_address && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5">
                            <ArrowUpCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">PICKUP ADDRESS</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{details.from_address}</span>
                            </div>
                        </div>
                    )}
                    {details.to_address && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5">
                            <ArrowDownCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">DELIVERY ADDRESS</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{details.to_address}</span>
                            </div>
                        </div>
                    )}
                    {details.weight && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5">
                            <Package className="w-5 h-5 text-orange-500 flex-shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">WEIGHT</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatValue(details.weight)} kg</span>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (serviceType === 'cleaning') {
            return (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5">
                    <Home className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">HOME SIZE</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatValue(details.home_size)} size</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 gap-3">
                {Object.entries(details).map(([key, value]) => {
                    if (key === 'custom' || key.includes('lat') || key.includes('lng')) return null;
                    return (
                        <div key={key} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-black/5 dark:border-white/5">
                            <AlignLeft className="w-5 h-5 text-orange-500 flex-shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{key.replace(/_/g, ' ')}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatValue(value)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (loading) return (
        <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    if (!job) return (
        <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center p-4">
            <h1 className="text-xl font-bold mb-4">Job not found</h1>
            <Button onClick={() => navigate("/jobs")}>Back to Jobs</Button>
        </div>
    );

    const isTransport = job.service_type === 'pickup_delivery';
    const statusLabel = job.status === 'completed' ? 'Completed' : 'Cancelled';
    const statusColor = job.status === 'completed' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-500';
    const statusIcon = job.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />;

    return (
        <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
            <div className="app-desktop-shell pt-6">
                <div className="mx-auto w-full max-w-4xl lg:max-w-5xl 2xl:max-w-6xl">
                <div className="space-y-8">
                    {/* Hero Section: Compact Card with Header & Image Overlay */}
                    <Card className="rounded-3xl border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden bg-card/95">
                        {/* HEADER BAR */}
                        <div className="bg-card px-6 py-4 flex items-center justify-between border-b border-black/5">
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg bg-slate-100 ${statusColor}`}>
                                    {statusIcon}
                                </div>
                                <span className={`font-bold text-sm tracking-wide uppercase ${statusColor}`}>{statusLabel}</span>
                            </div>
                            <Badge variant="outline" className="bg-slate-50 border border-black/10 text-slate-700 font-bold px-3 py-1 scale-110">
                                {job.service_type === 'cleaning' && <Sparkles className="w-3.5 h-3.5 mr-2" />}
                                {job.service_type === 'cooking' && <UtensilsCrossed className="w-3.5 h-3.5 mr-2" />}
                                {job.service_type === 'pickup_delivery' && <Truck className="w-3.5 h-3.5 mr-2" />}
                                {job.service_type === 'nanny' && <Baby className="w-3.5 h-3.5 mr-2" />}
                                {job.service_type === 'other_help' && <HelpCircle className="w-3.5 h-3.5 mr-2" />}
                                <span className="capitalize">{job.service_type?.replace('_', ' ')}</span>
                            </Badge>
                        </div>

                        {/* Above the image/map: maps/iframes often cover absolute siblings — keep profile here */}
                        {otherUserId && otherParty && (
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 border-b border-black/5 bg-card/95 px-4 py-3 text-left transition hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset sm:px-6"
                                onClick={() => navigate(`/profile/${encodeURIComponent(otherUserId)}`)}
                            >
                                <Avatar className="h-11 w-11 shrink-0 border border-black/10">
                                    <AvatarImage src={otherParty.photo_url || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                        {otherParty.full_name?.charAt(0) || "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-extrabold text-slate-900 dark:text-slate-100">
                                        {otherParty.full_name?.trim() || "View profile"}
                                    </p>
                                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                                        <Star className="h-4 w-4 shrink-0 text-orange-400 fill-orange-400" />
                                        <span className="font-semibold">{otherParty.average_rating ?? 0}</span>
                                        <span className="text-slate-400">
                                            ({otherParty.total_ratings ?? 0} reviews)
                                        </span>
                                    </div>
                                </div>
                                <span className="hidden shrink-0 text-xs font-bold text-orange-600 sm:inline">
                                    View →
                                </span>
                            </button>
                        )}

                        <CardContent className="p-0">
                            {/* Tall Image/Map with Light Overlay */}
                            <div className="relative h-96 md:h-[450px] overflow-hidden bg-slate-50">
                                <div className="absolute inset-0 z-0">
                                    {isTransport ? (
                                        <JobMap job={job} />
                                    ) : (
                                        <img 
                                            src={
                                                job.service_type === 'cleaning' ? "/cleaning-mar22.png" : 
                                                job.service_type === 'cooking' ? "/cooking-mar22.png" : 
                                                job.service_type === 'nanny' ? "/nanny-mar22.png" :
                                                "/other-mar22.png"
                                            } 
                                            alt={job.service_type} 
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                                
                                {/* LIGHT BOTTOM OVERLAY WITH DETAILS */}
                                <div className="absolute inset-x-4 bottom-4 p-6 bg-card/80 backdrop-blur-xl z-20 rounded-[2.5rem] border border-border/40 shadow-2xl">
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500/80 uppercase tracking-[0.2em] mb-2">START DATE</span>
                                            <div className="flex items-center gap-3 text-slate-900">
                                                <Calendar className="w-5 h-5 text-orange-500" />
                                                <span className="font-extrabold text-base sm:text-lg">
                                                    {job.confirm_starts_at ? new Date(job.confirm_starts_at).toLocaleDateString() : (job.start_at ? new Date(job.start_at).toLocaleDateString() : 'N/A')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500/80 uppercase tracking-[0.2em] mb-2">END DATE</span>
                                            <div className="flex items-center gap-3 text-slate-900">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                <span className="font-extrabold text-base sm:text-lg">
                                                    {job.confirm_ends_at ? new Date(job.confirm_ends_at).toLocaleDateString() : (job.start_at ? new Date(job.start_at).toLocaleDateString() : 'N/A')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500/80 uppercase tracking-[0.2em] mb-2">CITY</span>
                                            <div className="flex items-center gap-3 text-slate-900">
                                                <MapPin className="w-5 h-5 text-orange-500" />
                                                <span className="font-extrabold text-base sm:text-lg truncate">{job.location_city}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500/80 uppercase tracking-[0.2em] mb-2">DURATION</span>
                                            <div className="flex items-center gap-3 text-slate-900">
                                                <Hourglass className="w-5 h-5 text-orange-500" />
                                                <span className="font-extrabold text-base sm:text-lg capitalize">{job.time_duration?.replace(/_ /g, '-') || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Job Details Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg tracking-tight px-1">Service Specifications</h3>
                            {formatServiceDetails(job.service_details, job.service_type)}
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-lg tracking-tight px-1 text-slate-500">Additional Context</h3>
                            {job.service_details?.custom ? (
                                <div className="p-4 bg-card rounded-3xl border border-black/5 shadow-sm">
                                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-3 underline decoration-slate-200 underline-offset-8">Historical Notes</span>
                                    <span className="text-slate-700 text-sm font-medium whitespace-pre-wrap leading-relaxed">{job.service_details.custom}</span>
                                </div>
                            ) : (
                                <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-black/10 flex items-center justify-center text-slate-400 font-bold text-xs">
                                    No additional notes for this job.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Hub */}
                    <div className="pt-8">
                        {conversationId && (
                            <Button 
                                className="w-full h-16 rounded-3xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg shadow-lg transition-all active:scale-[0.98]"
                                onClick={() => navigate(`/chat/${conversationId}`)}
                            >
                                <MessageCircle className="w-6 h-6 mr-3" />
                                Resume Chat
                            </Button>
                        )}
                        {!conversationId && (
                            <div className="text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-black/10">
                                <p className="text-slate-400 font-bold text-sm">No active conversation found for this job.</p>
                            </div>
                        )}
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
}
