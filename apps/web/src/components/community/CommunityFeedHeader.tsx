import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LifeBuoy,
  Loader2,
  Newspaper,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import {
  CommunityFeedFilterButton,
  CommunityFeedFilterDialog,
  communityFeedFilterActiveBadgeClass,
  communityFeedFilterIdleBadgeClass,
} from "@/components/community/CommunityFeedFilterDialog";
import type { CommunityFeedAdvancedFilters } from "@/lib/communityFeedFilters";
import type { DiscoverHomeCategoryId } from "@/lib/serviceCategories";
import { OTHER_HELP_SUBCATEGORIES } from "@/lib/serviceCategories";
import { PublicPostsCategoryTabs } from "@/components/community/PublicPostsCategoryTabs";
import { fetchGlobalFeedRecentPosters } from "@/lib/globalFeedRecentPosters";
import type { GlobalFeedRecentPoster } from "@/lib/globalFeedRecentPosters";
import { feedLocationDisplayLabel } from "@/lib/globalFeedPostUi";
import { StarRating } from "@/components/StarRating";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { FAVORITES_SIDE_PANEL_RESERVE_CLASS } from "@/components/discover/FavoritesPostsSidePanel";
import { AvatarWithLiveDot } from "@/components/AvatarWithLiveDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type CommunityFeedPostTypeFilter =
  | "all"
  | "request_help"
  | "offer_service"
  | "community"
  | "event";

export const COMMUNITY_FEED_POST_TYPE_TABS: {
  id: CommunityFeedPostTypeFilter;
  labelKey: string;
  Icon: LucideIcon;
}[] = [
  { id: "all", labelKey: "feed.filters.all", Icon: LayoutGrid },
  { id: "request_help", labelKey: "feed.filters.requests", Icon: LifeBuoy },
  { id: "offer_service", labelKey: "feed.filters.offers", Icon: Briefcase },
  { id: "community", labelKey: "feed.filters.community", Icon: Newspaper },
  { id: "event", labelKey: "feed.filters.events", Icon: CalendarDays },
];

type FavoriteProfile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  live_until: string | null;
};

async function fetchFavoriteProfiles(viewerUserId: string): Promise<FavoriteProfile[]> {
  const { data: favs, error: favErr } = await supabase
    .from("profile_favorites")
    .select("favorite_user_id, created_at")
    .eq("user_id", viewerUserId)
    .order("created_at", { ascending: false });
  if (favErr) throw favErr;

  const ids = (favs ?? []).map((r) => r.favorite_user_id as string);
  if (ids.length === 0) return [];

  const [{ data: profiles, error: profileErr }, { data: fpRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, photo_url").in("id", ids),
    supabase.from("freelancer_profiles").select("user_id, live_until").in("user_id", ids),
  ]);
  if (profileErr) throw profileErr;

  const liveUntilByUser = new Map(
    (fpRows ?? []).map((row) => [
      row.user_id as string,
      (row.live_until as string | null) ?? null,
    ]),
  );

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        photo_url: (p.photo_url as string | null) ?? null,
        live_until: liveUntilByUser.get(p.id as string) ?? null,
      } satisfies FavoriteProfile,
    ]),
  );

  return ids
    .map((id) => profileMap.get(id))
    .filter(Boolean) as FavoriteProfile[];
}

