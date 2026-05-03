import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Clock,
  CookingPot,
  MessageCircle,
  Sparkles,
  Truck,
  UsersRound,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { trackEvent } from "@/lib/analytics";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import {
  buildHelpersPageUrlForFocusedHelper,
  CLIENT_HELPERS_PAGE_PATH,
} from "@/lib/clientAppPaths";
import { readyTimeCompactFragment, replyTimeCompactFragment } from "@/lib/liveCanStart";
import type { DiscoverLiveHelperCardEntry } from "@/hooks/data/useDiscoverFeed";
import { LiveAvatarDot } from "@/components/discover/LiveAvatarDot";
import { DiscoverProfileSaveBadge } from "@/components/discover/DiscoverProfileSaveBadge";

const MAX_BOXES = 5;

const categoryIconTint = "text-violet-600 dark:text-violet-300";

function categoryIconNode(
  categoryId: string,
  className = "h-4 w-4 shrink-0 stroke-[2.25]",
): ReactNode {
  if (categoryId === "cleaning") return <Sparkles className={cn(className, categoryIconTint)} aria-hidden />;
  if (categoryId === "cooking") return <CookingPot className={cn(className, categoryIconTint)} aria-hidden />;
  if (categoryId === "pickup_delivery") return <Truck className={cn(className, categoryIconTint)} aria-hidden />;
  if (categoryId === "nanny") return <UsersRound className={cn(className, categoryIconTint)} aria-hidden />;
  return <Wrench className={cn(className, categoryIconTint)} aria-hidden />;
}

const listGridClass =
  "grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3";

