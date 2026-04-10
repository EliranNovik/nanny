import { Dialog, DialogContent } from "@/components/ui/dialog";
import JobMap from "./JobMap";
import { 
  X, ArrowUpCircle, ArrowDownCircle, 
  Car, ChevronUp, ChevronDown, Sparkles, Calendar, Star, CheckCircle2, Loader2, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  discoverSheetDialogContentClassName,
  discoverSheetInnerCardClassName,
  DiscoverSheetTopHandle,
} from "@/lib/discoverSheetDialog";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { SwipeDecisionLayer } from "@/components/discover/SwipeDecisionLayer";

interface FullscreenMapModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  isConfirming?: boolean;
  showAcceptButton?: boolean;
  onDecline?: () => void;
  isDeclining?: boolean;
  /** Replaces action buttons (e.g. already responded). */
  incomingActionMessage?: string | null;
  /** Discover home incoming strip: same bottom sheet shell as availability preview. */
  sheetPresentation?: boolean;
}

export function FullscreenMapModal({ 
  job, isOpen, onClose, 
  onConfirm, isConfirming, showAcceptButton,
  onDecline, isDeclining,
  incomingActionMessage = null,
  sheetPresentation = false,
}: FullscreenMapModalProps) {
  const { user } = useAuth();
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  useEffect(() => {
    if (isOpen && job) {
      // Auto-expand for non-delivery jobs (where map is just a city marker)
      setIsMobileExpanded(job.service_type !== 'pickup_delivery');
    }
  }, [isOpen, job?.id]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!job || !user || !isOpen) return;

    const fetchOtherUser = async () => {
      let otherId = null;
      if (user.id === job.client_id) {
        otherId = job.selected_freelancer_id;
      } else {
        otherId = job.client_id;
      }

      if (!otherId) {
        setOtherUser(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select(`
          id, full_name, photo_url, average_rating, total_ratings
        `)
        .eq("id", otherId)
        .single();

      if (data) {
        setOtherUser({
          ...data,
          rating: data.average_rating || 0,
          totalRatings: data.total_ratings || 0
        });
      }
    };

    fetchOtherUser();
  }, [job?.id, user?.id, isOpen]);

  if (!job) return null;

  const isPickupDelivery = job.service_type === "pickup_delivery";

  const defaultMapShellClass =
    "max-w-[100vw] w-full h-[100dvh] p-0 border-none bg-background gap-0 overflow-hidden flex flex-col sm:rounded-none";

  const mapBodyInner = (
        <div
          className={cn(
            "relative w-full flex-1",
            sheetPresentation ? "min-h-[min(52dvh,480px)]" : "h-full"
          )}
        >
          <JobMap job={job} onRouteInfo={setRouteInfo} onClose={onClose} />

          {/* UNIFIED VIEW: Expandable Swipe Card (Desktop & Mobile) */}
          <div 
            className={cn(
              "absolute bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-xl z-[2000] bg-card border-t border-black/5 dark:border-border/40 md:rounded-t-[2.5rem] rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-500 ease-in-out",
              isMobileExpanded ? "h-[75dvh]" : "h-24"
            )}
          >
            {/* Drag Handle */}
            <div 
              className="w-full py-3 flex flex-col items-center cursor-pointer"
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full mb-1" />
            </div>

            <div className="px-6 h-full overflow-y-auto pb-12">
              {/* Compact Content (Always Visible) */}
              {!isMobileExpanded ? (
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-3">
                    {otherUser ? (
                      <>
                        <Avatar className="w-10 h-10 border border-orange-500/20 shadow-sm">
                          <AvatarImage src={otherUser.photo_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-orange-50 text-orange-600 text-xs font-bold">
                            {otherUser.full_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                            {otherUser.full_name || "Syncing profile..."}
                          </p>
                          <div className="flex items-center gap-2">
                             {(otherUser.rating || otherUser.average_rating) > 0 && (
                               <div className="flex items-center gap-1">
                                 <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                                 <span className="text-[10px] font-bold text-slate-500">{(otherUser.rating || otherUser.average_rating).toFixed(1)}</span>
                               </div>
                             )}
                             <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                                {isPickupDelivery && routeInfo ? `${routeInfo.distance} • ${routeInfo.duration}` : "Tap to show more"}
                             </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">My Request</p>
                        {routeInfo && (
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                            {routeInfo.distance} • {routeInfo.duration}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <button className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full">
                    Details <ChevronUp className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                /* Expanded Content */
                <div className="space-y-6 pt-4 animate-in fade-in duration-500">
                  {/* User Profile Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {otherUser ? (
                        <>
                          <Avatar className="w-16 h-16 border-2 border-orange-500/20 shadow-lg">
                            <AvatarImage src={otherUser.photo_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-orange-50 text-orange-600 text-xl font-bold">
                              {otherUser.full_name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{otherUser.full_name}</h2>
                            <StarRating rating={otherUser.rating || otherUser.average_rating || 0} totalRatings={otherUser.totalRatings || otherUser.total_ratings} size="sm" />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                             <Sparkles className="w-6 h-6" />
                          </div>
                          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">My Request</h2>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsMobileExpanded(false)}
                      className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-full text-slate-400"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-3xl border border-black/5 dark:border-white/5 flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 rounded-2xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 mb-2">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">SERVICE</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white capitalize leading-none">{job.care_type || job.service_type?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-3xl border border-black/5 dark:border-white/5 flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 mb-2">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">FREQUENCY</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white capitalize leading-none">{job.care_frequency?.replace(/_/g, ' ') || "One-time"}</span>
                    </div>
                  </div>

                  {/* Trip Info Section */}
                  <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
                     <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Car className="w-5 h-5 text-orange-500" /> Trip Details
                        </h4>
                        {routeInfo && (
                           <div className="flex items-center gap-2">
                              <Badge className="bg-orange-500/10 text-orange-600 border-none font-bold text-[10px] uppercase tracking-wider">{routeInfo.distance}</Badge>
                              <Badge className="bg-blue-500/10 text-blue-600 border-none font-bold text-[10px] uppercase tracking-wider">{routeInfo.duration}</Badge>
                           </div>
                        )}
                     </div>

                     <div className="space-y-3">
                        {job.service_details?.from_address && (
                          <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-black/5 dark:border-white/5">
                             <div className="w-8 h-8 rounded-2xl bg-card dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0">
                                <ArrowUpCircle className="w-4 h-4 text-orange-500" />
                             </div>
                             <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 leading-none">PICKUP</p>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">{job.service_details.from_address}</p>
                             </div>
                          </div>
                        )}
                        {job.service_details?.to_address && (
                          <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-black/5 dark:border-white/5">
                             <div className="w-8 h-8 rounded-2xl bg-card dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0">
                                <ArrowDownCircle className="w-4 h-4 text-blue-500" />
                             </div>
                             <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 leading-none">DELIVERY</p>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">{job.service_details.to_address}</p>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>

                  <div className="pt-2">
                     {job.service_details?.custom && (
                       <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-black/5 dark:border-white/5 mb-4">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NOTES</p>
                         <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug whitespace-pre-wrap">{job.service_details.custom}</p>
                       </div>
                     )}
                     <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-[0.2em] mb-4">Live Location Enabled</p>
                  </div>

                  {/* Job Photos */}
                  {job.service_details?.images && job.service_details.images.length > 0 && (
                    <div className="space-y-3 pb-4">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">📸 Job Photos</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {job.service_details.images.map((img: string, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            className="relative aspect-video rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 shadow-sm hover:ring-2 hover:ring-orange-400 transition-all cursor-zoom-in"
                            onClick={() => setLightboxIndex(idx)}
                          >
                            <img src={img} alt="Job photo" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accept / Decline or status (freelancers) */}
                  {(incomingActionMessage || (showAcceptButton && onConfirm)) && (
                    <div className="mt-6 animate-in slide-in-from-bottom-4 duration-500 space-y-3">
                      {incomingActionMessage ? (
                        <p className="text-center text-sm font-medium leading-relaxed text-muted-foreground px-1">
                          {incomingActionMessage}
                        </p>
                      ) : onDecline ? (
                        <div className="flex items-center justify-center gap-6 sm:gap-8">
                          <Button
                            type="button"
                            size="icon"
                            className="h-14 w-14 shrink-0 rounded-full bg-emerald-600 text-white shadow-[0_8px_20px_rgba(5,150,105,0.25)] hover:bg-emerald-700 active:scale-[0.96] disabled:opacity-60"
                            onClick={onConfirm}
                            disabled={isConfirming || isDeclining}
                            aria-label="Accept"
                          >
                            {isConfirming ? (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-7 w-7" aria-hidden />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-14 w-14 shrink-0 rounded-full border-slate-200 dark:border-white/15 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 active:scale-[0.96]"
                            onClick={onDecline}
                            disabled={isDeclining || isConfirming}
                            aria-label="Decline"
                          >
                            {isDeclining ? (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                              <XCircle className="h-7 w-7" aria-hidden />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            size="icon"
                            className="h-14 w-14 rounded-full bg-emerald-600 text-white shadow-[0_10px_30px_rgba(5,150,105,0.3)] hover:bg-emerald-700 active:scale-[0.96] disabled:opacity-60"
                            onClick={onConfirm}
                            disabled={isConfirming}
                            aria-label="Accept invitation"
                          >
                            {isConfirming ? (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-7 w-7" aria-hidden />
                            )}
                          </Button>
                        </div>
                      )}
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
                </div>
              )}
            </div>
          </div>
        </div>
  );

  const incomingSwipeSheet =
    sheetPresentation &&
    Boolean(showAcceptButton && onConfirm && onDecline && !incomingActionMessage);

  const mapBody = incomingSwipeSheet ? (
    <SwipeDecisionLayer
      variant="incoming"
      disabled={Boolean(isConfirming || isDeclining)}
      onSwipeLeft={() => {
        void onDecline?.();
      }}
      onSwipeRight={() => {
        void onConfirm?.();
      }}
      className={cn(
        "relative flex w-full flex-1 flex-col",
        sheetPresentation ? "min-h-[min(52dvh,480px)]" : "h-full"
      )}
    >
      {mapBodyInner}
    </SwipeDecisionLayer>
  ) : (
    mapBodyInner
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          sheetPresentation ? discoverSheetDialogContentClassName : defaultMapShellClass
        )}
      >
        {sheetPresentation ? (
          <div className={cn(discoverSheetInnerCardClassName, "flex flex-col")}>
            <DiscoverSheetTopHandle />
            <div className="relative z-[61] flex min-h-0 flex-1 flex-col overflow-hidden">
              {mapBody}
            </div>
          </div>
        ) : (
          <>
            <div className="absolute right-4 top-4 z-[60]">
              <button
                type="button"
                onClick={onClose}
                className="group rounded-full border border-black/5 bg-card/90 p-3 shadow-2xl backdrop-blur-sm transition-all hover:bg-card dark:border-white/5 dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
              >
                <X className="h-6 w-6 text-slate-900 transition-transform group-hover:scale-110 dark:text-white" />
              </button>
            </div>
            {mapBody}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
