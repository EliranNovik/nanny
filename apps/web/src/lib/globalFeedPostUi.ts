import type { TFunction } from "i18next";
import { format, parseISO } from "date-fns";
import { haversineDistanceKm } from "@/lib/geo";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import type { GeneratedPostCopy } from "@/lib/generatedPostCopy";
import { isRequestHelpWhenExpired } from "@/lib/requestHelpWhen";
import { cn } from "@/lib/utils";

const FEED_POST_TYPE_IDS = [
  "request_help",
  "offer_service",
  "community",
  "event",
] as const;

const FEED_WHEN_LABEL_KEYS: Record<string, string> = {
  now: "feed.filters.whenNow",
  today: "feed.filters.whenToday",
  tomorrow: "feed.filters.whenTomorrow",
  this_week: "feed.filters.whenThisWeek",
  custom: "feed.filters.whenCustom",
};

export type ViewerLocation = {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
};

type GlobalFeedPostLike = {
  source: "post" | "job_request" | "availability";
  post_type_id?: string | null;
  post_types?: { id: string; name?: string } | null;
  post_metadata?: Record<string, unknown> | null;
};

export function feedPostTypeId(post: GlobalFeedPostLike): string | null {
  if (post.source === "job_request") return "request_help";
  if (post.source === "post") return post.post_types?.id ?? post.post_type_id ?? null;
  return null;
}

export function feedPostLocationAddress(post: GlobalFeedPostLike): string | null {
  if (post.source === "job_request") {
    const location = post.post_metadata?.location;
    return typeof location === "string" && location.trim() ? location.trim() : null;
  }
  if (post.source === "post" && post.post_metadata?.location) {
    const location = post.post_metadata.location;
    return typeof location === "string" && location.trim() ? location.trim() : null;
  }
  return null;
}

