import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, MessageCircle, Navigation, Clock, ChevronRight } from "lucide-react";
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
}

const DashboardLiveJobCard: React.FC<DashboardLiveJobCardProps> = ({
  job,
  participant,
  onMapClick,
  onChatClick,
  onNavigateClick
}) => {
  const isPickupDelivery = job.service_type === 'pickup_delivery' || job.care_type === 'pickup_delivery';

  return (
    <Card className={cn("group relative border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white dark:bg-zinc-900 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-500")}>
      <CardContent className="p-4 flex gap-4 items-center">
        {/* Left: Square Map Preview */}
        <div 
          className="relative w-28 h-28 md:w-32 md:h-32 rounded-[1.5rem] overflow-hidden flex-shrink-0 cursor-pointer border border-black/5 dark:border-white/5 shadow-inner"
          onClick={onMapClick}
        >
          <div className="absolute inset-0 z-0">
            <JobMap job={job} />
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10" />
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/20 to-transparent z-20">
             <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit">
                <MapPin className="w-2 h-2 text-primary" />
                Live
             </div>
          </div>
        </div>

        {/* Center/Right: Job & Participant Info */}
        <div className="flex-1 flex flex-col justify-between h-28 md:h-32 min-w-0">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-12 h-12 border border-primary/10 flex-shrink-0 shadow-sm">
                  <AvatarImage src={participant.photo_url} className="object-cover" />
                  <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                    {participant.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight mb-1">
                    {participant.full_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={participant.average_rating || 5} size="md" />
                    <span className="text-[10px] font-bold text-slate-400">({participant.total_ratings || 0})</span>
                  </div>
                </div>
              </div>

              <Badge className="bg-primary/5 text-primary border-none font-bold text-[10px] px-3 py-1.5 rounded-xl uppercase tracking-wider flex-shrink-0 shadow-sm">
                {isPickupDelivery ? "Pickup & Delivery" : (job.care_type || job.service_type)?.replace(/_/g, " ") || "Active Job"}
              </Badge>
            </div>
          </div>

          {/* Actions & Metrics */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1.5">
               <div className="flex items-center gap-1 text-slate-500 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-xl border border-black/5 dark:border-white/5">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{job.time_duration?.replace(/_/g, "-") || "2h"}</span>
               </div>
               {isPickupDelivery && (
                  <div className="flex items-center gap-1 text-slate-500 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-xl border border-black/5 dark:border-white/5">
                     <Navigation className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[10px] font-bold uppercase tracking-tight">Active</span>
                  </div>
               )}
            </div>

            <div className="flex items-center gap-2">
               <Button 
                 variant="ghost" 
                 size="icon"
                 className="w-11 h-11 rounded-2xl bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100/50 dark:border-blue-900/20"
                 onClick={(e) => { e.stopPropagation(); onChatClick(); }}
               >
                 <MessageCircle className="w-5 h-5" />
               </Button>
               <Button 
                 variant="ghost" 
                 size="icon"
                 className="w-11 h-11 rounded-2xl bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100/50 dark:border-emerald-900/20"
                 onClick={(e) => { e.stopPropagation(); onNavigateClick(); }}
               >
                 <MapPin className="w-5 h-5" />
               </Button>
            </div>
          </div>
        </div>

        {/* Far Right: Chevron */}
        <div className="hidden md:flex items-center justify-center p-2 text-slate-300 group-hover:text-primary transition-colors">
          <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardLiveJobCard;
