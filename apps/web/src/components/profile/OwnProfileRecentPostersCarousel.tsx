import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { fetchGlobalFeedRecentPosters } from "@/lib/globalFeedRecentPosters";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const CAROUSEL_FETCH_LIMIT = 30;
const CAROUSEL_DISPLAY_LIMIT = 10;

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
      <div
        className={cn(
          "flex justify-center bg-slate-100 py-6 dark:bg-background",
          className,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (visiblePosters.length === 0) return null;

  return (
    <section
      className={cn(
        "border-b border-slate-200/60 bg-slate-100 px-4 py-4 dark:border-white/5 dark:bg-background",
        className,
      )}
      aria-label={t("profile.recentPostersCarousel")}
    >
      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory [touch-action:pan-x_pan-y] overscroll-x-contain",
        )}
        role="list"
      >
        {visiblePosters.map((poster) => {
          const label = poster.full_name?.trim()?.split(" ")[0] || "Member";
          const displayName = poster.full_name?.trim() || label;
          const savingFavorite = savingFavoriteId === poster.id;

          return (
            <div
              key={poster.id}
              role="listitem"
              className={cn(
                "flex w-[7.75rem] shrink-0 snap-start flex-col items-center gap-2.5 rounded-2xl px-2.5 py-3",
                "border border-slate-200/70 bg-white shadow-sm",
                "dark:border-0 dark:bg-zinc-800 dark:shadow-none",
              )}
            >
              <button
                type="button"
                onClick={() => navigate(`/profile/${poster.id}`)}
                className={cn(
                  "group flex w-full flex-col items-center gap-2 outline-none",
                  "transition-transform active:scale-[0.97]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                aria-label={t("feed.global.viewProfile", { name: displayName })}
              >
                <Avatar className="h-[5.5rem] w-[5.5rem] border-0 shadow-none ring-0">
                  <AvatarImage
                    src={poster.photo_url ?? undefined}
                    alt=""
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <AvatarFallback className="bg-zinc-200 text-xl font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {label.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
              </button>

              <button
                type="button"
                onClick={() => void saveAuthorToFavorites(poster.id)}
                disabled={savingFavorite}
                className={cn(
                  "inline-flex h-8 w-full items-center justify-center rounded-full px-2",
                  "bg-orange-600 text-[11px] font-bold lowercase text-white shadow-sm",
                  "transition-all hover:bg-orange-700 active:scale-[0.97] disabled:opacity-80",
                )}
              >
                {savingFavorite ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  t("profile.addAsFavorite")
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
