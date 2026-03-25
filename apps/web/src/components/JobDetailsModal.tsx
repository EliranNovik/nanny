import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MapPin, Clock, Hourglass, Users, X,
    Sparkles, UtensilsCrossed, Baby, HelpCircle, AlignLeft,
    Calendar, Briefcase, RefreshCw, Globe
} from "lucide-react";
import { StarRating } from "./StarRating";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ImageLightboxModal } from "./ImageLightboxModal";

interface JobDetailsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    job: any;
    formatJobTitle: (job: any) => string;
    isOwnRequest?: boolean;
}

const LiveTimer = ({ createdAt }: { createdAt: string }) => {
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

    return <>{formatElapsedTime(elapsed)}</>;
};

export function JobDetailsModal({ isOpen, onOpenChange, job, formatJobTitle, isOwnRequest }: JobDetailsModalProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    if (!job) return null;

    const getServiceIcon = (serviceType?: string) => {
        if (serviceType === 'cleaning') return <Sparkles className="w-4 h-4" />;
        if (serviceType === 'cooking') return <UtensilsCrossed className="w-4 h-4" />;
        if (serviceType === 'nanny') return <Baby className="w-4 h-4" />;
        if (serviceType === 'other_help') return <HelpCircle className="w-4 h-4" />;
        return <HelpCircle className="w-4 h-4" />;
    };

    const getServiceImage = (serviceType?: string) => {
        if (serviceType === 'cleaning') return "/cleaning-mar22.png";
        if (serviceType === 'cooking') return "/cooking-mar22.png";
        if (serviceType === 'nanny') return "/nanny-mar22.png";
        return "/other-mar22.png";
    };

    const clean = (text?: string) => {
        if (!text) return '';
        // If it's a range like "1_4", replace underscore with a hyphen: "1-4"
        return text.replace(/(\d)_(\d)/g, '$1-$2').replace(/_/g, ' ');
    };

    const client = job.profiles;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-full h-[100dvh] max-w-none sm:max-w-lg p-0 overflow-hidden rounded-none sm:rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-zinc-950 focus:outline-none flex flex-col sm:h-auto max-h-[100dvh] sm:max-h-[90vh]">
                <VisuallyHidden>
                    <DialogTitle>{formatJobTitle(job)} Details</DialogTitle>
                </VisuallyHidden>

                {/* Hero Section with Image - Zero Margin Top */}
                <div className="relative w-full h-[22rem] sm:h-[28rem] overflow-hidden bg-zinc-950">
                    <img
                        src={getServiceImage(job.service_type)}
                        alt={formatJobTitle(job)}
                        className="w-full h-full object-cover select-none opacity-90"
                    />
                    {/* Refined Modern Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

                    {/* Close Button - Precision Position */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white transition-all border border-white/20 active:scale-95 shadow-2xl"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Top Left Badges */}
                    <div className="absolute top-6 left-6 z-40 flex flex-col items-start gap-2">
                        <Badge className="bg-orange-500/95 backdrop-blur-md text-white border-none px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] shadow-xl rounded-full flex items-center gap-2">
                            {getServiceIcon(job.service_type)}
                            {formatJobTitle(job)}
                        </Badge>
                    </div>

                    {/* Centered Bottom Badges for own requests */}
                    {isOwnRequest && (
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-700">
                            <Badge className="bg-emerald-500/95 backdrop-blur-md text-white border-none px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xl rounded-full flex items-center gap-1.5 ring-1 ring-emerald-400/30">
                                My Request
                            </Badge>
                            <Badge className="bg-zinc-900/80 backdrop-blur-md text-orange-400 border-none px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xl rounded-full flex items-center gap-1.5 ring-1 ring-white/10">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                <LiveTimer createdAt={job.created_at} />
                            </Badge>
                        </div>
                    )}

                    {/* Unified Identity & Temporal Unit */}
                    {client && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-40 p-5 rounded-[2.5rem] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-1000">
                            {/* Pinned Real-time Timer - only shown if not own request (to avoid redundancy) */}
                            {!isOwnRequest && (
                                <div className="absolute top-5 right-7 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity duration-300">
                                    <Clock className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                                    <span className="text-white text-[9px] font-black uppercase tracking-wider tabular-nums [text-shadow:_0_1px_2px_rgba(0,0,0,0.8)]">
                                        <LiveTimer createdAt={job.created_at} />
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                    <Avatar className="w-14 h-14 shadow-2xl">
                                        <AvatarImage src={client.photo_url || ''} className="object-cover" />
                                        <AvatarFallback className="bg-zinc-800 text-white font-black text-xl">
                                            {client.full_name?.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xl font-black text-white tracking-tighter leading-none mb-1 shadow-sm truncate">
                                        {client.full_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <StarRating
                                            rating={client.average_rating || 0}
                                            size="sm"
                                            numberClassName="text-white/50"
                                        />
                                        <div className="flex items-center gap-1.5 text-white/50 font-black text-[8px] uppercase tracking-[0.1em]">
                                            <Users className="w-3 h-3" />
                                            <span>{client.total_ratings || 0} Reviews</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 space-y-8 overflow-y-auto flex-1 min-h-0 sm:max-h-[60vh] custom-scrollbar">
                    {/* Primary Insight Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1.5 shadow-sm transition-all hover:shadow-md">
                            <span className="text-[11px] uppercase font-black text-zinc-400 tracking-[0.1em]">Target Location</span>
                            <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100 font-black">
                                <MapPin className="w-5 h-5 text-orange-500" />
                                <span className="truncate text-lg tracking-tight">{job.location_city}</span>
                            </div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1.5 shadow-sm transition-all hover:shadow-md">
                            <span className="text-[11px] uppercase font-black text-zinc-400 tracking-[0.1em]">Time Duration</span>
                            <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100 font-black">
                                <Hourglass className="w-5 h-5 text-orange-500" />
                                <span className="text-lg tracking-tight capitalize">{clean(job.time_duration) || "Flexible"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Secondary & Dynamic Service Details */}
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Service Particulars</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {job.start_at && (
                                <div className="flex items-center gap-3 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100/50 dark:border-zinc-800/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <Calendar className="w-5 h-5 text-orange-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Scheduled For</span>
                                        <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                                            {new Date(job.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {job.care_type && (
                                <div className="flex items-center gap-3 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100/50 dark:border-zinc-800/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <Briefcase className="w-5 h-5 text-orange-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Care Type</span>
                                        <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 capitalize">{clean(job.care_type)}</span>
                                    </div>
                                </div>
                            )}
                            {job.children_count > 0 && (
                                <div className="flex items-center gap-3 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100/50 dark:border-zinc-800/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <Baby className="w-5 h-5 text-orange-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Children</span>
                                        <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                                            {job.children_count} {job.children_age_group ? `(${clean(job.children_age_group)})` : ''}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {job.care_frequency && (
                                <div className="flex items-center gap-3 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100/50 dark:border-zinc-800/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <RefreshCw className="w-5 h-5 text-orange-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Frequency</span>
                                        <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 capitalize">{clean(job.care_frequency)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Exhaustive Loop for Service details */}
                            {job.service_details && Object.entries(job.service_details).map(([key, value]) => {
                                if (key === 'custom' || key === 'images') return null;
                                if (key === 'from_lat' || key === 'from_lng' || key === 'to_lat' || key === 'to_lng') return null;
                                // Skip fields already handled or generic ones if redundant
                                if (key === 'care_type' || key === 'children_count' || key === 'care_frequency') return null;

                                return (
                                    <div key={key} className="flex items-center gap-3 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100/50 dark:border-zinc-800/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                        <AlignLeft className="w-5 h-5 text-orange-500" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">{clean(key)}</span>
                                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 capitalize">{clean(String(value))}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bio & Languages Section - Minimalist Integration */}
                    {client && (client.bio || client.languages) && (
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Biographical Background</h3>
                            <div className="bg-zinc-50 dark:bg-zinc-900/40 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 space-y-4">
                                {client.bio && (
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed italic">
                                        "{client.bio}"
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2.5">
                                    {client.city && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-orange-100/50 dark:border-orange-500/10">
                                            <MapPin className="w-3 h-3 text-orange-500" />
                                            <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">{client.city}</span>
                                        </div>
                                    )}
                                    {client.languages && Array.isArray(client.languages) && client.languages.map((lang: string) => (
                                        <div key={lang} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                            <Globe className="w-3 h-3 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">{lang}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Job Images Section */}
                    {job.service_details?.images && job.service_details.images.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Job Photos</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {job.service_details.images.map((img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="relative aspect-video rounded-[1.5rem] overflow-hidden border border-zinc-100 dark:border-zinc-800/60 shadow-sm hover:ring-2 hover:ring-orange-400 transition-all cursor-zoom-in"
                                        onClick={() => setLightboxIndex(idx)}
                                    >
                                        <img src={img} alt={`Job photo ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {lightboxIndex !== null && (
                        <ImageLightboxModal
                            images={job.service_details?.images || []}
                            initialIndex={lightboxIndex}
                            isOpen={lightboxIndex !== null}
                            onClose={() => setLightboxIndex(null)}
                        />
                    )}

                    {/* Immersive Notes Section */}
                    {job.service_details?.custom && (
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2.5">
                                <AlignLeft className="w-4 h-4 text-orange-500" /> Notes & Requirements
                            </h3>
                            <div className="relative">
                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-orange-500 rounded-full opacity-20" />
                                <p className="text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/80 p-6 rounded-[2rem] text-base font-medium leading-relaxed border border-zinc-100 dark:border-zinc-800 italic shadow-inner">
                                    "{job.service_details.custom}"
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