export function feedPostLocationCoords(
  post: GlobalFeedPostLike,
): { lat: number; lng: number } | null {
  if (post.source !== "post" || !post.post_metadata) return null;
  const lat = post.post_metadata.location_lat;
  const lng = post.post_metadata.location_lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function formatFeedDistanceKm(km: number): string {
  if (km < 1) return "< 1 km";
  return `${Math.round(km)} km`;
}

export function feedPostLocationLine(
  t: TFunction,
  locationLabel: string,
  viewer: ViewerLocation | null | undefined,
  post: GlobalFeedPostLike,
): string {
  const trimmed = locationLabel.trim();
  if (!trimmed) return "";

  const coords = feedPostLocationCoords(post);
  const viewerLat = viewer?.lat;
  const viewerLng = viewer?.lng;
  if (
    coords &&
    typeof viewerLat === "number" &&
    typeof viewerLng === "number" &&
    Number.isFinite(viewerLat) &&
    Number.isFinite(viewerLng)
  ) {
    const km = haversineDistanceKm(viewerLat, viewerLng, coords.lat, coords.lng);
    return t("feed.global.locationWithDistance", {
      location: trimmed,
      distance: formatFeedDistanceKm(km),
    });
  }

  return trimmed;
}

export function feedPostTitle(
  t: TFunction,
  post: GlobalFeedPostLike,
  generatedCopy: GeneratedPostCopy | null,
  categoryLabel: string | null | undefined,
): string | null {
  if (generatedCopy?.title?.trim()) return generatedCopy.title.trim();

  if (post.source === "post" && post.post_type_id === "event") {
    const name = post.post_metadata?.event_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }

  const typeId = feedPostTypeId(post);
  if (
    (typeId === "request_help" || post.source === "job_request") &&
    categoryLabel?.trim()
  ) {
    return t("feed.global.categoryHelpTitle", { category: categoryLabel.trim() });
  }

  return null;
}

export function feedPostDescription(
  generatedCopy: GeneratedPostCopy | null,
  caption: string,
  title: string | null,
): string {
  const text = (generatedCopy?.short_text ?? caption).trim();
  if (!text) return "";
  if (title && text.toLowerCase() === title.toLowerCase()) return "";
  return text;
}

/** Global feed post card shell — darker on desktop dark mode for contrast with page bg. */
export const globalFeedCardSurfaceClass =
  "bg-white shadow-none dark:bg-zinc-800/65 md:dark:bg-zinc-900";

export function globalFeedPostTypeAccentClass(typeId: string | null): string {
  switch (typeId) {
    case "request_help":
      return "text-red-600 dark:text-red-400";
    case "offer_service":
      return "text-emerald-600 dark:text-emerald-400";
    case "event":
      return "text-violet-600 dark:text-violet-400";
    case "community":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-muted-foreground";
  }
}

export function globalFeedTextOnlySurfaceClass(typeId: string | null): string {
  switch (typeId) {
    case "request_help":
      return "bg-zinc-50/90 dark:bg-red-950/25";
    case "offer_service":
      return "bg-zinc-50/90 dark:bg-emerald-950/25";
    case "event":
      return "bg-violet-50/90 dark:bg-violet-950/25";
    default:
      return "bg-zinc-50/90 dark:bg-zinc-800/55";
  }
}

export function globalFeedCtaLabel(
  t: TFunction,
  opts: {
    isJobRequest: boolean;
    jobAcceptedAt: string | null;
    postTypeId: string | null;
    authorFirstName: string;
    isOwnEventPost: boolean;
    eventJoinStatus: "accepted" | "declined" | "pending" | null;
  },
): string {
  if (opts.jobAcceptedAt) {
    return "Pending confirmation";
  }

  if (opts.isJobRequest) {
    return t("feed.global.offerHelp");
  }

  switch (opts.postTypeId) {
    case "request_help":
      return t("feed.global.offerHelp");
    case "offer_service":
      return t("feed.global.messageName", { name: opts.authorFirstName });
    case "event":
      if (opts.isOwnEventPost) return t("feed.event.viewInterestedUsers");
      if (opts.eventJoinStatus === "accepted") return t("feed.event.selectedHelper");
      if (opts.eventJoinStatus === "declined") return t("feed.event.declined");
      if (opts.eventJoinStatus === "pending") return t("feed.event.interested");
      return t("feed.global.joinEvent");
    default:
      return t("feed.global.messageName", { name: opts.authorFirstName });
  }
}

export function globalFeedPrimaryCtaClass(typeId: string | null, state?: "accepted" | "declined" | "pending"): string {
  if (state === "accepted") {
    return "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-300/80 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-800/80";
  }
  if (state === "declined") {
    return "bg-muted text-muted-foreground ring-1 ring-border/80";
  }
  if (state === "pending") {
    return "bg-violet-500/15 text-violet-700 ring-1 ring-violet-300/80 dark:bg-violet-950/30 dark:text-violet-200 dark:ring-violet-800/80";
  }

  switch (typeId) {
    case "request_help":
      return "bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-600";
    case "offer_service":
      return "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600";
    case "event":
      return "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-700 dark:hover:bg-violet-600";
    default:
      return "bg-orange-600 hover:bg-orange-700 text-white";
  }
}

function feedLocationSlug(part: string): string {
  return part
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function feedRateTypeLabel(t: TFunction, rateType?: string | null): string {
  return rateType === "per_hour"
    ? t("feed.budget.perHour")
    : t("feed.budget.fixedPrice");
}

export function feedLocationDisplayLabel(
  t: TFunction,
  location?: string | null,
): string {
  if (!location?.trim()) return "";
  const localizedCountry = t("feed.location.countryIsrael");
  const parts = location
    .trim()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return location.trim();

  return parts
    .map((part) => {
      if (/^israel$/i.test(part)) return localizedCountry;
      const slug = feedLocationSlug(part);
      if (!slug) return part;
      return t(`feed.location.cities.${slug}`, { defaultValue: part });
    })
    .join(", ");
}

function feedEventDateTimeLabel(
  t: TFunction,
  language: string,
  metadata: Record<string, unknown>,
): string | null {
  const eventDate = metadata.event_date;
  if (typeof eventDate === "string" && eventDate.trim()) {
    try {
      const base = parseISO(eventDate.trim());
      if (!Number.isNaN(base.getTime())) {
        const locale = dateFnsLocaleFor(language);
        const eventTime = metadata.event_time;
        const timeStr = typeof eventTime === "string" ? eventTime : "00:00";
        const [hours, minutes] = timeStr.split(":").map((part) => parseInt(part, 10));
        const dt = new Date(base);
        dt.setHours(
          Number.isFinite(hours) ? hours : 0,
          Number.isFinite(minutes) ? minutes : 0,
          0,
          0,
        );
        return t("feed.event.dateTime", {
          date: format(dt, "EEEE, MMMM d", { locale }),
          time: format(dt, "h:mm a", { locale }),
        });
      }
    } catch {
      /* fall through */
    }
  }
  const dateTime = metadata.date_time;
  return typeof dateTime === "string" && dateTime.trim() ? dateTime.trim() : null;
}

function feedWhenLabelFromMetadata(
  t: TFunction,
  metadata: Record<string, unknown>,
): string | null {
  const timeframe = metadata.timeframe;
  if (typeof timeframe !== "string" || !timeframe) return null;
  if (timeframe === "custom") {
    const customWhen = metadata.custom_when;
    return typeof customWhen === "string" && customWhen.trim()
      ? customWhen.trim()
      : null;
  }
  const key = FEED_WHEN_LABEL_KEYS[timeframe];
  if (key) return t(key);
  return timeframe.replace(/_/g, " ");
}

export function feedWhenDisplayLabel(
  t: TFunction,
  metadata: Record<string, unknown> | null | undefined,
  createdAt?: string | null,
): string | null {
  if (!metadata) return null;
  const timeframe = metadata.timeframe;
  if (typeof timeframe !== "string" || !timeframe) return null;
  if (createdAt && isRequestHelpWhenExpired(timeframe, createdAt)) {
    return t("feed.whenExpired");
  }
  return feedWhenLabelFromMetadata(t, metadata);
}

export function feedPostWhenLabel(
  t: TFunction,
  language: string,
  postTypeId: string | null,
  metadata: Record<string, unknown> | null | undefined,
  createdAt?: string | null,
): string | null {
  if (!metadata) return null;
  if (postTypeId === "request_help" && metadata.timeframe) {
    return feedWhenDisplayLabel(t, metadata, createdAt);
  }
  if (postTypeId === "event") {
    return feedEventDateTimeLabel(t, language, metadata);
  }
  return null;
}

export function feedPostBudgetLine(
  t: TFunction,
  postTypeId: string | null,
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || !postTypeId) return null;
  if (postTypeId === "request_help") {
    const budget = metadata.budget;
    if (budget == null || budget === "") return null;
    return `₪${budget} ${feedRateTypeLabel(t, metadata.rate_type as string | null | undefined)}`;
  }
  if (postTypeId === "offer_service") {
    const rate = metadata.rate;
    if (rate == null || rate === "") return null;
    return `₪${rate} ${feedRateTypeLabel(t, metadata.rate_type as string | null | undefined)}`;
  }
  return null;
}

export function globalFeedPostTypeBadgeLabel(
  t: TFunction,
  typeId: string,
  typeName?: string,
): string {
  if ((FEED_POST_TYPE_IDS as readonly string[]).includes(typeId)) {
    return t(`feed.postType.${typeId}`);
  }
  return typeName ?? typeId;
}

export function globalFeedPostTypeBadgeClass(typeId: string): string {
  return cn(
    "inline-flex items-center font-black uppercase tracking-wide rounded-md px-2.5 py-0.5 text-[11px]",
    typeId === "request_help" && "bg-red-500/25 text-red-200",
    typeId === "offer_service" && "bg-emerald-500/25 text-emerald-200",
    typeId === "community" && "bg-blue-500/25 text-blue-200",
    typeId === "event" && "bg-violet-500/25 text-violet-200",
  );
}

/** Mobile global feed page background — mirrors native DiscoverPalette background. */
export const globalFeedMobilePageClass =
  "max-md:bg-[#f5f5f5] dark:max-md:bg-[#101214]";

/** Mobile global feed card shell — edge-to-edge, elevated surface, 12px vertical gap. */
export const globalFeedMobileCardClass =
  "max-md:rounded-none max-md:mb-3 max-md:shadow-none max-md:ring-0 max-md:bg-white dark:max-md:bg-[#181b1f]";

/** Mobile card inner horizontal padding. */
export const globalFeedMobileCardPadClass = "max-md:px-4";

export function globalFeedMobileTextOnlySurfaceClass(typeId: string | null): string {
  switch (typeId) {
    case "request_help":
      return "max-md:bg-red-50 dark:max-md:bg-red-950/25";
    case "offer_service":
      return "max-md:bg-emerald-50 dark:max-md:bg-emerald-950/25";
    case "event":
      return "max-md:bg-violet-50 dark:max-md:bg-violet-950/25";
    case "community":
      return "max-md:bg-blue-50 dark:max-md:bg-blue-950/20";
    default:
      return "max-md:bg-zinc-50 dark:max-md:bg-zinc-800/55";
  }
}

/** Mobile feed header type badge — theme-aware pill (11px / 900), max-md only. */
export function globalFeedMobilePostTypeBadgeClass(typeId: string): string {
  return cn(
    "max-md:gap-0 max-md:rounded-md max-md:border-0 max-md:px-2.5 max-md:py-0.5 max-md:text-[11px] max-md:font-black max-md:uppercase max-md:tracking-[0.06em] max-md:shadow-none",
    typeId === "request_help" &&
      "max-md:bg-red-100 max-md:text-red-700 dark:max-md:bg-red-500/25 dark:max-md:text-red-200",
    typeId === "offer_service" &&
      "max-md:bg-emerald-100 max-md:text-emerald-700 dark:max-md:bg-emerald-500/25 dark:max-md:text-emerald-200",
    typeId === "community" &&
      "max-md:bg-blue-100 max-md:text-blue-700 dark:max-md:bg-blue-500/25 dark:max-md:text-blue-200",
    typeId === "event" &&
      "max-md:bg-violet-100 max-md:text-violet-700 dark:max-md:bg-violet-500/25 dark:max-md:text-violet-200",
  );
}

/** Mobile engagement row — flush with card surface. */
export const globalFeedMobileEngagementRowClass =
  "max-md:rounded-none max-md:bg-white max-md:border-t max-md:border-zinc-100 dark:max-md:bg-[#181b1f] dark:max-md:border-zinc-800/80";

/** Mobile comments bottom sheet shell. */
export const globalFeedMobileCommentsSheetClass =
  "max-md:bg-white max-md:text-zinc-900 dark:max-md:bg-[#101214] dark:max-md:text-zinc-100";

export const globalFeedMobileCommentsComposerWrapClass =
  "max-md:bg-white max-md:pt-2.5 dark:max-md:bg-[#101214] max-md:border-t max-md:border-zinc-100 dark:max-md:border-zinc-800/80";

export const globalFeedMobileCommentsInputShellClass =
  "max-md:rounded-full max-md:bg-[#f5f5f5] dark:max-md:bg-zinc-800";

export const globalFeedMobileCommentsInputClass =
  "max-md:text-[15px] max-md:font-medium max-md:text-zinc-900 max-md:placeholder:text-zinc-400 dark:max-md:text-zinc-100 dark:max-md:placeholder:text-zinc-500";

export const globalFeedMobileCommentsSendBtnClass =
  "max-md:h-[42px] max-md:w-[42px] max-md:rounded-full max-md:bg-white max-md:text-zinc-900 dark:max-md:bg-[#101214] dark:max-md:text-zinc-100";

export function feedPostReelLocationLine(
  t: TFunction,
  post: GlobalFeedPostLike,
): string | null {
  const address = feedPostLocationAddress(post);
  if (!address) return null;
  return feedLocationDisplayLabel(t, address);
}
