import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
  Check,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
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
import { fetchAcceptedRequestCount } from "@/lib/fetchAcceptedJobRequestsForFeed";
import { cn } from "@/lib/utils";
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
  label: string;
  Icon: LucideIcon;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    id: "all",
    label: "All",
    Icon: LayoutGrid,
    activeClass:
      "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-900/15",
    idleClass:
      "border-border/60 bg-background text-foreground hover:bg-muted/50",
  },
  {
    id: "request_help",
    label: "Requests",
    Icon: LifeBuoy,
    activeClass:
      "border-transparent bg-red-600 text-white shadow-md shadow-red-900/15",
    idleClass:
      "border-red-200/70 bg-red-50/50 text-red-700 hover:bg-red-50 dark:border-red-500/25 dark:bg-red-950/20 dark:text-red-300",
  },
  {
    id: "offer_service",
    label: "Offers",
    Icon: Briefcase,
    activeClass:
      "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-900/15",
    idleClass:
      "border-emerald-200/70 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-950/20 dark:text-emerald-300",
  },
  {
    id: "community",
    label: "Community",
    Icon: Users,
    activeClass:
      "border-transparent bg-blue-600 text-white shadow-md shadow-blue-900/15",
    idleClass:
      "border-blue-200/70 bg-blue-50/50 text-blue-700 hover:bg-blue-50 dark:border-blue-500/25 dark:bg-blue-950/20 dark:text-blue-300",
  },
  {
    id: "event",
    label: "Events",
    Icon: CalendarDays,
    activeClass:
      "border-transparent bg-violet-600 text-white shadow-md shadow-violet-900/15",
    idleClass:
      "border-violet-200/70 bg-violet-50/50 text-violet-700 hover:bg-violet-50 dark:border-violet-500/25 dark:bg-violet-950/20 dark:text-violet-300",
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

async function fetchCommentedOwnPostCount(viewerUserId: string): Promise<number> {
  const { data: ownPosts, error: ownErr } = await supabase
    .from("profile_posts")
    .select("id")
    .eq("author_id", viewerUserId);
  if (ownErr) throw ownErr;

  const ownIds = (ownPosts ?? []).map((p) => p.id as string);
  if (ownIds.length === 0) return 0;

  const { data: commentRows, error } = await supabase
    .from("profile_post_comments")
    .select("post_id")
    .in("post_id", ownIds);
  if (error) throw error;
  return new Set((commentRows ?? []).map((r) => r.post_id as string)).size;
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
  className,
}: CommunityFeedHeaderProps) {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  const { data: favoriteProfiles = [] } = useQuery({
    queryKey: queryKeys.discoverSavedProfiles(viewerUserId ?? null),
    queryFn: () => fetchFavoriteProfiles(viewerUserId!),
    enabled: Boolean(viewerUserId),
    staleTime: 60_000,
  });

  const { data: commentedOwnCount = 0 } = useQuery({
    queryKey: ["community", "commentedOwnPostCount", viewerUserId],
    queryFn: () => fetchCommentedOwnPostCount(viewerUserId!),
    enabled: Boolean(viewerUserId),
    staleTime: 30_000,
  });

  const { data: acceptedRequestCount = 0 } = useQuery({
    queryKey: ["community", "acceptedRequestCount", viewerUserId],
    queryFn: () => fetchAcceptedRequestCount(viewerUserId!),
    enabled: Boolean(viewerUserId),
    staleTime: 30_000,
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
        aria-label="Saved profiles"
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
          aria-label="Add your story"
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
            Your story
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
                  ? `Clear filter for ${author.full_name ?? label}`
                  : `Show posts by ${author.full_name ?? label}`
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
          "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "px-1 md:px-0",
        )}
        role="tablist"
        aria-label="Filter posts by type"
      >
        {FILTER_TABS.map((tab) => {
          const selected =
            tab.id === activeFilter && !commentedFilterActive && !acceptedFilterActive;
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
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all sm:text-[13px]",
                selected ? tab.activeClass : tab.idleClass,
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
              {tab.label}
            </button>
          );
        })}

        {viewerUserId ? (
          <button
            type="button"
            role="tab"
            aria-selected={commentedFilterActive}
              onClick={() => {
                onAuthorFilterChange?.(null);
                onAcceptedFilterChange?.(false);
                onCommentedFilterChange?.(!commentedFilterActive);
              }}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all sm:text-[13px]",
              commentedFilterActive
                ? "border-transparent bg-sky-600 text-white shadow-md shadow-sky-900/15"
                : "border-sky-200/70 bg-sky-50/50 text-sky-700 hover:bg-sky-50 dark:border-sky-500/25 dark:bg-sky-950/20 dark:text-sky-300",
            )}
          >
            <MessageCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
            Commented
            {commentedOwnCount > 0 ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums",
                  commentedFilterActive ? "bg-white/20 text-white" : "bg-sky-600/15 text-sky-700 dark:text-sky-300",
                )}
              >
                {commentedOwnCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {viewerUserId ? (
          <button
            type="button"
            role="tab"
            aria-selected={acceptedFilterActive}
            onClick={() => {
              onAuthorFilterChange?.(null);
              onCommentedFilterChange?.(false);
              onAcceptedFilterChange?.(!acceptedFilterActive);
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition-all sm:text-[13px]",
              acceptedFilterActive
                ? "border-transparent bg-amber-600 text-white shadow-md shadow-amber-900/15"
                : "border-amber-200/70 bg-amber-50/50 text-amber-800 hover:bg-amber-50 dark:border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-300",
            )}
          >
            <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.75} aria-hidden />
            Accepted
            {acceptedRequestCount > 0 ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums",
                  acceptedFilterActive
                    ? "bg-white/20 text-white"
                    : "bg-amber-600/15 text-amber-800 dark:text-amber-300",
                )}
              >
                {acceptedRequestCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {viewerUserId && advancedFilters && onAdvancedFiltersChange ? (
          <>
            <CommunityFeedFilterButton
              filters={advancedFilters}
              onClick={() => setFilterDialogOpen(true)}
            />
            <CommunityFeedFilterDialog
              open={filterDialogOpen}
              onOpenChange={setFilterDialogOpen}
              filters={advancedFilters}
              onApply={onAdvancedFiltersChange}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
