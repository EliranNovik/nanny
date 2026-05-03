import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronRight,
  CookingPot,
  Sparkles,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { trackEvent } from "@/lib/analytics";
import { serviceCategoryLabel, isServiceCategoryId } from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { useAuth } from "@/context/AuthContext";
import { navigateToWorkBrowseRequests } from "@/lib/discoverBrowseNavigate";
import { LiveAvatarDot } from "@/components/discover/LiveAvatarDot";

const MAX_BOXES = 5;
/** Fetch one extra row to know if more than `MAX_BOXES` exist. */
const FETCH_LIMIT = MAX_BOXES + 1;

export type PostedHelpRequestRow = {
  job_id: string;
  community_post_id: string | null;
  service_type: string;
  location_city: string;
  time_duration: string | null;
  shift_hours: string | null;
  created_at: string;
  client_id: string;
  author_full_name: string;
  author_photo_url: string | null;
  author_average_rating: number;
  author_total_ratings: number;
};

function humanizeSnakeField(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  return t.replace(/_/g, " ");
}

/** Match strip duration formatting (humanize + number pairs). */
function formatPostedRequestDuration(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  let s = humanizeSnakeField(t) ?? t;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g, "$1 - $2");
  }
  return s || null;
}

function durationLineForPostedRow(r: PostedHelpRequestRow): string | null {
  return (
    formatPostedRequestDuration(r.time_duration) ??
    formatPostedRequestDuration(r.shift_hours) ??
    null
  );
}

/** Same icon mapping as `DiscoverHomeRealtimeStrip` category chips. */
function postedRequestCategoryIcon(
  serviceType: string | null | undefined,
  className = "h-4 w-4 shrink-0 stroke-[2.25]",
): ReactNode {
  if (serviceType === "cleaning") return <Sparkles className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  if (serviceType === "cooking") return <CookingPot className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  if (serviceType === "pickup_delivery") return <Truck className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  if (serviceType === "nanny") return <UsersRound className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
  return <Wrench className={cn(className, "text-emerald-600 dark:text-emerald-300")} aria-hidden />;
}

function titleForServiceType(serviceType: string): string {
  if (serviceType && isServiceCategoryId(serviceType)) {
    return serviceCategoryLabel(serviceType as ServiceCategoryId);
  }
  const s = (serviceType || "").replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Help request";
}

