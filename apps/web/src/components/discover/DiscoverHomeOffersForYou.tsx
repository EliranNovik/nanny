import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BadgeCheck, ChevronRight, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { ListingImageSaveButton } from "@/components/discover/ListingImageSaveButton";
import { fetchDiscoverOffersForYou } from "@/lib/fetchDiscoverOffersForYou";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import { isolatedOfferPostPath } from "@/lib/profilePostShare";
import { haversineDistanceKm } from "@/lib/geo";
import { feedCategoryLabel, feedLocationDisplayLabel, type ViewerLocation } from "@/lib/globalFeedPostUi";
import {
  listingCityPart,
  localizedListingTitle,
} from "@/lib/localizedListingCopy";
import { categoryIllustrationSrc, OTHER_HELP_SUBCATEGORY_UI } from "@/lib/discoverCategoryTileIcons";
import type { DiscoverHomeCategoryFilter, DiscoverHomeListingSort, DiscoverHomeListingFilters } from "@/lib/discoverHomeCategoryFilter";
import { matchesListingFilters, EMPTY_LISTING_FILTERS } from "@/lib/discoverHomeCategoryFilter";
import { cn } from "@/lib/utils";
import { HomeListingSortButton } from "@/components/discover/HomeListingSortButton";

const HOME_LISTING_GRID_CLASS =
  "grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-x-5 md:gap-y-6 xl:grid-cols-4 min-[1440px]:grid-cols-5";

