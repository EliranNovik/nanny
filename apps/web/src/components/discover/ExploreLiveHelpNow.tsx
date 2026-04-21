import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Clock, UserRound } from "lucide-react";
import {
  EXPLORE_PAGE_CARD_SURFACE,
  INTERACTIVE_CARD_HOVER,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { LiveTimer } from "@/components/LiveTimer";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

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

  const otherPartyLabel = mode === "hire" ? "Helper" : "Client";
  const emptyTitle = mode === "hire" ? "Nothing in Helping me now yet." : "Nothing in Helping now yet.";
  const emptySub =
    mode === "hire"
      ? "When a helper is confirmed on your request, it will show up here."
      : "When you’re assigned to a job, it will appear here.";

  const openAllHref = useMemo(() => {
    return mode === "hire"
      ? buildJobsUrl("client", "jobs")
      : buildJobsUrl("freelancer", "jobs");
  }, [mode]);

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
        "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status",
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate(openAllHref)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          View all
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card/30 px-4 py-6 text-sm text-muted-foreground">
          Loading live help…
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/20 px-4 py-10 text-center">
          <p className="text-base font-semibold text-foreground">{emptyTitle}</p>
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

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  if (mode === "hire") {
                    navigate(`/client/jobs/${encodeURIComponent(job.id)}/live`);
                  } else {
                    navigate(openAllHref);
                  }
                }}
                className={cn(
                  "group relative w-full rounded-2xl p-4 text-left",
                  EXPLORE_PAGE_CARD_SURFACE,
                  INTERACTIVE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {title}
                  </p>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
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
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-muted-foreground">
                      {loc}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UserRound className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                      <span className="truncate">{otherName}</span>
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
                      <Clock
                        className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Started
                      </span>
                      <LiveTimer
                        createdAt={job.created_at}
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
                    aria-hidden
                    strokeWidth={2}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

