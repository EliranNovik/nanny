import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { trackEvent } from "@/lib/analytics";
import {
  serviceCategoryLabel,
  isServiceCategoryId,
  getServiceCategoryImage,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";

/**
 * "My Requests" — Airbnb-style horizontal carousel of the viewer's own open job
 * requests (`job_requests` with `client_id = userId` and an open status).
 *
 * Same shell/styling as the Open-requests / Favorite-requests / Saved-profiles
 * carousels: square image on top with a posted-time pill (and a helpers-interested
 * pill when there are accepted candidates), plain text details below.
 *
 * - Reuses the cached `useFreelancerRequests(user?.id).myOpenRequests`.
 * - Click target: `/client/jobs/<id>/live` — same as the rest of the app.
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

/** Shared pill height for accepted-count + posted-time badges on card images. */
const requestImageBadgeSizeClass =
  "inline-flex min-h-[1.75rem] items-center rounded-full px-2 py-1 text-[13px] leading-none sm:min-h-[1.5rem] sm:px-1.5 sm:py-0.5 sm:text-[11px] lg:min-h-[1.75rem] lg:px-2 lg:py-1 lg:text-[12.5px] xl:text-[13.5px]";

function titleForServiceType(serviceType: string | null | undefined): string {
  const t = (serviceType || "").trim();
  if (t && isServiceCategoryId(t)) {
    return serviceCategoryLabel(t as ServiceCategoryId);
  }
  const s = t.replace(/_/g, " ");
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

/** `5_6_hours` → `5-6 hours`, `full_day` → `full day` */
function prettyDurationLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = String(label).trim();
  if (!trimmed) return null;
  return trimmed.replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
}

type Props = {
  className?: string;
};

export function DiscoverHomeMyOpenRequests({ className }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: frData, isLoading: loading } = useFreelancerRequests(user?.id);
  const rows = useMemo(() => frData?.myOpenRequests ?? [], [frData]);

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
      <section className={cn("w-full", className)} aria-label="My open requests">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[15px] font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">
            My Requests
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

  if (rows.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label="My open requests">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[15px] font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">
          My Requests
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
        {rows.map((job: Record<string, unknown>) => {
          const id = String(job.id ?? "");
          if (!id) return null;
          const serviceType = (job.service_type as string | null) ?? null;
          const title = titleForServiceType(serviceType);
          const loc = (
            (job.location_city as string | null) ?? ""
          ).trim();
          let when = "";
          try {
            const createdAt = job.created_at as string | null | undefined;
            if (createdAt) {
              when = formatDistanceToNow(new Date(createdAt), { addSuffix: true }).replace(
                /^about\s+/i,
                "",
              );
            }
          } catch {
            when = "";
          }
          const durationLabel = prettyDurationLabel(
            (job.time_duration as string | null) ??
              (job.shift_hours as string | null) ??
              null,
          );
          const acceptedCount =
            typeof job.acceptedCount === "number"
              ? (job.acceptedCount as number)
              : 0;
          const photoUrl =
            firstJobImage(
              (job.service_details as Record<string, unknown> | null) ?? null,
            ) ?? getServiceCategoryImage(serviceType);

          return (
            <button
              key={id}
              type="button"
              className={cardBtnClass}
              onClick={() => {
                trackEvent("discover_my_open_request_open", { job_id: id });
                navigate(`/client/jobs/${encodeURIComponent(id)}/live`);
              }}
              aria-label={`${title}${loc ? ` in ${loc}` : ""} — your open request`}
            >
              <div className={imageWrapClass}>
                <img
                  src={photoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="eager" decoding="async"
                />

                {/* Helpers-accepted count pill — top-left; grey 0 when none, green when accepted */}
                <span
                  className={cn(
                    "absolute left-2 top-2 z-10 gap-1 font-black shadow-md backdrop-blur-sm sm:left-1.5 sm:top-1.5 sm:gap-0.5 lg:left-2 lg:top-2 lg:gap-1",
                    requestImageBadgeSizeClass,
                    acceptedCount > 0
                      ? "bg-emerald-600/95 text-white"
                      : "bg-zinc-500/90 text-white dark:bg-zinc-600/95",
                  )}
                  aria-label={
                    acceptedCount > 0
                      ? `${acceptedCount} accepted`
                      : "No helpers accepted yet"
                  }
                  title={
                    acceptedCount > 0
                      ? `${acceptedCount} accepted`
                      : "No helpers accepted yet"
                  }
                >
                  <Users
                    className="h-3.5 w-3.5 shrink-0 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4"
                    strokeWidth={2.75}
                    aria-hidden
                  />
                  <span className="tabular-nums">{acceptedCount}</span>
                </span>

                {/* Posted-time pill — top-right */}
                {when ? (
                  <span
                    className={cn(
                      "absolute right-2 top-2 z-10 max-w-[85%] font-bold uppercase tracking-wide text-zinc-900 shadow-md sm:right-1.5 sm:top-1.5 lg:right-2 lg:top-2",
                      requestImageBadgeSizeClass,
                      "bg-white",
                    )}
                  >
                    <span className="line-clamp-1">{when}</span>
                  </span>
                ) : null}
              </div>

              {/* Text on page background — Airbnb-style simple lines */}
              <div className={cardTextBelowClass}>
                <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-zinc-900 dark:text-white sm:text-[13px] lg:text-[16px] xl:text-[17px]">
                  {title}
                </span>
                {loc ? (
                  <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px] lg:text-[13.5px] xl:text-[14.5px]">
                    {loc}
                  </span>
                ) : null}
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
      </div>
    </section>
  );
}
