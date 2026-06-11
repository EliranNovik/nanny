import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
  LayoutGrid,
  LifeBuoy,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import {
  CommunityFeedFilterButton,
  CommunityFeedFilterDialog,
} from "@/components/community/CommunityFeedFilterDialog";
import type { CommunityFeedAdvancedFilters } from "@/lib/communityFeedFilters";
import { cn } from "@/lib/utils";
import { FAVORITES_SIDE_PANEL_RESERVE_CLASS } from "@/components/discover/FavoritesPostsSidePanel";
import { AvatarWithLiveDot } from "@/components/AvatarWithLiveDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type CommunityFeedPostTypeFilter =
  | "all"
  | "request_help"
  | "offer_service"
  | "community"
  | "event";

const FILTER_TABS: {
  id: CommunityFeedPostTypeFilter;
  labelKey: string;
  Icon: LucideIcon;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    id: "all",
    labelKey: "feed.filters.all",
    Icon: LayoutGrid,
    activeClass:
      "border-0 bg-emerald-600 text-white shadow-md shadow-emerald-900/15",
    idleClass:
      "border-0 bg-background text-foreground hover:bg-muted/50",
  },
  {
    id: "request_help",
    labelKey: "feed.filters.requests",
    Icon: LifeBuoy,
    activeClass:
      "border-0 bg-red-600 text-white shadow-md shadow-red-900/15",
    idleClass:
      "border-0 bg-red-50/50 text-red-700 hover:bg-red-50 dark:bg-red-950/20 dark:text-red-300",
  },
  {
    id: "offer_service",
    labelKey: "feed.filters.offers",
    Icon: Briefcase,
    activeClass:
      "border-0 bg-emerald-600 text-white shadow-md shadow-emerald-900/15",
    idleClass:
      "border-0 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-300",
  },
  {
    id: "community",
    labelKey: "feed.filters.community",
    Icon: Users,
    activeClass:
      "border-0 bg-blue-600 text-white shadow-md shadow-blue-900/15",
    idleClass:
      "border-0 bg-blue-50/50 text-blue-700 hover:bg-blue-50 dark:bg-blue-950/20 dark:text-blue-300",
  },
  {
    id: "event",
    labelKey: "feed.filters.events",
    Icon: CalendarDays,
    activeClass:
      "border-0 bg-violet-600 text-white shadow-md shadow-violet-900/15",
    idleClass:
      "border-0 bg-violet-50/50 text-violet-700 hover:bg-violet-50 dark:bg-violet-950/20 dark:text-violet-300",
  },
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
}: CommunityFeedHeaderProps) {
  const { t } = useTranslation();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  const { data: favoriteProfiles = [] } = useQuery({
    queryKey: queryKeys.discoverSavedProfiles(viewerUserId ?? null),
    queryFn: () => fetchFavoriteProfiles(viewerUserId!),
    enabled: Boolean(viewerUserId),
    staleTime: 60_000,
  });

  const viewerInitial =
    (viewer?.full_name?.charAt(0) || "Y").toUpperCase();

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-1 pt-0.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory [touch-action:pan-x_pan-y] overscroll-x-contain",
          "max-md:-mx-0 px-1 md:mx-0 md:px-0",
        )}
        role="list"
        aria-label={t("feed.filters.savedProfiles")}
      >
        <button
          type="button"
          role="listitem"
          onClick={onAddStory}
          className={cn(
            "group flex w-[5.5rem] shrink-0 snap-start flex-col items-center gap-2 rounded-xl pb-0.5 text-center outline-none",
            "transition-transform active:scale-[0.97]",
            "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label={t("feed.filters.addYourStory")}
        >
          <div className="relative h-[5.5rem] w-[5.5rem] shrink-0">
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
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-emerald-600 text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
          </div>
          <span className="max-w-full truncate px-0.5 text-xs font-semibold leading-tight text-foreground">
            {t("feed.filters.yourStory")}
          </span>
        </button>

        {favoriteProfiles.map((author) => {
          const label = author.full_name?.trim()?.split(" ")[0] || "Member";
          const isSelected = selectedAuthorFilterId === author.id;
          return (
            <button
              key={author.id}
              type="button"
              role="listitem"
              onClick={() => {
                onCommentedFilterChange?.(false);
                onAcceptedFilterChange?.(false);
                onAuthorFilterChange?.(isSelected ? null : author.id);
              }}
              className={cn(
                "group flex w-[5.5rem] shrink-0 snap-start flex-col items-center gap-2 rounded-xl pb-0.5 text-center outline-none",
                "transition-transform active:scale-[0.97]",
                "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              title={author.full_name ?? label}
              aria-label={
                isSelected
                  ? t("feed.filters.clearFilterFor", { name: author.full_name ?? label })
                  : t("feed.filters.showPostsBy", { name: author.full_name ?? label })
              }
              aria-pressed={isSelected}
            >
              <AvatarWithLiveDot
                liveUntil={author.live_until}
                className={cn(
                  "h-[5.5rem] w-[5.5rem] transition-transform duration-300 group-hover:scale-[1.03]",
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
                  <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-xl font-bold text-emerald-800 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-200">
                    {label.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </AvatarWithLiveDot>
              <span
                className={cn(
                  "max-w-full truncate px-0.5 text-xs font-semibold leading-tight",
                  isSelected ? "text-orange-600 dark:text-orange-400" : "text-foreground",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "flex gap-2 overflow-x-auto pb-1",
          "max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
          "md:[scrollbar-width:thin] md:[&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-border/80",
          "px-1 md:px-0",
          reserveSidePanelSpace && FAVORITES_SIDE_PANEL_RESERVE_CLASS,
        )}
        role="tablist"
        aria-label={t("feed.filters.filterPostsByType")}
      >
        {FILTER_TABS.map((tab) => {
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
                "inline-flex shrink-0 items-center gap-2 rounded-full border-0 px-4 py-2 text-xs font-black uppercase tracking-wide transition-all sm:text-[13px]",
                selected ? tab.activeClass : tab.idleClass,
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
              {t(tab.labelKey)}
            </button>
          );
        })}

        {viewerUserId && advancedFilters && onAdvancedFiltersChange ? (
          <>
            <CommunityFeedFilterButton
              filters={advancedFilters}
              commentedFilterActive={commentedFilterActive}
              acceptedFilterActive={acceptedFilterActive}
              onClick={() => setFilterDialogOpen(true)}
            />
            <CommunityFeedFilterDialog
              open={filterDialogOpen}
              onOpenChange={setFilterDialogOpen}
              filters={advancedFilters}
              onApply={onAdvancedFiltersChange}
              viewerUserId={viewerUserId}
              commentedFilterActive={commentedFilterActive}
              onCommentedFilterChange={onCommentedFilterChange}
              acceptedFilterActive={acceptedFilterActive}
              onAcceptedFilterChange={onAcceptedFilterChange}
              onAuthorFilterChange={onAuthorFilterChange}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
