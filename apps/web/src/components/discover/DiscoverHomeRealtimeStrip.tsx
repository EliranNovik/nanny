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
import { LiveTimer } from "@/components/LiveTimer";
import { T } from "@/lib/typography";
import {
  ChevronRight,
  ClipboardList,
  Compass,
  UsersRound,
} from "lucide-react";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";

const MAX = 4;
/** Align with Jobs → Community's requests: fewer rows than the old strip of 4. */
const MAX_WORK_REQUEST_ROWS = 3;

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
  title: string;
  /** City / area only */
  cityLine: string;
  createdAt: string | null;
  /** Shift / duration / time — only when present */
  detailLine: string | null;
  thumbUrl: string;
  name: string;
};

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

function mapJobLikeToWorkRow(opts: {
  key: string;
  href: string;
  serviceType: string | null | undefined;
  location_city: string | null | undefined;
  created_at?: string | null;
  start_at?: string | null;
  shift_hours?: string | null;
  time_duration?: string | null;
  photo: string | null | undefined;
  name: string | null | undefined;
}): WorkRowItem {
  const cat = opts.serviceType;
  const title =
    cat && isServiceCategoryId(cat)
      ? serviceCategoryLabel(cat as ServiceCategoryId)
      : (cat || "Request").replace(/_/g, " ");
  const city = (opts.location_city || "").trim() || "—";
  const rawDetail = formatJobDetailLine({
    shift_hours: opts.shift_hours,
    time_duration: opts.time_duration,
    start_at: opts.start_at ?? null,
  });
  const detailLine = rawDetail === "—" ? null : rawDetail;
  const thumb = opts.photo?.trim() || categoryImageSrc(cat ?? null);
  return {
    key: opts.key,
    href: opts.href,
    title,
    cityLine: city,
    createdAt: opts.created_at ?? null,
    detailLine,
    thumbUrl: thumb,
    name: (opts.name || "?").trim() || "?",
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
      label: string;
      photo: string | null;
      name: string;
      href: string;
      average_rating: number | null;
      /** Area / city (profile city) */
      locationLine: string;
    }[] = [];
    for (const cat of DISCOVER_HOME_CATEGORIES) {
      if (cat.id === ALL_HELP_CATEGORY_ID) continue;
      const avs = categoryAvatars[cat.id];
      const first = avs?.[0];
      if (!first) continue;
      const helperId = first.helper_user_id;
      out.push({
        key: `${cat.id}-${helperId}`,
        label: cat.label,
        photo: first.photo_url,
        name: first.full_name || "?",
        href: `/profile/${encodeURIComponent(helperId)}?category=${encodeURIComponent(cat.id)}`,
        average_rating: first.average_rating ?? null,
        locationLine: first.location_line ?? "—",
      });
      if (out.length >= MAX) break;
    }
    return out.slice(0, MAX);
  }, [categoryAvatars]);

  const workListRows = useMemo((): WorkRowItem[] => {
    const requestsTabHref = `/jobs?mode=freelancer&tab=requests`;

    const fromOpenHelpRpc = (rows: DiscoverOpenHelpRequestRow[]) =>
      rows.slice(0, MAX_WORK_REQUEST_ROWS).map((r) =>
        mapJobLikeToWorkRow({
          key: r.id,
          href: requestsTabHref,
          serviceType: r.service_type,
          location_city: r.location_city,
          created_at: r.created_at,
          start_at: r.start_at,
          shift_hours: r.shift_hours,
          time_duration: r.time_duration,
          photo: r.client_photo_url,
          name: r.client_display_name,
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
            href: requestsTabHref,
            serviceType: jr.service_type,
            location_city: jr.location_city,
            created_at: jr.created_at,
            start_at: jr.start_at,
            shift_hours: jr.shift_hours,
            time_duration: jr.time_duration,
            photo: jr.profiles?.photo_url,
            name: jr.profiles?.full_name,
          });
        },
      );
    }

    return fromOpenHelpRpc(openHelpRows);
  }, [frData, profile?.role, openHelpRows, user?.id, fetchOpenHelpPool]);

  const title =
    variant === "hire"
      ? "Helpers available now"
      : "Requests now near you";
  const items = variant === "hire" ? hireItems : workListRows;

  function onBrowseTap() {
    if (variant === "hire") {
      trackEvent("discover_strip_view_all", { variant: "hire_live_posts" });
      navigate(
        `/public/posts?category=${encodeURIComponent(ALL_HELP_CATEGORY_ID)}`,
      );
      return;
    }
    trackEvent("discover_strip_view_all", { variant: "work_community_requests" });
    navigate("/jobs?mode=freelancer&tab=requests");
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
            <span
              className={cn(
                "mx-auto h-2 w-2 rounded-full shadow-[0_0_0_3px_rgba(0,0,0,0.06)] sm:mx-0",
                variant === "hire"
                  ? "bg-[#7B61FF] shadow-[0_0_0_3px_rgba(123,97,255,0.22)]"
                  : "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]",
              )}
              aria-hidden
            />
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
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
              aria-hidden
            />
            <h3 className={cn(T.h2, "text-slate-900 dark:text-zinc-50")}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onBrowseTap}
            className={cn(
              "flex shrink-0 items-center gap-0.5 transition-opacity hover:opacity-90",
              "text-[#065f46] dark:text-emerald-400",
              "text-[14px] font-semibold",
            )}
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div
          className={cn(
            "-mx-1 flex gap-3 overflow-x-auto px-1 pb-0.5",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "snap-x snap-mandatory",
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
                "flex w-[10.25rem] shrink-0 snap-start flex-col gap-2 rounded-[14px] border border-slate-200/80 bg-white p-2.5",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
                "transition-[box-shadow,transform,border-color] hover:border-slate-300/90 hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.12)]",
                "active:scale-[0.99] dark:border-zinc-700/70 dark:bg-zinc-900",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/[0.04] dark:bg-zinc-800 dark:ring-white/10">
                    <img
                      src={row.thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("truncate", T.h2, "text-slate-900 dark:text-zinc-50")}>
                      {shortDisplayName(row.name)}
                    </p>
                    <p className={cn("mt-0.5 truncate", T.meta, "text-slate-500 dark:text-zinc-400")}>
                      {row.cityLine}
                    </p>
                  </div>
                </div>
                {/* removed NEW/NOW badge */}
              </div>

              <div className="min-w-0">
                <p className={cn("truncate text-[13px] font-semibold leading-tight", "text-slate-900 dark:text-zinc-50")}>
                  {row.title}
                </p>
                {row.createdAt ? (
                  <div className={cn("mt-1 flex items-center gap-2", T.meta, "text-slate-400 dark:text-zinc-500")}>
                    <span className={cn(T.label, "text-slate-400 dark:text-zinc-500")}>
                      Posted
                    </span>
                    <LiveTimer createdAt={row.createdAt} />
                  </div>
                ) : null}
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
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#7B61FF] shadow-[0_0_0_3px_rgba(123,97,255,0.2)]"
            aria-hidden
          />
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-zinc-50">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onBrowseTap}
          className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium tracking-wide text-[#7B61FF] transition-opacity hover:opacity-90"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <div
        className={cn(
          "-mx-1 flex gap-3 overflow-x-auto px-1 pb-0.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory",
        )}
        role="list"
      >
        {hireStrip.map((it) => (
          <Link
            key={it.key}
            to={it.href}
            role="listitem"
            className={cn(
              "flex w-[8rem] shrink-0 snap-start flex-col gap-2 rounded-[14px] border border-slate-200/80 bg-white p-2.5",
              "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
              "transition-[box-shadow,transform,border-color] hover:border-slate-300/90 hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.12)]",
              "active:scale-[0.99] dark:border-zinc-700/70 dark:bg-zinc-900",
            )}
          >
            <div className="relative mx-auto w-fit">
              <Avatar className="h-20 w-20 shadow-[0_2px_8px_rgba(15,23,42,0.1)]">
                <AvatarImage src={it.photo || undefined} className="object-cover" />
                <AvatarFallback className="text-lg font-semibold">
                  {it.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span
                className="absolute right-[10%] top-[10%] z-10 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm ring-2 ring-white dark:ring-zinc-900"
                aria-hidden
              />
              <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white px-1.5 py-px text-[10px] font-medium tabular-nums text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/90 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600/50">
                <span className="text-slate-900 dark:text-zinc-100" aria-hidden>
                  ★
                </span>
                {ratingLabel(it.average_rating)}
              </span>
            </div>
            <div className="min-w-0 pt-1 text-center">
              <p className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-zinc-50">
                {shortDisplayName(it.name)}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
                {it.label}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-zinc-500">
                {it.locationLine}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
