import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useToast } from "@/components/ui/toast";
import { acceptOpenHelpRequest } from "@/lib/acceptOpenHelpRequest";
import { toggleJobRequestFavorite } from "@/lib/jobRequestFavorites";
import { globalCommunityFeedPath } from "@/lib/communityFeedNav";
import { globalJobRequestFeedPath } from "@/lib/jobRequestShare";
import {
  loadDismissedOpenHelpRequestIds,
  rememberDismissedOpenHelpRequest,
} from "@/lib/dismissedOpenHelpRequests";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { useDiscoverOpenHelpRequests } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { useJobRequestFavoriteIds } from "@/hooks/data/useJobRequestFavoriteIds";
import {
  DiscoverOpenHelpRequestCard,
  DiscoverOpenHelpRequestsSeeMoreButton,
} from "@/components/discover/DiscoverOpenHelpRequestCard";
import {
  DiscoverRequestCarouselArrows,
  useDiscoverRequestCarouselScroll,
} from "@/components/discover/DiscoverRequestCarouselControls";
import {
  discoverRequestCardCarouselItemClass,
  discoverRequestCardsCarouselContainerClass,
} from "@/components/discover/discoverRequestCarouselCardShared";
import {
  applyOpenHelpRequestDiscoverSort,
  filterOpenHelpRequestsByCategory,
  type DiscoverHomeCategoryFilter,
  type DiscoverOpenHelpRequestSort,
} from "@/lib/discoverHomeCategoryFilter";

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
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { addToast } = useToast();
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [acceptedJobIds, setAcceptedJobIds] = useState<Set<string>>(() => new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<DiscoverOpenHelpRequestSort>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(
    () => loadDismissedOpenHelpRequestIds(user?.id),
  );
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const { scrollerRef, scrollByDir } = useDiscoverRequestCarouselScroll();

  const { data: openRequests = [], isLoading: loading } = useDiscoverOpenHelpRequests(
    enabled,
    user?.id,
  );
  const { data: savedJobIds = new Set<string>() } = useJobRequestFavoriteIds(user?.id);

  const filteredRequests = useMemo(
    () =>
      filterOpenHelpRequestsByCategory(openRequests, categoryFilter).filter(
        (row) => !dismissedJobIds.has(row.id),
      ),
    [openRequests, categoryFilter, dismissedJobIds],
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

  useEffect(() => {
    if (!user?.id || visibleRows.length === 0) {
      setAcceptedJobIds(new Set());
      return;
    }

    let cancelled = false;
    const jobIds = visibleRows.map((row) => row.id);

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
  }, [user?.id, visibleJobIdsKey, visibleRows]);

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
      navigate(globalJobRequestFeedPath(jobId));
    },
    [navigate],
  );

  const handleDismiss = useCallback(
    (jobId: string) => {
      rememberDismissedOpenHelpRequest(user?.id, jobId);
      setDismissedJobIds((prev) => new Set(prev).add(jobId));
      trackEvent("discover_posted_help_request_dismiss", { job_id: jobId });
    },
    [user?.id],
  );

  const handleToggleSave = useCallback(
    async (jobId: string) => {
      if (!user?.id) {
        openGuestAuthPrompt({ variant: "engage" });
        return;
      }

      const currentlySaved = savedJobIds.has(jobId);
      setSavingJobId(jobId);
      try {
        await toggleJobRequestFavorite(user.id, jobId, currentlySaved);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.jobRequestFavorites(user.id),
        });
        trackEvent("discover_posted_help_request_save", {
          job_id: jobId,
          saved: !currentlySaved,
        });
        addToast({
          title: currentlySaved ? "Removed from saved" : "Request saved",
          description: currentlySaved ? undefined : "Find it under Saved → Requests.",
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Could not save",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "error",
        });
      } finally {
        setSavingJobId(null);
      }
    },
    [user?.id, savedJobIds, queryClient, addToast, openGuestAuthPrompt],
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
        <div className="mb-4 space-y-1">
          <div className="h-6 w-56 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
        </div>
        <div className={discoverRequestCardsCarouselContainerClass}>
          {Array.from({ length: 4 }, (_, i) => (
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

  if (filteredRequests.length === 0) return null;

  const sortLabel = t(`common.${sortBy}`);

  return (
    <section className={cn("w-full", className)} aria-label="Posted help requests">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
              {t("discover.openRequestsNearYou")}
            </h2>
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
          </div>
          <p className="mt-0.5 text-[15px] text-muted-foreground sm:text-base">
            {t("discover.openRequestsSubtitle")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div ref={sortMenuRef} className="relative">
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
          <DiscoverRequestCarouselArrows
            onScrollLeft={() => scrollByDir(-1)}
            onScrollRight={() => scrollByDir(1)}
          />
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm font-semibold text-foreground">
            {t("discover.noSortMatch", { sort: sortLabel })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("discover.tryAnotherSort")}
          </p>
        </div>
      ) : (
        <div ref={scrollerRef} className={discoverRequestCardsCarouselContainerClass}>
          {visibleRows.map((row) => (
            <DiscoverOpenHelpRequestCard
              key={row.id}
              row={row}
              layout="carousel"
              className={discoverRequestCardCarouselItemClass}
              onOpen={() => handleOpenRequest(row.id)}
              saved={savedJobIds.has(row.id)}
              saveBusy={savingJobId === row.id}
              onToggleSave={() => void handleToggleSave(row.id)}
              accepted={acceptedJobIds.has(row.id)}
              accepting={acceptingJobId === row.id}
              onAccept={() => void handleAccept(row.id, row.client_display_name)}
              onDismiss={() => handleDismiss(row.id)}
            />
          ))}
        </div>
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
