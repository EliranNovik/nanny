import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { discoverMobileSheetBottomOffset } from "@/lib/discoverSheetDialog";
import { useCommunityFeedOverlayLock } from "@/hooks/useCommunityFeedOverlayLock";

type FavoriteProfile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
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

  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url")
    .in("id", ids);
  if (profileErr) throw profileErr;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        photo_url: (p.photo_url as string | null) ?? null,
      },
    ]),
  );

  return ids
    .map((id) => profileMap.get(id))
    .filter(Boolean) as FavoriteProfile[];
}

type GlobalFeedMobileTebnuMenuProps = {
  viewerUserId: string;
  className?: string;
};

/** Mobile global feed header: centred tebnu brand opens My favorites. */
export function GlobalFeedMobileTebnuMenu({
  viewerUserId,
  className,
}: GlobalFeedMobileTebnuMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);

  useCommunityFeedOverlayLock(favoritesOpen);

  const { data: favoriteProfiles = [], isLoading: favoritesLoading } = useQuery({
    queryKey: queryKeys.discoverSavedProfiles(viewerUserId),
    queryFn: () => fetchFavoriteProfiles(viewerUserId),
    enabled: favoritesOpen,
    staleTime: 60_000,
  });

  function openFavoriteProfile(profileId: string) {
    setFavoritesOpen(false);
    navigate(`/profile/${profileId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFavoritesExpanded(true);
          setFavoritesOpen(true);
        }}
        className={cn(
          "inline-flex items-center rounded-lg px-1 py-0.5",
          "text-[1.625rem] font-black lowercase tracking-tight text-foreground transition-opacity active:opacity-80",
          className,
        )}
        aria-label={t("feed.global.myFavorites")}
      >
        tebnu
      </button>

      {favoritesOpen
        ? createPortal(
            <MobileSnapBottomSheet
              expanded={favoritesExpanded}
              onExpandedChange={(next) => {
                setFavoritesExpanded(next);
                if (!next) setFavoritesOpen(false);
              }}
              onDismiss={() => setFavoritesOpen(false)}
              bottomOffsetClass={discoverMobileSheetBottomOffset}
              className="z-[9999]"
              maxHeight="min(85dvh, 560px)"
              ariaLabel={t("feed.global.myFavorites")}
              collapsed={
                <div className="flex w-full flex-col bg-background px-5 pb-2 pt-3">
                  <div
                    aria-hidden
                    className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/35"
                  />
                  <p className="text-base font-bold text-foreground">
                    {t("feed.global.myFavorites")}
                  </p>
                </div>
              }
            >
              <div className="flex min-h-0 flex-col bg-background px-5 pb-6">
                {favoritesLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("common.loading")}
                  </p>
                ) : favoriteProfiles.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("feed.global.noFavoriteProfiles")}
                  </p>
                ) : (
                  <ul className="max-h-[min(60dvh,420px)] space-y-1 overflow-y-auto overscroll-contain">
                    {favoriteProfiles.map((profile) => {
                      const label = profile.full_name?.trim() || "Member";
                      return (
                        <li key={profile.id}>
                          <button
                            type="button"
                            onClick={() => openFavoriteProfile(profile.id)}
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted/80"
                          >
                            <Avatar className="h-11 w-11 shrink-0">
                              <AvatarImage src={profile.photo_url ?? undefined} alt="" />
                              <AvatarFallback className="text-sm font-bold">
                                {label.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
                              {label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </MobileSnapBottomSheet>,
            document.body,
          )
        : null}
    </>
  );
}
