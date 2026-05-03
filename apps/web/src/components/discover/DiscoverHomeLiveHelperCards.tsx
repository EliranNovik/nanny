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
import { canStartInCardLabel, respondsWithinCardLabel } from "@/lib/liveCanStart";
import type { DiscoverLiveHelperCardEntry } from "@/hooks/data/useDiscoverFeed";

const MAX_BOXES = 5;

function categoryIconNode(
  categoryId: string,
  className = "h-4 w-4 shrink-0 stroke-[2.25]",
): ReactNode {
  if (categoryId === "cleaning") return <Sparkles className={cn(className, "text-emerald-300")} aria-hidden />;
  if (categoryId === "cooking") return <CookingPot className={cn(className, "text-emerald-300")} aria-hidden />;
  if (categoryId === "pickup_delivery") return <Truck className={cn(className, "text-emerald-300")} aria-hidden />;
  if (categoryId === "nanny") return <UsersRound className={cn(className, "text-emerald-300")} aria-hidden />;
  return <Wrench className={cn(className, "text-emerald-300")} aria-hidden />;
}

const rowBtnClass = cn(
  "flex w-full items-stretch gap-3 rounded-[1.25rem] border border-zinc-700/40 bg-zinc-900/90 p-4 text-left shadow-xl backdrop-blur-xl transition-all active:scale-[0.98]",
  "dark:border-zinc-500/35 dark:bg-zinc-700/90 dark:shadow-black/25",
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
    "mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-[13px] font-black uppercase tracking-wide text-emerald-800 transition-all active:scale-[0.99] dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
    "hover:bg-emerald-500/15 dark:hover:bg-emerald-500/25",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Helpers live now">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Helpers live now
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
    <section className={cn("w-full", className)} aria-label="Helpers live now">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Helpers live now
      </p>
      <div className="flex flex-col gap-2.5">
        {visibleRows.map((h) => {
          const name = (h.full_name || "Helper").trim() || "Helper";
          const rating = h.average_rating != null && Number.isFinite(h.average_rating) ? h.average_rating : 0;
          const totalRatings =
            h.total_ratings != null && Number.isFinite(h.total_ratings) ? Math.floor(h.total_ratings) : 0;
          const responds = respondsWithinCardLabel(h.avg_reply_seconds, h.reply_sample_count);
          const readyLabel = canStartInCardLabel(h.live_can_start_in);

          return (
            <button
              key={h.helper_user_id}
              type="button"
              className={rowBtnClass}
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
                <Avatar className="h-16 w-16 overflow-hidden shadow-md">
                  <AvatarImage src={h.photo_url || undefined} alt="" className="object-cover" />
                  <AvatarFallback className="bg-zinc-800 text-base font-black text-white">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <StarRating
                  rating={rating}
                  totalRatings={totalRatings}
                  size="sm"
                  showCount
                  className="max-w-full flex-col items-center gap-0.5"
                  starClassName="text-amber-400"
                  emptyStarClassName="text-white/25"
                  numberClassName="text-amber-100 tabular-nums text-[10px]"
                  countClassName="text-white/55 text-[9px]"
                />
              </div>
              <div className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col pt-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate text-[15px] font-black leading-tight text-white">{name}</span>
                </div>
                <p className="mt-0.5 truncate text-[13px] font-bold leading-tight text-white/80">
                  {(h.location_line || "").trim() || "Location not set"}
                </p>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {h.live_category_ids.map((cid) => {
                    if (!isServiceCategoryId(cid)) return null;
                    const label = serviceCategoryLabel(cid);
                    return (
                      <span
                        key={cid}
                        className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90 ring-1 ring-white/10"
                      >
                        {categoryIconNode(cid, "h-3.5 w-3.5 shrink-0 stroke-[2.25]")}
                        <span className="truncate">{label}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="mt-auto flex flex-wrap justify-end gap-1.5 pt-2">
                  {responds ? (
                    <span className="shrink-0 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/85 ring-1 ring-white/10">
                      Responds within {responds}
                    </span>
                  ) : null}
                  {readyLabel ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/25">
                      Ready in {readyLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div
                className="flex w-8 shrink-0 items-center justify-center self-stretch pl-0.5"
                aria-hidden
              >
                <ChevronRight className="h-5 w-5 text-white/70" />
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
          <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        </button>
      ) : null}
    </section>
  );
}