type CommunityFeedHeaderProps = {
  activeFilter: CommunityFeedPostTypeFilter;
  onFilterChange: (filter: CommunityFeedPostTypeFilter) => void;
  onAddStory: () => void;
  viewer?: {
    full_name?: string | null;
    photo_url?: string | null;
  } | null;
  viewerUserId?: string | null;
  commentedFilterActive?: boolean;
  onCommentedFilterChange?: (active: boolean) => void;
  acceptedFilterActive?: boolean;
  onAcceptedFilterChange?: (active: boolean) => void;
  advancedFilters?: CommunityFeedAdvancedFilters;
  onAdvancedFiltersChange?: (filters: CommunityFeedAdvancedFilters) => void;
  selectedAuthorFilterId?: string | null;
  onAuthorFilterChange?: (authorId: string | null) => void;
  /** Keep filter chips out from under the fixed favorites side panel on desktop. */
  reserveSidePanelSpace?: boolean;
  className?: string;
  /** Global posts feed uses the same type tabs with compact styling. */
  variant?: "default" | "global";
  showCategoryTabs?: boolean;
  categoryFilter?: DiscoverHomeCategoryId;
  onCategoryFilterChange?: (id: DiscoverHomeCategoryId) => void;
  otherSubFilter?: string | null;
  onOtherSubFilterChange?: (id: string | null) => void;
  /** Hide type chips on md+ (they live in the guest left sidebar). */
  hidePostTypeTabsOnDesktop?: boolean;
};

