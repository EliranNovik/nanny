import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    MapPin, MessageSquare, Clock, Sparkles, UtensilsCrossed, 
    Truck, Baby, HelpCircle, Navigation
} from "lucide-react";
import { StarRating } from "@/components/StarRating";
import JobMap from "@/components/JobMap";
import { cn } from "@/lib/utils";

interface DashboardLiveJobCardProps {
  job: any;
  participant: {
    full_name: string;
    photo_url?: string;
    average_rating?: number;
    total_ratings?: number;
  };
  onMapClick: () => void;
  onChatClick: () => void;
  onNavigateClick: () => void;
  onDetailsClick: () => void;
}

const DashboardLiveJobCard: React.FC<DashboardLiveJobCardProps> = ({
  job,
  participant,
  onMapClick,
  onChatClick,
  onNavigateClick,
  onDetailsClick
}) => {
  const isPickupDelivery = job.service_type === 'pickup_delivery' || job.care_type === 'pickup_delivery';

  const formatJobTitle = (job: any) => {
    if (job.service_type === 'cleaning') return 'Cleaning';
    if (job.service_type === 'cooking') return 'Cooking';
    if (job.service_type === 'pickup_delivery') return 'Pickup & Delivery';
    if (job.service_type === 'nanny') return 'Nanny';
    if (job.service_type === 'other_help') return 'Other Help';
    return "Service Request";
  };

  const getServiceIcon = (serviceType?: string) => {
    if (serviceType === 'cleaning') return <Sparkles className="w-3.5 h-3.5" />;
    if (serviceType === 'cooking') return <UtensilsCrossed className="w-3.5 h-3.5" />;
    if (serviceType === 'pickup_delivery') return <Truck className="w-3.5 h-3.5" />;
    if (serviceType === 'nanny') return <Baby className="w-3.5 h-3.5" />;
    if (serviceType === 'other_help') return <HelpCircle className="w-3.5 h-3.5" />;
    return <HelpCircle className="w-3.5 h-3.5" />;
  };

  return (
    <Card 
      className={cn("group relative border border-black/[0.03] dark:border-white/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-[32px] overflow-hidden bg-white dark:bg-zinc-900/50 backdrop-blur-sm hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col")}
      onClick={onDetailsClick}
    >
      <div 
        className="relative w-full h-56 overflow-hidden group/img cursor-pointer"
        onClick={(e) => { e.stopPropagation(); isPickupDelivery ? onMapClick() : onDetailsClick(); }}
      >
        {isPickupDelivery ? (
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
          <Badge className="h-8 px-3.5 rounded-full bg-blue-600 text-white text-[11px] uppercase font-black tracking-wider border-none shadow-lg shadow-blue-500/20">
            In progress
          </Badge>
        </div>

        {/* Bottom Overlays: Title & Rating */}
        <div className="absolute bottom-5 left-6 right-6 flex flex-col gap-2 z-20">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-white/30 shadow-2xl flex-shrink-0">
              <AvatarImage src={participant.photo_url} className="object-cover" />
              <AvatarFallback className="bg-orange-500 text-white font-black text-sm">
                {participant.full_name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-[24px] font-black text-white truncate tracking-tight drop-shadow-xl">
              {participant.full_name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {participant.average_rating ? (
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
                <StarRating rating={participant.average_rating} size="sm" />
                <span className="text-[14px] font-black text-white/95">
                  {participant.average_rating.toFixed(1)}
                </span>
              </div>
            ) : (
              <span className="text-[14px] font-bold text-white/80 italic drop-shadow-md">New Client</span>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-6 flex-1 flex flex-col gap-6">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-4">
          <div className="flex items-center gap-2.5 text-[15px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
            <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{job.time_duration?.replace(/_/g, '-') || "Ongoing"}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[15px] text-slate-700 dark:text-slate-300 font-semibold tracking-tight">
            <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{job.location_city}</span>
          </div>
        </div>

        {/* Standardized CTA Buttons */}
        <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
          <Button 
            variant="outline" 
            className="flex-1 h-12 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-[18px] text-[16px] font-bold transition-all active:scale-[0.96]"
            onClick={(e) => { e.stopPropagation(); onChatClick(); }}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Message
          </Button>
          <Button 
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-[18px] text-[16px] font-bold shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition-all active:scale-[0.96]"
            onClick={(e) => { e.stopPropagation(); onNavigateClick(); }}
          >
            <Navigation className="w-4 h-4 mr-2" /> Navigate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardLiveJobCard;
