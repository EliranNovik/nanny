import { useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { avatarUrl } from "@/lib/imageTransform";
import {
  serviceCategoryLabel,
  isServiceCategoryId,
  getServiceCategoryImage,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { useAuth } from "@/context/AuthContext";
import { DiscoverProfileSaveBadge } from "@/components/discover/DiscoverProfileSaveBadge";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { isJobOpenForDiscoverListing } from "@/lib/discoverOpenJobStatuses";
import {
  discoverRequestPostedTimeBadgeCircleClass,
  stripAboutFromDistance,
} from "@/components/discover/discoverRequestCarouselCardShared";

const MAX_BOXES = 8;

type FavoriteRequestRow = {
  id: string;
  service_type: string | null;
  location_city: string | null;
  start_at: string | null;
  created_at: string | null;
  shift_hours: string | null;
  time_duration: string | null;
  client_id: string;
  status: string | null;
  service_details: Record<string, unknown> | null;
  client_photo_url: string | null;
  client_display_name: string | null;
  client_average_rating: number | null;
  client_total_ratings: number | null;
};

function titleForServiceType(serviceType: string): string {
  if (serviceType && isServiceCategoryId(serviceType)) {
    return serviceCategoryLabel(serviceType as ServiceCategoryId);
  }
  const s = (serviceType || "").replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Help request";
}

function firstJobImage(
  serviceDetails: Record<string, unknown> | null | undefined,
): string | null {
  const imgs = (serviceDetails as Record<string, unknown> | null)?.images;
  if (!Array.isArray(imgs)) return null;
  const found = (imgs as unknown[]).find(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  return found ?? null;
}

function prettyDurationLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = String(label).trim();
  if (!trimmed) return null;
  return trimmed.replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
}

/**
 * Open job requests authored by the viewer's saved profiles
 * (`profile_favorites` → `job_requests`). Pulls latest posted requests
 * from saved profiles in a single round trip + a profiles enrichment query.
 */
function useDiscoverFavoriteRequests(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discoverFavoriteRequests(userId ?? null),
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FavoriteRequestRow[]> => {
      if (!userId) return [];

      const { data: favs, error: favErr } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", userId);
      if (favErr) throw favErr;
      const favIds = (favs ?? []).map(
        (r: { favorite_user_id: string }) => r.favorite_user_id,
      );
      if (favIds.length === 0) return [];

      const { data: requests, error: reqErr } = await supabase
        .from("job_requests")
        .select(
          "id, service_type, location_city, start_at, created_at, shift_hours, time_duration, client_id, status, service_details",
        )
        .in("client_id", favIds)
        .is("community_post_id", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (reqErr) throw reqErr;

      const rows = (requests ?? []) as Array<
        Omit<
          FavoriteRequestRow,
          | "client_photo_url"
          | "client_display_name"
          | "client_average_rating"
          | "client_total_ratings"
        >
      >;
      const open = rows.filter((r) => {
        if (r.status == null || r.status === "") return true;
        return isJobOpenForDiscoverListing(String(r.status));
      });
      if (open.length === 0) return [];

      const clientIds = [...new Set(open.map((r) => r.client_id))];
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, average_rating, total_ratings")
        .in("id", clientIds);
      if (profErr) throw profErr;
      const profMap = new Map<
        string,
        {
          id: string;
          full_name: string | null;
          photo_url: string | null;
          average_rating: number | null;
          total_ratings: number | null;
        }
      >();
      for (const p of (profs ?? []) as Array<{
        id: string;
        full_name: string | null;
        photo_url: string | null;
        average_rating: number | null;
        total_ratings: number | null;
      }>) {
        profMap.set(p.id, p);
      }

      return open.map((r) => {
        const p = profMap.get(r.client_id);
        return {
          ...r,
          service_details: (r.service_details ?? null) as Record<
            string,
            unknown
          > | null,
          client_photo_url: p?.photo_url ?? null,
          client_display_name: p?.full_name ?? null,
          client_average_rating: p?.average_rating ?? null,
          client_total_ratings: p?.total_ratings ?? null,
        };
      });
    },
  });
}

/** Match DiscoverHomeSavedProfiles (I need help — Your favorites). */
const listContainerClass = cn(
  "flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 scroll-pl-4",
  "-mx-4 px-4 sm:-mx-0 sm:px-0 sm:scroll-pl-0",
);

const cardBtnClass = cn(
  "group flex flex-col items-center gap-1.5 text-center",
  "w-[7.75rem] shrink-0 snap-start",
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

const favoriteImageShellClass =
  "relative mx-auto w-full shrink-0 aspect-square";

const imageWrapClass = cn(
  "h-full w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/60",
  "ring-1 ring-black/5 dark:ring-white/5 shadow-sm",
  "transition-transform duration-200 group-hover:shadow-md",
);

type Props = {
  enabled?: boolean;
  className?: string;
};

export function DiscoverHomeFavoriteRequests({
  enabled = true,
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

  const { data: rows = [], isLoading } = useDiscoverFavoriteRequests(
    enabled ? user?.id : undefined,
  );

  const visibleRows = useMemo(() => rows.slice(0, MAX_BOXES), [rows]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.85)) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  if (!enabled) return null;
  if (!user?.id) return null;

  if (isLoading) {
    return (
      <section className={cn("w-full", className)} aria-label="Your favorites">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[15px] font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">
            Your favorites
          </p>
        </div>
        <div className={listContainerClass}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex w-[7.75rem] shrink-0 snap-start flex-col items-center gap-1.5 sm:w-[8.25rem] md:w-[9rem] lg:w-[9.75rem] xl:w-[10.5rem] sm:gap-1 lg:gap-1.5"
            >
              <div className="aspect-square w-full animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="flex w-full flex-col items-center space-y-1 sm:space-y-0.5">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80 sm:h-3" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60 sm:h-2.5" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60 sm:h-2.5" />
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
        <p className="text-[15px] font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">
          Your favorites
        </p>
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
        {visibleRows.map((r) => {
          const name = (r.client_display_name || "Member").trim() || "Member";
          const title = titleForServiceType(r.service_type || "");
          const loc = (r.location_city || "").trim() || "Location not set";
          let when = "";
          try {
            if (r.created_at) {
              when = formatDistanceToNow(new Date(r.created_at), {
                addSuffix: true,
              });
            }
          } catch {
            when = "";
          }
          const durationLabel = prettyDurationLabel(
            r.time_duration || r.shift_hours,
          );

          const clientPhotoUrl = avatarUrl.sm(r.client_photo_url);
          const categoryPhotoUrl =
            firstJobImage(r.service_details ?? null) ??
            getServiceCategoryImage(r.service_type ?? null);
          const circlePhotoUrl = clientPhotoUrl || categoryPhotoUrl;

          return (
            <button
              key={r.id}
              type="button"
              className={cardBtnClass}
              onClick={() => {
                trackEvent("discover_favorite_request_open_match", {
                  job_id: r.id,
                  client_id: r.client_id,
                });
                navigate(
                  `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(r.id)}`,
                );
              }}
              aria-label={`${title} in ${loc} — posted by ${name}`}
            >
              <div className={favoriteImageShellClass}>
                <div className={imageWrapClass}>
                  {circlePhotoUrl ? (
                    <img
                      src={circlePhotoUrl}
                      alt=""
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200 dark:from-zinc-800 dark:via-zinc-800/70 dark:to-zinc-700/60">
                      <span className="text-base font-black text-zinc-700 dark:text-white">
                        {name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {r.client_id ? (
                  <div className="absolute right-[8%] bottom-[8%] z-20">
                    <DiscoverProfileSaveBadge
                      targetUserId={r.client_id}
                      accent="work"
                      viewerUserId={user?.id}
                      favoriteUserIds={favoriteUserIds}
                      analyticsEvent="discover_favorite_request_save_profile"
                    />
                  </div>
                ) : null}
                {when ? (
                  <span className={discoverRequestPostedTimeBadgeCircleClass}>
                    <span className="line-clamp-1">
                      {stripAboutFromDistance(when)}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className={cardTextBelowClass}>
                <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-zinc-900 dark:text-white sm:text-[13px] lg:text-[16px] xl:text-[17px]">
                  {title}
                </span>
                <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                  {loc}
                </span>
                {durationLabel ? (
                  <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Duration
                    </span>{" "}
                    {durationLabel}
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
