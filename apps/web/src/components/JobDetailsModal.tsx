import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    MapPin, Clock, Hourglass, Users, X,
    Sparkles, UtensilsCrossed, Baby, HelpCircle, AlignLeft 
} from "lucide-react";
import { StarRating } from "./StarRating";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface JobDetailsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    job: any;
    formatJobTitle: (job: any) => string;
}

export function JobDetailsModal({ isOpen, onOpenChange, job, formatJobTitle }: JobDetailsModalProps) {
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

    const client = job.profiles;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-zinc-950">
                <DialogHeader>
                    <VisuallyHidden>
                        <DialogTitle>{formatJobTitle(job)} Details</DialogTitle>
                    </VisuallyHidden>
                </DialogHeader>
                
                {/* Hero Section with Image */}
                <div className="relative w-full h-64 sm:h-72 overflow-hidden">
                    <img 
                        src={getServiceImage(job.service_type)} 
                        alt={formatJobTitle(job)} 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    
                    {/* Close Button */}
                    <button 
                        onClick={() => onOpenChange(false)}
                        className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white transition-all shadow-lg border border-white/10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Badge on Image */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <Badge className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md text-black dark:text-white border-none px-3 py-1 font-bold flex items-center gap-2 shadow-lg">
                            {getServiceIcon(job.service_type)}
                            {formatJobTitle(job)}
                        </Badge>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                    {/* Core Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Location</span>
                            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
                                <MapPin className="w-4 h-4 text-orange-500" />
                                <span className="truncate">{job.location_city}</span>
                            </div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Duration</span>
                            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
                                <Hourglass className="w-4 h-4 text-orange-500" />
                                <span>{job.time_duration || "Flexible"}</span>
                            </div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1 col-span-2">
                            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Start Time</span>
                            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
                                <Clock className="w-4 h-4 text-orange-500" />
                                <span>
                                    {job.start_at 
                                        ? new Date(job.start_at).toLocaleString('en-US', { 
                                            weekday: 'short', 
                                            month: 'short', 
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          }) 
                                        : "Not set"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Client Section */}
                    {client && (
                        <div className="bg-white dark:bg-zinc-900/30 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 shadow-sm">
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">About the Client</h3>
                                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-none font-bold text-xs">
                                    Trusted User
                                </Badge>
                             </div>
                             <div className="flex items-center gap-4">
                                <Avatar className="w-14 h-14 border-2 border-orange-100 dark:border-orange-500/20 shadow-md">
                                    <AvatarImage src={client.photo_url || ''} />
                                    <AvatarFallback className="bg-orange-50 text-orange-600 font-bold">
                                        {client.full_name?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none mb-1">
                                        {client.full_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <StarRating rating={client.average_rating || 0} size="md" />
                                        <div className="flex items-center gap-1 text-zinc-400 font-medium text-xs">
                                            <Users className="w-3 h-3" />
                                            <span>{client.total_ratings || 0} reviews</span>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* Additional Notes */}
                    {job.service_details?.custom && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <AlignLeft className="w-4 h-4" /> Notes & Requirements
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl text-sm leading-relaxed border border-dashed border-zinc-200 dark:border-zinc-800">
                                {job.service_details.custom}
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
