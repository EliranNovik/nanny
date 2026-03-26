import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MapPin, Clock, Hourglass, X,
    Sparkles, UtensilsCrossed, Baby, HelpCircle, AlignLeft,
    Calendar, Briefcase, RefreshCw, Globe, CheckCircle2, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "./StarRating";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ImageLightboxModal } from "./ImageLightboxModal";

interface JobDetailsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    job: any;
    formatJobTitle: (job: any) => string;
    isOwnRequest?: boolean;
    onConfirm?: () => void;
    isConfirming?: boolean;
    showAcceptButton?: boolean;
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

export function JobDetailsModal({ 
    isOpen, onOpenChange, job, formatJobTitle, isOwnRequest, 
    onConfirm, isConfirming, showAcceptButton 
}: JobDetailsModalProps) {
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

                {/* Hero — slimmer image strip + restrained badges */}
                <div className="relative h-[13rem] w-full shrink-0 overflow-hidden bg-zinc-950 sm:h-[15rem]">
                    <img
                        src={getServiceImage(job.service_type)}
                        alt={formatJobTitle(job)}
                        className="h-full w-full object-cover select-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-black/75" />

                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 active:scale-95"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* Service category — subtle chip, top-left */}
                    <div className="absolute left-3 top-3 z-40 max-w-[70%]">
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-black/35 px-2.5 py-1.5 text-white shadow-sm backdrop-blur-md">
                            <span className="text-white/90 [&>svg]:h-3.5 [&>svg]:w-3.5">
                                {getServiceIcon(job.service_type)}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wide">
                                {formatJobTitle(job)}
                            </span>
                        </div>
                    </div>

                    {/* Bottom stack: own-request meta + client (gradient dock) */}
                    <div className="absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-3.5 sm:pt-12">
                        {isOwnRequest && (
                            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-white/75">
                                    Your listing
                                </span>
                                <div className="flex items-center gap-1.5 rounded border border-white/15 bg-black/45 px-2 py-1 font-mono text-[11px] tabular-nums text-white/95 backdrop-blur-sm">
                                    <Clock className="h-3 w-3 shrink-0 text-white/60" aria-hidden />
                                    <LiveTimer createdAt={job.created_at} />
                                </div>
                            </div>
                        )}

                        {client && (
                            <div className="rounded-xl border border-white/15 bg-black/30 p-3 backdrop-blur-md sm:p-3.5">
                                {!isOwnRequest && (
                                    <div className="mb-2 flex items-center justify-end gap-1.5 border-b border-white/10 pb-2">
                                        <Clock className="h-3.5 w-3.5 text-white/50" aria-hidden />
                                        <span className="font-mono text-[10px] tabular-nums text-white/80">
                                            <LiveTimer createdAt={job.created_at} />
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 shrink-0 shadow-lg ring-2 ring-white/10 sm:h-14 sm:w-14">
                                        <AvatarImage src={client.photo_url || ''} className="object-cover" />
                                        <AvatarFallback className="bg-zinc-800 text-lg font-bold text-white">
                                            {client.full_name?.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg">
                                            {client.full_name}
                                        </span>
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <StarRating
                                                rating={client.average_rating || 0}
                                                size="sm"
                                                numberClassName="text-white/70"
                                            />
                                            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/45">
                                                {client.total_ratings || 0} reviews
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
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

                {/* Fixed Bottom Action Bar for Freelancers */}
                {showAcceptButton && onConfirm && (
                    <div className="p-6 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center animate-in slide-in-from-bottom-4 duration-500">
                        <Button
                            className="w-full h-14 rounded-[20px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_10px_30px_rgba(5,150,105,0.3)] transition-all active:scale-[0.98] font-black text-lg flex items-center justify-center gap-3"
                            onClick={onConfirm}
                            disabled={isConfirming}
                        >
                            {isConfirming ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle2 className="w-6 h-6" />
                                    Accept Invitation
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