export function CommunityFeedHeader({
  activeFilter,
  onFilterChange,
  onAddStory,
  viewer,
  viewerUserId,
  commentedFilterActive = false,
  onCommentedFilterChange,
  acceptedFilterActive = false,
  onAcceptedFilterChange,
  advancedFilters,
  onAdvancedFiltersChange,
  selectedAuthorFilterId = null,
  onAuthorFilterChange,
  reserveSidePanelSpace = false,
  className,
  variant = "default",
  showCategoryTabs = false,
  categoryFilter,
  onCategoryFilterChange,
  otherSubFilter = null,
  onOtherSubFilterChange,
  hidePostTypeTabsOnDesktop = false,
}: CommunityFeedHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [savingFavoriteId, setSavingFavoriteId] = useState<string | null>(null);
  const filterTabs = COMMUNITY_FEED_POST_TYPE_TABS;
  const isGlobalVariant = variant === "global";
  const showFilterControls = Boolean(
    advancedFilters &&
      onAdvancedFiltersChange &&
      (viewerUserId || (isGlobalVariant && showCategoryTabs && !hidePostTypeTabsOnDesktop)),
  );

  const { data: favoriteProfiles = [] } = useQuery({
    queryKey: queryKeys.discoverSavedProfiles(viewerUserId ?? null),
    queryFn: () => fetchFavoriteProfiles(viewerUserId!),
    enabled: Boolean(viewerUserId) && !isGlobalVariant,
    staleTime: 60_000,
  });

  const { data: recentPosters = [] } = useQuery({
    queryKey: queryKeys.globalFeedRecentPosters(viewerUserId ?? null),
    queryFn: () => fetchGlobalFeedRecentPosters(viewerUserId),
    enabled: isGlobalVariant,
    staleTime: 5 * 60_000,
  });

  const { data: profileFavoriteRows = [] } = useQuery({
    queryKey: queryKeys.profileFavorites(viewerUserId ?? null),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", viewerUserId!);
      if (error) throw error;
      return (data ?? []) as { favorite_user_id: string }[];
    },
    enabled: Boolean(viewerUserId) && isGlobalVariant,
    staleTime: 60_000,
  });

  const favoriteAuthorIds = useMemo(
    () =>
      new Set(
        profileFavoriteRows
          .map((row) => String(row.favorite_user_id ?? ""))
          .filter(Boolean),
      ),
    [profileFavoriteRows],
  );

  const stripAuthors = isGlobalVariant ? recentPosters : favoriteProfiles;

  const posterStripRef = useRef<HTMLDivElement>(null);
  const [posterStripOverflow, setPosterStripOverflow] = useState({
    left: false,
    right: false,
  });

  const updatePosterStripOverflow = useCallback(() => {
    const el = posterStripRef.current;
    if (!el) {
      setPosterStripOverflow({ left: false, right: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 4) {
      setPosterStripOverflow({ left: false, right: false });
      return;
    }
    const sl = el.scrollLeft;
    setPosterStripOverflow({
      left: sl > 4,
      right: sl < maxScroll - 4,
    });
  }, []);

  const scrollPosterStrip = useCallback((dir: -1 | 1) => {
    const el = posterStripRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: amount * dir, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isGlobalVariant) return;
    const el = posterStripRef.current;
    if (!el) return;
    updatePosterStripOverflow();
    el.addEventListener("scroll", updatePosterStripOverflow, { passive: true });
    const ro = new ResizeObserver(updatePosterStripOverflow);
    ro.observe(el);
    for (const child of el.children) {
      if (child instanceof Element) ro.observe(child);
    }
    const timeoutId = window.setTimeout(updatePosterStripOverflow, 250);
    return () => {
      el.removeEventListener("scroll", updatePosterStripOverflow);
      ro.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, [isGlobalVariant, stripAuthors.length, updatePosterStripOverflow]);

  async function saveAuthorToFavorites(authorId: string) {
    if (!viewerUserId) {
      addToast({ title: t("feed.global.signInToSaveProfile"), variant: "warning" });
      return;
    }
    if (authorId === viewerUserId || favoriteAuthorIds.has(authorId)) return;

    setSavingFavoriteId(authorId);
    try {
      const { error } = await supabase.from("profile_favorites").insert({
        user_id: viewerUserId,
        favorite_user_id: authorId,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.profileFavorites(viewerUserId),
          });
          addToast({ title: t("feed.global.alreadySavedProfile"), variant: "success" });
          return;
        }
        throw error;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profileFavorites(viewerUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.discoverSavedProfiles(viewerUserId),
      });
      addToast({ title: t("feed.global.savedProfile"), variant: "success" });
    } catch (err) {
      console.error("[CommunityFeedHeader] save favorite", err);
      addToast({ title: t("feed.global.couldNotSaveProfile"), variant: "error" });
    } finally {
      setSavingFavoriteId(null);
    }
  }

  const viewerInitial =
    (viewer?.full_name?.charAt(0) || "Y").toUpperCase();

  const storyCircleSizeClass = isGlobalVariant
    ? "h-[6.25rem] w-[6.25rem]"
    : "h-[5.5rem] w-[5.5rem]";
  const storyItemWidthClass = isGlobalVariant ? "w-[6.25rem]" : "w-[5.5rem]";
  const storyAvatarFallbackClass = isGlobalVariant
    ? "bg-zinc-100 text-xl font-bold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300"
    : "bg-gradient-to-br from-emerald-100 to-teal-100 text-xl font-bold text-emerald-800 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-200";
  const storyNameClass = isGlobalVariant
    ? "max-w-full truncate px-0.5 text-xs font-medium lowercase leading-tight text-muted-foreground"
    : "max-w-full truncate px-0.5 text-xs font-semibold leading-tight text-foreground";
  const globalPosterCardClass = cn(
    "flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl text-center",
    "w-[7.25rem] bg-zinc-50 dark:w-[8.5rem] dark:bg-zinc-800",
  );
  const globalPosterPhotoClass = "relative aspect-square w-full overflow-hidden";
  const posterStripArrowClass = cn(
    "absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full",
    "border border-white/45 bg-white/50 text-zinc-800 shadow-md",
    "backdrop-blur-xl backdrop-saturate-150",
    "transition-opacity hover:bg-white/70 active:scale-95",
    "dark:border-white/15 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:bg-zinc-900/70",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70",
    "md:flex",
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
      <div
        ref={isGlobalVariant ? posterStripRef : undefined}
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-1 pt-0.5 dark:gap-3",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-proximity [touch-action:pan-x_pan-y] overscroll-x-contain",
          isGlobalVariant
            ? "px-2 pe-4 scroll-ps-2 scroll-pe-4 md:px-0 md:pe-2 md:scroll-ps-0 md:scroll-pe-2"
            : "max-md:-mx-0 px-1 md:mx-0 md:px-0",
        )}
        role="list"
        aria-label={
          isGlobalVariant
            ? t("feed.global.recentPosters")
            : t("feed.filters.savedProfiles")
        }
      >
        <button
          type="button"
          role="listitem"
          onClick={onAddStory}
          className={cn(
            isGlobalVariant
              ? cn(
                  globalPosterCardClass,
                  "outline-none transition-transform active:scale-[0.97]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )
              : cn(
                  "group flex shrink-0 snap-start flex-col items-center gap-2 rounded-xl pb-0.5 text-center outline-none",
                  storyItemWidthClass,
                  "transition-transform active:scale-[0.97]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                ),
          )}
          aria-label={t("discoverHome.actions.sharePost")}
        >
          {isGlobalVariant ? (
            <>
              <div className={cn(globalPosterPhotoClass, "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400")}>
                <div className="flex h-full w-full items-center justify-center">
                  <Plus className="h-8 w-8" strokeWidth={2.25} aria-hidden />
                </div>
              </div>
              <span className="max-w-full truncate px-2 pb-2.5 pt-2 text-sm font-semibold lowercase leading-tight text-foreground">
                {t("discoverHome.actions.sharePost")}
              </span>
            </>
          ) : (
            <>
              <div className={cn("relative shrink-0", storyCircleSizeClass)}>
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/35 bg-muted/20">
                  {viewer?.photo_url ? (
                    <Avatar className="h-full w-full border-0">
                      <AvatarImage
                        src={viewer.photo_url}
                        alt=""
                        className="object-cover"
                      />
                      <AvatarFallback className="text-xl font-bold">
                        {viewerInitial}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                      <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
                    </div>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
              </div>
              <span className={cn(storyNameClass, "text-foreground")}>
                {t("discoverHome.actions.sharePost")}
              </span>
            </>
          )}
        </button>

        {stripAuthors.map((author) => {
          const label = author.full_name?.trim()?.split(" ")[0] || "Member";
          const displayName = author.full_name?.trim() || label;
          const isSelected = selectedAuthorFilterId === author.id;
          const isSelf = viewerUserId === author.id;
          const isSaved = favoriteAuthorIds.has(author.id);
          const showSaveBadge = isGlobalVariant && !isSelf && !isSaved;
          const savingFavorite = savingFavoriteId === author.id;

          if (isGlobalVariant) {
            const poster = author as GlobalFeedRecentPoster;
            const locationLabel = feedLocationDisplayLabel(t, poster.city);

            return (
              <div key={author.id} role="listitem" className={globalPosterCardClass}>
                <div className={globalPosterPhotoClass}>
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${author.id}`)}
                    className={cn(
                      "group h-full w-full outline-none transition-transform active:scale-[0.97]",
                      "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                    title={displayName}
                    aria-label={t("feed.global.viewProfile", { name: displayName })}
                  >
                    <AvatarWithLiveDot
                      liveUntil={author.live_until}
                      className="block h-full w-full"
                      dotClassName="bottom-auto right-auto top-1.5 left-1.5 border-0"
                    >
                      <Avatar className="h-full w-full rounded-none border-0 shadow-none ring-0 !rounded-none">
                        <AvatarImage
                          src={author.photo_url ?? undefined}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <AvatarFallback className={cn(storyAvatarFallbackClass, "rounded-none")}>
                          {label.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </AvatarWithLiveDot>
                  </button>
                  {showSaveBadge ? (
                    <button
                      type="button"
                      onClick={() => void saveAuthorToFavorites(author.id)}
                      disabled={savingFavorite}
                      className={cn(
                        "absolute bottom-1.5 right-1.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full",
                        "border-0 bg-zinc-500 text-white shadow-sm outline-none ring-0",
                        "hover:bg-zinc-600 dark:bg-zinc-500 dark:text-white dark:hover:bg-zinc-400",
                        "transition-transform hover:scale-105 active:scale-95 disabled:opacity-80",
                      )}
                      aria-label={t("feed.global.saveProfile", {
                        name: displayName,
                      })}
                    >
                      {savingFavorite ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="h-4 w-4" strokeWidth={3} aria-hidden />
                      )}
                    </button>
                  ) : null}
                </div>

                <div className="flex w-full min-w-0 flex-col items-center gap-1 px-2 pb-2.5 pt-2">
                  <span className="flex min-w-0 max-w-full items-center justify-center gap-1 px-0.5">
                    <span className="truncate text-sm font-semibold lowercase leading-tight text-foreground">
                      {displayName}
                    </span>
                    {poster.is_verified ? (
                      <BadgeCheck
                        className="h-3.5 w-3.5 shrink-0 fill-emerald-500 text-white"
                        strokeWidth={2.35}
                        aria-label={t("profile.verifiedHelper")}
                      />
                    ) : null}
                  </span>
                  <StarRating
                    rating={poster.average_rating ?? 0}
                    totalRatings={poster.total_ratings ?? 0}
                    size="sm"
                    showCount
                    className="justify-center gap-0.5"
                    numberClassName="text-[11px] font-bold text-foreground/80"
                    countClassName="text-[10px] text-muted-foreground"
                  />
                  {locationLabel ? (
                    <span className="max-w-full truncate px-0.5 text-[11px] leading-tight text-muted-foreground">
                      {locationLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          }

          return (
            <div
              key={author.id}
              role="listitem"
              className={cn(
                "flex shrink-0 snap-start flex-col items-center gap-2 rounded-xl pb-0.5 text-center",
                storyItemWidthClass,
              )}
            >
              <div className={cn("relative shrink-0", storyCircleSizeClass)}>
                <button
                  type="button"
                  onClick={() => {
                    onCommentedFilterChange?.(false);
                    onAcceptedFilterChange?.(false);
                    onAuthorFilterChange?.(isSelected ? null : author.id);
                  }}
                  className={cn(
                    "group h-full w-full outline-none transition-transform active:scale-[0.97]",
                    "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  title={author.full_name ?? label}
                  aria-label={
                    isSelected
                      ? t("feed.filters.clearFilterFor", {
                          name: author.full_name ?? label,
                        })
                      : t("feed.filters.showPostsBy", {
                          name: author.full_name ?? label,
                        })
                  }
                  aria-pressed={isSelected}
                >
                  <AvatarWithLiveDot
                    liveUntil={author.live_until}
                    className={cn(
                      "h-full w-full transition-transform duration-300 group-hover:scale-[1.03]",
                      isSelected &&
                        "rounded-full ring-2 ring-orange-500 ring-offset-2 ring-offset-background",
                    )}
                  >
                    <Avatar className="h-full w-full border-0 shadow-none ring-0">
                      <AvatarImage
                        src={author.photo_url ?? undefined}
                        alt=""
                        className="object-cover"
                      />
                      <AvatarFallback className={storyAvatarFallbackClass}>
                        {label.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </AvatarWithLiveDot>
                </button>
              </div>
              <span
                className={cn(
                  storyNameClass,
                  isSelected
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-foreground",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
        {isGlobalVariant ? (
          <div className="w-4 shrink-0 md:w-6" aria-hidden />
        ) : null}
      </div>
      {isGlobalVariant ? (
        <>
          <button
            type="button"
            onClick={() => scrollPosterStrip(-1)}
            disabled={!posterStripOverflow.left}
            aria-label={t("feed.global.scrollPostersLeft", {
              defaultValue: "Scroll profiles left",
            })}
            className={cn(
              posterStripArrowClass,
              "left-1",
              !posterStripOverflow.left && "pointer-events-none opacity-0",
            )}
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollPosterStrip(1)}
            disabled={!posterStripOverflow.right}
            aria-label={t("feed.global.scrollPostersRight", {
              defaultValue: "Scroll profiles right",
            })}
            className={cn(
              posterStripArrowClass,
              "right-1",
              !posterStripOverflow.right && "pointer-events-none opacity-0",
            )}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </button>
        </>
      ) : null}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto pb-1",
          variant === "global" && "gap-1.5",
          "max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
          "md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden",
          "px-1 md:px-0",
          reserveSidePanelSpace && FAVORITES_SIDE_PANEL_RESERVE_CLASS,
          hidePostTypeTabsOnDesktop && "md:hidden",
        )}
        role="tablist"
        aria-label={t("feed.filters.filterPostsByType")}
      >
        {showFilterControls ? (
          <>
            <CommunityFeedFilterButton
              filters={advancedFilters!}
              commentedFilterActive={commentedFilterActive}
              acceptedFilterActive={acceptedFilterActive}
              categoryFilter={categoryFilter}
              otherSubFilter={otherSubFilter}
              onClick={() => setFilterDialogOpen(true)}
            />
            <CommunityFeedFilterDialog
              open={filterDialogOpen}
              onOpenChange={setFilterDialogOpen}
              filters={advancedFilters!}
              onApply={onAdvancedFiltersChange!}
              viewerUserId={viewerUserId}
              commentedFilterActive={commentedFilterActive}
              onCommentedFilterChange={onCommentedFilterChange}
              acceptedFilterActive={acceptedFilterActive}
              onAcceptedFilterChange={onAcceptedFilterChange}
              onAuthorFilterChange={onAuthorFilterChange}
              showCategoryTabs={showCategoryTabs && !hidePostTypeTabsOnDesktop}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={onCategoryFilterChange}
              otherSubFilter={otherSubFilter}
              onOtherSubFilterChange={onOtherSubFilterChange}
            />
          </>
        ) : null}

        {filterTabs.map((tab) => {
          const selected = tab.id === activeFilter;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                onCommentedFilterChange?.(false);
                onAcceptedFilterChange?.(false);
                onAuthorFilterChange?.(null);
                onFilterChange(tab.id);
              }}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border-0 font-semibold transition-all",
                variant === "global"
                  ? "gap-1.5 px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs"
                  : "gap-2.5 px-[1.125rem] py-2.5 text-[13px] font-black uppercase tracking-wide sm:px-5 sm:text-[14px]",
                variant === "global"
                  ? selected
                    ? "bg-zinc-600 text-white dark:bg-zinc-700 dark:text-white"
                    : "bg-zinc-500/90 text-white hover:bg-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  : selected
                    ? communityFeedFilterActiveBadgeClass
                    : communityFeedFilterIdleBadgeClass,
              )}
            >
              <Icon
                className={cn(
                  "shrink-0",
                  variant === "global" ? "h-4 w-4 sm:h-5 sm:w-5" : "h-[18px] w-[18px]",
                )}
                strokeWidth={2.25}
                aria-hidden
              />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {showCategoryTabs && onCategoryFilterChange && categoryFilter ? (
        <div className="-mx-2 md:hidden">
          <div
            className={cn(
              "flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1 pt-0.5",
              "[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "px-3 pe-6 scroll-ps-3 scroll-pe-6",
            )}
          >
            <PublicPostsCategoryTabs
              dense
              startAligned
              lightGrey={hidePostTypeTabsOnDesktop}
              activeId={categoryFilter}
              onSelect={(id) => {
                onCategoryFilterChange(id);
                if (id !== "other_help") {
                  onOtherSubFilterChange?.(null);
                }
              }}
            />
            {categoryFilter === "other_help" ? (
              <select
                value={otherSubFilter ?? ""}
                onChange={(e) => onOtherSubFilterChange?.(e.target.value || null)}
                className={cn(
                  "h-8 max-w-[9.5rem] shrink-0 rounded-full border-0 px-2.5 text-[11px] font-semibold outline-none",
                  hidePostTypeTabsOnDesktop
                    ? "bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200"
                    : "bg-zinc-500/90 text-white dark:bg-zinc-800 dark:text-zinc-200",
                )}
                aria-label={t("discoverHome.filters.pickSubcategory")}
              >
                <option value="">{t("discoverHome.filters.allOther")}</option>
                {OTHER_HELP_SUBCATEGORIES.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {t(`otherHelpSubcategories.${sub.id}`)}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="w-2 shrink-0" aria-hidden />
          </div>
        </div>
      ) : null}
    </div>
  );
}
