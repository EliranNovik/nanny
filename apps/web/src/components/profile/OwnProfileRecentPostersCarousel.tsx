import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { fetchGlobalFeedRecentPosters } from "@/lib/globalFeedRecentPosters";
import { feedLocationDisplayLabel } from "@/lib/globalFeedPostUi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithLiveDot } from "@/components/AvatarWithLiveDot";
import { StarRating } from "@/components/StarRating";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const CAROUSEL_FETCH_LIMIT = 30;
const CAROUSEL_DISPLAY_LIMIT = 10;

const posterCardClass = cn(
  "flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl text-center",
  "w-[7.25rem] bg-zinc-50 dark:w-[8.5rem] dark:bg-zinc-800",
);
const posterPhotoClass = "relative aspect-square w-full overflow-hidden";

type OwnProfileRecentPostersCarouselProps = {
  viewerUserId: string;
  className?: string;
};

export function OwnProfileRecentPostersCarousel({
  viewerUserId,
  className,
}: OwnProfileRecentPostersCarouselProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [savingFavoriteId, setSavingFavoriteId] = useState<string | null>(null);

  const { data: posters = [], isLoading: postersLoading } = useQuery({
    queryKey: queryKeys.globalFeedRecentPosters(viewerUserId, CAROUSEL_FETCH_LIMIT),
    queryFn: () => fetchGlobalFeedRecentPosters(viewerUserId, CAROUSEL_FETCH_LIMIT),
    staleTime: 5 * 60_000,
  });

  const { data: profileFavoriteRows = [], isLoading: favoritesLoading } = useQuery({
    queryKey: queryKeys.profileFavorites(viewerUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", viewerUserId);
      if (error) throw error;
      return (data ?? []) as { favorite_user_id: string }[];
    },
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

  const visiblePosters = useMemo(
    () =>
      posters
        .filter((poster) => !favoriteAuthorIds.has(poster.id))
        .slice(0, CAROUSEL_DISPLAY_LIMIT),
    [posters, favoriteAuthorIds],
  );

  async function saveAuthorToFavorites(authorId: string) {
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
      console.error("[OwnProfileRecentPostersCarousel] save favorite", err);
      addToast({ title: t("feed.global.couldNotSaveProfile"), variant: "error" });
    } finally {
      setSavingFavoriteId(null);
    }
  }

  const isLoading = postersLoading || favoritesLoading;

  if (isLoading) {
    return (
      <div className={cn("flex justify-center py-6", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (visiblePosters.length === 0) return null;

  return (
    <section
      className={cn("px-4 py-4", className)}
      aria-label={t("profile.recentPostersCarousel")}
    >
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-1 dark:gap-3",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-proximity [touch-action:pan-x_pan-y] overscroll-x-contain",
        )}
        role="list"
      >
        {visiblePosters.map((poster) => {
          const label = poster.full_name?.trim()?.split(" ")[0] || "Member";
          const displayName = poster.full_name?.trim() || label;
          const savingFavorite = savingFavoriteId === poster.id;
          const locationLabel = feedLocationDisplayLabel(t, poster.city);

          return (
            <div key={poster.id} role="listitem" className={posterCardClass}>
              <div className={posterPhotoClass}>
                <button
                  type="button"
                  onClick={() => navigate(`/profile/${poster.id}`)}
                  className={cn(
                    "group h-full w-full outline-none transition-transform active:scale-[0.97]",
                    "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  title={displayName}
                  aria-label={t("feed.global.viewProfile", { name: displayName })}
                >
                  <AvatarWithLiveDot
                    liveUntil={poster.live_until}
                    className="block h-full w-full"
                    dotClassName="bottom-auto right-auto top-1.5 left-1.5 border-0"
                  >
                    <Avatar className="h-full w-full rounded-none border-0 shadow-none ring-0 !rounded-none">
                      <AvatarImage
                        src={poster.photo_url ?? undefined}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <AvatarFallback className="rounded-none bg-zinc-100 text-xl font-bold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
                        {label.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </AvatarWithLiveDot>
                </button>
                <button
                  type="button"
                  onClick={() => void saveAuthorToFavorites(poster.id)}
                  disabled={savingFavorite}
                  className={cn(
                    "absolute bottom-1.5 right-1.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full",
                    "border-0 bg-zinc-500 text-white shadow-sm outline-none ring-0",
                    "hover:bg-zinc-600 dark:bg-zinc-500 dark:text-white dark:hover:bg-zinc-400",
                    "transition-transform hover:scale-105 active:scale-95 disabled:opacity-80",
                  )}
                  aria-label={t("feed.global.saveProfile", { name: displayName })}
                >
                  {savingFavorite ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={3} aria-hidden />
                  )}
                </button>
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
        })}
      </div>
    </section>
  );
}
