import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Clock, MessageSquare, Sparkles, UtensilsCrossed, Truck, Baby, Wrench, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { haversineDistanceKm } from "@/lib/geo";
import {
  EXPLORE_PAGE_CARD_SURFACE,
  INTERACTIVE_CARD_HOVER,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import JobReviewModal from "@/components/JobReviewModal";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { Button } from "@/components/ui/button";

type Mode = "hire" | "work";

type ProfileMini = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

type JobRow = {
  id: string;
  created_at: string;
  service_type: string | null;
  location_city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  client_id: string | null;
  selected_freelancer_id: string | null;
  status: string | null;
};

const HELPING_NOW_STATUSES = ["locked", "active"] as const;

function formatJobTitle(job: { service_type?: string | null }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Help request";
}

function serviceHeroImageSrc(job: { service_type?: string | null }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
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

async function fetchProfileMap(ids: string[]): Promise<Map<string, ProfileMini>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url")
    .in("id", uniq);
  if (error) {
    console.warn("[ExploreLiveHelpNow] profiles", error);
    return new Map();
  }
  const m = new Map<string, ProfileMini>();
  for (const p of (data ?? []) as ProfileMini[]) {
    if (p?.id) m.set(p.id, p);
  }
  return m;
}

export function ExploreLiveHelpNow({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileMini>>(new Map());
  const [reviewJob, setReviewJob] = useState<{
    jobId: string;
    reviewee: ProfileMini;
    revieweeRole: "client" | "freelancer";
  } | null>(null);

  const [selectedMapJob, setSelectedMapJob] = useState<any | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null);

  function openJobPreview(job: any) {
    if (job.service_type === "pickup_delivery") setSelectedMapJob(job);
    else setSelectedJobDetails(job);
  }

  const otherPartyLabel = mode === "hire" ? "Helper" : "Client";
  const emptyTitle = mode === "hire" ? "Nothing in Helping me now yet." : "Nothing in Helping now yet.";
  const emptySub =
    mode === "hire"
      ? "When a helper is confirmed on your request, it will show up here."
      : "When you’re assigned to a job, it will appear here.";


  const load = useCallback(async () => {
    if (!user?.id) {
      setJobs([]);
      setProfiles(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const uid = user.id;

    const base = supabase
      .from("job_requests")
      .select(
        "id, created_at, service_type, location_city, location_lat, location_lng, client_id, selected_freelancer_id, status",
      )
      .in("status", [...HELPING_NOW_STATUSES])
      .not("selected_freelancer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(24);

    const res =
      mode === "hire"
        ? await base.eq("client_id", uid)
        : await base.eq("selected_freelancer_id", uid);

    if (res.error) {
      console.warn("[ExploreLiveHelpNow] jobs", res.error);
      setJobs([]);
      setProfiles(new Map());
      setLoading(false);
      return;
    }

    const rows = (res.data ?? []) as JobRow[];
    setJobs(rows);

    const otherIds =
      mode === "hire"
        ? rows.map((r) => String(r.selected_freelancer_id ?? ""))
        : rows.map((r) => String(r.client_id ?? ""));
    const profMap = await fetchProfileMap(otherIds);
    setProfiles(profMap);
    setLoading(false);
  }, [mode, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user?.id) return null;

  return (
    <section className="space-y-4" aria-label="Live help now">
      {reviewJob ? (
        <JobReviewModal
          open={!!reviewJob}
          jobId={reviewJob.jobId}
          reviewee={reviewJob.reviewee}
          revieweeRole={reviewJob.revieweeRole}
          onClose={() => setReviewJob(null)}
          onConfirmed={() => {
            setReviewJob(null);
            void load();
          }}
        />
      ) : null}
      {loading ? (
        <div className="rounded-2xl border-0 bg-transparent px-4 py-6 text-sm text-muted-foreground shadow-none dark:bg-zinc-900">
          Loading live help…
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-transparent px-4 py-10 text-center shadow-none dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-lg font-bold text-foreground">{emptyTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{emptySub}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => {
            const title = formatJobTitle(job);
            const loc = (job.location_city ?? "").trim() || "Location not set";
            const imgSrc = serviceHeroImageSrc(job);
            const otherId =
              mode === "hire"
                ? String(job.selected_freelancer_id ?? "")
                : String(job.client_id ?? "");
            const other = otherId ? profiles.get(otherId) : null;
            const otherName =
              String(other?.full_name ?? otherPartyLabel).trim() || otherPartyLabel;
            
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
              <div
                key={job.id}
                className={cn(
                  "group relative w-full rounded-2xl pt-2 px-4 pb-4 text-left",
                  EXPLORE_PAGE_CARD_SURFACE,
                  INTERACTIVE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    openJobPreview(job);
                  }}
                  className="w-full text-left focus-visible:outline-none"
                  aria-label="Open live help details"
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
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300 shadow-sm">
                      Live
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-emerald-500/20 bg-muted/40 shadow-sm ring-1 ring-emerald-500/15"
                      aria-hidden
                    >
                      {imgSrc ? (
                        <img src={imgSrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/50">
                          <Clock
                            className="h-8 w-8 text-emerald-600/45 dark:text-emerald-400/50"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-black/15" />
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
                          <AvatarImage src={other?.photo_url || ""} />
                          <AvatarFallback className="text-[8px] font-bold">
                            {otherName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{otherName}</span>
                      </p>
                      <div
                        className="mt-1.5 flex items-center gap-1.5 text-[15px] font-medium text-slate-500 sm:text-sm dark:text-zinc-400"
                        role="status"
                        aria-live="polite"
                      >
                        <Clock
                          className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                        <span>Started {timeAgo(job.created_at)}</span>
                      </div>
                    </div>

                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                      strokeWidth={2}
                    />
                  </div>
                </button>

                <div className="mt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-[18px] border-border/70 text-[14px] font-bold text-foreground transition-all hover:bg-muted/50 active:scale-[0.98]"
                    onClick={() => {
                      navigate(`/client/jobs/${encodeURIComponent(job.id)}/live`);
                    }}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
                    Message
                  </Button>
                  <Button
                    type="button"
                    className="h-11 flex-1 rounded-[18px] bg-emerald-600 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)] transition-all hover:bg-emerald-700 active:scale-[0.98]"
                    onClick={async () => {
                      if (otherId && other) {
                        setReviewJob({
                          jobId: job.id,
                          reviewee: other,
                          revieweeRole: mode === "hire" ? "freelancer" : "client",
                        });
                        return;
                      }
                      await supabase
                        .from("job_requests")
                        .update({ status: "completed" })
                        .eq("id", job.id);
                      void load();
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                    Done
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
        formatJobTitle={formatJobTitle}
        sheetPresentation
        isOwnRequest={selectedJobDetails?.client_id === user?.id}
      />
    </section>
  );
}

