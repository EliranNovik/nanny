import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, HelpCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/hooks/data/keys";
import { fetchDiscoverOffersForYou } from "@/lib/fetchDiscoverOffersForYou";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import { isolatedOfferPostPath } from "@/lib/profilePostShare";
import { haversineDistanceKm } from "@/lib/geo";
import { feedCategoryLabel, feedLocationDisplayLabel, type ViewerLocation } from "@/lib/globalFeedPostUi";
import {
  listingCityPart,
  localizedListingTitle,
} from "@/lib/localizedListingCopy";
import { requestHeroWaveToneClass } from "@/components/discover/DiscoverRequestHeroWaves";
import {
  HIRE_CATEGORY_TILE_UI,
  OTHER_HELP_SUBCATEGORY_UI,
  resolveHelpCategoryIconId,
} from "@/lib/discoverCategoryTileIcons";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import type { DiscoverHomeCategoryFilter } from "@/lib/discoverHomeCategoryFilter";
import { cn } from "@/lib/utils";

function OfferCategoryIcon({
  categoryId,
  customCategory,
  className,
}: {
  categoryId: string | null;
  customCategory?: string | null;
  className?: string;
}) {
  const id = resolveHelpCategoryIconId(categoryId, customCategory);
  const ui =
    (id ? OTHER_HELP_SUBCATEGORY_UI[id] : null) ??
    (id && isServiceCategoryId(id) ? HIRE_CATEGORY_TILE_UI[id] : null);
  const Icon = ui?.Icon ?? HelpCircle;
  return <Icon className={className} aria-hidden />;
}

export function DiscoverHomeOffersForYou({
  className,
  categoryFilter = "all",
  viewerLocation = null,
}: {
  className?: string;
  categoryFilter?: DiscoverHomeCategoryFilter;
  viewerLocation?: ViewerLocation | null;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: queryKeys.discoverOffersForYou(user?.id, 10),
    queryFn: () => fetchDiscoverOffersForYou(user?.id, 10),
    staleTime: 60_000,
  });

  const visibleOffers = useMemo(() => {
    if (categoryFilter === "all") return offers;
    if (categoryFilter === "other_help") {
      return offers.filter((offer) => {
        const id = (offer.categoryId ?? "").toLowerCase();
        const custom = (offer.customCategory ?? "").toLowerCase();
        return id === "other_help" || Boolean(OTHER_HELP_SUBCATEGORY_UI[id] || OTHER_HELP_SUBCATEGORY_UI[custom]);
      });
    }
    return offers.filter((offer) => offer.categoryId === categoryFilter);
  }, [offers, categoryFilter]);

  const openOffer = (postId: string) => {
    navigate(isolatedOfferPostPath(postId));
  };

  if (isLoading) {
    return (
      <section className={cn("w-full", className)} aria-label={t("discover.offersForYou")}>
        <div className="mb-5 h-7 w-40 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                <div className="h-5 w-52 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (offers.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label={t("discover.offersForYou")}>
      <h2 className="mb-5 text-[24px] font-black tracking-tight text-orange-700 dark:text-orange-400 sm:text-2xl">
        {t("discover.offersForYou")}
      </h2>

      {visibleOffers.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-[15px] font-semibold text-foreground sm:text-sm">
            {t("discover.noSortMatch", {
              sort: t(`discoverHome.filters.${categoryFilter}`),
            })}
          </p>
          <p className="mt-1 text-[15px] text-muted-foreground sm:text-sm">
            {t("discover.tryAnotherSort")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
          {visibleOffers.map((offer) => {
            const iconId = resolveHelpCategoryIconId(offer.categoryId, offer.customCategory);
            const viewerLat = viewerLocation?.lat;
            const viewerLng = viewerLocation?.lng;
            const hasCoords =
              offer.locationLat != null &&
              offer.locationLng != null &&
              typeof viewerLat === "number" &&
              typeof viewerLng === "number" &&
              Number.isFinite(viewerLat) &&
              Number.isFinite(viewerLng);
            const km = hasCoords
              ? haversineDistanceKm(viewerLat, viewerLng, offer.locationLat!, offer.locationLng!)
              : null;
            const localizedLocation = feedLocationDisplayLabel(
              t,
              listingCityPart(offer.locationLabel),
            );
            const offerTitle = localizedListingTitle(t, {
              kind: "offer",
              categoryLabel: feedCategoryLabel(t, offer.categoryId, offer.customCategory),
              location: localizedLocation,
            }) || offer.title;
            const locationLine = localizedLocation
              ? km != null
                ? t("discover.offerLocationFromYou", {
                    location: localizedLocation,
                    km: km.toFixed(1),
                  })
                : localizedLocation
              : null;
            const timeAgo = formatDistanceToNow(new Date(offer.createdAt), {
              addSuffix: true,
              locale: dateFnsLocaleFor(i18n.language),
            });

            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => openOffer(offer.id)}
                className={cn(
                  "flex w-full items-center gap-3.5 text-left sm:gap-3",
                  "outline-none transition-opacity active:opacity-80",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800">
                  {offer.imageUrl ? (
                    <img
                      src={offer.imageUrl}
                      alt=""
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex h-full w-full items-center justify-center",
                        requestHeroWaveToneClass(iconId ?? offer.categoryId),
                        "text-white",
                      )}
                    >
                      <OfferCategoryIcon
                        categoryId={offer.categoryId}
                        customCategory={offer.customCategory}
                        className="h-10 w-10 text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-orange-700 dark:text-orange-400 sm:text-[13px]">
                    <OfferCategoryIcon
                      categoryId={offer.categoryId}
                      customCategory={offer.customCategory}
                      className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5"
                    />
                    <span className="truncate">
                      {feedCategoryLabel(t, offer.categoryId, offer.customCategory)}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug text-zinc-900 dark:text-white sm:text-[16px]">
                    {offerTitle}
                  </p>
                  {locationLine ? (
                    <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
                      {locationLine}
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
                    {offer.authorName} • {timeAgo}
                  </p>
                </div>

                <ChevronRight
                  className="h-6 w-6 shrink-0 text-zinc-300 rtl-flip-icon dark:text-zinc-600 sm:h-5 sm:w-5"
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