const rowBtnClass = cn(
  "flex min-w-0 w-full flex-col gap-2 rounded-[1.25rem] border-0 bg-zinc-50 p-4 text-left shadow-sm ring-0 backdrop-blur-sm transition-all hover:bg-zinc-50/90 hover:shadow-md active:scale-[0.98]",
  "dark:border dark:border-zinc-500/35 dark:bg-zinc-700/90 dark:shadow-xl dark:ring-0 dark:backdrop-blur-xl dark:shadow-black/25",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const rowTopClass = "relative flex min-w-0 w-full items-start gap-3";

const respondBadgeClass = cn(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 pl-1.5 shadow-sm",
  "border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-violet-100/50 text-violet-950",
  "dark:border-violet-500/25 dark:from-violet-950/50 dark:via-zinc-800/90 dark:to-violet-900/30 dark:text-violet-50 dark:shadow-black/20",
);

const readyBadgeClass = cn(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 pl-1.5 shadow-sm",
  "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 text-emerald-950",
  "dark:border-emerald-500/25 dark:from-emerald-950/45 dark:via-zinc-800/90 dark:to-emerald-900/25 dark:text-emerald-50 dark:shadow-black/20",
);

type Props = {
  helpers: DiscoverLiveHelperCardEntry[];
  loading?: boolean;
  className?: string;
};

export function DiscoverHomeLiveHelperCards({
  helpers,
  loading = false,
  className,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profileFavoriteRows = [] } = useQuery({
    queryKey: queryKeys.profileFavorites(user?.id ?? null),
    queryFn: async () => {
      const uid = user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", uid);
      if (error) throw error;
      return (data ?? []) as { favorite_user_id: string }[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const favoriteUserIds = useMemo(
    () => new Set(profileFavoriteRows.map((r) => r.favorite_user_id)),
    [profileFavoriteRows],
  );

  const visibleRows = useMemo(() => helpers.slice(0, MAX_BOXES), [helpers]);

  if (!loading && helpers.length === 0) return null;

  const seeMoreBtnClass = cn(
    "group mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-50/50 px-4 py-2 text-[12px] font-semibold tracking-wide text-zinc-500 shadow-none transition-all",
    "hover:border-zinc-300/90 hover:bg-zinc-200/35 hover:text-zinc-800 active:scale-[0.99]",
    "dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-400 dark:hover:border-white/18 dark:hover:bg-zinc-800/55 dark:hover:text-zinc-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Helper live near you">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Helper live near you
        </p>
        <div className={listGridClass}>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-[6.25rem] animate-pulse rounded-[1.25rem] bg-zinc-200/80 dark:bg-zinc-800/80"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("w-full", className)} aria-label="Helper live near you">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Helper live near you
      </p>
      <div className={listGridClass}>
        {visibleRows.map((h) => {
          const name = (h.full_name || "Helper").trim() || "Helper";
          const rating = h.average_rating != null && Number.isFinite(h.average_rating) ? h.average_rating : 0;
          const totalRatings =
            h.total_ratings != null && Number.isFinite(h.total_ratings) ? Math.floor(h.total_ratings) : 0;
          const respondTime = replyTimeCompactFragment(h.avg_reply_seconds, h.reply_sample_count);
          const readyTime = readyTimeCompactFragment(h.live_can_start_in);

          const showBadges = Boolean(respondTime || readyTime);
          const categoryIds = h.live_category_ids.filter(isServiceCategoryId);

          return (
            <button
              key={h.helper_user_id}
              type="button"
              className={cn(rowBtnClass, "relative")}
              onClick={() => {
                trackEvent("discover_live_helper_card_open", {
                  helper_user_id: h.helper_user_id,
                });
                navigate(
                  buildHelpersPageUrlForFocusedHelper(h.helper_user_id, {
                    lat: h.location_lat,
                    lng: h.location_lng,
                  }),
                );
              }}
            >
              <div className={rowTopClass}>
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center self-start sm:w-[5rem]">
                  <div className="relative inline-flex shrink-0">
                    <div className="relative h-16 w-16 shrink-0">
                      <Avatar className="h-16 w-16 overflow-hidden shadow-md">
                        <AvatarImage src={h.photo_url || undefined} alt="" className="object-cover" />
                        <AvatarFallback className="bg-zinc-200 text-base font-black text-zinc-700 dark:bg-zinc-800 dark:text-white">
                          {name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <LiveAvatarDot />
                    </div>
                    <DiscoverProfileSaveBadge
                      targetUserId={h.helper_user_id}
                      accent="hire"
                      viewerUserId={user?.id}
                      favoriteUserIds={favoriteUserIds}
                      analyticsEvent="discover_live_helper_save_profile"
                    />
                  </div>
                </div>
                <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                  {showBadges ? (
                    <div className="pointer-events-none absolute right-0 top-0 z-[1] flex flex-col items-end gap-1.5">
                      {readyTime ? (
                        <span className={cn(readyBadgeClass, "pointer-events-auto shrink-0")} title={`Can start ${readyTime}`}>
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/15 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/20"
                            aria-hidden
                          >
                            {readyTime === "now" ? (
                              <Zap className="h-3.5 w-3.5" strokeWidth={2.35} />
                            ) : (
                              <Clock className="h-3.5 w-3.5" strokeWidth={2.35} />
                            )}
                          </span>
                          <span className="flex min-w-0 flex-col items-start gap-0 pr-0.5 leading-none">
                            <span className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700/90 dark:text-emerald-300/90">
                              Start
                            </span>
                            <span className="text-[12px] font-black tabular-nums tracking-tight text-emerald-950 dark:text-white">
                              {readyTime}
                            </span>
                          </span>
                        </span>
                      ) : null}
                      {respondTime ? (
                        <span className={cn(respondBadgeClass, "pointer-events-auto shrink-0")} title={`Typical reply ${respondTime}`}>
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/15 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/20"
                            aria-hidden
                          >
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.35} />
                          </span>
                          <span className="flex min-w-0 flex-col items-start gap-0 pr-0.5 leading-none">
                            <span className="text-[8px] font-black uppercase tracking-[0.14em] text-violet-600/85 dark:text-violet-300/90">
                              Reply
                            </span>
                            <span className="text-[12px] font-black tabular-nums tracking-tight text-violet-950 dark:text-white">
                              {respondTime}
                            </span>
                          </span>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "flex min-w-0 flex-col gap-1.5",
                      showBadges && "pr-[6.75rem] sm:pr-[7.25rem]",
                    )}
                  >
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="min-w-0 truncate text-[17px] font-black leading-tight text-zinc-900 dark:text-white">
                        {name}
                      </span>
                      <span className="min-w-0 truncate text-[14px] font-bold leading-tight text-zinc-600 dark:text-white/75">
                        {(h.location_line || "").trim() || "Location not set"}
                      </span>
                    </div>
                  <StarRating
                    rating={rating}
                    totalRatings={totalRatings}
                    size="sm"
                    showCount
                    className="max-w-full shrink-0 items-center justify-start"
                    starClassName="text-amber-500 dark:text-amber-400"
                    emptyStarClassName="text-zinc-300 dark:text-white/25"
                    numberClassName="text-amber-700 tabular-nums text-[11px] dark:text-amber-100"
                    countClassName="text-zinc-500 text-[10px] dark:text-white/55"
                  />
                  </div>
                </div>
                <div
                  className="flex w-8 shrink-0 items-center justify-center self-start py-0.5 pl-0.5"
                  aria-hidden
                >
                  <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-white/70" />
                </div>
              </div>
              {categoryIds.length > 0 ? (
                <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-1.5">
                  {categoryIds.map((cid) => {
                    const label = serviceCategoryLabel(cid);
                    return (
                      <span
                        key={cid}
                        className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1 rounded-full bg-zinc-200/70 px-2.5 py-1 text-[11px] font-bold text-zinc-800 ring-0 dark:bg-white/10 dark:text-white/90 dark:ring-1 dark:ring-white/10"
                      >
                        {categoryIconNode(cid, "h-3.5 w-3.5 shrink-0 stroke-[2.25]")}
                        <span className="truncate">{label}</span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      {visibleRows.length > 0 ? (
        <button
          type="button"
          className={seeMoreBtnClass}
          aria-label="Show more helpers on Find helpers"
          onClick={() => {
            trackEvent("discover_helpers_browse", { from: "discover_live_helper_cards" });
            trackEvent("discover_live_helper_cards_show_more", {
              from: "discover_home",
              total_live: helpers.length,
            });
            navigate(CLIENT_HELPERS_PAGE_PATH);
          }}
        >
          Show more
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-80"
            aria-hidden
          />
        </button>
      ) : null}
    </section>
  );
}
