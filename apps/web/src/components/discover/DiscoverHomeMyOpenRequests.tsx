import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { trackEvent } from "@/lib/analytics";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { DiscoverMyOpenRequestCard } from "@/components/discover/DiscoverOpenHelpRequestCard";

const MY_REQUESTS_PREVIEW_LIMIT = 5;

type Props = {
  className?: string;
  explorePath?: string;
};

function toOpenHelpRow(
  job: Record<string, unknown>,
  viewer: { id: string; full_name?: string | null; photo_url?: string | null },
): DiscoverOpenHelpRequestRow | null {
  const id = String(job.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    service_type: (job.service_type as string | null) ?? null,
    location_city: (job.location_city as string | null) ?? null,
    start_at: (job.start_at as string | null) ?? null,
    created_at: (job.created_at as string | null) ?? null,
    shift_hours: (job.shift_hours as string | null) ?? null,
    time_duration: (job.time_duration as string | null) ?? null,
    care_type: (job.care_type as string | null) ?? null,
    care_frequency: (job.care_frequency as string | null) ?? null,
    when_timeframe: (job.when_timeframe as string | null) ?? null,
    custom_when_at: (job.custom_when_at as string | null) ?? null,
    budget_min: (job.budget_min as number | null) ?? null,
    budget_max: (job.budget_max as number | null) ?? null,
    budget_rate_type: (job.budget_rate_type as string | null) ?? null,
    notes: (job.notes as string | null) ?? null,
    service_details: (job.service_details as Record<string, unknown> | null) ?? null,
    ai_generated_copy: job.ai_generated_copy,
    client_id: viewer.id,
    client_display_name: viewer.full_name ?? null,
    client_photo_url: viewer.photo_url ?? null,
  };
}

export function DiscoverHomeMyOpenRequests({
  className,
  explorePath = "/client/explore",
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { data: frData, isLoading: loading } = useFreelancerRequests(user?.id);
  const rows = useMemo(() => frData?.myOpenRequests ?? [], [frData]);

  const cards = useMemo(() => {
    if (!user?.id) return [];
    const viewer = {
      id: user.id,
      full_name: profile?.full_name ?? null,
      photo_url: profile?.photo_url ?? null,
    };
    return rows
      .map((job) => {
        const row = toOpenHelpRow(job as Record<string, unknown>, viewer);
        if (!row) return null;
        const acceptedCount =
          typeof (job as { acceptedCount?: number }).acceptedCount === "number"
            ? (job as { acceptedCount: number }).acceptedCount
            : 0;
        return { row, acceptedCount };
      })
      .filter((item): item is { row: DiscoverOpenHelpRequestRow; acceptedCount: number } =>
        item != null,
      );
  }, [rows, user?.id, profile?.full_name, profile?.photo_url]);

  if (!user?.id) return null;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="My open requests">
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

  if (cards.length === 0) return null;

  const visibleCards = cards.slice(0, MY_REQUESTS_PREVIEW_LIMIT);
  const hasMore = cards.length > MY_REQUESTS_PREVIEW_LIMIT;
  const myRequestsActivityPath = `${explorePath}?mode=hire&tab=my_requests`;

  return (
    <section className={cn("w-full", className)} aria-label="My open requests">
      <div className="mb-3">
        <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
          {t("discover.myRequests")}
        </h2>
        <p className="mt-0.5 text-[15px] text-muted-foreground sm:text-base">
          {t("discover.myRequestsSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {visibleCards.map(({ row, acceptedCount }) => (
          <DiscoverMyOpenRequestCard
            key={row.id}
            row={row}
            acceptedCount={acceptedCount}
            onOpen={() => {
              trackEvent("discover_my_open_request_open", { job_id: row.id });
              navigate(`/client/jobs/${encodeURIComponent(row.id)}/live`);
            }}
          />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              trackEvent("discover_my_open_requests_show_more", {
                from: "discover_home",
                total: cards.length,
                destination: "my_activity_my_requests",
              });
              navigate(myRequestsActivityPath);
            }}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-zinc-50 text-sm font-bold text-foreground transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800",
            )}
          >
            {t("common.showMore")}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}
