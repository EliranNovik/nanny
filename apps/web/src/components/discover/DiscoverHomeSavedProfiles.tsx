import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarUrl } from "@/lib/imageTransform";
import { trackEvent } from "@/lib/analytics";
import { useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
import { discoverFavoriteCircleBadgeClass } from "@/components/discover/discoverRequestCarouselCardShared";

const favoriteImageShellClass =
  "relative mx-auto w-full shrink-0 aspect-square";

const imageWrapClass = cn(
  "h-full w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/60",
  "ring-1 ring-black/5 dark:ring-white/5 shadow-sm",
  "transition-transform duration-200 group-hover:shadow-md",
);

type SavedProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  role: string | null;
  average_rating: number | null;
  total_ratings: number | null;
  is_verified: boolean | null;
};

/**
 * "Your Favorites" carousel — all saved profiles for the current viewer.
 *
 * Round profile photo on top + data-below cards. Live helpers show a white "Available" pill on the image.
 */
const listContainerClass = cn(
  "flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 scroll-pl-4",
  "-mx-4 px-4 sm:-mx-0 sm:px-0 sm:scroll-pl-0",
);

const cardBtnClass = cn(
  "group flex flex-col items-center gap-1.5 text-center",
  "w-[7.25rem] shrink-0 snap-start",
  "sm:w-[8.25rem] md:w-[9rem] lg:w-[9.75rem] xl:w-[10.5rem]",
  "sm:gap-1 lg:gap-1.5",
  "focus-visible:outline-none",
);

const cardTextBelowClass =
  "flex w-full flex-col items-center gap-0.5 px-0 sm:gap-0 lg:gap-0.5";

const carouselArrowBtnClass = cn(
  "hidden md:inline-flex h-8 w-8 items-center justify-center rounded-full",
  "border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all",
  "hover:bg-zinc-100 hover:shadow active:scale-95",
  "dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
);

function useDiscoverSavedProfiles(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discoverSavedProfiles(userId ?? null),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<SavedProfileRow[]> => {
      if (!userId) return [];

      const { data: favs, error: favErr } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (favErr) throw favErr;

      const ids = (favs ?? []).map(
        (r: { favorite_user_id: string }) => r.favorite_user_id,
      );
      if (ids.length === 0) return [];

      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id, full_name, photo_url, city, role, average_rating, total_ratings, is_verified",
        )
        .in("id", ids);
      if (profErr) throw profErr;

      const byId = new Map<string, SavedProfileRow>(
        (profs ?? []).map((p: Record<string, unknown>) => [
          p.id as string,
          {
            id: p.id as string,
            full_name: (p.full_name as string | null) ?? null,
            photo_url: (p.photo_url as string | null) ?? null,
            city: (p.city as string | null) ?? null,
            role: (p.role as string | null) ?? null,
            average_rating:
              typeof p.average_rating === "number"
                ? (p.average_rating as number)
                : null,
            total_ratings:
              typeof p.total_ratings === "number"
                ? (p.total_ratings as number)
                : null,
            is_verified:
              typeof p.is_verified === "boolean" ? (p.is_verified as boolean) : null,
          },
        ]),
      );

      const ordered: SavedProfileRow[] = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (row) ordered.push(row);
      }
      return ordered;
    },
  });
}

type Props = {
  className?: string;
};

export function DiscoverHomeSavedProfiles({ className }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rows = [], isLoading: loading } = useDiscoverSavedProfiles(
    user?.id,
  );

  /**
   * Currently-live helper IDs (from the same cache the homepage uses).
   * A helper is "live within 24h" when `freelancer_profiles.live_until > now()`,
   * which is exactly what `useDiscoverLiveAvatars` filters on.
   */
  const { data: liveAvatarsPayload } = useDiscoverLiveAvatars(user?.id);
  const liveHelperIds = useMemo(() => {
    const ids = new Set<string>();
    for (const h of liveAvatarsPayload?.helpersForCards ?? []) {
      if (h?.helper_user_id) ids.add(h.helper_user_id);
    }
    return ids;
  }, [liveAvatarsPayload]);

  const visibleRows = useMemo(() => rows, [rows]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.85)) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  if (!user?.id) return null;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Your favorites">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            Your Favorites
          </h2>
        </div>
        <div className={listContainerClass}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex w-[7.75rem] shrink-0 snap-start flex-col gap-1 sm:w-[8.25rem] md:w-[9rem] lg:w-[9.75rem] xl:w-[10.5rem]"
            >
              <div className="aspect-square w-full animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="space-y-0.5 px-0">
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label="Your favorites">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
          Your Favorites
        </h2>
        <div className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label="Scroll previous"
            className={carouselArrowBtnClass}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label="Scroll next"
            className={carouselArrowBtnClass}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
      <div ref={scrollerRef} className={listContainerClass}>
        {visibleRows.map((p) => {
          const name = (p.full_name || "").trim() || "Member";
          const city = (p.city || "").trim();
          const rating =
            typeof p.average_rating === "number" && Number.isFinite(p.average_rating)
              ? p.average_rating
              : 0;
          const totalRatings =
            typeof p.total_ratings === "number" && Number.isFinite(p.total_ratings)
              ? Math.floor(p.total_ratings)
              : 0;
          const hasRating = totalRatings > 0 && rating > 0;
          const photoUrl = avatarUrl.sm(p.photo_url);
          const isLive = liveHelperIds.has(p.id);

          return (
            <button
              key={p.id}
              type="button"
              className={cardBtnClass}
              onClick={() => {
                trackEvent("discover_saved_profile_open", {
                  target_user_id: p.id,
                });
                navigate(`/profile/${encodeURIComponent(p.id)}`);
              }}
              aria-label={`Open profile of ${name}`}
            >
              <div className={favoriteImageShellClass}>
                <div className={imageWrapClass}>
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt=""
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="eager" decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200 dark:from-zinc-800 dark:via-zinc-800/70 dark:to-zinc-700/60">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={undefined} alt="" />
                        <AvatarFallback className="bg-zinc-200 text-base font-black text-zinc-700 dark:bg-zinc-800 dark:text-white">
                          {name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>

                {isLive ? (
                  <span className={discoverFavoriteCircleBadgeClass}>Available</span>
                ) : null}
              </div>

              <div className={cardTextBelowClass}>
                <span className="flex min-w-0 items-center justify-center gap-1">
                  <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-zinc-900 dark:text-white sm:text-[13px] lg:text-[16px] xl:text-[17px]">
                    {name}
                  </span>
                  {p.is_verified === true ? (
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 fill-emerald-500 text-white sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4"
                      strokeWidth={2.25}
                      aria-label="Verified"
                    />
                  ) : null}
                </span>
                {city ? (
                  <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                    {city}
                  </span>
                ) : null}
                {hasRating ? (
                  <span className="inline-flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                    <Star
                      className="h-3 w-3 fill-current text-amber-500 dark:text-amber-400 sm:h-2.5 sm:w-2.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4"
                      strokeWidth={0}
                      aria-hidden
                    />
                    <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                      {rating.toFixed(1)}
                    </span>
                    {totalRatings > 0 ? (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        ({totalRatings})
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
