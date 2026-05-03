import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LiveTimer } from "@/components/LiveTimer";
import JobReviewModal from "@/components/JobReviewModal";
import {
  EXPLORE_PAGE_CARD_HOVER,
  EXPLORE_PAGE_CARD_SURFACE,
  EXPLORE_PAGE_CARD_THUMB,
} from "@/components/jobs/jobCardSharedClasses";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

const HELPING_NOW_STATUSES = ["locked", "active"] as const;

const JOB_SELECT =
  "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status";

const exploreOutlineBtnClass =
  "h-11 flex-1 rounded-[18px] border-border/70 text-[14px] font-bold text-foreground transition-all hover:bg-muted/50 active:scale-[0.98]";

const explorePrimaryBtnClass =
  "h-11 flex-1 rounded-[18px] bg-emerald-600 text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)] transition-all hover:bg-emerald-700 active:scale-[0.98]";

type JobMini = {
  id: string;
  created_at: string;
  service_type: string | null;
  location_city: string | null;
  client_id: string;
  selected_freelancer_id: string | null;
};

type ProfileMini = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

function canActAsHelper(
  profile: { role?: string; is_available_for_jobs?: boolean } | null,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true)
    return true;
  return false;
}

/** Match `ExploreLiveHelpNow` card titles */
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

async function fetchProfiles(ids: string[]): Promise<Map<string, ProfileMini>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url")
    .in("id", uniq);
  if (error) {
    console.warn("[DiscoverHomeHeroDesktopLiveColumn] profiles:", error);
    return new Map();
  }
  const m = new Map<string, ProfileMini>();
  for (const p of (data ?? []) as ProfileMini[]) {
    if (p?.id) m.set(p.id, p);
  }
  return m;
}

