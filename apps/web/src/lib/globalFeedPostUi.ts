import type { TFunction } from "i18next";
import { format, parseISO } from "date-fns";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";
import he from "@/i18n/locales/he.json";
import ru from "@/i18n/locales/ru.json";
import { haversineDistanceKm } from "@/lib/geo";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import type { GeneratedPostCopy } from "@/lib/generatedPostCopy";
import {
  isRequestHelpWhenExpired,
  requestHelpWhenExpiresAt,
} from "@/lib/requestHelpWhen";
import { cn } from "@/lib/utils";
import {
  isServiceCategoryId,
  otherHelpSubcategoryLabel,
} from "@/lib/serviceCategories";
import {
  listingCityPart,
  listingWhenLabel,
  localizedListingTitle,
} from "@/lib/localizedListingCopy";
import {
  requestPostAccentTextClass,
  requestPostBadgeMobileClass,
  requestPostBadgeOnDarkClass,
  requestPostCtaClass,
  requestPostTextOnlySurfaceClass,
  requestPostTextOnlySurfaceMobileClass,
} from "@/lib/requestPostTheme";

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
  custom_category?: string | null;
  row?: {
    service_type?: string | null;
    service_details?: Record<string, unknown> | null;
  };
};

export type FeedPickupRoute = {
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  from_address?: string | null;
  to_address?: string | null;
};

function finiteCoord(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickupRouteFromDetails(
  details: Record<string, unknown> | null | undefined,
): FeedPickupRoute | null {
  if (!details) return null;
  const from_lat = finiteCoord(details.from_lat ?? details.fromLat);
  const from_lng = finiteCoord(details.from_lng ?? details.fromLng);
  const to_lat = finiteCoord(details.to_lat ?? details.toLat);
  const to_lng = finiteCoord(details.to_lng ?? details.toLng);
  if (from_lat == null || from_lng == null || to_lat == null || to_lng == null) {
    return null;
  }
  const from_address =
    typeof details.from_address === "string"
      ? details.from_address
      : typeof details.fromAddress === "string"
        ? details.fromAddress
        : null;
  const to_address =
    typeof details.to_address === "string"
      ? details.to_address
      : typeof details.toAddress === "string"
        ? details.toAddress
        : null;
  return { from_lat, from_lng, to_lat, to_lng, from_address, to_address };
}

/** From/to route for pickup & delivery cards (job request details or post metadata). */
export function feedPostPickupRoute(post: GlobalFeedPostLike): FeedPickupRoute | null {
  const fromRow = pickupRouteFromDetails(post.row?.service_details ?? undefined);
  if (fromRow) return fromRow;
  const meta = post.post_metadata;
  if (!meta) return null;
  const nested =
    meta.service_details && typeof meta.service_details === "object"
      ? pickupRouteFromDetails(meta.service_details as Record<string, unknown>)
      : null;
  if (nested) return nested;
  return pickupRouteFromDetails(meta);
}

function feedMetaString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Other-help subcategory id (`pet_help`, …) or free-form custom text. */
export function feedPostCustomCategory(post: GlobalFeedPostLike): string | null {
  return (
    feedMetaString(post.post_metadata?.custom_category) ||
    feedMetaString(post.post_metadata?.other_type) ||
    feedMetaString(post.custom_category) ||
    feedMetaString(post.row?.service_details?.other_type) ||
    null
  );
}

export function feedCategoryLabel(
  t: TFunction,
  categoryId?: string | null,
  customCategory?: string | null,
): string {
  if (categoryId === "other_help" && customCategory?.trim()) {
    const trimmed = customCategory.trim();
    const subLabel = otherHelpSubcategoryLabel(trimmed);
    if (subLabel) {
      return t(`otherHelpSubcategories.${trimmed}`, { defaultValue: subLabel });
    }
    return trimmed;
  }
  if (categoryId && isServiceCategoryId(categoryId)) {
    return t(`feed.categories.${categoryId}`);
  }
  if (!categoryId) return t("feed.categories.help_request");
  return categoryId.replace(/_/g, " ");
}

export function feedPostServiceCategoryMeta(
  t: TFunction,
  post: GlobalFeedPostLike,
): { id: string; iconId: string; label: string } | null {
  const typeId = feedPostTypeId(post);
  const categoryId =
    post.source === "job_request"
      ? post.post_metadata?.category ?? post.row?.service_type
      : typeId === "request_help"
        ? post.post_metadata?.category
        : typeId === "offer_service"
          ? post.post_metadata?.service ?? post.post_metadata?.category
          : null;
  if (!categoryId) return null;
  const id = String(categoryId);
  const customCategory = feedPostCustomCategory(post);
  const iconId = id === "other_help" && customCategory ? customCategory : id;
  return {
    id,
    iconId,
    label: feedCategoryLabel(t, id, customCategory),
  };
}

export function shouldShowPostTypeCategorySubtitle(
  postTypeId: string | null,
  _categoryLabel?: string | null | undefined,
): boolean {
  return Boolean(postTypeId);
}

export function feedPostTypeCategorySubtitleText(
  t: TFunction,
  postTypeId: string,
  typeName: string | undefined,
  _categoryLabel?: string | null | undefined,
): string {
  return globalFeedPostTypeBadgeLabel(t, postTypeId, typeName);
}

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
  const typeId = feedPostTypeId(post);
  const isHelpRequest = typeId === "request_help" || post.source === "job_request";
  const trimmedCategory = categoryLabel?.trim() || "";
  const isOffer = typeId === "offer_service";

  if (isHelpRequest || isOffer) {
    const timeframe =
      typeof post.post_metadata?.timeframe === "string"
        ? post.post_metadata.timeframe
        : null;
    const customWhen =
      typeof post.post_metadata?.custom_when === "string"
        ? post.post_metadata.custom_when
        : null;
    const location = feedLocationDisplayLabel(
      t,
      listingCityPart(feedPostLocationAddress(post)),
    );
    const rebuilt = localizedListingTitle(t, {
      kind: isOffer ? "offer" : "request",
      categoryLabel: trimmedCategory,
      when: isHelpRequest ? listingWhenLabel(t, timeframe, customWhen) : "",
      location,
    });
    if (rebuilt) return rebuilt;
  }

  if (post.source === "post" && post.post_type_id === "event") {
    const name = post.post_metadata?.event_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }

  if (generatedCopy?.title?.trim() && !isHelpRequest && !isOffer) {
    return generatedCopy.title.trim();
  }

  if (isHelpRequest && trimmedCategory) {
    return t("feed.global.categoryHelpTitle", { category: trimmedCategory });
  }

  return null;
}

