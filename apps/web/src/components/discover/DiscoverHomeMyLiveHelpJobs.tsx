import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { trackEvent } from "@/lib/analytics";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { DiscoverMyLiveHelpCard } from "@/components/discover/DiscoverOpenHelpRequestCard";
import {
  DiscoverRequestCarouselArrows,
  useDiscoverRequestCarouselScroll,
} from "@/components/discover/DiscoverRequestCarouselControls";
import {
  discoverRequestCardCarouselItemClass,
  discoverRequestCardsCarouselContainerClass,
} from "@/components/discover/discoverRequestCarouselCardShared";

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
  service_details?: Record<string, unknown> | null;
};

type LiveHelpPayload = {
  jobs: JobRow[];
  profileMap: Record<string, ProfileMini>;
};

const HELPING_NOW_STATUSES = ["locked", "active"] as const;

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
  | "service_details"
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
    service_details: job.service_details ?? null,
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
          "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status, notes, ai_generated_copy, when_timeframe, budget_min, budget_max, budget_rate_type, service_details",
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
  createRequestPath?: string;
  emptyPostTrackEvent?: string;
};

function DiscoverHomeLiveHelpSection({
  jobs,
  profileMap,
  loading,
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
  createRequestPath,
  emptyPostTrackEvent,
}: LiveHelpSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scrollerRef, scrollByDir } = useDiscoverRequestCarouselScroll();

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label={ariaLabel}>
        <div className="mb-3 space-y-1">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="h-4 w-52 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
        </div>
        <div className={discoverRequestCardsCarouselContainerClass}>
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className={cn(
                discoverRequestCardCarouselItemClass,
                "h-36 animate-pulse rounded-[18px] bg-zinc-200/70 dark:bg-zinc-800/70",
              )}
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
              aria-label={t("discover.postRequest")}
            >
              {t("discover.postRequest")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("w-full", className)} aria-label={ariaLabel}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-[15px] text-muted-foreground sm:text-base">{subtitle}</p>
        </div>
        <DiscoverRequestCarouselArrows
          onScrollLeft={() => scrollByDir(-1)}
          onScrollRight={() => scrollByDir(1)}
        />
      </div>

      <div ref={scrollerRef} className={discoverRequestCardsCarouselContainerClass}>
        {jobs.map((job) => {
          const otherId = getOtherPartyId(job);
          const otherProfile = otherId ? profileMap[otherId] : null;
          const otherPartyName =
            (otherProfile?.full_name || "").trim() || otherPartyFallback;

          return (
            <DiscoverMyLiveHelpCard
              key={job.id}
              row={toLiveHelpCardRow(job)}
              layout="carousel"
              className={discoverRequestCardCarouselItemClass}
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
    </section>
  );
}

export function DiscoverHomeMyLiveHelpJobs({
  mode,
  exploreLiveHelpPath: _exploreLiveHelpPath,
  createRequestPath,
  className,
}: Props) {
  const { t } = useTranslation();
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
        createRequestPath={createRequestPath}
        className={className}
        title={t("discover.myHelpLive")}
        subtitle={t("discover.myHelpLiveSubtitle")}
        ariaLabel={t("discover.myHelpLive")}
        emptyTitle={t("discover.noLiveHelpYet")}
        emptySub={t("discover.noLiveHelpYetSub")}
        otherPartyLabel="Helper"
        otherPartyFallback="Helper"
        getOtherPartyId={(job) => String(job.selected_freelancer_id ?? "")}
        getJobOpenPath={(jobId) => `/client/jobs/${encodeURIComponent(jobId)}/live`}
        openTrackEvent="discover_my_help_live_open"
        emptyPostTrackEvent="discover_my_help_live_empty_post_request"
      />
    );
  }

  return (
    <DiscoverHomeLiveHelpSection
      jobs={jobs}
      profileMap={profileMap}
      loading={loading}
      className={className}
      title={t("discover.liveHelp")}
      subtitle={t("discover.liveHelpSubtitle")}
      ariaLabel={t("discover.liveHelp")}
      emptyTitle={t("discover.noLiveGigsYet")}
      emptySub={t("discover.noLiveGigsYetSub")}
      otherPartyLabel="Helping"
      otherPartyFallback="Client"
      getOtherPartyId={(job) => String(job.client_id ?? "")}
      getJobOpenPath={(jobId) =>
        `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(jobId)}`
      }
      openTrackEvent="discover_my_live_help_open"
    />
  );
}
