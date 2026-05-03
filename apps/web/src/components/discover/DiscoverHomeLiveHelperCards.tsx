import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  CookingPot,
  Sparkles,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const MAX_BOXES = 5;

function categoryIconNode(
  categoryId: string,
  className = "h-4 w-4 shrink-0 stroke-[2.25]",
): ReactNode {
  if (categoryId === "cleaning") return <Sparkles className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  if (categoryId === "cooking") return <CookingPot className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  if (categoryId === "pickup_delivery") return <Truck className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  if (categoryId === "nanny") return <UsersRound className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  return <Wrench className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
}

const rowBtnClass = cn(
  "flex w-full items-stretch gap-3 rounded-[1.25rem] border-0 bg-zinc-100 p-4 text-left shadow-none ring-0 backdrop-blur-sm transition-all active:scale-[0.98]",
  "dark:border dark:border-zinc-500/35 dark:bg-zinc-700/90 dark:shadow-xl dark:ring-0 dark:backdrop-blur-xl dark:shadow-black/25",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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

  const visibleRows = useMemo(() => helpers.slice(0, MAX_BOXES), [helpers]);

  if (!loading && helpers.length === 0) return null;

  const seeMoreBtnClass = cn(
    "group mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-50/50 px-4 py-2 text-[12px] font-semibold tracking-wide text-zinc-500 shadow-none transition-all",
    "hover:border-zinc-300/90 hover:bg-zinc-100/70 hover:text-zinc-800 active:scale-[0.99]",
    "dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-400 dark:hover:border-white/18 dark:hover:bg-zinc-800/55 dark:hover:text-zinc-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Helper live near you">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Helper live near you
        </p>
        <div className="flex flex-col gap-2.5">
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
      <div className="flex flex-col gap-2.5">
        {visibleRows.map((h) => {
          const name = (h.full_name || "Helper").trim() || "Helper";
          const rating = h.average_rating != null && Number.isFinite(h.average_rating) ? h.average_rating : 0;
          const totalRatings =
            h.total_ratings != null && Number.isFinite(h.total_ratings) ? Math.floor(h.total_ratings) : 0;
          const respondTime = replyTimeCompactFragment(h.avg_reply_seconds, h.reply_sample_count);
          const readyTime = readyTimeCompactFragment(h.live_can_start_in);

          const showBadges = Boolean(respondTime || readyTime);

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
              <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 self-start sm:w-[5rem]">
                <div className="relative h-16 w-16 shrink-0">
                  <Avatar className="h-16 w-16 overflow-hidden shadow-md">
                    <AvatarImage src={h.photo_url || undefined} alt="" className="object-cover" />
                    <AvatarFallback className="bg-zinc-200 text-base font-black text-zinc-700 dark:bg-zinc-800 dark:text-white">
                      {name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <LiveAvatarDot />
                </div>
                <StarRating
                  rating={rating}
                  totalRatings={totalRatings}
                  size="sm"
                  showCount
                  className="max-w-full flex-col items-center gap-0.5"
                  starClassName="text-amber-500 dark:text-amber-400"
                  emptyStarClassName="text-zinc-300 dark:text-white/25"
                  numberClassName="text-amber-700 tabular-nums text-[11px] dark:text-amber-100"
                  countClassName="text-zinc-500 text-[10px] dark:text-white/55"
                />
              </div>
              <div
                className={cn(
                  "flex min-h-[5rem] min-w-0 flex-1 flex-col pt-0.5",
                  showBadges && "pr-[5.25rem] sm:pr-28",
                )}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate text-[17px] font-black leading-tight text-zinc-900 dark:text-white">{name}</span>
                </div>
                <p className="mt-0.5 truncate text-[15px] font-bold leading-tight text-zinc-600 dark:text-white/80">
                  {(h.location_line || "").trim() || "Location not set"}
                </p>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {h.live_category_ids.map((cid) => {
                    if (!isServiceCategoryId(cid)) return null;
                    const label = serviceCategoryLabel(cid);
                    return (
                      <span
                        key={cid}
                        className="inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-200/70 px-2.5 py-1 text-[13px] font-bold text-zinc-800 ring-0 dark:bg-white/10 dark:text-white/90 dark:ring-1 dark:ring-white/10"
                      >
                        {categoryIconNode(cid, "h-4 w-4 shrink-0 stroke-[2.25]")}
                        <span className="truncate">{label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              {showBadges ? (
                <div className="absolute right-11 top-3 z-[1] flex max-w-[min(11rem,calc(100%-5rem))] flex-col items-end gap-1 sm:right-12">
                  {respondTime ? (
                    <span className="shrink-0 rounded-full border-0 bg-violet-100/95 px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-tight text-violet-950 ring-0 dark:bg-violet-500/20 dark:text-violet-50 dark:ring-1 dark:ring-violet-400/35">
                      respond {respondTime}
                    </span>
                  ) : null}
                  {readyTime ? (
                    <span className="shrink-0 rounded-full border-0 bg-emerald-200/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-tight text-emerald-900 ring-0 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-1 dark:ring-emerald-400/25">
                      ready {readyTime}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div
                className="flex w-8 shrink-0 items-center justify-center self-stretch pl-0.5"
                aria-hidden
              >
                <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-white/70" />
              </div>
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
