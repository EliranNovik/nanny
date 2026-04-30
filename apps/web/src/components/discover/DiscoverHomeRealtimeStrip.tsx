import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { canStartInCardLabel, respondsWithinCardLabel } from "@/lib/liveCanStart";
import {
  DISCOVER_HOME_CATEGORIES,
  ALL_HELP_CATEGORY_ID,
  SERVICE_CATEGORIES,
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { trackEvent } from "@/lib/analytics";
import { matchesCommunityRequestsIncoming } from "@/lib/communityRequestsNotificationFilter";
import { haversineDistanceKm } from "@/lib/geo";
import {
  useDiscoverOpenHelpRequests,
  type DiscoverOpenHelpRequestRow,
} from "@/hooks/data/useDiscoverOpenHelpRequests";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClipboardList,
  Compass,
  CookingPot,
  Sparkles,
  Star,
  Truck,
  Wrench,
  UsersRound,
  Zap,
  MessageCircle,
  MapPin,
  BadgeCheck,
} from "lucide-react";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";

/** One full row of cards on desktop (md:grid-cols-5); mobile strip stays compact. */
const MAX = 5;
/** Same row count as hire strip on Discover home desktop. */
const MAX_WORK_REQUEST_ROWS = 5;

function ageLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  try {
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return null;
    const diffMs = Date.now() - t;
    const hoursTotal = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const days = Math.floor(hoursTotal / 24);
    const hours = hoursTotal % 24;
    if (days > 0) return `Posted ${days}d ${hours}h ago`;
    return `Posted ${hoursTotal}h ago`;
  } catch {
    return null;
  }
}

