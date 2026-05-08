import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trackEvent } from "@/lib/analytics";
import {
  serviceCategoryLabel,
  isServiceCategoryId,
  getServiceCategoryImage,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";

type Mode = "hire" | "work";

type ProfileMini = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

type JobRow = {
  id: string;
  created_at: string;
  service_type: string | null;
  location_city: string | null;
  client_id: string | null;
  selected_freelancer_id: string | null;
  status: string | null;
};

type LiveHelpPayload = {
  jobs: JobRow[];
  profileMap: Record<string, ProfileMini>;
};

const HELPING_NOW_STATUSES = ["locked", "active"] as const;

/**
 * Live-help-now carousel — Airbnb-style cards for jobs the viewer is currently
 * engaged in.
 *
 * - `mode="hire"` → jobs the viewer **posted** that have a confirmed helper
 *   (header: "My help live"). The other-party shown is the helper.
 * - `mode="work"` → jobs the viewer is **helping with** as the selected
 *   freelancer (header: "Live help"). The other-party shown is the client.
 *
 * Same shell + cards as the rest of the discover home carousels (mobile
 * edge-to-edge swipe, desktop arrows in the header). No `.slice(0, 1)` cap —
 * every active live gig is shown (cap is a safe `limit(24)` on the query).
 *
 * Shares the same `queryKeys.exploreLiveHelp(userId, mode)` cache key as
 * `ExploreLiveHelpNow` so navigation between Discover home and Explore is
 * instant. Auto-refreshes via realtime subscription on `job_requests`.
 */
const listContainerClass = cn(
  "flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 scroll-pl-4",
  "-mx-4 px-4 sm:-mx-0 sm:px-0 sm:scroll-pl-0",
);

const cardBtnClass = cn(
  "group flex flex-col gap-2.5 text-left",
  "w-[11rem] shrink-0 snap-start",
  "sm:w-[11.5rem] lg:w-[12rem] sm:gap-2",
  "focus-visible:outline-none",
);

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

function titleForServiceType(serviceType: string | null | undefined): string {
  const t = (serviceType || "").trim();
  if (t && isServiceCategoryId(t)) {
    return serviceCategoryLabel(t as ServiceCategoryId);
  }
  const s = t.replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Help request";
}

function useDiscoverMyLiveHelpJobs(userId: string | undefined, mode: Mode) {
  const queryClient = useQueryClient();
  const qk = queryKeys.exploreLiveHelp(userId, mode);
  const filterField = mode === "hire" ? "client_id" : "selected_freelancer_id";

  useRealtimeSubscription(
    {
      table: "job_requests",
      event: "*",
      enabled: !!userId,
      filter: userId ? `${filterField}=eq.${userId}` : undefined,
    },
    () => {
      void queryClient.invalidateQueries({ queryKey: qk });
    },
  );

  return useQuery<LiveHelpPayload>({
    queryKey: qk,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<LiveHelpPayload> => {
      if (!userId) return { jobs: [], profileMap: {} };

      const baseSelect = supabase
        .from("job_requests")
        .select(
          "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status",
        );
      const filtered =
        mode === "hire"
          ? baseSelect.eq("client_id", userId)
          : baseSelect.eq("selected_freelancer_id", userId);

      const { data, error } = await filtered
        .in("status", [...HELPING_NOW_STATUSES])
        .not("selected_freelancer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);

      if (error) {
        console.warn("[DiscoverHomeMyLiveHelpJobs] jobs", error);
        return { jobs: [], profileMap: {} };
      }

      const rows = (data ?? []) as JobRow[];
      if (rows.length === 0) return { jobs: rows, profileMap: {} };

      // Other-party profiles: helpers in hire mode, clients in work mode.
      const otherIds = Array.from(
        new Set(
          (mode === "hire"
            ? rows.map((r) => String(r.selected_freelancer_id ?? ""))
            : rows.map((r) => String(r.client_id ?? ""))
          ).filter(Boolean),
        ),
      );

      const profileMap: Record<string, ProfileMini> = {};
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", otherIds);
        for (const p of (profs ?? []) as ProfileMini[]) {
          if (p?.id) profileMap[p.id] = p;
        }
      }

      return { jobs: rows, profileMap };
    },
  });
}

type Props = {
  /**
   * `"hire"` shows jobs the viewer posted (header: "My help live", other-party
   * is the helper). `"work"` shows jobs the viewer is helping with (header:
   * "Live help", other-party is the client).
   */
  mode: Mode;
  /**
   * Where to send the user when a card is clicked. Should resolve to the
   * Explore page's "Live help" tab (e.g. `${explorePath}?mode=work&tab=live_help`).
   */
  exploreLiveHelpPath: string;
  /**
   * Hire-mode only: when provided, the empty state renders a "Post new
   * request" CTA that navigates here.
   */
  createRequestPath?: string;
  className?: string;
};

export function DiscoverHomeMyLiveHelpJobs({
  mode,
  exploreLiveHelpPath,
  createRequestPath,
  className,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading: loading } = useDiscoverMyLiveHelpJobs(user?.id, mode);
  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const profileMap = data?.profileMap ?? {};

  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByDir = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.85)) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  const headerText = mode === "hire" ? "My help live" : "Live help";
  const ariaLabel = mode === "hire" ? "My live help" : "Live help";
  const otherPartyLabel = mode === "hire" ? "Helper" : "Helping";

  if (!user?.id) return null;

  if (loading) {
    return (
      <section className={cn("w-full", className)} aria-label={ariaLabel}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {headerText}
          </p>
        </div>
        <div className={listContainerClass}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex w-[11rem] shrink-0 snap-start flex-col gap-2.5 sm:w-[11.5rem] lg:w-[12rem] sm:gap-2"
            >
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="space-y-2 px-0.5 sm:space-y-1.5">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80 sm:h-3" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60 sm:h-2.5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const emptyTitle =
    mode === "hire" ? "No live help yet" : "No live gigs yet";
  const emptySub =
    mode === "hire"
      ? "When a helper is confirmed on your request, it will appear here."
      : "When you're confirmed on a job, it will appear here.";

  if (jobs.length === 0) {
    const showPostCta = mode === "hire" && !!createRequestPath;
    return (
      <section className={cn("w-full", className)} aria-label={ariaLabel}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {headerText}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-200/80 bg-zinc-50/60 px-4 py-5 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25">
            <Zap className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold leading-tight text-zinc-900 dark:text-white">
              {emptyTitle}
            </p>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
              {emptySub}
            </p>
          </div>
          {showPostCta ? (
            <button
              type="button"
              onClick={() => {
                trackEvent("discover_my_help_live_empty_post_request", {});
                navigate(createRequestPath as string);
              }}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-900 shadow-sm transition-colors",
                "hover:bg-emerald-100 active:scale-95",
                "dark:border-white/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/20 dark:shadow-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              )}
              aria-label="Post a new request"
            >
              Post request
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("w-full", className)} aria-label={ariaLabel}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {headerText}
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
        {jobs.map((job) => {
          const title = titleForServiceType(job.service_type);
          const loc = (job.location_city ?? "").trim();
          const otherId = String(
            (mode === "hire"
              ? job.selected_freelancer_id
              : job.client_id) ?? "",
          );
          const otherProfile = otherId ? profileMap[otherId] : null;
          const otherName = (otherProfile?.full_name || "").trim() ||
            (mode === "hire" ? "Helper" : "Client");
          const photoUrl = getServiceCategoryImage(job.service_type ?? null);

          return (
            <button
              key={job.id}
              type="button"
              className={cardBtnClass}
              onClick={() => {
                trackEvent(
                  mode === "hire"
                    ? "discover_my_help_live_open"
                    : "discover_my_live_help_open",
                  { job_id: job.id },
                );
                navigate(exploreLiveHelpPath);
              }}
              aria-label={`${title}${loc ? ` in ${loc}` : ""} — ${
                mode === "hire" ? "helped by" : "helping"
              } ${otherName}`}
            >
              <div className={imageWrapClass}>
                <img
                  src={photoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />

                {/* Top overlay gradient — improves legibility of the avatar / name row */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 via-black/30 to-transparent sm:h-14"
                  aria-hidden
                />

                {/* Other-party avatar + name — top of image */}
                <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 p-2 sm:gap-1 sm:p-1.5">
                  <Avatar className="h-8 w-8 overflow-hidden shadow-sm sm:h-7 sm:w-7">
                    <AvatarImage
                      src={otherProfile?.photo_url || undefined}
                      alt=""
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-zinc-200 text-[10px] font-black text-zinc-700 dark:bg-zinc-800 dark:text-white sm:text-[9px]">
                      {otherName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-tight text-white sm:text-[11px]"
                    style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
                  >
                    {otherName}
                  </span>
                </div>

                {/* "Live" pill — bottom-left */}
                <span className="absolute bottom-2 left-2 z-10 inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-emerald-600/95 px-2.5 py-1 text-[12px] font-black uppercase tracking-wide text-white shadow-md backdrop-blur-sm sm:bottom-1.5 sm:left-1.5 sm:gap-1 sm:px-2 sm:py-0.5 sm:text-[10.5px]">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inset-0 rounded-full bg-white/70 motion-safe:animate-ping motion-reduce:hidden" />
                    <span className="relative h-2 w-2 rounded-full bg-white" />
                  </span>
                  <span>Live</span>
                </span>
              </div>

              {/* Text on page background — Airbnb-style simple lines */}
              <div className="flex flex-col gap-1 px-0.5 sm:gap-0.5">
                <span className="min-w-0 truncate text-[15px] font-semibold leading-snug text-zinc-900 dark:text-white sm:text-[13px]">
                  {title}
                </span>
                {loc ? (
                  <span className="flex min-w-0 items-center gap-1 truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px]">
                    <MapPin
                      className="h-3 w-3 shrink-0 sm:h-2.5 sm:w-2.5"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="truncate">{loc}</span>
                  </span>
                ) : null}
                <span className="truncate text-[13px] text-zinc-500 dark:text-zinc-400 sm:text-[11.5px]">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {otherPartyLabel}
                  </span>{" "}
                  {otherName}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
