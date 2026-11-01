import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Clock, Loader2, MessageCircle } from "lucide-react";
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
import {
  discoverNearbyRequestCardCarouselItemClass,
  discoverRequestCardsCarouselContainerClass,
} from "@/components/discover/discoverRequestCarouselCardShared";
import {
  applyOpenHelpRequestDiscoverSort,
  filterOpenHelpRequestsByCategory,
  type DiscoverHomeCategoryFilter,
  type DiscoverOpenHelpRequestSort,
} from "@/lib/discoverHomeCategoryFilter";
import { isOpenHelpRequestWhenExpired } from "@/lib/openHelpRequestDisplay";
import {
  openHelpRequestScheduleLine,
  openHelpRequestTitle,
} from "@/lib/openHelpRequestDisplay";
import { jobAttachmentImageUrls } from "@/components/JobAttachedPhotosStrip";
import {
  categoryIllustrationSrc,
  helpCategoryIdFromServiceDetails,
} from "@/lib/discoverCategoryTileIcons";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";

const MAX_VISIBLE = 8;

const SORT_OPTIONS: DiscoverOpenHelpRequestSort[] = [
  "newest",
  "oldest",
  "today",
  "now",
];

function canActAsHelper(
  profile: { role?: string; is_available_for_jobs?: boolean } | null | undefined,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true) return true;
  return false;
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
  const attachment = jobAttachmentImageUrls({
    service_details: row.service_details ?? undefined,
  })[0];
  const image =
    attachment ||
    row.client_photo_url ||
    categoryIllustrationSrc(
      row.service_type,
      helpCategoryIdFromServiceDetails(row.service_details),
    );
  const category = postServiceCategoryLabel(
    row.service_type,
    helpCategoryIdFromServiceDetails(row.service_details),
  );
  const title = openHelpRequestTitle(row, t);
  const schedule = openHelpRequestScheduleLine(row);
  const author = row.client_display_name?.trim() || "Member";
  const timeAgo = row.created_at
    ? formatDistanceToNow(new Date(row.created_at), {
        addSuffix: true,
        locale: dateFnsLocaleFor(i18n.language),
      })
    : "";

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
      className="flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-[20px] bg-white p-0 pe-3 text-left shadow-[0_5px_20px_rgba(15,23,42,0.08)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(15,23,42,0.12)] focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 dark:bg-[#1d1f21] dark:shadow-none"
    >
      <div className="h-[112px] w-[112px] shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-emerald-700 dark:text-emerald-400 sm:text-[13px]">
          {category}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug text-zinc-900 dark:text-white sm:text-[16px]">
          {title}
        </p>
        {schedule ? (
          <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
            {schedule}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
          {author}{timeAgo ? ` • ${timeAgo}` : ""}
        </p>
      </div>
      <button
        type="button"
        disabled={accepted || accepting}
        onClick={(event) => {
          event.stopPropagation();
          onAccept();
        }}
        className={cn(
          "inline-flex h-10 min-w-[88px] shrink-0 items-center justify-center rounded-full px-4 text-sm font-extrabold transition active:scale-[0.97] disabled:cursor-default",
          accepted
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        )}
      >
        {accepting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : accepted ? (
          "Accepted"
        ) : (
          "Accept"
        )}
      </button>
    </div>
  );
}

type Props = {
  enabled?: boolean;
  className?: string;
  categoryFilter?: DiscoverHomeCategoryFilter;
};

export function DiscoverHomePostedHelpRequests({
  enabled = true,
  className,
  categoryFilter = "all",
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [acceptedJobIds, setAcceptedJobIds] = useState<Set<string>>(() => new Set());
  const [sortBy, setSortBy] = useState<DiscoverOpenHelpRequestSort>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(
    () => loadDismissedOpenHelpRequestIds(user?.id),
  );
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const { data: openRequests = [], isLoading: loading } = useDiscoverOpenHelpRequests(
    enabled,
    user?.id,
  );

  const undismissedRequests = useMemo(
    () =>
      openRequests.filter(
        (row) =>
          !dismissedJobIds.has(row.id) &&
          !isOpenHelpRequestWhenExpired(row.when_timeframe, row.created_at),
      ),
    [openRequests, dismissedJobIds],
  );
  const filteredRequests = useMemo(
    () => filterOpenHelpRequestsByCategory(undismissedRequests, categoryFilter),
    [undismissedRequests, categoryFilter],
  );

  useEffect(() => {
    setDismissedJobIds(loadDismissedOpenHelpRequestIds(user?.id));
  }, [user?.id]);

  const sortedRequests = useMemo(
    () => applyOpenHelpRequestDiscoverSort(filteredRequests, sortBy),
    [filteredRequests, sortBy],
  );

  const visibleRows = useMemo(
    () => sortedRequests.slice(0, MAX_VISIBLE),
    [sortedRequests],
  );
  const hasMore = sortedRequests.length > MAX_VISIBLE;
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

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortMenuOpen]);

  const handleSortChange = useCallback((next: DiscoverOpenHelpRequestSort) => {
    setSortBy(next);
    setSortMenuOpen(false);
    trackEvent("discover_posted_help_requests_sort", { sort: next });
  }, []);

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
        <div className="mb-5 space-y-1">
          <div className="h-6 w-56 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
        </div>
        <div className={discoverRequestCardsCarouselContainerClass}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={cn(
                discoverNearbyRequestCardCarouselItemClass,
                "h-52 animate-pulse rounded-[1.75rem] bg-zinc-200/70 dark:bg-zinc-800/70",
              )}
            />
          ))}
        </div>
      </section>
    );
  }

  if (undismissedRequests.length === 0) return null;

  const sortLabel = t(`common.${sortBy}`);

  return (
    <section className={cn("w-full", className)} aria-label="Posted help requests">
      <div className="mb-5 flex items-center justify-between gap-3">
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
          <div ref={sortMenuRef} className="relative hidden md:block">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-sm font-bold text-foreground shadow-sm dark:border-white/10 dark:bg-zinc-900",
                sortMenuOpen && "ring-2 ring-emerald-500/30",
              )}
              aria-label={`${t("common.sort")}: ${sortLabel}`}
              aria-expanded={sortMenuOpen}
              aria-haspopup="listbox"
              onClick={() => setSortMenuOpen((open) => !open)}
            >
              {t("common.sort")}: {sortLabel}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  sortMenuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {sortMenuOpen ? (
              <div
                role="listbox"
                aria-label="Sort open requests"
                className="absolute right-0 top-[calc(100%+0.35rem)] z-20 min-w-[9.5rem] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-900"
              >
                {SORT_OPTIONS.map((option) => {
                  const selected = sortBy === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSortChange(option)}
                      className={cn(
                        "flex w-full items-center px-3.5 py-2.5 text-left text-sm font-semibold transition-colors",
                        selected
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/80",
                      )}
                    >
                      {t(`common.${option}`)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-sm font-semibold text-foreground">
            {t("discover.noSortMatch", {
              sort:
                categoryFilter !== "all" && filteredRequests.length === 0
                  ? t(`discoverHome.filters.${categoryFilter}`)
                  : sortLabel,
            })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("discover.tryAnotherSort")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
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
