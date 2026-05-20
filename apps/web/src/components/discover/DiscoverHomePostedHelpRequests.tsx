import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trackEvent } from "@/lib/analytics";
import {
  serviceCategoryLabel,
  isServiceCategoryId,
  getServiceCategoryImage,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { useAuth } from "@/context/AuthContext";
import { navigateToWorkBrowseRequests } from "@/lib/discoverBrowseNavigate";
import { useDiscoverOpenHelpRequests } from "@/hooks/data/useDiscoverOpenHelpRequests";
import {
  discoverRequestClientNameRowClass,
  discoverRequestClientOverlayClass,
  discoverRequestPostedTimeBadgeClass,
  discoverRequestRatingRowClass,
  discoverRequestTopGradientClass,
  stripAboutFromDistance,
} from "@/components/discover/discoverRequestCarouselCardShared";

const MAX_BOXES = 8;

function titleForServiceType(serviceType: string): string {
  if (serviceType && isServiceCategoryId(serviceType)) {
    return serviceCategoryLabel(serviceType as ServiceCategoryId);
  }
  const s = (serviceType || "").replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Help request";
}

/** First public image URL uploaded with the request, if any (`service_details.images`). */
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

/**
 * Pretty duration string from snake/underscore values.
 * Numeric ranges keep a hyphen (`5_6_hours` → `5-6 hours`); other underscores
 * become spaces (`full_day` → `full day`).
 */
function prettyDurationLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = String(label).trim();
  if (!trimmed) return null;
  return trimmed.replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
}

/**
 * Airbnb-style horizontal carousel — same shell on mobile and desktop.
 *
 * - Mobile (<sm): edge-to-edge snap carousel, native touch scroll.
 * - Tablet+ (sm/lg): same carousel; arrow controls appear in the section header.
 *
 * Card anatomy: square image with avatar/name/rating overlay on top,
 * save bookmark top-right, posted-time pill bottom-left, and plain text
 * job details rendered on the page background below the image.
 */
const listContainerClass = cn(
  "flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 scroll-pl-4",
  "-mx-4 px-4 sm:-mx-0 sm:px-0 sm:scroll-pl-0",
);

const cardBtnClass = cn(
  "group flex flex-col gap-1.5 text-left",
  "w-[12rem] shrink-0 snap-start",
  "sm:w-[11.5rem] md:w-[12.5rem] lg:w-[15rem] xl:w-[16.5rem] 2xl:w-[18rem]",
  "sm:gap-1 lg:gap-1.5",
  "focus-visible:outline-none",
);

const cardTextBelowClass = "flex flex-col gap-0.5 px-0 sm:gap-0 lg:gap-0.5";

const carouselArrowBtnClass = cn(
  "hidden md:inline-flex h-8 w-8 items-center justify-center rounded-full",
  "border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all",
  "hover:bg-zinc-100 hover:shadow active:scale-95",
  "dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
);

