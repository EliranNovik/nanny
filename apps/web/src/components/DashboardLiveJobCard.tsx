import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    MapPin, MessageSquare, Clock, Navigation
} from "lucide-react";
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

  return (
    <Card 
      className={cn("group relative border border-slate-200/60 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col bg-white dark:bg-zinc-900/50 rounded-[24px] overflow-hidden")}
      onClick={onDetailsClick}
    >
      {/* LAYER A: MEDIA/HEADER AREA */}
      <div 
        className="relative w-full h-60 overflow-hidden group/img"
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
        
        {/* Dark Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 z-10" />
        
        {/* Status Pill Top Right */}
        <div className="absolute top-4 right-4 z-20">
          <Badge className="h-7 px-3 rounded-full bg-blue-600/90 backdrop-blur-md text-white text-[10px] uppercase font-bold tracking-wider border-none shadow-lg">
            In progress
          </Badge>
        </div>

        {/* Client Info Overlay Bottom Left */}
        <div className="absolute bottom-4 left-5 right-5 z-20 flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-white/20 shadow-xl flex-shrink-0">
            <AvatarImage src={participant.photo_url} className="object-cover" />
            <AvatarFallback className="bg-orange-500 text-white font-bold text-xs">
              {participant.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <h3 className="text-[20px] font-bold text-white truncate leading-tight">
              {participant.full_name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[12px] font-semibold text-white/80 uppercase tracking-wide">
                {formatJobTitle(job)}
              </span>
              {participant.average_rating && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded-md">
                  <span className="text-[11px] font-bold text-white">{participant.average_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CardContent className="px-5 py-5 flex flex-col gap-5">
        {/* LAYER B: QUICK DETAILS ROW */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="text-[13px] font-semibold">{job.time_duration?.replace(/_/g, '-') || "Ongoing"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <MapPin className="w-4 h-4" />
              <span className="text-[13px] font-semibold">{job.location_city}</span>
            </div>
          </div>
        </div>

        {/* LAYER C: ACTIONS */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 h-11 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-[14px] font-bold transition-all active:scale-[0.96]"
            onClick={(e) => { e.stopPropagation(); onChatClick(); }}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Message
          </Button>
          <Button 
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[14px] font-bold shadow-md transition-all active:scale-[0.96]"
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