function shortDisplayName(full: string | null | undefined): string {
  const t = (full || "?").trim();
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${parts[0]!} ${last.charAt(0).toUpperCase()}.`;
}

function ratingLabel(r: number | null | undefined): string {
  if (r == null || Number.isNaN(Number(r)) || Number(r) <= 0) return "New";
  return Number(r).toFixed(1);
}

type Props = {
  variant: "hire" | "work";
  explorePath: string;
};

type WorkRowItem = {
  key: string;
  href: string;
  jobId: string;
  title: string;
  categoryIcon: React.ReactNode;
  /** City / area only */
  cityLine: string;
  createdAt: string | null;
  /** Shift / duration / time — only when present */
  detailLine: string | null;
  /** care_type + care_frequency from job_requests (footer) */
  helpTypeLine: string | null;
  /** job_requests.time_duration only */
  durationLine: string | null;
  thumbUrl: string;
  name: string;
  average_rating: number | null;
  total_ratings: number | null;
  responds_within_label?: string | null;
  distanceKm?: number | null;
  is_verified?: boolean | null;
  clientId: string;
  categoryId: ServiceCategoryId;
};

function categoryIconNode(
  serviceType: string | null | undefined,
  className = "h-4 w-4 shrink-0",
): React.ReactNode {
  // Keep these simple + recognizable on tiny sizes.
  if (serviceType === "cleaning") return <Sparkles className={className} aria-hidden />;
  if (serviceType === "cooking") return <CookingPot className={className} aria-hidden />;
  if (serviceType === "pickup_delivery") return <Truck className={className} aria-hidden />;
  if (serviceType === "nanny") return <UsersRound className={className} aria-hidden />;
  return <Wrench className={className} aria-hidden />;
}

function categoryImageSrc(
  serviceType: string | null | undefined,
): string {
  if (serviceType && isServiceCategoryId(serviceType)) {
    const hit = SERVICE_CATEGORIES.find((c) => c.id === serviceType);
    if (hit) return hit.imageSrc;
  }
  return SERVICE_CATEGORIES[0]?.imageSrc ?? "/nanny-mar22.png";
}

// (relativeDayLabel / pickBadge were used by the old vertical list UI; removed)

function humanizeSnakeField(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  return t.replace(/_/g, " ");
}

function buildHelpTypeFromCareFields(
  careType: string | null | undefined,
  careFrequency: string | null | undefined,
): string | null {
  const ct = humanizeSnakeField(careType);
  const cf = humanizeSnakeField(careFrequency);
  const parts = [ct, cf].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function mapJobLikeToWorkRow(opts: {
  key: string;
  jobId: string;
  href: string;
  serviceType: string | null | undefined;
  location_city: string | null | undefined;
  created_at?: string | null;
  start_at?: string | null;
  shift_hours?: string | null;
  time_duration?: string | null;
  care_type?: string | null;
  care_frequency?: string | null;
  photo: string | null | undefined;
  name: string | null | undefined;
  average_rating?: number | null | undefined;
  total_ratings?: number | null | undefined;
  responds_within_label?: string | null;
  distanceKm?: number | null;
  is_verified?: boolean | null;
  clientId: string;
}): WorkRowItem {
  const cat = opts.serviceType;
  const title =
    cat && isServiceCategoryId(cat)
      ? serviceCategoryLabel(cat as ServiceCategoryId)
      : (cat || "Request").replace(/_/g, " ");
  const categoryIcon = categoryIconNode(cat);
  const city = (opts.location_city || "").trim() || "—";
  const rawDetail = formatJobDetailLine({
    shift_hours: opts.shift_hours,
    time_duration: opts.time_duration,
    start_at: opts.start_at ?? null,
  });
  const detailLine = rawDetail === "—" ? null : rawDetail;
  const helpTypeLine = buildHelpTypeFromCareFields(
    opts.care_type,
    opts.care_frequency,
  );
  const durationLine = (opts.time_duration || "").trim() || null;
  const thumb = opts.photo?.trim() || categoryImageSrc(cat ?? null);
  return {
    key: opts.key,
    href: opts.href,
    jobId: opts.jobId,
    title,
    categoryIcon,
    cityLine: city,
    createdAt: opts.created_at ?? null,
    detailLine,
    helpTypeLine,
    durationLine,
    thumbUrl: thumb,
    name: (opts.name || "?").trim() || "?",
    average_rating: opts.average_rating ?? null,
    total_ratings: opts.total_ratings ?? null,
    responds_within_label: opts.responds_within_label ?? null,
    distanceKm: opts.distanceKm ?? null,
    is_verified: opts.is_verified ?? null,
    clientId: opts.clientId,
    categoryId: opts.serviceType as ServiceCategoryId,
  };
}

function formatJobDetailLine(job: {
  shift_hours?: string | null;
  time_duration?: string | null;
  start_at?: string | null;
}): string {
  const parts: string[] = [];
  const sh = (job.shift_hours || "").trim();
  const td = (job.time_duration || "").trim();
  if (sh) parts.push(sh);
  if (td) parts.push(td);
  if (parts.length) return parts.join(" · ");
  if (job.start_at) {
    try {
      const d = new Date(job.start_at);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      /* ignore */
    }
  }
  return "—";
}

/**
 * Hire: horizontal avatar strip. Work: vertical request rows (reference layout).
 */
export function DiscoverHomeRealtimeStrip({ variant, explorePath }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: categoryAvatars = {} } = useDiscoverLiveAvatars(user?.id);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<ServiceCategoryId | "all">("all");
  const { data: frData } = useFreelancerRequests(
    variant === "work" && user?.id ? user.id : undefined,
  );
  const fetchOpenHelpPool =
    variant === "work" &&
    !!user?.id &&
    profile?.role !== "freelancer";
  const { data: openHelpRows = [] } = useDiscoverOpenHelpRequests(
    fetchOpenHelpPool,
    user?.id,
  );

  const hireLiveHelperCount = useMemo(() => {
    let n = 0;
    for (const catId of Object.keys(categoryAvatars)) {
      if (catId === ALL_HELP_CATEGORY_ID) continue;
      const avs = categoryAvatars[catId as ServiceCategoryId];
      if (Array.isArray(avs)) n += avs.length;
    }
    return n;
  }, [categoryAvatars]);

  const hireItems = useMemo(() => {
    const out: {
      key: string;
      categoryId: ServiceCategoryId;
      label: string;
      photo: string | null;
      name: string;
      href: string;
      average_rating: number | null;
      total_ratings: number | null;
      locationLine: string;
      can_start_in_label: string | null;
      responds_within_label: string | null;
      distanceKm: number | null;
      is_verified: boolean | null;
      categoryIcon: React.ReactNode;
    }[] = [];

    const categoriesToProcess = selectedFilterCategory === "all"
      ? DISCOVER_HOME_CATEGORIES.filter(c => c.id !== ALL_HELP_CATEGORY_ID && isServiceCategoryId(c.id))
      : DISCOVER_HOME_CATEGORIES.filter(c => c.id === selectedFilterCategory);

    for (const cat of categoriesToProcess) {
      const avs = categoryAvatars[cat.id as ServiceCategoryId] || [];
      const count = selectedFilterCategory === "all" ? 1 : MAX;
      const subset = avs.slice(0, count);

      for (const first of subset) {
        const helperId = first.helper_user_id;
        out.push({
          key: `${cat.id}-${helperId}`,
          categoryId: cat.id as ServiceCategoryId,
          label: cat.label,
          photo: first.photo_url,
          name: first.full_name || "?",
          href: `/profile/${encodeURIComponent(helperId)}?category=${encodeURIComponent(cat.id)}`,
          average_rating: first.average_rating ?? null,
          total_ratings: (first as { total_ratings?: number | null }).total_ratings ?? null,
          locationLine: first.location_line || "",
          can_start_in_label: canStartInCardLabel(first.live_can_start_in),
          responds_within_label: respondsWithinCardLabel(first.avg_reply_seconds, first.reply_sample_count),
          distanceKm: (() => {
            const vl = profile?.location_lat;
            const vg = profile?.location_lng;
            const hl = first.location_lat;
            const hn = first.location_lng;
            if (vl != null && vg != null && hl != null && hn != null) {
              const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
              if ([a, b, c, d].every(Number.isFinite)) {
                return haversineDistanceKm(a, b, c, d);
              }
            }
            return first.distance_km ?? null;
          })(),
          is_verified: first.is_verified ?? null,
          categoryIcon: categoryIconNode(cat.id),
        });
      }

      if (selectedFilterCategory === "all" && out.length >= MAX) break;
      if (selectedFilterCategory !== "all" && out.length >= MAX) break;
    }
    return out.slice(0, MAX);
  }, [categoryAvatars, selectedFilterCategory, profile]);

  const workListRows = useMemo((): WorkRowItem[] => {
    const focusHref = (jobId: string) =>
      `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(jobId)}`;

    const fromOpenHelpRpc = (rows: DiscoverOpenHelpRequestRow[]) =>
      rows.slice(0, MAX_WORK_REQUEST_ROWS).map((r) =>
        mapJobLikeToWorkRow({
          key: r.id,
          jobId: r.id,
          href: focusHref(r.id),
          serviceType: r.service_type,
          location_city: r.location_city,
          created_at: r.created_at,
          start_at: r.start_at,
          shift_hours: r.shift_hours,
          time_duration: r.time_duration,
          care_type: r.care_type ?? null,
          care_frequency: r.care_frequency ?? null,
          photo: r.client_photo_url,
          name: r.client_display_name,
          average_rating: r.client_average_rating ?? null,
          total_ratings: r.client_total_ratings ?? null,
          responds_within_label: respondsWithinCardLabel(r.client_avg_reply_seconds, r.client_reply_sample_count),
          distanceKm: (() => {
            const vl = profile?.location_lat;
            const vg = profile?.location_lng;
            const hl = r.location_lat;
            const hn = r.location_lng;
            if (vl != null && vg != null && hl != null && hn != null) {
              const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
              if ([a, b, c, d].every(Number.isFinite)) {
                return haversineDistanceKm(a, b, c, d);
              }
            }
            return null;
          })(),
          is_verified: r.is_verified ?? null,
          clientId: r.client_id ?? "",
        }),
      );

    if (profile?.role === "freelancer") {
      // Same data as Jobs → Community’s requests only (your notification inbox).
      // Do not merge get_discover_open_help_requests — that pool is not what the tab shows.
      const inbound = (frData?.inboundNotifications ?? []).filter((n) =>
        matchesCommunityRequestsIncoming(n, {
          excludeClientId: user?.id ?? null,
        }),
      );
      return inbound.slice(0, MAX_WORK_REQUEST_ROWS).map(
        (n: {
          id: string;
          job_requests: {
            id: string;
            service_type?: string;
            care_type?: string | null;
            care_frequency?: string | null;
            location_city?: string;
            location_lat?: number | null;
            location_lng?: number | null;
            created_at?: string;
            start_at?: string | null;
            shift_hours?: string | null;
            time_duration?: string | null;
            profiles?: { photo_url?: string | null; full_name?: string | null; average_rating?: number | null; total_ratings?: number | null; is_verified?: boolean | null };
            client_avg_reply_seconds?: number | null;
            client_reply_sample_count?: number | null;
          };
        }) => {
          const jr = n.job_requests;
          return mapJobLikeToWorkRow({
            key: n.id,
            jobId: jr.id,
            href: focusHref(jr.id),
            serviceType: jr.service_type,
            location_city: jr.location_city,
            created_at: jr.created_at,
            start_at: jr.start_at,
            shift_hours: jr.shift_hours,
            time_duration: jr.time_duration,
            care_type: jr.care_type ?? null,
            care_frequency: jr.care_frequency ?? null,
            photo: jr.profiles?.photo_url,
            name: jr.profiles?.full_name,
            average_rating:
              jr.profiles?.average_rating != null ? Number(jr.profiles.average_rating) : null,
            total_ratings:
              jr.profiles?.total_ratings != null ? Number(jr.profiles.total_ratings) : null,
            distanceKm: (() => {
              const vl = profile?.location_lat;
              const vg = profile?.location_lng;
              const hl = jr.location_lat;
              const hn = jr.location_lng;
              if (vl != null && vg != null && hl != null && hn != null) {
                const a = Number(vl), b = Number(vg), c = Number(hl), d = Number(hn);
                if ([a, b, c, d].every(Number.isFinite)) {
                  return haversineDistanceKm(a, b, c, d);
                }
              }
              return null;
            })(),
            is_verified: jr.profiles?.is_verified ?? null,
            clientId: (jr as any).client_id ?? "",
          });
        },
      );
    }

    const list = fromOpenHelpRpc(openHelpRows);
    if (selectedFilterCategory === "all") return list;
    return list.filter(item => {
      // item.jobId is used to find the original row
      const original = openHelpRows.find(r => r.id === item.jobId);
      return original?.service_type === selectedFilterCategory;
    });
  }, [frData, profile?.role, openHelpRows, user?.id, fetchOpenHelpPool, selectedFilterCategory]);

  const items = variant === "hire" ? hireItems : workListRows;

  const workCounts = useMemo(() => {
    if (variant !== "work") return null;
    const rows = items as WorkRowItem[];
    const counts: Record<string, number> = {};
    for (const cat of DISCOVER_HOME_CATEGORIES) {
      if (cat.id === ALL_HELP_CATEGORY_ID) {
        counts[cat.id] = rows.length;
      } else {
        counts[cat.id] = rows.filter((r) => r.categoryId === cat.id).length;
      }
    }
    return counts;
  }, [variant, items]);

  function onBrowseTap() {
    if (variant === "hire") {
      trackEvent("discover_strip_view_all", { variant: "hire_live_posts" });
      navigate("/client/helpers");
      return;
    }
    trackEvent("discover_strip_view_all", { variant: "work_community_requests" });
    navigate("/freelancer/jobs/match");
  }

  const browseLabel =
    variant === "hire" ? "Browse helpers" : "Browse requests";

  const BrowseRoundControl = (
    <button
      type="button"
      onClick={onBrowseTap}
      className={cn(
        "flex shrink-0 flex-col items-center gap-2 text-center min-h-24 justify-center",
        "outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2",
        variant === "hire"
          ? "focus-visible:ring-[#1e3a8a]/45"
          : "focus-visible:ring-[#065f46]/45",
      )}
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full shadow-sm ring-2 transition-transform active:scale-[0.97]",
          variant === "hire"
            ? "bg-[#1e3a8a]/12 text-[#1e3a8a] ring-[#1e3a8a]/25 dark:bg-blue-950/50 dark:text-blue-300"
            : "bg-[#065f46]/12 text-[#065f46] ring-[#065f46]/25 dark:bg-emerald-950/50 dark:text-emerald-300",
        )}
        aria-hidden
      >
        {variant === "hire" ? (
          <UsersRound
            className="w-8 h-8"
            strokeWidth={DISCOVER_STROKE}
          />
        ) : (
          <ClipboardList
            className="w-8 h-8"
            strokeWidth={DISCOVER_STROKE}
          />
        )}
      </span>
      <span className="max-w-[6rem] text-xs font-bold leading-tight text-foreground">
        {browseLabel}
      </span>
    </button>
  );

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[1rem] border border-dashed px-4 py-5 dark:bg-zinc-900/40",
          variant === "hire"
            ? "border-[#7B61FF]/25 bg-[rgba(123,97,255,0.06)]"
            : "border-border/50 bg-muted/25",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 flex-col items-center gap-2 text-center text-sm text-muted-foreground sm:items-start sm:text-left">
            {variant === "hire" ? (
              <p>
                No helpers showing as available right now — try{" "}
                <button
                  type="button"
                  onClick={onBrowseTap}
                  className="font-semibold text-[#7B61FF] underline-offset-4 hover:underline"
                >
                  browsing all helpers
                </button>
                .
              </p>
            ) : (
              <p>
                Nothing live right now — open{" "}
                <Link
                  to={explorePath}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                >
                  <Compass
                    className={cn(discoverIcon.sm, "inline shrink-0")}
                    strokeWidth={DISCOVER_STROKE}
                  />
                  Explore
                </Link>
                .
              </p>
            )}
          </div>
          {variant === "work" ? BrowseRoundControl : null}
        </div>
      </div>
    );
  }

  /* ——— Work mode: vertical list (mockup) ——— */
  if (variant === "work") {
    const rows = items as WorkRowItem[];

    return (
      <div className="space-y-4">
        {/* Category Icons Row - Work Mode */}
        <div className="mt-2 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-3 px-4 pb-2">
          <button
            onClick={() => setSelectedFilterCategory("all")}
            className={cn(
              "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
              "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <div className={cn(
              "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
              "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
              selectedFilterCategory === "all"
                ? "border-emerald-500/70 text-emerald-700 shadow-[0_10px_25px_-16px_rgba(16,185,129,0.7)] dark:text-emerald-300"
                : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
            )}>
              <Compass className="h-9 w-9" strokeWidth={2.5} />
              {(workCounts?.[ALL_HELP_CATEGORY_ID] ?? 0) > 0 && (
                <span className="absolute -right-1 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
                  {workCounts?.[ALL_HELP_CATEGORY_ID] ?? 0}
                </span>
              )}
            </div>
            <span className={cn(
              "text-[9px] font-extrabold uppercase tracking-[0.14em]",
              selectedFilterCategory === "all" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-zinc-500"
            )}>All</span>
          </button>

          {DISCOVER_HOME_CATEGORIES.filter(c => c.id !== ALL_HELP_CATEGORY_ID).map(cat => {
            const count = workCounts?.[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedFilterCategory(cat.id as ServiceCategoryId)}
                className={cn(
                  "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
                  "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <div className={cn(
                  "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
                  "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
                  selectedFilterCategory === cat.id
                    ? "border-emerald-500/70 text-emerald-700 shadow-[0_10px_25px_-16px_rgba(16,185,129,0.7)] dark:text-emerald-300"
                    : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
                )}>
                  <span className="h-9 w-9 flex items-center justify-center">
                    {categoryIconNode(cat.id, "h-6 w-6")}
                  </span>
                  {count > 0 && (
                    <span className="absolute -right-1 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
                      {count}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-extrabold uppercase tracking-[0.14em]",
                  selectedFilterCategory === cat.id ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-zinc-500"
                )}>{cat.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            "flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "md:mx-0 md:grid md:grid-cols-5 md:grid-rows-1 md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none lg:gap-5",
          )}
          role="list"
          aria-label="Requests now near you"
        >
          {rows.map((row) => (
            <Link
              key={row.key}
              to={row.href}
              role="listitem"
              className={cn(
                "flex w-[8rem] shrink-0 snap-start flex-col gap-2 rounded-[14px] p-2.5 transition-all duration-300",
                "bg-transparent border-transparent shadow-none",
                "dark:bg-zinc-800/80 dark:border-transparent dark:shadow-md",
                "active:scale-[0.99]",
                "md:w-full md:min-w-0 md:max-w-none md:overflow-hidden md:p-0",
                "md:rounded-2xl md:hover:shadow-lg",
              )}
            >
              {/* DESKTOP SQUARE IMAGE (Preserved) */}
              <div className="relative hidden aspect-[4/5] w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-zinc-800 md:block">
                <img
                  src={row.thumbUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                <span className="absolute right-2 top-2 z-[3] inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur-md">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  Live
                </span>

                {/* Category Badge - Desktop */}
                <span className="absolute left-2 top-2 z-[3] flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-md ring-1 ring-white/10">
                  <span className="h-4 w-4">{row.categoryIcon}</span>
                </span>
                {row.distanceKm != null && (
                  <span className="absolute bottom-2 left-2 z-[3] inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur-md ring-1 ring-white/10">
                    <MapPin className="h-2.5 w-2.5" strokeWidth={3} />
                    <span>
                      {row.distanceKm < 1 ? `${Math.round(row.distanceKm * 1000)}m` : `${row.distanceKm.toFixed(1)}km`}
                    </span>
                  </span>
                )}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/80 via-black/50 to-transparent"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 z-[2] px-3 pb-2.5 pt-10">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <p className="truncate text-lg font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                      {shortDisplayName(row.name)}
                    </p>
                    {row.is_verified && (
                      <BadgeCheck
                        className="h-[22px] w-[22px] shrink-0 translate-y-[1px] fill-emerald-500 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
                        strokeWidth={2.5}
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] font-semibold tabular-nums text-white/95">
                    <Star
                      className="h-3.5 w-3.5 shrink-0 text-emerald-300"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <span>{ratingLabel(row.average_rating)}</span>
                    {row.total_ratings ? (
                      <span className="text-white/75">({row.total_ratings})</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* MOBILE BIG AVATAR (Like Hire cards) */}
              <div className="relative mx-auto w-fit md:hidden pt-1">
                <Avatar className="h-28 w-28 shadow-[0_4px_12px_rgba(15,23,42,0.12)]">
                  <AvatarImage
                    src={row.thumbUrl || undefined}
                    className="object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <AvatarFallback className="text-xl font-bold">
                    {row.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute top-0 left-0 z-10 -translate-x-1.5 -translate-y-1.5 items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20 inline-flex">
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
                {row.distanceKm != null ? (
                  <span className="absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-900 px-2.5 py-1 shadow-lg ring-1 ring-inset ring-white/20 backdrop-blur-md">
                    <MapPin className="h-3 w-3 shrink-0 text-white" strokeWidth={2.5} aria-hidden />
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-bold tracking-tight text-white">
                        {row.distanceKm < 1 ? `${Math.round(row.distanceKm * 1000)}m` : `${row.distanceKm.toFixed(1)}km`}
                      </span>
                      <span className="text-[8px] font-medium uppercase tracking-wide text-white/70">Away</span>
                    </div>
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 text-left md:p-4 md:pt-3">
                <div className="flex items-center gap-1.5 md:hidden">
                  <p className="truncate text-[17px] font-bold leading-tight text-slate-950 dark:text-zinc-50">
                    {shortDisplayName(row.name)}
                  </p>
                  {row.is_verified && (
                    <BadgeCheck
                      className="h-5 w-5 shrink-0 fill-emerald-500 text-white"
                      strokeWidth={2.5}
                    />
                  )}
                </div>

                <p className="mt-1 truncate text-[14px] text-slate-500 dark:text-zinc-400 md:mt-0 md:text-sm">
                  {row.cityLine}
                </p>

                <p className="mt-1.5 flex items-center gap-1.5 truncate text-[16px] font-bold leading-tight text-slate-800 dark:text-zinc-200 md:mt-2 md:text-[15px]">
                  <span className="text-slate-500 dark:text-zinc-400">
                    {row.categoryIcon}
                  </span>
                  {row.title}
                </p>

                {/* Mobile Rating Details */}
                <div className="mt-1 flex items-center gap-1 text-[14px] font-semibold tabular-nums text-slate-500 dark:text-zinc-400 md:hidden">
                  <Star className="h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-hidden />
                  <span className="text-slate-700 dark:text-zinc-200">
                    {ratingLabel(row.average_rating)}
                  </span>
                  {row.total_ratings ? (
                    <span className="text-slate-400 dark:text-zinc-500">
                      ({row.total_ratings})
                    </span>
                  ) : null}
                </div>

                {/* DESKTOP ONLY EXTRAS (Restored from old Work template) */}
                {row.createdAt ? (
                  <div className="hidden md:flex mt-1 items-center gap-2 md:mt-1.5 text-[10px] font-medium tracking-wide text-slate-400 dark:text-zinc-500 md:text-[13px]">
                    <span>{ageLabel(row.createdAt)}</span>
                  </div>
                ) : null}

                <div
                  className={cn(
                    "hidden md:block",
                    "mt-2.5 space-y-2 border-t border-slate-200/70 pt-2.5 dark:border-zinc-700/70",
                    "md:mt-3 md:pt-3",
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500",
                      )}
                    >
                      Care
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-snug text-slate-800 dark:text-zinc-200 md:text-[13px]">
                      {row.helpTypeLine ?? "Not specified"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500",
                      )}
                    >
                      Duration
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-slate-600 dark:text-zinc-300 md:text-[13px]">
                      {row.durationLine ?? "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  /* ——— Hire mode: helper cards ——— */
  const hireStrip = items as typeof hireItems;
  return (
    <div className="space-y-4">
      {/* Category Icons Row - Hire Mode */}
      <div className="mt-2 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-3 px-4 pb-2">
        <button
          onClick={() => setSelectedFilterCategory("all")}
          className={cn(
            "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
            "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <div className={cn(
            "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
            "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
            selectedFilterCategory === "all"
              ? "border-violet-500/70 text-violet-700 shadow-[0_10px_25px_-16px_rgba(124,58,237,0.7)] dark:text-violet-300"
              : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
          )}>
            <Compass className="h-9 w-9" strokeWidth={2.5} />
            {hireLiveHelperCount > 0 && (
              <span className="absolute -right-1 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#7B61FF] px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
                {hireLiveHelperCount}
              </span>
            )}
          </div>
          <span className={cn(
            "text-[9px] font-extrabold uppercase tracking-[0.14em]",
            selectedFilterCategory === "all" ? "text-violet-700 dark:text-violet-300" : "text-slate-500 dark:text-zinc-500"
          )}>All</span>
        </button>

        {DISCOVER_HOME_CATEGORIES.filter(c => c.id !== ALL_HELP_CATEGORY_ID).map(cat => {
          const count = categoryAvatars[cat.id as ServiceCategoryId]?.length || 0;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedFilterCategory(cat.id as ServiceCategoryId)}
              className={cn(
                "flex flex-col items-center gap-2 shrink-0 transition-transform active:scale-95",
                "focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <div className={cn(
                "relative h-14 w-14 rounded-full flex items-center justify-center border transition-all",
                "bg-white/85 shadow-sm backdrop-blur-md dark:bg-zinc-900/55",
                selectedFilterCategory === cat.id
                  ? "border-violet-500/70 text-violet-700 shadow-[0_10px_25px_-16px_rgba(124,58,237,0.7)] dark:text-violet-300"
                  : "border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-zinc-400"
              )}>
                <span className="h-9 w-9 flex items-center justify-center">
                  {categoryIconNode(cat.id, "h-6 w-6")}
                </span>
                {count > 0 && (
                  <span className="absolute -right-1 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#7B61FF] px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
                    {count}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[9px] font-extrabold uppercase tracking-[0.14em]",
                selectedFilterCategory === cat.id ? "text-violet-700 dark:text-violet-300" : "text-slate-500 dark:text-zinc-500"
              )}>{cat.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "gap-4 pb-0.5",
          "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:mx-0 md:grid md:grid-cols-5 md:grid-rows-1 md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none lg:gap-5",
        )}
        role="list"
      >
        {hireStrip.map((it) => (
          <Link
            key={it.key}
            to={it.href}
            role="listitem"
            className={cn(
              "flex w-[8rem] shrink-0 snap-start flex-col gap-2 rounded-[14px] p-2.5 transition-all duration-300",
              "bg-transparent border-transparent shadow-none",
              "dark:bg-zinc-800/80 dark:border-transparent dark:shadow-md",
              "active:scale-[0.99]",
              "md:w-full md:min-w-0 md:max-w-none md:overflow-hidden md:p-0",
              "md:rounded-2xl md:hover:shadow-lg",
            )}
          >
            <div className="relative hidden aspect-[4/5] w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-zinc-800 md:block">
              {it.photo ? (
                <img
                  src={it.photo}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-slate-400 dark:text-zinc-500">
                  {it.name.charAt(0)}
                </div>
              )}
              {/* Category Badge - Desktop */}
              <span className="absolute left-2 top-2 z-[3] flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-md ring-1 ring-white/10">
                <span className="h-4 w-4">{it.categoryIcon}</span>
              </span>
              <span className="absolute right-2 top-2 z-[3] inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur-md">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
              {it.distanceKm != null ? (
                <span className="absolute bottom-3.5 left-2.5 z-[3] inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white shadow-sm backdrop-blur-md ring-1 ring-white/10">
                  <MapPin className="h-2.5 w-2.5" strokeWidth={3} />
                  <span>{it.distanceKm < 1 ? `${Math.round(it.distanceKm * 1000)}m` : `${it.distanceKm.toFixed(1)}km`} away</span>
                </span>
              ) : it.can_start_in_label ? (
                <span className="absolute bottom-3.5 left-2.5 z-[3] inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-md ring-1 ring-white/10">
                  <Zap className="h-2.5 w-2.5" strokeWidth={3} />
                  <span>Ready {it.can_start_in_label.toLowerCase() === "immediately" ? "Now" : it.can_start_in_label}</span>
                </span>
              ) : it.responds_within_label ? (
                <span className="absolute bottom-3.5 left-2.5 z-[3] inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-md ring-1 ring-white/10">
                  <MessageCircle className="h-2.5 w-2.5" strokeWidth={3} />
                  <span>Replies in {it.responds_within_label}</span>
                </span>
              ) : null}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/80 via-black/50 to-transparent"
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 z-[2] px-3 pb-2.5 pt-10">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <p className="truncate text-lg font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                    {shortDisplayName(it.name)}
                  </p>
                  {it.is_verified && (
                    <BadgeCheck
                      className="h-[22px] w-[22px] shrink-0 translate-y-[1px] fill-emerald-500 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
                      strokeWidth={2.5}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] font-semibold tabular-nums text-white/95">
                  <Star
                    className="h-3.5 w-3.5 shrink-0 text-violet-200"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <span>{ratingLabel(it.average_rating)}</span>
                  {it.total_ratings ? (
                    <span className="text-white/75">({it.total_ratings})</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-fit md:hidden">
              <Avatar className="h-28 w-28 shadow-[0_4px_12px_rgba(15,23,42,0.12)]">
                <AvatarImage
                  src={it.photo || undefined}
                  className="object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <AvatarFallback className="text-xl font-bold">
                  {it.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute top-0 left-0 z-10 -translate-x-1.5 -translate-y-1.5 items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20 inline-flex">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
              {it.distanceKm != null ? (
                <span className="absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 translate-y-[20%] items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-900 px-2.5 py-1.5 shadow-lg ring-1 ring-inset ring-white/20 backdrop-blur-md">
                  <MapPin className="h-3 w-3 shrink-0 text-white" strokeWidth={2.5} aria-hidden />
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold tracking-tight text-white">
                      {it.distanceKm < 1 ? `${Math.round(it.distanceKm * 1000)}m` : `${it.distanceKm.toFixed(1)}km`}
                    </span>
                    <span className="text-[8px] font-medium uppercase tracking-wide text-white/70">Away</span>
                  </div>
                </span>
              ) : it.can_start_in_label ? (
                <span className="absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 translate-y-[20%] items-center gap-1 whitespace-nowrap rounded-full bg-[#2ca36a] px-2.5 py-1.5 shadow-lg ring-1 ring-inset ring-white/20">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.5} aria-hidden />
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/90">Ready</span>
                    <span className="text-[13px] font-black tracking-tight text-white">
                      {it.can_start_in_label.toLowerCase() === "immediately" ? "Now" : it.can_start_in_label}
                    </span>
                  </div>
                </span>
              ) : it.responds_within_label ? (
                <span className="absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 translate-y-[20%] items-center gap-1.5 whitespace-nowrap rounded-full bg-[#2c2b4c]/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                  <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#5c4b8e]">
                    <MessageCircle className="h-2 w-2 text-white" strokeWidth={2.5} aria-hidden />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[7px] font-medium uppercase tracking-wide text-white/90">Replies in</span>
                    <span className="text-[9px] font-bold tracking-tight text-white">
                      {it.responds_within_label}
                    </span>
                  </div>
                </span>
              ) : null}
            </div>

            <div className="min-w-0 text-left md:p-4 md:pt-3">
              <div className="flex items-center gap-1.5 md:hidden">
                <p className="truncate text-[16px] font-semibold leading-tight text-slate-900 dark:text-zinc-50">
                  {shortDisplayName(it.name)}
                </p>
                {it.is_verified && (
                  <BadgeCheck
                    className="h-5 w-5 shrink-0 fill-emerald-500 text-white"
                    strokeWidth={2.5}
                  />
                )}
              </div>
              <p className="mt-0.5 truncate text-[14px] text-slate-500 dark:text-zinc-400 md:mt-0 md:text-sm">
                {it.locationLine}
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[16px] font-bold leading-tight text-slate-700 dark:text-zinc-200 md:mt-2 md:text-[15px]">
                <span className="text-slate-500 dark:text-zinc-400">
                  {categoryIconNode(it.categoryId)}
                </span>
                {it.label}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[14px] font-semibold tabular-nums text-slate-500 dark:text-zinc-400 md:hidden">
                <Star className="h-4 w-4 text-[#7B61FF]" strokeWidth={2.5} aria-hidden />
                <span className="text-slate-700 dark:text-zinc-200">
                  {ratingLabel(it.average_rating)}
                </span>
                {it.total_ratings ? (
                  <span className="text-slate-400 dark:text-zinc-500">
                    ({it.total_ratings})
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