function ExploreLiveThumb({ job }: { job: JobMini }) {
  const imgSrc = serviceHeroImageSrc(job);
  return (
    <div
      className={cn(EXPLORE_PAGE_CARD_THUMB, "h-16 w-16 md:h-20 md:w-20")}
      aria-hidden
    >
      {imgSrc ? (
        <img src={imgSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <Clock
            className="h-7 w-7 text-emerald-600/45 dark:text-emerald-400/50 md:h-8 md:w-8"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/15" />
    </div>
  );
}

type Props = {
  className?: string;
};

/**
 * Desktop-only column beside the Discover hero: latest “Helping now” (as helper)
 * and “Helping me now” (as client), matching active rules in JobsTabContent.
 * Card chrome matches `ExploreLiveHelpNow`.
 */
export function DiscoverHomeHeroDesktopLiveColumn({ className }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [helperJob, setHelperJob] = useState<JobMini | null>(null);
  const [clientJob, setClientJob] = useState<JobMini | null>(null);
  const [profiles, setProfiles] = useState<Map<string, ProfileMini>>(new Map());
  const [reviewJob, setReviewJob] = useState<{
    jobId: string;
    reviewee: ProfileMini;
    revieweeRole: "client" | "freelancer";
  } | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setHelperJob(null);
      setClientJob(null);
      setProfiles(new Map());
      setLoading(false);
      return;
    }

    setHelperJob(null);
    setClientJob(null);
    setProfiles(new Map());
    setLoading(true);

    const actAsHelper = canActAsHelper(profile);

    const helperPromise = actAsHelper
      ? supabase
          .from("job_requests")
          .select(JOB_SELECT)
          .eq("selected_freelancer_id", user.id)
          .in("status", [...HELPING_NOW_STATUSES])
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null as JobMini[] | null, error: null });

    const clientPromise = supabase
      .from("job_requests")
      .select(JOB_SELECT)
      .eq("client_id", user.id)
      .in("status", [...HELPING_NOW_STATUSES])
      .not("selected_freelancer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const [hRes, cRes] = await Promise.all([helperPromise, clientPromise]);

    const hRow = hRes.data?.[0] ?? null;
    const cRow = cRes.data?.[0] ?? null;

    if (hRes.error) {
      console.warn("[DiscoverHomeHeroDesktopLiveColumn] helper job:", hRes.error);
    }
    if (cRes.error) {
      console.warn("[DiscoverHomeHeroDesktopLiveColumn] client job:", cRes.error);
    }

    setHelperJob((hRow as JobMini | undefined) ?? null);
    setClientJob((cRow as JobMini | undefined) ?? null);

    const ids: string[] = [];
    if (hRow?.client_id) ids.push(String(hRow.client_id));
    if (cRow?.selected_freelancer_id)
      ids.push(String(cRow.selected_freelancer_id));
    const pmap = await fetchProfiles(ids);
    setProfiles(pmap);
    setLoading(false);
  }, [user?.id, profile?.role, profile?.is_available_for_jobs]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user?.id) {
    return null;
  }

  const city = (v: string | null | undefined) =>
    String(v ?? "").trim() || "your area";

  const helperClient = helperJob?.client_id
    ? profiles.get(helperJob.client_id)
    : undefined;
  const clientHelper = clientJob?.selected_freelancer_id
    ? profiles.get(clientJob.selected_freelancer_id)
    : undefined;

  const helperCity = helperJob ? city(helperJob.location_city) : "";
  const helperCategory = helperJob ? formatJobTitle(helperJob) : "";
  const clientNameForHelperLine =
    helperClient?.full_name?.trim() || "someone";

  const helperHeadline = helperJob
    ? `You are helping now ${clientNameForHelperLine} in ${helperCity} - ${helperCategory}`
    : "";

  const clientOpenAllHref = buildJobsUrl("client", "jobs");
  const clientTitle = clientJob ? formatJobTitle(clientJob) : "";
  const clientCity = clientJob ? city(clientJob.location_city) : "";
  const clientHelperId = clientJob?.selected_freelancer_id
    ? String(clientJob.selected_freelancer_id)
    : "";
  const clientHelperName =
    String(clientHelper?.full_name ?? "Helper").trim() || "Helper";

  const hasAny = Boolean(helperJob || clientJob);
  const showSkeleton = loading && !hasAny;

  const exploreCardClass = cn(
    "group relative w-full rounded-2xl p-4 text-left",
    EXPLORE_PAGE_CARD_SURFACE,
    EXPLORE_PAGE_CARD_HOVER,
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
  );

  return (
    <aside
      className={cn(
        "hidden min-h-0 min-w-0 flex-col gap-4 md:flex",
        "text-left",
        className,
      )}
      aria-label="Your active jobs"
    >
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

      {showSkeleton ? (
        <div className="rounded-2xl border-0 bg-zinc-100 px-4 py-6 text-sm text-muted-foreground shadow-none dark:bg-zinc-900">
          Loading live help…
        </div>
      ) : null}

      {!loading || hasAny ? (
        <>
          {helperJob ? (
            <div className={exploreCardClass}>
              <button
                type="button"
                onClick={() => navigate(`/jobs/${helperJob.id}/details`)}
                className="w-full text-left focus-visible:outline-none"
                aria-label="Open live help details"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-3 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground">
                    {helperHeadline}
                  </p>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    Live
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <ExploreLiveThumb job={helperJob} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="mt-1 flex min-w-0 items-center gap-1.5"
                      role="status"
                      aria-live="polite"
                    >
                      <Clock
                        className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Started
                      </span>
                      <LiveTimer
                        createdAt={helperJob.created_at}
                        render={({ time }) => (
                          <span className="!font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {time}
                          </span>
                        )}
                      />
                    </div>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </button>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(exploreOutlineBtnClass, "w-full flex-none")}
                  onClick={() => navigate(`/jobs/${helperJob.id}/details`)}
                >
                  Open job
                </Button>
                <button
                  type="button"
                  className="text-left text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => navigate(buildJobsUrl("freelancer", "jobs"))}
                >
                  View all helping now
                </button>
              </div>
            </div>
          ) : null}

          {clientJob ? (
            <div className={exploreCardClass}>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/client/jobs/${encodeURIComponent(clientJob.id)}/live`,
                  )
                }
                className="w-full text-left focus-visible:outline-none"
                aria-label="Open live help details"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {clientTitle}
                  </p>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    Live
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <ExploreLiveThumb job={clientJob} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-muted-foreground">
                      {clientCity}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UserRound
                        className="h-4 w-4 shrink-0 opacity-70"
                        aria-hidden
                      />
                      <span className="truncate">{clientHelperName}</span>
                    </p>
                    <div
                      className="mt-1 flex min-w-0 items-center gap-1.5"
                      role="status"
                      aria-live="polite"
                    >
                      <Clock
                        className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Started
                      </span>
                      <LiveTimer
                        createdAt={clientJob.created_at}
                        render={({ time }) => (
                          <span className="!font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {time}
                          </span>
                        )}
                      />
                    </div>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </button>

              <div className="mt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={exploreOutlineBtnClass}
                  onClick={() =>
                    navigate(
                      `/client/jobs/${encodeURIComponent(clientJob.id)}/live`,
                    )
                  }
                >
                  <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
                  Message
                </Button>
                <Button
                  type="button"
                  className={explorePrimaryBtnClass}
                  onClick={async () => {
                    if (clientHelperId && clientHelper) {
                      setReviewJob({
                        jobId: clientJob.id,
                        reviewee: clientHelper,
                        revieweeRole: "freelancer",
                      });
                      return;
                    }
                    await supabase
                      .from("job_requests")
                      .update({ status: "completed" })
                      .eq("id", clientJob.id);
                    void load();
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                  Done
                </Button>
              </div>
              <button
                type="button"
                className="mt-2 w-full text-left text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => navigate(clientOpenAllHref)}
              >
                View my active jobs
              </button>
            </div>
          ) : null}

          {!loading && !helperJob && !clientJob ? (
            <div className="rounded-2xl border-0 bg-zinc-100 px-4 py-10 text-center text-sm text-muted-foreground shadow-none dark:bg-zinc-900/50">
              No active jobs right now. When you are matched, status appears
              here on desktop.
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
