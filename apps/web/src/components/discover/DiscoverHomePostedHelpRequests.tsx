import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Clock, Loader2, MessageCircle, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { acceptOpenHelpRequest } from "@/lib/acceptOpenHelpRequest";
import { globalCommunityFeedPath } from "@/lib/communityFeedNav";
import { isolatedOpenRequestPath } from "@/lib/jobRequestShare";
import {
  loadDismissedOpenHelpRequestIds,
} from "@/lib/dismissedOpenHelpRequests";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import {
  useDiscoverOpenHelpRequests,
  type DiscoverOpenHelpRequestRow,
} from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  DiscoverOpenHelpRequestsSeeMoreButton,
} from "@/components/discover/DiscoverOpenHelpRequestCard";
import { haversineDistanceKm } from "@/lib/geo";
import type { ViewerLocation } from "@/lib/globalFeedPostUi";
import { HomeListingSortButton } from "@/components/discover/HomeListingSortButton";
import {
  filterOpenHelpRequestsByCategory,
  matchesListingFilters,
  EMPTY_LISTING_FILTERS,
  type DiscoverHomeCategoryFilter,
  type DiscoverHomeListingFilters,
  type DiscoverHomeListingSort,
} from "@/lib/discoverHomeCategoryFilter";
import {
  formatOpenHelpRequestBudget,
  isOpenHelpRequestWhenExpired,
  openHelpRequestScheduleLine,
  openHelpRequestTitle,
} from "@/lib/openHelpRequestDisplay";
import {
  categoryIllustrationSrc,
  helpCategoryIdFromServiceDetails,
} from "@/lib/discoverCategoryTileIcons";
import { jobRequestImageUrls } from "@/lib/openHelpRequestFeedPost";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";

const MAX_VISIBLE = 8;

function canActAsHelper(
  profile: { role?: string; is_available_for_jobs?: boolean } | null | undefined,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true) return true;
  return false;
}

const HOME_LISTING_GRID_CLASS =
  "grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-x-5 md:gap-y-6 xl:grid-cols-4 min-[1440px]:grid-cols-5";

