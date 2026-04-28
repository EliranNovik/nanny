import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
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
  average_rating?: number | null;
  total_ratings?: number | null;
};

function categoryIconNode(serviceType: string | null | undefined): React.ReactNode {
  // Keep these simple + recognizable on tiny sizes.
  if (serviceType === "cleaning") return <Sparkles className="h-4 w-4 shrink-0" aria-hidden />;
  if (serviceType === "cooking") return <CookingPot className="h-4 w-4 shrink-0" aria-hidden />;
  if (serviceType === "pickup_delivery") return <Truck className="h-4 w-4 shrink-0" aria-hidden />;
  if (serviceType === "nanny") return <UsersRound className="h-4 w-4 shrink-0" aria-hidden />;
  return <Wrench className="h-4 w-4 shrink-0" aria-hidden />;
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
      /** Area / city (profile city) */
      locationLine: string;
    }[] = [];
    for (const cat of DISCOVER_HOME_CATEGORIES) {
      if (cat.id === ALL_HELP_CATEGORY_ID) continue;
      if (!isServiceCategoryId(cat.id)) continue;
      const avs = categoryAvatars[cat.id];
      const first = avs?.[0];
      if (!first) continue;
      const helperId = first.helper_user_id;
      out.push({
        key: `${cat.id}-${helperId}`,
        categoryId: cat.id,
        label: cat.label,
        photo: first.photo_url,
        name: first.full_name || "?",
        href: `/profile/${encodeURIComponent(helperId)}?category=${encodeURIComponent(cat.id)}`,
        average_rating: first.average_rating ?? null,
        total_ratings: (first as { total_ratings?: number | null }).total_ratings ?? null,
        locationLine: first.location_line ?? "—",
      });
      if (out.length >= MAX) break;
    }
    return out.slice(0, MAX);
  }, [categoryAvatars]);

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
            created_at?: string;
            start_at?: string | null;
            shift_hours?: string | null;
            time_duration?: string | null;
            profiles?: { photo_url?: string | null; full_name?: string | null };
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
              jr.profiles &&
                (jr.profiles as { average_rating?: number | null }).average_rating != null
                ? Number((jr.profiles as { average_rating?: number | null }).average_rating)
                : null,
            total_ratings:
              jr.profiles &&
                (jr.profiles as { total_ratings?: number | null }).total_ratings != null
                ? Number((jr.profiles as { total_ratings?: number | null }).total_ratings)
                : null,
          });
        },
      );
    }

    return fromOpenHelpRpc(openHelpRows);
  }, [frData, profile?.role, openHelpRows, user?.id, fetchOpenHelpPool]);

  const items = variant === "hire" ? hireItems : workListRows;

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
        "flex shrink-0 flex-col items-center gap-1 text-center",
        "outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2",
        variant === "hire"
          ? "focus-visible:ring-[#1e3a8a]/45"
          : "focus-visible:ring-[#065f46]/45",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-2 transition-transform active:scale-[0.97]",
          variant === "hire"
            ? "bg-[#1e3a8a]/12 text-[#1e3a8a] ring-[#1e3a8a]/25 dark:bg-blue-950/50 dark:text-blue-300"
            : "bg-[#065f46]/12 text-[#065f46] ring-[#065f46]/25 dark:bg-emerald-950/50 dark:text-emerald-300",
        )}
        aria-hidden
      >
        {variant === "hire" ? (
          <UsersRound
            className={discoverIcon.md}
            strokeWidth={DISCOVER_STROKE}
          />
        ) : (
          <ClipboardList
            className={discoverIcon.md}
            strokeWidth={DISCOVER_STROKE}
          />
        )}
      </span>
      <span className="max-w-[5rem] text-[10px] font-bold leading-tight text-foreground">
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
      <div className="space-y-3.5">

        <div
          className={cn(
            "-mx-1 gap-3 px-1 pb-0.5",
            "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "md:mx-0 md:grid md:grid-cols-5 md:grid-rows-1 md:gap-2 md:overflow-visible md:px-0 md:pb-0 md:snap-none lg:gap-3",
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
              <div className="relative hidden aspect-square w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-zinc-800 md:block">
                <img
                  src={row.thumbUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <span className="absolute left-2 top-2 z-[3] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur-md">
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/80 via-black/50 to-transparent"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 z-[2] px-3 pb-2.5 pt-10">
                  <p
                    className={cn(
                      "truncate text-lg font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
                    )}
                  >
                    {shortDisplayName(row.name)}
                  </p>
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
                <Avatar className="h-24 w-24 shadow-[0_4px_12px_rgba(15,23,42,0.12)]">
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
                <span className="absolute bottom-0 right-0 z-10 inline-flex translate-x-2 translate-y-2 items-center gap-1 rounded-full bg-black/65 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              </div>

              {/* TEXT CONTENT (Aligned to match Hire cards on mobile) */}
              <div className="min-w-0 text-left md:p-4 md:pt-3">
                <p className="truncate text-[14px] font-semibold leading-tight text-slate-900 dark:text-zinc-50 md:hidden">
                  {shortDisplayName(row.name)}
                </p>

                <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-zinc-400 md:mt-0 md:text-sm">
                  {row.cityLine}
                </p>

                <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] font-semibold leading-tight text-slate-700 dark:text-zinc-200 md:mt-2 md:text-[15px]">
                  <span className="text-slate-500 dark:text-zinc-400">
                    {row.categoryIcon}
                  </span>
                  {row.title}
                </p>

                {/* Mobile Rating Details */}
                <div className="mt-1 flex items-center gap-1 text-[12px] font-semibold tabular-nums text-slate-500 dark:text-zinc-400 md:hidden">
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
    <div className="space-y-3.5">
      <div
        className={cn(
          "-mx-1 gap-3 px-1 pb-0.5",
          "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:mx-0 md:grid md:grid-cols-5 md:grid-rows-1 md:gap-2 md:overflow-visible md:px-0 md:pb-0 md:snap-none lg:gap-3",
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
            <div className="relative hidden aspect-square w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-zinc-800 md:block">
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
              <span className="absolute left-2 top-2 z-[3] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur-md">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black/80 via-black/50 to-transparent"
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 z-[2] px-3 pb-2.5 pt-10">
                <p className="truncate text-lg font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                  {shortDisplayName(it.name)}
                </p>
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
              <Avatar className="h-24 w-24 shadow-[0_4px_12px_rgba(15,23,42,0.12)]">
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
              <span className="absolute bottom-0 right-0 z-10 inline-flex translate-x-2 translate-y-2 items-center gap-1 rounded-full bg-black/65 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/20">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            </div>

            <div className="min-w-0 text-left md:p-4 md:pt-3">
              <p className="truncate text-[14px] font-semibold leading-tight text-slate-900 dark:text-zinc-50 md:hidden">
                {shortDisplayName(it.name)}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-zinc-400 md:mt-0 md:text-sm">
                {it.locationLine}
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] font-semibold leading-tight text-slate-700 dark:text-zinc-200 md:mt-2 md:text-[15px]">
                <span className="text-slate-500 dark:text-zinc-400">
                  {categoryIconNode(it.categoryId)}
                </span>
                {it.label}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[12px] font-semibold tabular-nums text-slate-500 dark:text-zinc-400 md:hidden">
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
