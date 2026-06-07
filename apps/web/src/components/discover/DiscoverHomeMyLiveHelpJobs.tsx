import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { trackEvent } from "@/lib/analytics";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { DiscoverMyLiveHelpCard } from "@/components/discover/DiscoverOpenHelpRequestCard";

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
  notes?: string | null;
  ai_generated_copy?: unknown;
  when_timeframe?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: string | null;
};

type LiveHelpPayload = {
  jobs: JobRow[];
  profileMap: Record<string, ProfileMini>;
};

const HELPING_NOW_STATUSES = ["locked", "active"] as const;
const MY_LIVE_HELP_PREVIEW_LIMIT = 5;

function toLiveHelpCardRow(job: JobRow): Pick<
  DiscoverOpenHelpRequestRow,
  | "service_type"
  | "location_city"
  | "created_at"
  | "notes"
  | "ai_generated_copy"
  | "when_timeframe"
  | "budget_min"
  | "budget_max"
  | "budget_rate_type"
> {
  return {
    service_type: job.service_type,
    location_city: job.location_city,
    created_at: job.created_at,
    notes: job.notes ?? null,
    ai_generated_copy: job.ai_generated_copy,
    when_timeframe: job.when_timeframe ?? null,
    budget_min: job.budget_min ?? null,
    budget_max: job.budget_max ?? null,
    budget_rate_type: job.budget_rate_type ?? null,
  };
}

function useDiscoverMyLiveHelpJobs(userId: string | undefined, mode: Mode) {
  const queryClient = useQueryClient();
  const qk = queryKeys.exploreLiveHelp(userId, mode);
  const filterField = mode === "hire" ? "client_id" : "selected_freelancer_id";

  useRealtimeSubscription(
    {
      table: "job_requests",
      event: "*",
      enabled: !!userId,
      filter: userId ? `${filterField}=eq.${userId}` : undefined,
    },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    },
  );

  return useQuery<LiveHelpPayload>({
    queryKey: qk,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<LiveHelpPayload> => {
      if (!userId) return { jobs: [], profileMap: {} };

      const baseSelect = supabase
        .from("job_requests")
        .select(
          "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status, notes, ai_generated_copy, when_timeframe, budget_min, budget_max, budget_rate_type",
        );
      const filtered =
        mode === "hire"
          ? baseSelect.eq("client_id", userId)
          : baseSelect.eq("selected_freelancer_id", userId);

      const { data, error } = await filtered
        .in("status", [...HELPING_NOW_STATUSES])
        .not("selected_freelancer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);

      if (error) {
        console.warn("[DiscoverHomeMyLiveHelpJobs] jobs", error);
        return { jobs: [], profileMap: {} };
      }

      const rows = (data ?? []) as JobRow[];
      if (rows.length === 0) return { jobs: rows, profileMap: {} };

      const otherIds = Array.from(
        new Set(
          (mode === "hire"
            ? rows.map((r) => String(r.selected_freelancer_id ?? ""))
            : rows.map((r) => String(r.client_id ?? ""))
          ).filter(Boolean),
        ),
      );

      const profileMap: Record<string, ProfileMini> = {};
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", otherIds);
        for (const p of (profs ?? []) as ProfileMini[]) {
          if (p?.id) profileMap[p.id] = p;
        }
      }

      return { jobs: rows, profileMap };
    },
  });
}

type Props = {
  mode: Mode;
  exploreLiveHelpPath: string;
  createRequestPath?: string;
  className?: string;
};

type LiveHelpSectionProps = {
  jobs: JobRow[];
  profileMap: Record<string, ProfileMini>;
  loading: boolean;
  exploreLiveHelpPath: string;
  className?: string;
  title: string;
  subtitle: string;
  ariaLabel: string;
  emptyTitle: string;
  emptySub: string;
  otherPartyLabel: string;
  otherPartyFallback: string;
  getOtherPartyId: (job: JobRow) => string;
  getJobOpenPath: (jobId: string) => string;
  openTrackEvent: string;
  showMoreTrackEvent: string;
  createRequestPath?: string;
  emptyPostTrackEvent?: string;
};

