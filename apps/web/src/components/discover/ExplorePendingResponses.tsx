import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock, Sparkles, UtensilsCrossed, Truck, Baby, Wrench, MessageSquare, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { haversineDistanceKm } from "@/lib/geo";
import {
  EXPLORE_PAGE_CARD_HOVER,
  EXPLORE_PAGE_CARD_SURFACE,
  EXPLORE_PAGE_CARD_THUMB,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";

import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";

type InboundNotif = {
  id: string;
  created_at: string;
  isConfirmed?: boolean;
  job_id: string;
  job_requests: {
    id: string;
    service_type?: string | null;
    location_city?: string | null;
    location_lat: number | null;
    location_lng: number | null;
    created_at: string;
    profiles?: { full_name?: string | null; photo_url?: string | null } | null;
  };
};

function formatJobTitle(job: { service_type?: string | null }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Help request";
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  other_help: Wrench,
};

function CategoryIcon({
  serviceType,
  className,
}: {
  serviceType: string | null | undefined;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[(serviceType ?? "").toLowerCase()] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function serviceHeroImageSrc(job: { service_type?: string | null }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

export function ExplorePendingResponses() {
  const { user } = useAuth();
  const { data, isLoading } = useFreelancerRequests(user?.id);
  const inbound = (data?.inboundNotifications ?? []) as InboundNotif[];
  const [selectedMapJob, setSelectedMapJob] = useState<any | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null);

  const pending = useMemo(
    () => inbound.filter((n) => Boolean(n.isConfirmed)),
    [inbound],
  );
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (pending.length === 0) return;
    async function fetchCounts() {
      const jobIds = pending.map((n) => n.job_id);
      const { data: comments } = await supabase
        .from("job_request_comments")
        .select("job_request_id");

      if (comments) {
        const counts: Record<string, number> = {};
        for (const c of comments) {
          if (jobIds.includes(c.job_request_id)) {
            counts[c.job_request_id] = (counts[c.job_request_id] || 0) + 1;
          }
        }
        setCommentCounts(counts);
      }
    }
    fetchCounts();
  }, [pending]);

  const formatModalJobTitle = useCallback((job: any) => formatJobTitle(job), []);

  const openJobById = useCallback(async (jobId: string) => {
    const { data: job } = await supabase
      .from("job_requests")
      .select("*")
      .eq("id", jobId)
      .single();
    if (!job) return;
    if (job.service_type === "pickup_delivery") setSelectedMapJob(job);
    else setSelectedJobDetails(job);
  }, []);

  if (!user?.id) return null;

  return (
    <section className="space-y-4" aria-label="Pending response">
      <FullscreenMapModal
        job={selectedMapJob}
        isOpen={!!selectedMapJob}
        sheetPresentation
        onClose={() => setSelectedMapJob(null)}
      />
      <JobDetailsModal
        job={selectedJobDetails}
        isOpen={!!selectedJobDetails}
        onOpenChange={(open) => !open && setSelectedJobDetails(null)}
        formatJobTitle={formatModalJobTitle}
        sheetPresentation
        isOwnRequest={selectedJobDetails?.client_id === user?.id}
      />
      {isLoading ? (
        <div className="rounded-2xl border-0 bg-zinc-50 px-4 py-6 text-sm text-muted-foreground shadow-sm dark:bg-zinc-900">
          Loading pending…
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border-0 bg-zinc-50 px-4 py-10 text-center shadow-sm dark:bg-zinc-900/50">
          <p className="text-lg font-bold text-foreground">
            No pending responses
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            When you accept a request, it will show here while you wait for the
            client to confirm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pending.map((n) => {
            const job = n.job_requests;
            const title = formatJobTitle(job);
            const loc = (job.location_city ?? "").trim() || "Location not set";
            const imgSrc = serviceHeroImageSrc(job);
            const clientName =
              String(job.profiles?.full_name ?? "").trim() || "Client";
            
            const distanceKm = (() => {
              const vl = user?.user_metadata?.location_lat;
              const vg = user?.user_metadata?.location_lng;
              const hl = job.location_lat;
              const hn = job.location_lng;
              if (vl != null && vg != null && hl != null && hn != null) {
                const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
                if ([a, b, c, d].every(Number.isFinite)) {
                  return haversineDistanceKm(a, b, c, d);
                }
              }
              return null;
            })();

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void openJobById(String(job.id))}
                className={cn(
                  "group relative w-full rounded-2xl pt-2 px-4 pb-4 text-left",
                  EXPLORE_PAGE_CARD_SURFACE,
                  EXPLORE_PAGE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/20">
                      <CategoryIcon
                        serviceType={job.service_type}
                        className="h-3 w-3 shrink-0 text-white/90"
                      />
                      {title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-amber-900 dark:text-amber-200">
                      Pending
                    </span>
                    {commentCounts[job.id] > 0 && (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {commentCounts[job.id]}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className={EXPLORE_PAGE_CARD_THUMB} aria-hidden>
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted/50">
                        <Clock className="h-8 w-8 text-muted-foreground/50" strokeWidth={2} aria-hidden />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-black/10" />
                    {distanceKm != null && (
                      <div className="absolute bottom-1 left-1 right-1 z-10 flex items-center justify-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white shadow-lg backdrop-blur-md ring-1 ring-white/10">
                          <MapPin className="h-2.5 w-2.5" strokeWidth={3} />
                          <span>
                            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-800 sm:text-sm dark:text-zinc-300">
                      {loc}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[15px] font-medium text-slate-600 sm:text-sm dark:text-zinc-200">
                      <Avatar className="h-6 w-6 shrink-0 border border-slate-200/50 dark:border-white/10">
                        <AvatarImage src={job.profiles?.photo_url || ""} />
                        <AvatarFallback className="text-[8px] font-bold">
                          {clientName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">With {clientName}</span>
                    </p>
                    <div
                      className="mt-1.5 flex items-center gap-1.5 text-[15px] font-medium text-slate-500 sm:text-sm dark:text-zinc-400"
                      role="status"
                      aria-live="polite"
                    >
                      <Clock
                        className="h-4 w-4 shrink-0 text-amber-700/70 dark:text-amber-300/70"
                        aria-hidden
                      />
                      <span>Waiting {timeAgo(n.created_at || job.created_at)}</span>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={2} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

