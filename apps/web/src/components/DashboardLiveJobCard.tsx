import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { JobAttachedPhotosStrip, jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    MapPin, MessageSquare, Navigation
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
  const attachmentUrls = jobAttachmentImageUrls(job);

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
      className={cn(
        "group relative transition-all duration-500 cursor-pointer flex flex-col bg-card rounded-[24px] overflow-hidden backdrop-blur-sm",
        "border border-slate-300/45 dark:border-zinc-500/35 shadow-none",
        "md:shadow-[0_20px_50px_rgba(0,0,0,0.12)] md:dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] md:hover:shadow-[0_40px_80px_rgba(0,0,0,0.18)] md:hover:-translate-y-2"
      )}
      onClick={onDetailsClick}
    >
      {/* LAYER A: MEDIA/HEADER AREA — slim strip; height fits larger overlay text */}
      <div 
        className="relative h-36 w-full overflow-hidden group/img sm:h-40"
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
        <div className="absolute inset-0 bg-black/40 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-20" />

        {/* Location — top left */}
        {job.location_city && (
          <div className="pointer-events-none absolute left-2 top-2 z-[35] max-w-[min(100%,calc(100%-5.5rem))] sm:left-3 sm:top-3">
            <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md backdrop-blur-md sm:text-[12px]">
              <MapPin className="h-3 w-3 shrink-0 opacity-95 sm:h-3.5 sm:w-3.5" aria-hidden />
              <span className="truncate">{job.location_city}</span>
            </div>
          </div>
        )}
        
        {/* Status Pill Top Right */}
        <div className="absolute top-2 right-2 z-30">
          <Badge className="h-6 px-2.5 rounded-full bg-emerald-500 text-white text-[9px] uppercase font-bold tracking-wider border-none shadow-md">
            Confirmed
          </Badge>
        </div>

        {/* Client Info Overlay Bottom Left */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-3.5 sm:bottom-3.5 sm:left-4 sm:right-4">
          <Avatar className="h-14 w-14 shrink-0 border-2 border-white/20 shadow-lg transition-transform duration-500 group-hover:scale-110 sm:h-16 sm:w-16">
            <AvatarImage src={participant.photo_url} className="object-cover" />
            <AvatarFallback className="bg-orange-500 text-base font-bold text-white sm:text-lg">
              {participant.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex flex-col">
            <h3 className="truncate text-[19px] font-bold leading-tight text-white sm:text-[21px]">
              {participant.full_name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <span className="truncate text-[15px] font-semibold uppercase tracking-wide text-white/90 sm:text-[17px]">
                {formatJobTitle(job)}
              </span>
              {participant.average_rating && (
                <div className="flex shrink-0 items-center gap-1.5 px-0.5">
                    <div className="flex items-center gap-0.5 text-white">
                        <svg className="h-5 w-5 fill-current sm:h-6 sm:w-6" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    </div>
                    <span className="text-[16px] font-black text-white drop-shadow-md sm:text-[18px]">{participant.average_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <JobAttachedPhotosStrip images={attachmentUrls} />

      <CardContent className="px-4 py-4 flex flex-col gap-3.5">
        {/* LAYER B: ACTIONS */}
        <div className="flex gap-2.5">
          <Button 
            variant="outline" 
            className="flex-1 h-10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-[13px] font-bold transition-all active:scale-[0.96]"
            onClick={(e) => { e.stopPropagation(); onChatClick(); }}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Message
          </Button>
          {job.service_type === 'pickup_delivery' ? (
            <Button 
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-bold shadow-md transition-all active:scale-[0.96]"
              onClick={(e) => { e.stopPropagation(); onNavigateClick(); }}
            >
              <Navigation className="w-4 h-4 mr-2" /> Navigate
            </Button>
          ) : (
            <Button 
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-bold shadow-md transition-all active:scale-[0.96]"
              onClick={(e) => { e.stopPropagation(); onMapClick(); }}
            >
              <MapPin className="w-4 h-4 mr-2" /> {job.location_city || "Location"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardLiveJobCard;