function DiscoverHomeLiveHelpSection({
  jobs,
  profileMap,
  loading,
  exploreLiveHelpPath,
  className,
  title,
  subtitle,
  ariaLabel,
  emptyTitle,
  emptySub,
  otherPartyLabel,
  otherPartyFallback,
  getOtherPartyId,
  getJobOpenPath,
  openTrackEvent,
  showMoreTrackEvent,
  createRequestPath,
  emptyPostTrackEvent,
}: LiveHelpSectionProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label={ariaLabel}>
        <div className="mb-3 space-y-1">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="h-4 w-52 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[18px] bg-zinc-200/70 dark:bg-zinc-800/70"
            />
          ))}
        </div>
      </section>
    );
  }

  if (jobs.length === 0) {
    const showPostCta = !!createRequestPath;
    return (
      <section className={cn("w-full", className)} aria-label={ariaLabel}>
        <div className="mb-3">
          <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-[15px] text-muted-foreground sm:text-base">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-5 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25">
            <Zap className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold leading-tight text-zinc-900 dark:text-white">
              {emptyTitle}
            </p>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
              {emptySub}
            </p>
          </div>
          {showPostCta ? (
            <button
              type="button"
              onClick={() => {
                if (emptyPostTrackEvent) {
                  trackEvent(emptyPostTrackEvent, {});
                }
                navigate(createRequestPath as string);
              }}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-900 shadow-sm transition-colors",
                "hover:bg-emerald-100 active:scale-95",
                "dark:border-white/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 dark:shadow-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              )}
              aria-label="Post a new request"
            >
              Post request
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const visibleJobs = jobs.slice(0, MY_LIVE_HELP_PREVIEW_LIMIT);
  const hasMore = jobs.length > MY_LIVE_HELP_PREVIEW_LIMIT;

  return (
    <section className={cn("w-full", className)} aria-label={ariaLabel}>
      <div className="mb-3">
        <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
          {title}
        </h2>
        <p className="mt-0.5 text-[15px] text-muted-foreground sm:text-base">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {visibleJobs.map((job) => {
          const otherId = getOtherPartyId(job);
          const otherProfile = otherId ? profileMap[otherId] : null;
          const otherPartyName =
            (otherProfile?.full_name || "").trim() || otherPartyFallback;

          return (
            <DiscoverMyLiveHelpCard
              key={job.id}
              row={toLiveHelpCardRow(job)}
              otherPartyLabel={otherPartyLabel}
              otherPartyName={otherPartyName}
              onOpen={() => {
                trackEvent(openTrackEvent, { job_id: job.id });
                navigate(getJobOpenPath(job.id));
              }}
            />
          );
        })}
      </div>

      {hasMore ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              trackEvent(showMoreTrackEvent, {
                from: "discover_home",
                total: jobs.length,
                destination: "my_activity_live_help",
              });
              navigate(exploreLiveHelpPath);
            }}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-zinc-50 text-sm font-bold text-foreground transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800",
            )}
          >
            Show more
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function DiscoverHomeMyLiveHelpJobs({
  mode,
  exploreLiveHelpPath,
  createRequestPath,
  className,
}: Props) {
  const { user } = useAuth();

  const { data, isLoading: loading } = useDiscoverMyLiveHelpJobs(user?.id, mode);
  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const profileMap = data?.profileMap ?? {};

  if (!user?.id) return null;

  if (mode === "hire") {
    return (
      <DiscoverHomeLiveHelpSection
        jobs={jobs}
        profileMap={profileMap}
        loading={loading}
        exploreLiveHelpPath={exploreLiveHelpPath}
        createRequestPath={createRequestPath}
        className={className}
        title="My help live"
        subtitle="Active help sessions with a confirmed helper"
        ariaLabel="My live help"
        emptyTitle="No live help yet"
        emptySub="When a helper is confirmed on your request, it will appear here."
        otherPartyLabel="Helper"
        otherPartyFallback="Helper"
        getOtherPartyId={(job) => String(job.selected_freelancer_id ?? "")}
        getJobOpenPath={(jobId) => `/client/jobs/${encodeURIComponent(jobId)}/live`}
        openTrackEvent="discover_my_help_live_open"
        showMoreTrackEvent="discover_my_help_live_show_more"
        emptyPostTrackEvent="discover_my_help_live_empty_post_request"
      />
    );
  }

  return (
    <DiscoverHomeLiveHelpSection
      jobs={jobs}
      profileMap={profileMap}
      loading={loading}
      exploreLiveHelpPath={exploreLiveHelpPath}
      className={className}
      title="Live help"
      subtitle="Jobs you're actively helping with right now"
      ariaLabel="Live help"
      emptyTitle="No live gigs yet"
      emptySub="When you're confirmed on a job, it will appear here."
      otherPartyLabel="Helping"
      otherPartyFallback="Client"
      getOtherPartyId={(job) => String(job.client_id ?? "")}
      getJobOpenPath={(jobId) =>
        `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(jobId)}`
      }
      openTrackEvent="discover_my_live_help_open"
      showMoreTrackEvent="discover_my_live_help_show_more"
    />
  );
}
