import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { trackEvent } from "@/lib/analytics";
import {
  categoryIllustrationSrc,
  helpCategoryIdFromServiceDetails,
} from "@/lib/discoverCategoryTileIcons";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";

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

type Props = {
  mode: Mode;
  exploreLiveHelpPath?: string;
  createRequestPath?: string;
  className?: string;
};

const HELPING_NOW_STATUSES = ["locked", "active"] as const;

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
        console.warn("[DiscoverHomeMyLiveHelpJobs]", error);
        return { jobs: [], profileMap: {} };
      }

      const jobs = (data ?? []) as JobRow[];
      const otherIds = [
        ...new Set(
          jobs
            .map((j) =>
              mode === "hire" ? j.selected_freelancer_id : j.client_id,
            )
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      let profileMap: Record<string, ProfileMini> = {};
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", otherIds);
        profileMap = Object.fromEntries(
          ((profiles ?? []) as ProfileMini[]).map((p) => [p.id, p]),
        );
      }

      return { jobs, profileMap };
    },
  });
}

function jobCategoryLabel(job: JobRow): string {
  const sub = helpCategoryIdFromServiceDetails(job.service_details);
  return postServiceCategoryLabel(job.service_type, sub);
}

function jobCategoryId(job: JobRow): string | null {
  return (
    helpCategoryIdFromServiceDetails(job.service_details) ||
    job.service_type ||
    null
  );
}

export function DiscoverHomeMyLiveHelpJobs({
  mode,
  className,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading: loading } = useDiscoverMyLiveHelpJobs(user?.id, mode);
  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const profileMap = data?.profileMap ?? {};

  if (!user?.id || loading || jobs.length === 0) return null;

  const title =
    mode === "hire" ? t("discover.myHelpLive") : t("discover.liveHelp");
  const titleClass =
    mode === "hire"
      ? "text-orange-700 dark:text-orange-400"
      : "text-emerald-700 dark:text-emerald-400";
  const ringClass =
    mode === "hire"
      ? "focus-visible:ring-orange-500/70"
      : "focus-visible:ring-emerald-500/70";

  return (
    <section className={cn("w-full", className)} aria-label={title}>
      <h2
        className={cn(
          "mb-5 text-[24px] font-black tracking-tight sm:text-2xl",
          titleClass,
        )}
      >
        {title}
      </h2>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
        {jobs.map((job) => {
          const otherId =
            mode === "hire"
              ? String(job.selected_freelancer_id ?? "")
              : String(job.client_id ?? "");
          const otherProfile = otherId ? profileMap[otherId] : null;
          const otherName =
            (otherProfile?.full_name || "").trim() ||
            (mode === "hire" ? "Helper" : "Client");
          const categoryId = jobCategoryId(job);
          const categoryLabel = jobCategoryLabel(job);
          const location = (job.location_city ?? "").trim() || null;
          const openPath =
            mode === "hire"
              ? `/client/jobs/${encodeURIComponent(job.id)}/live`
              : `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(job.id)}`;

          return (
            <button
              key={job.id}
              type="button"
              onClick={() => {
                trackEvent(
                  mode === "hire"
                    ? "discover_my_help_live_open"
                    : "discover_my_live_help_open",
                  { job_id: job.id },
                );
                navigate(openPath);
              }}
              className={cn(
                "flex w-full items-center gap-3 overflow-hidden rounded-[20px] p-0 pe-3 text-left",
                "bg-white shadow-[0_5px_20px_rgba(15,23,42,0.08)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(15,23,42,0.12)] active:opacity-80 dark:bg-[#1d1f21] dark:shadow-none",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                ringClass,
              )}
            >
              <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={categoryIllustrationSrc(categoryId)}
                  alt=""
                  className="h-full w-full origin-center scale-[1.08] object-cover object-center"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-[15px] font-semibold sm:text-[13px]",
                    titleClass,
                  )}
                >
                  {categoryLabel}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug text-zinc-900 dark:text-white sm:text-[16px]">
                  {location || title}
                </p>
                <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
                  {mode === "hire" ? `Helper · ${otherName}` : `Helping · ${otherName}`}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live now
                </p>
              </div>

              <ChevronRight
                className="h-6 w-6 shrink-0 text-zinc-300 rtl-flip-icon dark:text-zinc-600 sm:h-5 sm:w-5"
                strokeWidth={2}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