const rowBtnClass = cn(
  "flex w-full items-stretch gap-3 rounded-[1.25rem] border-0 bg-zinc-100 p-4 text-left shadow-none ring-0 backdrop-blur-sm transition-all active:scale-[0.98]",
  "dark:border dark:border-zinc-500/35 dark:bg-zinc-700/90 dark:shadow-xl dark:ring-0 dark:backdrop-blur-xl dark:shadow-black/25",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

type Props = {
  /** When false, skip network (e.g. “I need help” tab). */
  enabled?: boolean;
  className?: string;
};

export function DiscoverHomePostedHelpRequests({
  enabled = true,
  className,
}: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PostedHelpRequestRow[]>([]);

  const visibleRows = useMemo(() => rows.slice(0, MAX_BOXES), [rows]);
  /** True when the server returned more than we show (we fetch `MAX_BOXES + 1`). */
  const hasMore = rows.length > MAX_BOXES;

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("get_discover_posted_help_requests_public", {
        p_limit: FETCH_LIMIT,
      });
      if (cancelled) return;
      if (error) {
        console.warn("[DiscoverHomePostedHelpRequests] RPC failed:", error.code, error.message, error);
        setRows([]);
        setLoading(false);
        return;
      }
      const raw = data ?? [];
      const list = (Array.isArray(raw) ? raw : []).map((row: Record<string, unknown>) => ({
        job_id: String(row.job_id ?? row.jobId ?? ""),
        community_post_id:
          row.community_post_id != null
            ? String(row.community_post_id)
            : row.communityPostId != null
              ? String(row.communityPostId)
              : null,
        service_type: String(row.service_type ?? row.serviceType ?? "other_help"),
        location_city: String(row.location_city ?? row.locationCity ?? ""),
        time_duration:
          row.time_duration != null || row.timeDuration != null
            ? String(row.time_duration ?? row.timeDuration ?? "").trim() || null
            : null,
        shift_hours:
          row.shift_hours != null || row.shiftHours != null
            ? String(row.shift_hours ?? row.shiftHours ?? "").trim() || null
            : null,
        created_at: String(row.created_at ?? row.createdAt ?? ""),
        client_id: String(row.client_id ?? row.clientId ?? ""),
        author_full_name: String(row.author_full_name ?? row.authorFullName ?? "Member"),
        author_photo_url:
          (row.author_photo_url ?? row.authorPhotoUrl) != null
            ? String(row.author_photo_url ?? row.authorPhotoUrl)
            : null,
        author_average_rating: (() => {
          const v = Number(row.author_average_rating ?? row.authorAverageRating);
          return Number.isFinite(v) && v >= 0 ? v : 0;
        })(),
        author_total_ratings: (() => {
          const v = Number(row.author_total_ratings ?? row.authorTotalRatings);
          return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
        })(),
      })) as PostedHelpRequestRow[];
      setRows(list.filter((r) => r.job_id.length > 0));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;
  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label="Posted help requests">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Open requests near you
        </p>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: MAX_BOXES }, (_, i) => (
            <div
              key={i}
              className="h-[6.25rem] animate-pulse rounded-[1.25rem] bg-zinc-200/80 dark:bg-zinc-800/80"
            />
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0) return null;

  const seeMoreBtnClass = cn(
    "group mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-50/50 px-4 py-2 text-[12px] font-semibold tracking-wide text-zinc-500 shadow-none transition-all",
    "hover:border-zinc-300/90 hover:bg-zinc-100/70 hover:text-zinc-800 active:scale-[0.99]",
    "dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-400 dark:hover:border-white/18 dark:hover:bg-zinc-800/55 dark:hover:text-zinc-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  return (
    <section className={cn("w-full", className)} aria-label="Posted help requests">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Open requests near you
      </p>
      <div className="flex flex-col gap-2.5">
        {visibleRows.map((r) => {
          const name = (r.author_full_name || "Member").trim() || "Member";
          const title = titleForServiceType(r.service_type);
          const loc = (r.location_city || "").trim() || "Location not set";
          let when = "";
          try {
            when = formatDistanceToNow(new Date(r.created_at), { addSuffix: true });
          } catch {
            when = "";
          }
          const rating = Number.isFinite(r.author_average_rating) ? r.author_average_rating : 0;
          const totalRatings = Number.isFinite(r.author_total_ratings) ? r.author_total_ratings : 0;
          const durationLabel = durationLineForPostedRow(r);

          return (
            <button
              key={r.job_id}
              type="button"
              className={rowBtnClass}
              onClick={() => {
                trackEvent("discover_posted_help_request_open_match", {
                  job_id: r.job_id,
                  community_post_id: r.community_post_id,
                });
                navigate(
                  `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(r.job_id)}`,
                );
              }}
            >
              <div className="flex w-[5.25rem] shrink-0 flex-col items-center gap-1 self-start sm:w-[5.75rem]">
                <div className="relative h-16 w-16 shrink-0">
                  <Avatar className="h-16 w-16 overflow-hidden shadow-md">
                    <AvatarImage src={r.author_photo_url || undefined} alt="" className="object-cover" />
                    <AvatarFallback className="bg-zinc-200 text-base font-black text-zinc-700 dark:bg-zinc-800 dark:text-white">
                      {name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <LiveAvatarDot />
                </div>
                <p
                  className="w-full max-w-[5.75rem] truncate text-center text-[13px] font-bold leading-snug text-zinc-800 dark:text-zinc-100 sm:text-[14px]"
                  title={name}
                >
                  {name}
                </p>
                <StarRating
                  rating={rating}
                  totalRatings={totalRatings}
                  size="sm"
                  showCount
                  className="max-w-full flex-col items-center gap-0.5"
                  starClassName="text-amber-500 dark:text-amber-400"
                  emptyStarClassName="text-zinc-300 dark:text-white/25"
                  numberClassName="text-amber-700 tabular-nums text-[11px] dark:text-amber-100"
                  countClassName="text-zinc-500 text-[10px] dark:text-white/55"
                />
              </div>
              <div className="flex min-h-[5rem] min-w-0 flex-1 flex-col pt-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {postedRequestCategoryIcon(r.service_type, "h-4.5 w-4.5 shrink-0 stroke-[2.25]")}
                  <span className="min-w-0 truncate text-[17px] font-black leading-tight text-zinc-900 dark:text-white">
                    {title}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[15px] font-bold leading-tight text-zinc-600 dark:text-white/80">{loc}</p>
                {durationLabel ? (
                  <p className="mt-0.5 truncate text-[15px] font-semibold leading-snug text-zinc-500 dark:text-white/70">
                    {durationLabel}
                  </p>
                ) : null}
                {when ? (
                  <div className="mt-auto flex justify-end pt-2">
                    <span className="shrink-0 rounded-full border-0 bg-zinc-200/90 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-zinc-800 ring-0 dark:border dark:border-zinc-500/50 dark:bg-zinc-800/95 dark:text-zinc-100 dark:ring-1 dark:ring-zinc-950/40">
                      {when}
                    </span>
                  </div>
                ) : null}
              </div>
              <div
                className="flex w-8 shrink-0 items-center justify-center self-stretch pl-0.5"
                aria-hidden
              >
                <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-white/70" />
              </div>
            </button>
          );
        })}
      </div>
      {visibleRows.length > 0 ? (
        <button
          type="button"
          className={seeMoreBtnClass}
          aria-label="See more open requests on job match"
          onClick={() => {
            trackEvent("discover_posted_help_requests_see_more", {
              from: "discover_home",
              truncated: hasMore,
            });
            navigateToWorkBrowseRequests(navigate, profile);
          }}
        >
          See more
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-80"
            aria-hidden
          />
        </button>
      ) : null}
    </section>
  );
}
