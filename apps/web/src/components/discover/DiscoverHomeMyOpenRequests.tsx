import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { trackEvent } from "@/lib/analytics";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { DiscoverMyOpenRequestCard } from "@/components/discover/DiscoverOpenHelpRequestCard";
import {
  DiscoverRequestCarouselArrows,
  useDiscoverRequestCarouselScroll,
} from "@/components/discover/DiscoverRequestCarouselControls";
import {
  discoverRequestCardCarouselItemClass,
  discoverRequestCardsCarouselContainerClass,
} from "@/components/discover/discoverRequestCarouselCardShared";

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
  explorePath: _explorePath = "/client/explore",
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { data: frData, isLoading: loading } = useFreelancerRequests(user?.id);
  const rows = useMemo(() => frData?.myOpenRequests ?? [], [frData]);
  const confirmedHelperAvatarsByJobId = frData?.confirmedHelperAvatarsByJobId ?? {};

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
        const acceptedHelpers = confirmedHelperAvatarsByJobId[row.id] ?? [];
        return { row, acceptedCount, acceptedHelpers };
      })
      .filter(
        (
          item,
        ): item is {
          row: DiscoverOpenHelpRequestRow;
          acceptedCount: number;
          acceptedHelpers: {
            id: string;
            photo_url: string | null;
            full_name: string | null;
          }[];
        } => item != null,
      );
  }, [rows, user?.id, profile?.full_name, profile?.photo_url, confirmedHelperAvatarsByJobId]);

  const { scrollerRef, scrollByDir } = useDiscoverRequestCarouselScroll();

  if (!user?.id) return null;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="My open requests">
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

  if (cards.length === 0) return null;

  const visibleCards = cards;

  return (
    <section className={cn("w-full", className)} aria-label="My open requests">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            {t("discover.myRequests")}
          </h2>
          <p className="mt-0.5 text-[15px] text-muted-foreground sm:text-base">
            {t("discover.myRequestsSubtitle")}
          </p>
        </div>
        <DiscoverRequestCarouselArrows
          onScrollLeft={() => scrollByDir(-1)}
          onScrollRight={() => scrollByDir(1)}
        />
      </div>

      <div ref={scrollerRef} className={discoverRequestCardsCarouselContainerClass}>
        {visibleCards.map(({ row, acceptedCount, acceptedHelpers }) => (
          <DiscoverMyOpenRequestCard
            key={row.id}
            row={row}
            acceptedCount={acceptedCount}
            acceptedHelpers={acceptedHelpers}
            layout="carousel"
            className={discoverRequestCardCarouselItemClass}
            onOpen={() => {
              trackEvent("discover_my_open_request_open", { job_id: row.id });
              navigate(`/client/jobs/${encodeURIComponent(row.id)}/live`);
            }}
          />
        ))}
      </div>
    </section>
  );
}