export function feedPostDescription(
  generatedCopy: GeneratedPostCopy | null,
  caption: string,
  title: string | null,
): string {
  const userCaption = caption.trim();
  const text = (userCaption || generatedCopy?.short_text || "").trim();
  if (!text) return "";
  if (title && text.toLowerCase() === title.toLowerCase()) return "";
  return userCaption || text;
}

/** Global feed post card shell — pale grey in light mode; darker on desktop dark mode. */
export const globalFeedCardSurfaceClass =
  "bg-zinc-50 shadow-none dark:bg-zinc-800/65 md:dark:bg-zinc-900";

export function globalFeedPostTypeAccentClass(typeId: string | null): string {
  switch (typeId) {
    case "request_help":
      return requestPostAccentTextClass;
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

/** Post-type accent colors for text on dark media overlays (reels, video headers). */
export function globalFeedPostTypeAccentOnDarkClass(
  typeId: string | null,
): string {
  switch (typeId) {
    case "request_help":
      return "text-orange-300";
    case "offer_service":
      return "text-emerald-300";
    case "event":
      return "text-violet-300";
    case "community":
      return "text-blue-300";
    default:
      return "text-white/80";
  }
}

export function globalFeedTextOnlySurfaceClass(typeId: string | null): string {
  switch (typeId) {
    case "request_help":
      return requestPostTextOnlySurfaceClass;
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
      return requestPostCtaClass;
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

function foldLocationPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`ʼʹ׳]/g, "")
    .replace(/[-–—־]/g, " ")
    .replace(/[^a-z0-9\u0400-\u04ff\u0590-\u05ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type LocationAliasHit =
  | { kind: "country" }
  | { kind: "city"; slug: string }
  | { kind: "district"; slug: string };

type LocationAlias = { folded: string; hit: LocationAliasHit };

const CITY_NAME_EXTRAS: Record<string, readonly string[]> = {
  tel_aviv: [
    "Tel Aviv-Yafo",
    "Tel Aviv Yafo",
    "Tel-Aviv-Yafo",
    "Tel Aviv Jaffa",
    "תל אביב-יפו",
    "תל אביב יפו",
    "Тель-Авив-Яффо",
    "Тель Авив Яффо",
  ],
  beer_sheva: ["Beersheba", "Be'er Sheva", "Beer Sheba", "Beersheva"],
  netanya: ["Natanya", "Nétanya"],
  rishon_lezion: ["Rishon Lezion", "Rishon Le Zion", "Rishon-LeZion"],
  petah_tikva: ["Petach Tikva", "Petah Tiqwa", "Petah-Tikva"],
  raanana: ["Raanana"],
};

const DISTRICT_NAME_EXTRAS: Record<string, readonly string[]> = {
  central: [
    "Central District of Israel",
    "Center District",
    "Centre District",
    "District Centre",
    "District Center",
    "District of Central Israel",
    "Центральный округ Израиля",
    "Округ Центр",
    "המרכז",
  ],
  north: [
    "North District",
    "District North",
    "District du Nord",
    "Северный округ Израиля",
    "הצפון",
  ],
  south: [
    "South District",
    "District South",
    "District du Sud",
    "Южный округ Израиля",
    "הדרום",
  ],
  haifa: ["District of Haifa", "District de Haïfa"],
  jerusalem: ["District of Jerusalem", "District de Jérusalem"],
  tel_aviv: [
    "Tel Aviv-Yafo District",
    "Tel Aviv Yafo District",
    "District de Tel Aviv",
    "District de Tel-Aviv",
  ],
  judea_samaria: ["Judea and Samaria Area", "West Bank", "מחוז יהודה ושומרון"],
};

const COUNTRY_NAME_EXTRAS = [
  "State of Israel",
  "מדינת ישראל",
  "Государство Израиль",
  "État d'Israël",
];

const CITY_TRAILING_OK = new Set(["yafo", "jaffa", "yaffo", "יפו", "яффо"]);

const LOCATION_BUNDLES = [en, fr, he, ru].map((bundle) => bundle.feed.location);

let locationAliases: LocationAlias[] | null = null;

function locationAliasTable(): LocationAlias[] {
  if (locationAliases) return locationAliases;

  const aliases: LocationAlias[] = [];
  const push = (label: string | null | undefined, hit: LocationAliasHit) => {
    const folded = label ? foldLocationPart(label) : "";
    if (!folded) return;
    aliases.push({ folded, hit });
  };

  for (const bundle of LOCATION_BUNDLES) {
    push(bundle.countryIsrael, { kind: "country" });
  }
  for (const extra of COUNTRY_NAME_EXTRAS) {
    push(extra, { kind: "country" });
  }

  const citySlugs = new Set<string>();
  for (const bundle of LOCATION_BUNDLES) {
    for (const slug of Object.keys(bundle.cities)) {
      citySlugs.add(slug);
    }
  }
  for (const slug of citySlugs) {
    for (const bundle of LOCATION_BUNDLES) {
      const label = bundle.cities[slug as keyof typeof bundle.cities];
      push(label, { kind: "city", slug });
    }
    for (const extra of CITY_NAME_EXTRAS[slug] ?? []) {
      push(extra, { kind: "city", slug });
    }
    push(slug.replace(/_/g, " "), { kind: "city", slug });
  }

  const districtSlugs = new Set<string>();
  for (const bundle of LOCATION_BUNDLES) {
    for (const slug of Object.keys(bundle.districts ?? {})) {
      districtSlugs.add(slug);
    }
  }
  for (const slug of districtSlugs) {
    for (const bundle of LOCATION_BUNDLES) {
      const districts = bundle.districts as Record<string, string> | undefined;
      push(districts?.[slug], { kind: "district", slug });
    }
    for (const extra of DISTRICT_NAME_EXTRAS[slug] ?? []) {
      push(extra, { kind: "district", slug });
    }
    push(slug.replace(/_/g, " "), { kind: "district", slug });
  }

  aliases.sort((a, b) => b.folded.length - a.folded.length);
  locationAliases = aliases;
  return aliases;
}

function resolveLocationPart(part: string): LocationAliasHit | null {
  const folded = foldLocationPart(part);
  if (!folded) return null;

  const aliases = locationAliasTable();
  const exact = aliases.find((entry) => entry.folded === folded);
  if (exact) return exact.hit;

  for (const entry of aliases) {
    if (!folded.startsWith(`${entry.folded} `)) continue;
    const rest = folded.slice(entry.folded.length).trim();
    if (entry.hit.kind === "district") return entry.hit;
    if (entry.hit.kind === "city" && CITY_TRAILING_OK.has(rest)) return entry.hit;
  }
  return null;
}

function translateLocationPart(t: TFunction, part: string): string {
  const hit = resolveLocationPart(part);
  if (hit?.kind === "country") return t("feed.location.countryIsrael");
  if (hit?.kind === "city") {
    return t(`feed.location.cities.${hit.slug}`, { defaultValue: part });
  }
  if (hit?.kind === "district") {
    return t(`feed.location.districts.${hit.slug}`, { defaultValue: part });
  }

  const slug = feedLocationSlug(part);
  if (slug) {
    const city = t(`feed.location.cities.${slug}`, { defaultValue: "" });
    if (city) return city;
    if (/^israel$/i.test(part)) return t("feed.location.countryIsrael");
  }
  return part;
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
  const parts = location
    .trim()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return location.trim();

  return parts.map((part) => translateLocationPart(t, part)).join(", ");
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

export function feedWhenExpiredOnLabel(
  t: TFunction,
  language: string,
  timeframe: string | null | undefined,
  createdAt: string | Date | null | undefined,
): string {
  if (!createdAt) return t("feed.whenExpired");
  const expiresAt = requestHelpWhenExpiresAt(timeframe, createdAt);
  if (!expiresAt) return t("feed.whenExpired");
  const locale = dateFnsLocaleFor(language);
  const includeYear = expiresAt.getFullYear() !== new Date().getFullYear();
  const date = format(expiresAt, includeYear ? "MMM d, yyyy" : "MMM d", {
    locale,
  });
  return t("feed.whenExpiredOn", { date });
}

export function feedWhenDisplayLabel(
  t: TFunction,
  metadata: Record<string, unknown> | null | undefined,
  createdAt?: string | null,
  language?: string,
): string | null {
  if (!metadata) return null;
  const timeframe = metadata.timeframe;
  if (typeof timeframe !== "string" || !timeframe) return null;
  if (createdAt && isRequestHelpWhenExpired(timeframe, createdAt)) {
    return feedWhenExpiredOnLabel(t, language ?? "en", timeframe, createdAt);
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
    return feedWhenDisplayLabel(t, metadata, createdAt, language);
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
    typeId === "request_help" && requestPostBadgeOnDarkClass,
    typeId === "offer_service" && "bg-emerald-500/25 text-emerald-200",
    typeId === "community" && "bg-blue-500/25 text-blue-200",
    typeId === "event" && "bg-violet-500/25 text-violet-200",
  );
}

/** Mobile global feed scroll area — grey canvas behind edge-to-edge post cards. */
export const globalFeedMobileFeedAreaClass =
  "max-md:bg-[#f5f5f5] dark:max-md:bg-[#101214]";

/** Mobile global feed page background — mirrors native DiscoverPalette background. */
export const globalFeedMobilePageClass = globalFeedMobileFeedAreaClass;

/** Mobile global feed card shell — full width, rounded top and bottom. */
export const globalFeedMobileCardClass =
  "max-md:mb-2.5 max-md:w-full max-md:overflow-hidden max-md:rounded-2xl max-md:shadow-none max-md:ring-0 max-md:bg-zinc-50 dark:max-md:bg-[#181b1f]";

/** Mobile card inner horizontal padding. */
export const globalFeedMobileCardPadClass = "max-md:px-1";

export function globalFeedMobileTextOnlySurfaceClass(typeId: string | null): string {
  switch (typeId) {
    case "request_help":
      return requestPostTextOnlySurfaceMobileClass;
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

/** Mobile feed header type badge — theme-aware pill, max-md only. */
export function globalFeedMobilePostTypeBadgeClass(typeId: string): string {
  return cn(
    "max-md:gap-0 max-md:rounded-md max-md:border-0 max-md:px-3 max-md:py-1 max-md:text-[12px] max-md:font-black max-md:uppercase max-md:tracking-[0.06em] max-md:shadow-none",
    typeId === "request_help" && requestPostBadgeMobileClass,
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
  "max-md:rounded-none max-md:bg-white dark:max-md:bg-[#181b1f]";

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