const imageWrapClass = cn(
  "relative w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800/60",
  "aspect-square",
  "ring-1 ring-black/5 dark:ring-white/5 shadow-sm",
  "transition-transform duration-200 group-hover:shadow-md",
  "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

type Props = {
  enabled?: boolean;
  className?: string;
};

export function DiscoverHomePostedHelpRequests({
  enabled = true,
  className,
}: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { data: openRequests = [], isLoading: loading } = useDiscoverOpenHelpRequests(
    enabled,
    user?.id,
  );

  const visibleRows = useMemo(() => openRequests.slice(0, MAX_BOXES), [openRequests]);
  const hasMore = openRequests.length > MAX_BOXES;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.85)) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  if (!enabled) return null;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Posted help requests">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[15px] font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">
            Open requests near you
          </p>
        </div>
        <div className={listContainerClass}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex w-[12rem] shrink-0 snap-start flex-col gap-1.5 sm:w-[11.5rem] md:w-[12.5rem] lg:w-[15rem] xl:w-[16.5rem] 2xl:w-[18rem] sm:gap-1 lg:gap-1.5"
            >
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="space-y-1 px-0 sm:space-y-0.5">
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

  if (openRequests.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label="Posted help requests">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[15px] font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">
          Open requests near you
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
          const rating = r.client_average_rating ?? 0;
          const totalRatings = r.client_total_ratings ?? 0;
          const hasRating = totalRatings > 0 && rating > 0;
          const durationLabel = prettyDurationLabel(
            r.time_duration || r.shift_hours,
          );

          const photoUrl =
            firstJobImage(r.service_details ?? null) ??
            getServiceCategoryImage(r.service_type ?? null);

          return (
            <button
              key={r.id}
              type="button"
              className={cardBtnClass}
              onClick={() => {
                trackEvent("discover_posted_help_request_open_match", {
                  job_id: r.id,
                });
                navigate(
                  `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(r.id)}`,
                );
              }}
              aria-label={`${title} in ${loc} — posted by ${name}`}
            >
              <div className={imageWrapClass}>
                <img
                  src={photoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />

                <div className={discoverRequestTopGradientClass} aria-hidden />

                <div className={discoverRequestClientOverlayClass}>
                  <div className={discoverRequestClientNameRowClass}>
                    <span className="relative inline-flex shrink-0">
                      <Avatar className="h-8 w-8 overflow-hidden shadow-sm sm:h-7 sm:w-7 lg:h-9 lg:w-9 xl:h-10 xl:w-10">
                        <AvatarImage
                          src={r.client_photo_url || undefined}
                          alt=""
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-zinc-200 text-[10px] font-black text-zinc-700 dark:bg-zinc-800 dark:text-white sm:text-[9px] lg:text-[11px]">
                          {name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="pointer-events-none absolute right-0 top-0 block size-2 rounded-full bg-emerald-500 motion-safe:animate-strip-live-dot-breathe dark:bg-emerald-400 sm:size-1.5 lg:size-2 xl:size-2.5"
                        aria-hidden
                      />
                    </span>
                    <span
                      className="min-w-0 truncate text-[12.5px] font-semibold leading-tight text-white sm:text-[11px] lg:text-[13px] xl:text-[14px]"
                      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
                    >
                      {name}
                    </span>
                  </div>
                  {hasRating ? (
                    <span
                      className={discoverRequestRatingRowClass}
                      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
                    >
                      <Star
                        className="h-3 w-3 fill-current text-white sm:h-2.5 sm:w-2.5 lg:h-3 lg:w-3 xl:h-3.5 xl:w-3.5"
                        strokeWidth={0}
                        aria-hidden
                      />
                      <span className="tabular-nums">{rating.toFixed(1)}</span>
                      {totalRatings > 0 ? (
                        <span className="font-normal text-white/80">
                          ({totalRatings})
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>

                {when ? (
                  <span className={discoverRequestPostedTimeBadgeClass}>
                    <span className="line-clamp-1">
                      {stripAboutFromDistance(when)}
                    </span>
                  </span>
                ) : null}
              </div>

              {/* Text on page background — Airbnb-style simple lines */}
              <div className={cardTextBelowClass}>
                <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-zinc-900 dark:text-white sm:text-[13px] lg:text-[16px] xl:text-[17px]">
                  {title}
                </span>
                <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                  {loc}
                </span>
                {durationLabel ? (
                  <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Duration</span>{" "}
                    {durationLabel}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}

        {/* "See more" tile — last carousel item */}
        <button
          type="button"
          className={cardBtnClass}
          aria-label="See all open requests"
          onClick={() => {
            trackEvent("discover_posted_help_requests_see_more", {
              from: "discover_home",
              truncated: hasMore,
            });
            navigateToWorkBrowseRequests(navigate, profile);
          }}
        >
          <div
            className={cn(
              imageWrapClass,
              "ring-1 ring-emerald-200/70 dark:ring-emerald-500/30",
            )}
          >
            <div
              className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-emerald-50 to-emerald-200/70 dark:from-emerald-900/45 dark:via-emerald-800/40 dark:to-emerald-700/35"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/40 blur-2xl dark:bg-emerald-300/15"
              aria-hidden
            />
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-white/60 transition-transform duration-300 group-hover:scale-105 group-active:scale-95 dark:bg-emerald-500 dark:ring-emerald-700/40 sm:h-12 sm:w-12">
                <ArrowRight className="h-6 w-6 sm:h-5 sm:w-5" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="text-[12px] font-black uppercase tracking-[0.14em] leading-tight text-emerald-900 dark:text-emerald-100">
                See more
              </span>
            </div>
          </div>

          <div className={cardTextBelowClass}>
            <span className="truncate text-[15px] font-semibold leading-tight text-zinc-900 dark:text-white sm:text-[13px] lg:text-[16px] xl:text-[17px]">
              Browse all requests
            </span>
            <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
              Explore the full list
            </span>
          </div>
        </button>
      </div>
    </section>
  );
}