function RequestCardSkeleton() {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-[20px] bg-white pe-3 shadow-[0_5px_20px_rgba(15,23,42,0.08)] dark:bg-[#1d1f21] md:flex-col md:items-stretch md:pe-0">
      <div className="h-[112px] w-[112px] shrink-0 animate-pulse bg-zinc-200 dark:bg-zinc-800 md:aspect-[4/3] md:h-auto md:w-full" />
      <div className="min-w-0 flex-1 space-y-2 py-1 md:px-4 md:pb-4 md:pt-3.5">
        <div className="h-6 w-24 animate-pulse rounded-full bg-emerald-100 dark:bg-emerald-500/15" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-700/80" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700/60" />
        <div className="hidden gap-2 pt-1 md:flex">
          <div className="h-10 flex-[2] animate-pulse rounded-full bg-emerald-200/80 dark:bg-emerald-500/25" />
          <div className="h-10 w-16 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

function NearbyRequestRow({
  row,
  onOpen,
  accepted,
  accepting,
  onAccept,
}: {
  row: DiscoverOpenHelpRequestRow;
  onOpen: () => void;
  accepted: boolean;
  accepting: boolean;
  onAccept: () => void;
}) {
  const { t, i18n } = useTranslation();
  const attachment =
    jobRequestImageUrls(
      (row.service_details as Record<string, unknown> | null | undefined) ?? null,
    )[0] ?? null;
  const authorPhoto = row.client_photo_url?.trim() || null;
  // Prefer request media, then profile photo; otherwise same category
  // illustration as the home filter row (matches Offers for you).
  const image =
    attachment ||
    authorPhoto ||
    categoryIllustrationSrc(
      row.service_type,
      helpCategoryIdFromServiceDetails(row.service_details),
    );
  const category = postServiceCategoryLabel(
    row.service_type,
    helpCategoryIdFromServiceDetails(row.service_details),
  );
  const title = openHelpRequestTitle(row, t).replace(/\s+/g, " ").trim();
  const schedule = openHelpRequestScheduleLine(row);
  const author = row.client_display_name?.trim() || "Member";
  const timeAgo = row.created_at
    ? formatDistanceToNow(new Date(row.created_at), {
        addSuffix: true,
        locale: dateFnsLocaleFor(i18n.language),
      })
    : "";
  const budget = formatOpenHelpRequestBudget(row);
  const budgetLabel = budget
    ? row.budget_rate_type === "per_hour"
      ? `${budget}/hr`
      : budget
    : null;
  const clientRating =
    row.client_average_rating != null && Number(row.client_average_rating) > 0
      ? Number(row.client_average_rating)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-[20px] bg-white p-0 pe-2 text-left md:flex-col md:items-stretch md:gap-0 md:pe-0 shadow-[0_5px_20px_rgba(15,23,42,0.08)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(15,23,42,0.12)] focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 dark:bg-[#1d1f21] dark:shadow-none"
    >
      <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-800 md:aspect-[4/3] md:h-auto md:w-full">
        <img src={image} alt="" className="h-full w-full object-cover transition-transform duration-500 md:group-hover:scale-[1.04]" loading="lazy" />
        {budgetLabel || clientRating != null ? (
          <span className="absolute bottom-2.5 end-2.5 z-[2] hidden items-center gap-1.5 md:inline-flex">
            {clientRating != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-[15px] font-bold leading-none text-zinc-900 shadow-md">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                {clientRating.toFixed(1)}
                <span className="font-semibold text-zinc-500">
                  ({row.client_total_ratings ?? 0})
                </span>
              </span>
            ) : null}
            {budgetLabel ? (
              <span className="inline-flex rounded-full bg-emerald-600 px-3.5 py-1.5 text-[16px] font-bold leading-none text-white shadow-md">
                {budgetLabel}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 w-0 flex-1 basis-0 md:w-auto md:px-4 md:pt-3.5">
        <p className="truncate text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 md:mb-1.5 md:w-fit md:max-w-full md:rounded-full md:bg-emerald-50 md:px-2.5 md:py-1 md:text-[12px] md:font-bold dark:md:bg-emerald-500/15">
          {category}
        </p>
        <p className="mt-0.5 line-clamp-2 w-full break-normal text-[15px] font-bold leading-snug text-zinc-900 [overflow-wrap:normal] [word-break:normal] dark:text-white md:text-[16px]">
          {title}
        </p>
        {schedule ? (
          <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400 dark:text-zinc-500 md:text-[13px]">
            {schedule}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400 dark:text-zinc-500 md:text-[13px]">
          {author}{timeAgo ? ` • ${timeAgo}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 md:mx-4 md:mb-4 md:mt-3 md:flex-row md:gap-2">
        <button
          type="button"
          disabled={accepted || accepting}
          onClick={(event) => {
            event.stopPropagation();
            onAccept();
          }}
          aria-label={accepted ? "Accepted" : "Accept"}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold transition active:scale-[0.97] disabled:cursor-default md:h-10 md:w-auto md:min-w-0 md:flex-[2] md:px-4",
            accepted
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
          )}
        >
          {accepting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              <Check className="h-5 w-5 md:hidden" strokeWidth={2.75} aria-hidden />
              <span className="hidden md:inline">{accepted ? "Accepted" : "Accept"}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="hidden h-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-3.5 text-sm font-extrabold text-zinc-800 transition hover:bg-zinc-50 active:scale-[0.97] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 md:inline-flex"
        >
          {t("common.more")}
        </button>
      </div>
    </div>
  );
}

type Props = {
  enabled?: boolean;
  className?: string;
  categoryFilter?: DiscoverHomeCategoryFilter;
  otherSubFilter?: string | null;
  viewerLocation?: ViewerLocation | null;
  listingSort?: DiscoverHomeListingSort;
  onListingSortChange?: (next: DiscoverHomeListingSort) => void;
  listingFilters?: DiscoverHomeListingFilters;
  onListingFiltersChange?: (next: DiscoverHomeListingFilters) => void;
};

export function DiscoverHomePostedHelpRequests({
  enabled = true,
  className,
  categoryFilter = "all",
  otherSubFilter = null,
  viewerLocation = null,
  listingSort = "newest",
  onListingSortChange,
  listingFilters = EMPTY_LISTING_FILTERS,
  onListingFiltersChange,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  const { addToast } = useToast();
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [acceptedJobIds, setAcceptedJobIds] = useState<Set<string>>(() => new Set());
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(
    () => loadDismissedOpenHelpRequestIds(user?.id),
  );

  const { data: openRequests = [], isLoading: loading } = useDiscoverOpenHelpRequests(
    enabled,
    isAdmin ? null : user?.id,
    isAdmin ? 200 : undefined,
  );

  const undismissedRequests = useMemo(
    () =>
      openRequests.filter(
        (row) =>
          (isAdmin || !dismissedJobIds.has(row.id)) &&
          !isOpenHelpRequestWhenExpired(row.when_timeframe, row.created_at),
      ),
    [isAdmin, openRequests, dismissedJobIds],
  );
  const filteredRequests = useMemo(
    () =>
      filterOpenHelpRequestsByCategory(
        undismissedRequests,
        categoryFilter,
        otherSubFilter,
      ),
    [undismissedRequests, categoryFilter, otherSubFilter],
  );

  useEffect(() => {
    setDismissedJobIds(loadDismissedOpenHelpRequestIds(user?.id));
  }, [user?.id]);

  const sortedRequests = useMemo(() => {
    const lat = viewerLocation?.lat;
    const lng = viewerLocation?.lng;
    const rows = filteredRequests.filter((row) => {
      const distanceKm =
        row.location_lat != null &&
        row.location_lng != null &&
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
          ? haversineDistanceKm(lat, lng, row.location_lat, row.location_lng)
          : null;
      return matchesListingFilters(
        {
          createdAt: row.created_at,
          when: row.when_timeframe ?? null,
          categoryId: row.service_type,
          customCategory: helpCategoryIdFromServiceDetails(row.service_details),
          rating:
            row.client_average_rating != null ? Number(row.client_average_rating) : null,
          distanceKm,
        },
        listingFilters,
      );
    });
    const postedAt = (row: (typeof rows)[number]) =>
      new Date(row.created_at ?? 0).getTime();
    const whenRank = (row: (typeof filteredRequests)[number]) => {
      if (row.when_timeframe === "now") return 0;
      if (row.when_timeframe === "today") return 1;
      return 2;
    };
    const distanceKm = (row: (typeof filteredRequests)[number]) => {
      const lat = viewerLocation?.lat;
      const lng = viewerLocation?.lng;
      if (
        row.location_lat == null ||
        row.location_lng == null ||
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return null;
      }
      return haversineDistanceKm(lat, lng, row.location_lat, row.location_lng);
    };
    return [...rows].sort((a, b) => {
      if (listingSort === "oldest") return postedAt(a) - postedAt(b);
      if (listingSort === "when") {
        const rank = whenRank(a) - whenRank(b);
        if (rank !== 0) return rank;
        return postedAt(b) - postedAt(a);
      }
      if (listingSort === "reviews") {
        const ratingDiff = (b.client_average_rating ?? -1) - (a.client_average_rating ?? -1);
        if (ratingDiff !== 0) return ratingDiff;
        return postedAt(b) - postedAt(a);
      }
      if (listingSort === "category") {
        const aLabel = postServiceCategoryLabel(
          a.service_type,
          helpCategoryIdFromServiceDetails(a.service_details),
        );
        const bLabel = postServiceCategoryLabel(
          b.service_type,
          helpCategoryIdFromServiceDetails(b.service_details),
        );
        return aLabel.localeCompare(bLabel);
      }
      if (listingSort === "nearest") {
        const aKm = distanceKm(a);
        const bKm = distanceKm(b);
        if (aKm == null && bKm == null) return postedAt(b) - postedAt(a);
        if (aKm == null) return 1;
        if (bKm == null) return -1;
        return aKm - bKm;
      }
      return postedAt(b) - postedAt(a);
    });
  }, [filteredRequests, listingFilters, listingSort, viewerLocation]);

  const visibleRows = useMemo(
    () => (isAdmin ? sortedRequests : sortedRequests.slice(0, MAX_VISIBLE)),
    [isAdmin, sortedRequests],
  );
  const hasMore = !isAdmin && sortedRequests.length > MAX_VISIBLE;
  const visibleJobIdsKey = useMemo(
    () => visibleRows.map((row) => row.id).join(","),
    [visibleRows],
  );

  const { data: commentCountByJobId = {} } = useQuery({
    queryKey: ["discoverOpenHelpRequestComments", visibleJobIdsKey],
    enabled: enabled && visibleRows.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = visibleJobIdsKey.split(",").filter(Boolean);
      if (ids.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("job_request_comments")
        .select("job_request_id")
        .in("job_request_id", ids);
      if (error) {
        console.warn("[DiscoverHomePostedHelpRequests] comments", error);
        return {} as Record<string, number>;
      }
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = String((row as { job_request_id?: string }).job_request_id ?? "");
        if (!id) continue;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      return counts;
    },
  });
  const totalComments = Object.values(commentCountByJobId).reduce((sum, n) => sum + n, 0);

  useEffect(() => {
    if (!enabled || !user?.id || !visibleJobIdsKey) {
      setAcceptedJobIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    let cancelled = false;
    const jobIds = visibleJobIdsKey.split(",").filter(Boolean);

    void supabase
      .from("job_confirmations")
      .select("job_id")
      .eq("freelancer_id", user.id)
      .eq("status", "available")
      .in("job_id", jobIds)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setAcceptedJobIds(new Set((data ?? []).map((row) => row.job_id as string)));
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id, visibleJobIdsKey]);

  const handleAccept = useCallback(
    async (jobId: string, clientName: string | null | undefined) => {
      if (!user?.id) {
        addToast({
          title: "Sign in required",
          description: "Sign in to accept help requests.",
          variant: "warning",
        });
        return;
      }

      if (!canActAsHelper(profile)) {
        addToast({
          title: "Enable helper profile",
          description: "Turn on help mode to accept requests.",
          variant: "warning",
        });
        return;
      }

      setAcceptingJobId(jobId);
      try {
        await acceptOpenHelpRequest(jobId);
        setAcceptedJobIds((prev) => new Set(prev).add(jobId));
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discoverOpenHelpRequests(user.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.freelancerRequests(user.id),
        });
        trackEvent("discover_posted_help_request_accept", { job_id: jobId });
        addToast({
          title: "Accepted",
          description: `Waiting for ${(clientName || "the client").trim()}.`,
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Failed to accept",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "error",
        });
      } finally {
        setAcceptingJobId(null);
      }
    },
    [user?.id, profile, queryClient, addToast],
  );

  const handleOpenRequest = useCallback(
    (jobId: string) => {
      trackEvent("discover_posted_help_request_open", { job_id: jobId });
      navigate(isolatedOpenRequestPath(jobId));
    },
    [navigate],
  );

  const handleOpenGlobalRequestsFeed = useCallback(
    (from: "discover_home" | "discover_home_header" = "discover_home_header") => {
      trackEvent("discover_posted_help_requests_see_more", {
        from,
        truncated: hasMore,
        destination: "community_feed_requests",
      });
      navigate(globalCommunityFeedPath({ type: "request_help" }));
    },
    [navigate, hasMore],
  );

  if (!enabled) return null;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Posted help requests">
        <div className="mb-5 h-7 w-56 animate-pulse rounded bg-emerald-100 dark:bg-emerald-500/15" />
        <div className={HOME_LISTING_GRID_CLASS}>
          {Array.from({ length: 5 }, (_, i) => (
            <RequestCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (undismissedRequests.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label="Posted help requests">
      <div data-guide="find-requests" data-guide-rank="primary" className="mb-5 flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-[22px] font-black tracking-tight text-emerald-800 dark:text-emerald-400 sm:text-2xl">
          Requests near you
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-100 px-2.5 text-sm font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
            {visibleRows.length}
          </span>
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-zinc-100 px-2.5 text-sm font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
            {totalComments}
          </span>
          <button
            type="button"
            onClick={() => handleOpenGlobalRequestsFeed("discover_home_header")}
            className={cn(
              "hidden md:inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-sm font-bold text-foreground shadow-sm transition-colors",
              "hover:bg-zinc-50 active:scale-[0.98]",
              "dark:border-white/10 dark:bg-zinc-800 dark:hover:bg-zinc-700",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
            )}
          >
            {t("discover.exploreMore")}
            <ChevronRight className="h-4 w-4 rtl-flip-icon" aria-hidden />
          </button>
          {onListingSortChange ? (
            <HomeListingSortButton
              value={listingSort}
              onChange={onListingSortChange}
              filters={listingFilters}
              onFiltersChange={onListingFiltersChange}
              tone="emerald"
            />
          ) : null}
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-sm font-semibold text-foreground">
            {t("discover.noSortMatch", {
              sort:
                categoryFilter !== "all" && filteredRequests.length === 0
                  ? t(`discoverHome.filters.${categoryFilter}`)
                  : "this filter",
            })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("discover.tryAnotherSort")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-x-5 md:gap-y-6 xl:grid-cols-4 min-[1440px]:grid-cols-5">
            {visibleRows.map((row) => (
              <NearbyRequestRow
                key={row.id}
                row={row}
                onOpen={() => handleOpenRequest(row.id)}
                accepted={acceptedJobIds.has(row.id)}
                accepting={acceptingJobId === row.id}
                onAccept={() => void handleAccept(row.id, row.client_display_name)}
              />
            ))}
          </div>
        </>
      )}

      {sortedRequests.length > 0 ? (
        <div className="mt-4 md:hidden">
          <DiscoverOpenHelpRequestsSeeMoreButton
            onClick={() => handleOpenGlobalRequestsFeed("discover_home")}
          />
        </div>
      ) : null}
    </section>
  );
}
