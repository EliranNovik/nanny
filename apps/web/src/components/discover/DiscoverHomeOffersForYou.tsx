import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Baby,
  Sparkles,
  Truck,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/hooks/data/keys";
import { fetchDiscoverOffersForYou } from "@/lib/fetchDiscoverOffersForYou";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import { avatarUrl } from "@/lib/imageTransform";
import { isolatedOfferPostPath } from "@/lib/profilePostShare";
import { DiscoverRequestHeroPlaceholder } from "@/components/discover/DiscoverRequestHeroWaves";
import type { DiscoverHomeCategoryFilter } from "@/lib/discoverHomeCategoryFilter";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, ElementType> = {
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  technical_help: Wrench,
  other_help: Wrench,
};

function CategoryIcon({
  categoryId,
  className,
}: {
  categoryId: string | null;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[(categoryId ?? "").toLowerCase()] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 1).toUpperCase();
}

export function DiscoverHomeOffersForYou({
  className,
  categoryFilter = "all",
}: {
  className?: string;
  categoryFilter?: DiscoverHomeCategoryFilter;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: queryKeys.discoverOffersForYou(user?.id, 10),
    queryFn: () => fetchDiscoverOffersForYou(user?.id, 10),
    staleTime: 60_000,
  });

  const visibleOffers = useMemo(
    () =>
      categoryFilter === "all"
        ? offers
        : offers.filter((offer) => offer.categoryId === categoryFilter),
    [offers, categoryFilter],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [categoryFilter]);

  const syncActiveIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    children.forEach((child, i) => {
      const center = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveIndex(best);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncActiveIndex();
    el.addEventListener("scroll", syncActiveIndex, { passive: true });
    return () => el.removeEventListener("scroll", syncActiveIndex);
  }, [syncActiveIndex, visibleOffers.length]);

  const scrollToIndex = (index: number) => {
    const el = scrollerRef.current;
    const child = el?.children[index] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({
      left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2,
      behavior: "smooth",
    });
  };

  const openOffer = (postId: string) => {
    navigate(isolatedOfferPostPath(postId));
  };

  if (isLoading) {
    return (
      <section className={cn("w-full", className)} aria-label={t("discover.offersForYou")}>
        <div className="mb-5 h-7 w-40 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="h-52 w-[min(calc(100vw-5.5rem),20rem)] shrink-0 animate-pulse rounded-[1.75rem] bg-zinc-200/70 dark:bg-zinc-800/70"
            />
          ))}
        </div>
      </section>
    );
  }

  if (offers.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label={t("discover.offersForYou")}>
      <h2 className="mb-5 text-[22px] font-black tracking-tight text-orange-700 dark:text-orange-400 sm:text-2xl">
        {t("discover.offersForYou")}
      </h2>

      {visibleOffers.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-sm font-semibold text-foreground">
            {t("discover.noSortMatch", {
              sort: t(`discoverHome.filters.${categoryFilter}`),
            })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("discover.tryAnotherSort")}
          </p>
        </div>
      ) : (
      <div
        ref={scrollerRef}
        className={cn(
          "flex items-start gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1",
          "scroll-smooth overscroll-x-contain [-webkit-overflow-scrolling:touch]",
          "-mx-4 px-4",
        )}
      >
        {visibleOffers.map((offer) => (
          <button
            key={offer.id}
            type="button"
            onClick={() => openOffer(offer.id)}
            className={cn(
              "w-[min(calc(100vw-5.5rem),20rem)] shrink-0 snap-center text-left",
              "outline-none transition-transform active:scale-[0.99]",
              "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.75rem] bg-zinc-200 dark:bg-zinc-800">
              {offer.imageUrl ? (
                <img
                  src={offer.imageUrl}
                  alt=""
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <DiscoverRequestHeroPlaceholder serviceType={offer.categoryId} />
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
              <span className="absolute left-2.5 top-2.5 z-10 inline-flex max-w-[75%] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                <CategoryIcon categoryId={offer.categoryId} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{offer.categoryLabel}</span>
              </span>
              <p className="absolute inset-x-3 bottom-3 z-10 line-clamp-2 text-[17px] font-bold leading-snug text-white">
                {offer.title}
              </p>
            </div>

            <div className="mt-3 flex min-w-0 items-center gap-3 px-0.5">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage
                  src={avatarUrl.sm(offer.authorPhotoUrl) || undefined}
                  alt=""
                  className="object-cover"
                />
                <AvatarFallback className="bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {initials(offer.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold leading-tight text-zinc-900 dark:text-white">
                  {offer.authorName}
                </p>
                <p className="mt-0.5 truncate text-[13px] font-medium text-zinc-400 dark:text-zinc-500">
                  {formatDistanceToNow(new Date(offer.createdAt), {
                    addSuffix: true,
                    locale: dateFnsLocaleFor(i18n.language),
                  })}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
      )}

      {visibleOffers.length > 1 ? (
        <div className="mt-3.5 flex items-center justify-center gap-1.5" role="tablist" aria-label={t("discover.offersForYou")}>
          {visibleOffers.map((offer, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={offer.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${t("discover.offersForYou")} ${index + 1}`}
                onClick={() => scrollToIndex(index)}
                className="flex h-6 items-center justify-center px-0.5"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    active ? "w-6 bg-orange-500" : "w-1.5 bg-zinc-300 dark:bg-zinc-600",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