function HomeListingCardSkeleton({ tone }: { tone: "orange" | "emerald" }) {
  const accent = tone === "orange" ? "bg-orange-100 dark:bg-orange-500/15" : "bg-emerald-100 dark:bg-emerald-500/15";
  const button = tone === "orange" ? "bg-orange-200/80 dark:bg-orange-500/25" : "bg-emerald-200/80 dark:bg-emerald-500/25";
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-[20px] bg-white pe-3 shadow-[0_5px_20px_rgba(15,23,42,0.08)] dark:bg-[#1d1f21] md:flex-col md:items-stretch md:pe-0">
      <div className="h-[112px] w-[112px] shrink-0 animate-pulse bg-zinc-200 dark:bg-zinc-800 md:aspect-[4/3] md:h-auto md:w-full" />
      <div className="min-w-0 flex-1 space-y-2 py-1 md:px-4 md:pb-4 md:pt-3.5">
        <div className={cn("h-6 w-24 animate-pulse rounded-full", accent)} />
        <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-700/80" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700/60" />
        {tone === "emerald" ? (
          <div className="hidden gap-2 pt-1 md:flex">
            <div className={cn("h-10 flex-[2] animate-pulse rounded-full", button)} />
            <div className="h-10 w-16 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function listingNameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function trimUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function DiscoverHomeOffersForYou({
  className,
  categoryFilter = "all",
  otherSubFilter = null,
  viewerLocation = null,
  listingSort = "newest",
  onListingSortChange,
  listingFilters = EMPTY_LISTING_FILTERS,
  onListingFiltersChange,
  showSortButton = true,
}: {
  className?: string;
  categoryFilter?: DiscoverHomeCategoryFilter;
  otherSubFilter?: string | null;
  viewerLocation?: ViewerLocation | null;
  listingSort?: DiscoverHomeListingSort;
  onListingSortChange?: (next: DiscoverHomeListingSort) => void;
  listingFilters?: DiscoverHomeListingFilters;
  onListingFiltersChange?: (next: DiscoverHomeListingFilters) => void;
  showSortButton?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { user, profile } = useAuth();
  const [savingOfferId, setSavingOfferId] = useState<string | null>(null);
  const isAdmin = profile?.is_admin === true;
  const offerLimit = isAdmin ? 200 : 10;
  const excludeUserId = isAdmin ? null : user?.id;

  const { data: savedOfferIds = new Set<string>() } = useQuery({
    queryKey: queryKeys.profilePostSaves(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_post_likes")
        .select("post_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.post_id as string));
    },
  });

  const toggleOfferSave = async (offerId: string) => {
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    const saved = savedOfferIds.has(offerId);
    setSavingOfferId(offerId);
    try {
      if (saved) {
        const { error } = await supabase
          .from("profile_post_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", offerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_post_likes")
          .insert({ user_id: user.id, post_id: offerId });
        if (error) throw error;
      }
      queryClient.setQueryData<Set<string>>(queryKeys.profilePostSaves(user.id), (prev) => {
        const next = new Set(prev ?? []);
        if (saved) next.delete(offerId);
        else next.add(offerId);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["community", "profilePostsFeed"] });
      addToast({
        title: saved ? "Removed from saved" : "Offer saved",
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSavingOfferId(null);
    }
  };

  const { data: offers = [], isLoading } = useQuery({
    queryKey: queryKeys.discoverOffersForYou(excludeUserId, offerLimit),
    queryFn: () => fetchDiscoverOffersForYou(excludeUserId, offerLimit),
    staleTime: 60_000,
  });

  const visibleOffers = useMemo(() => {
    if (categoryFilter === "all") return offers;
    if (categoryFilter === "other_help") {
      return offers.filter((offer) => {
        const id = (offer.categoryId ?? "").toLowerCase();
        const custom = (offer.customCategory ?? "").toLowerCase();
        if (otherSubFilter) {
          return id === otherSubFilter || custom === otherSubFilter;
        }
        return (
          id === "other_help" ||
          Boolean(OTHER_HELP_SUBCATEGORY_UI[id] || OTHER_HELP_SUBCATEGORY_UI[custom])
        );
      });
    }
    return offers.filter(
      (offer) =>
        (offer.categoryId ?? "").toLowerCase() === categoryFilter ||
        (offer.customCategory ?? "").toLowerCase() === categoryFilter,
    );
  }, [offers, categoryFilter, otherSubFilter]);

  const filteredOffers = useMemo(() => {
    const lat = viewerLocation?.lat;
    const lng = viewerLocation?.lng;
    return visibleOffers.filter((offer) => {
      const distanceKm =
        offer.locationLat != null &&
        offer.locationLng != null &&
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
          ? haversineDistanceKm(lat, lng, offer.locationLat, offer.locationLng)
          : null;
      return matchesListingFilters(
        {
          createdAt: offer.createdAt,
          when: null,
          categoryId: offer.categoryId,
          customCategory: offer.customCategory,
          rating: offer.authorRating,
          distanceKm,
        },
        listingFilters,
      );
    });
  }, [listingFilters, viewerLocation, visibleOffers]);

  const sortedOffers = useMemo(() => {
    const postedAt = (offer: (typeof visibleOffers)[number]) =>
      new Date(offer.createdAt).getTime();
    const distanceKm = (offer: (typeof visibleOffers)[number]) => {
      const lat = viewerLocation?.lat;
      const lng = viewerLocation?.lng;
      if (
        offer.locationLat == null ||
        offer.locationLng == null ||
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return null;
      }
      return haversineDistanceKm(lat, lng, offer.locationLat, offer.locationLng);
    };
    return [...filteredOffers].sort((a, b) => {
      if (listingSort === "oldest") return postedAt(a) - postedAt(b);
      if (listingSort === "reviews") {
        const ratingDiff = (b.authorRating ?? -1) - (a.authorRating ?? -1);
        if (ratingDiff !== 0) return ratingDiff;
        return postedAt(b) - postedAt(a);
      }
      if (listingSort === "category") {
        return feedCategoryLabel(t, a.categoryId, a.customCategory).localeCompare(
          feedCategoryLabel(t, b.categoryId, b.customCategory),
        );
      }
      if (listingSort === "nearest") {
        const aKm = distanceKm(a);
        const bKm = distanceKm(b);
        if (aKm == null && bKm == null) return postedAt(b) - postedAt(a);
        if (aKm == null) return 1;
        if (bKm == null) return -1;
        return aKm - bKm;
      }
      return postedAt(b) - postedAt(a);
    });
  }, [filteredOffers, listingSort, t, viewerLocation]);

  const openOffer = (postId: string) => {
    navigate(isolatedOfferPostPath(postId));
  };

  if (isLoading) {
    return (
      <section className={cn("w-full", className)} aria-label={t("discover.offersForYou")}>
        <div className="mb-5 h-7 w-48 animate-pulse rounded bg-orange-100 dark:bg-orange-500/15" />
        <div className={HOME_LISTING_GRID_CLASS}>
          {Array.from({ length: 5 }, (_, i) => (
            <HomeListingCardSkeleton key={i} tone="orange" />
          ))}
        </div>
      </section>
    );
  }

  if (offers.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label={t("discover.offersForYou")}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-[24px] font-black tracking-tight text-orange-700 dark:text-orange-400 sm:text-2xl">
          {t("discover.offersForYou")}
        </h2>
        {showSortButton && onListingSortChange ? (
          <HomeListingSortButton
            value={listingSort}
            onChange={onListingSortChange}
            filters={listingFilters}
            onFiltersChange={onListingFiltersChange}
            tone="orange"
          />
        ) : null}
      </div>

      {sortedOffers.length === 0 ? (
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
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3 md:gap-x-5 md:gap-y-6 xl:grid-cols-4 min-[1440px]:grid-cols-5">
          {sortedOffers.map((offer) => {
            const postMediaUrl = trimUrl(offer.imageUrl);
            const authorPhotoUrl = trimUrl(offer.authorPhotoUrl);
            // Prefer post media, then profile photo; otherwise use the same
            // category illustration as the home filter row.
            const listingImageUrl =
              postMediaUrl ||
              authorPhotoUrl ||
              categoryIllustrationSrc(offer.categoryId, offer.customCategory);
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
            const freeTextTitle = offer.caption?.trim() || "";
            const offerTitle = (
              freeTextTitle ||
              localizedListingTitle(t, {
                kind: "offer",
                categoryLabel: feedCategoryLabel(t, offer.categoryId, offer.customCategory),
                location: localizedLocation,
              }) ||
              offer.title
            ).replace(/\s+/g, " ").trim();
            const locationLine = localizedLocation
              ? km != null
                ? t("discover.offerLocationFromYou", {
                    location: localizedLocation,
                    km: km.toFixed(1),
                  })
                : localizedLocation
              : null;
            const categoryLabel = feedCategoryLabel(t, offer.categoryId, offer.customCategory);
            const timeAgo = formatDistanceToNow(new Date(offer.createdAt), {
              addSuffix: true,
              locale: dateFnsLocaleFor(i18n.language),
            });

            return (
              <div
                key={offer.id}
                role="button"
                tabIndex={0}
                onClick={() => openOffer(offer.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openOffer(offer.id);
                  }
                }}
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-[20px] p-0 pe-2 text-left md:h-auto md:flex-col md:items-stretch md:gap-0 md:self-stretch md:pe-0",
                  "bg-white shadow-[0_5px_20px_rgba(15,23,42,0.08)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(15,23,42,0.12)] active:opacity-80 dark:bg-[#1d1f21] dark:shadow-none",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-800 md:aspect-[4/3] md:h-auto md:w-full">
                  <img
                    src={listingImageUrl}
                    alt=""
                    className="h-full w-full object-cover object-center transition-transform duration-500 md:group-hover:scale-[1.04]"
                    loading="lazy"
                    decoding="async"
                  />
                  <ListingImageSaveButton
                    saved={savedOfferIds.has(offer.id)}
                    busy={savingOfferId === offer.id}
                    label={savedOfferIds.has(offer.id) ? "Remove from saved" : "Save offer"}
                    onToggle={() => void toggleOfferSave(offer.id)}
                  />
                  {offer.budgetLabel ? (
                    <span className="absolute bottom-2.5 end-2.5 z-[2] hidden md:inline-flex">
                      <span className="inline-flex rounded-full bg-orange-600 px-3.5 py-1.5 text-[16px] font-bold leading-none text-white shadow-md">
                        {offer.budgetLabel}
                      </span>
                    </span>
                  ) : null}
                </div>

                <div className="flex min-h-0 w-0 min-w-0 flex-1 basis-0 flex-col justify-center md:h-auto md:w-full md:min-h-fit md:flex-none md:basis-auto md:px-4 md:pb-4 md:pt-3.5">
                  <span className="mb-1 flex min-w-0 items-center gap-1.5">
                    <Avatar className="h-6 w-6 md:h-7 md:w-7">
                      <AvatarImage src={authorPhotoUrl ?? undefined} alt="" />
                      <AvatarFallback className="text-[10px] font-bold">
                        {listingNameInitials(offer.authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-100 md:text-[13px]">
                      {offer.authorName}
                    </span>
                    {offer.authorVerified ? (
                      <BadgeCheck
                        className="h-3.5 w-3.5 shrink-0"
                        fill="#0ea5e9"
                        color="#ffffff"
                        aria-label="Verified"
                      />
                    ) : null}
                    {offer.authorRating != null && offer.authorRating > 0 ? (
                      <span className="ms-auto inline-flex shrink-0 items-center gap-0.5 text-[12px] font-bold leading-none text-zinc-900 dark:text-zinc-100 md:text-[13px]">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                        {offer.authorRating.toFixed(1)}
                        <span className="font-semibold text-zinc-500">
                          ({offer.authorRatingCount ?? 0})
                        </span>
                      </span>
                    ) : null}
                  </span>
                  {categoryLabel ? (
                    <p className="truncate text-[12px] font-semibold text-orange-700 dark:text-orange-400 md:mb-1 md:w-fit md:max-w-full md:rounded-full md:bg-orange-50 md:px-2.5 md:py-1 md:font-bold dark:md:bg-orange-500/15">
                      {categoryLabel}
                    </p>
                  ) : null}
                  <p className="mt-0.5 line-clamp-2 w-full break-normal text-[15px] font-bold leading-snug text-zinc-900 [overflow-wrap:normal] [word-break:normal] dark:text-white md:text-[16px]">
                    {offerTitle}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-500 dark:text-zinc-400 md:text-[13px]">
                    {[locationLine, timeAgo].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <ChevronRight
                  className="h-6 w-6 shrink-0 text-zinc-300 rtl-flip-icon dark:text-zinc-600 sm:h-5 sm:w-5 md:hidden"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
