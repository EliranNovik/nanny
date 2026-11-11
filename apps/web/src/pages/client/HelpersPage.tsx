import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  GOOGLE_MAP_EMBED_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
  MAP_SEARCH_CIRCLE_FIT_PADDING,
} from "@/lib/googleMapsLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  Navigation,
  MapPin,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import {
  HelperResultProfileCard,
  type HelperOfferPreview,
  type PublicProfileGalleryRow,
} from "@/components/helpers/HelperResultProfileCard";
import {
  FindHelpersMobileChrome,
  type FindHelpersMobilePanel,
  type FindHelpersQuickFilter,
} from "@/components/helpers/FindHelpersMobileChrome";
import { isFreelancerInActive24hLiveWindow, isFreelancerLiveWindowActive } from "@/lib/freelancerLiveWindow";
import { useToast } from "@/components/ui/toast";
import { browserLocationPromptAllowed } from "@/lib/location";
import {
  canStartInCardLabel,
  respondsWithinCardLabel,
} from "@/lib/liveCanStart";
import {
  getServiceCategoryImage,
  isServiceCategoryId,
  OTHER_HELP_SUBCATEGORIES,
  postServiceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { haversineDistanceKm } from "@/lib/geo";
import { cityPlaceFromGeocoderResult } from "@/lib/cityPlace";
import {
  HELPERS_FOCUS_HELPER_QUERY,
  HELPERS_FOCUS_LAT_QUERY,
  HELPERS_FOCUS_LNG_QUERY,
} from "@/lib/clientAppPaths";
import {
  BigRadiusSlider,
  RADIUS_MAX,
} from "@/components/search/BigRadiusSlider";
import { setMatchSearchChromeVisible } from "@/lib/matchSearchHeaderState";

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

function HelperBrowseCardSkeleton() {
  return (
    <div className="flex min-h-[22rem] w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.12)] dark:bg-zinc-800">
      <div className="aspect-video w-full shrink-0 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
      <div className="flex flex-1 flex-col gap-2.5 px-3.5 py-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700/70" />
        <div className="flex gap-2 pt-1">
          <div className="h-7 w-24 animate-pulse rounded-full bg-emerald-50 dark:bg-zinc-700" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-emerald-50 dark:bg-zinc-700" />
        </div>
        <div className="mt-auto h-10 w-full animate-pulse rounded-full bg-orange-200/90 dark:bg-orange-500/25" />
      </div>
    </div>
  );
}

/**
 * Prefer great-circle km from the logged-in user’s saved map pin when both have coords;
 * otherwise keep the RPC `distance_km` from the search radius / listing rules.
 */
function resolveHelperDistanceKmForViewer(
  h: HelperResult,
  viewerProfile: {
    location_lat?: number | null;
    location_lng?: number | null;
  } | null | undefined,
): { km: number | null; fromViewerPin: boolean } {
  const vl = viewerProfile?.location_lat;
  const vg = viewerProfile?.location_lng;
  const hl = h.location_lat;
  const hn = h.location_lng;
  if (
    vl != null &&
    vg != null &&
    hl != null &&
    hn != null
  ) {
    const a = Number(vl);
    const b = Number(vg);
    const c = Number(hl);
    const d = Number(hn);
    if ([a, b, c, d].every((x) => Number.isFinite(x))) {
      return {
        km: haversineDistanceKm(a, b, c, d),
        fromViewerPin: true,
      };
    }
  }
  return { km: h.distanceKm ?? null, fromViewerPin: false };
}

const SEARCH_CIRCLE_STYLE: google.maps.CircleOptions = {
  fillColor: "#f97316",
  fillOpacity: 0.22,
  strokeColor: "#ea580c",
  strokeOpacity: 1,
  strokeWeight: 3,
  clickable: false,
  zIndex: 1,
};

const HELPERS_PAGE_STATE_KEY = "helpers_page_state:v1";

function helpersFetchErrorToast(e: unknown): { title: string; description: string } {
  const raw =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: string }).message)
      : "An unexpected error occurred.";
  const lower = raw.toLowerCase();
  if (
    lower.includes("networkerror") ||
    lower.includes("failed to fetch") ||
    lower.includes("cors request did not succeed")
  ) {
    return {
      title: "Could not reach the server",
      description:
        "Check your internet connection. VPNs, firewalls, or ad blockers can block Supabase — try disabling them and search again.",
    };
  }
  return { title: "Error fetching helpers", description: raw };
}

type FreelancerRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  /** Service categories, including other-help subcategory ids. */
  categories?: string[] | null;
  city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  service_radius: number | null;
  average_rating?: number | null;
  total_ratings?: number | null;
  role?: string | null;
  is_available_for_jobs?: boolean | null;
  /** From `get_helpers_near_location` when migration 066 applied. */
  whatsapp_contact_available?: boolean | null;
  telegram_contact_available?: boolean | null;
  /** From `get_helpers_near_location` when migration 068 applied. */
  is_verified?: boolean | null;
  freelancer_profiles: {
    hourly_rate_min: number | null;
    hourly_rate_max: number | null;
    bio: string | null;
    available_now: boolean | null;
    live_until?: string | null;
    live_categories?: string[] | null;
    live_can_start_in?: string | null;
  } | null;
};

/** Trim + lowercase for comparing city strings when there are no coordinates. */
function normalizeCityLabel(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Avoid geocoding short single-token queries that are usually person names (e.g. "Dan"). */
function shouldGeocodeSearchQuery(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 3) return false;
  if (/\s/.test(t)) return true;
  if (t.length >= 5) return true;
  return false;
}

/** `distanceKm` is null when the helper has no lat/lng — we still list them if search/city matches. */
export type HelperResult = FreelancerRow & { distanceKm: number | null };

const NEARBY_MAX_KM = 25;

/** Same city as the signed-in user, or within 25 km of their saved pin. */
function helperIsNearbyForViewer(
  h: HelperResult,
  viewerProfile: {
    city?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
  } | null | undefined,
): boolean {
  const viewerCity = normalizeCityLabel(viewerProfile?.city);
  const helperCity = normalizeCityLabel(h.city);
  if (viewerCity && helperCity && viewerCity === helperCity) return true;

  const vl = viewerProfile?.location_lat;
  const vg = viewerProfile?.location_lng;
  const hl = h.location_lat;
  const hn = h.location_lng;
  if (vl != null && vg != null && hl != null && hn != null) {
    const a = Number(vl);
    const b = Number(vg);
    const c = Number(hl);
    const d = Number(hn);
    if ([a, b, c, d].every((x) => Number.isFinite(x))) {
      return haversineDistanceKm(a, b, c, d) <= NEARBY_MAX_KM;
    }
  }
  return false;
}

function helperMatchesSelectedCategories(
  h: HelperResult,
  selected: ReadonlySet<ServiceCategoryId>,
  selectedOtherSubs: ReadonlySet<string> = new Set(),
): boolean {
  if (selected.size === 0) return true;
  const lc = h.freelancer_profiles?.live_categories;
  if (!lc?.length) return false;
  const live = new Set(lc);
  const otherSubIds = OTHER_HELP_SUBCATEGORIES.map((s) => s.id);
  for (const id of selected) {
    if (id === "other_help") {
      const helperSubs = otherSubIds.filter((sub) => live.has(sub));
      if (selectedOtherSubs.size > 0) {
        if (helperSubs.some((sub) => selectedOtherSubs.has(sub))) return true;
        if (helperSubs.length === 0 && live.has("other_help")) return true;
      } else if (live.has("other_help") || helperSubs.length > 0) {
        return true;
      }
      continue;
    }
    if (live.has(id)) return true;
  }
  return false;
}

function LocationCitySearchBar({
  isLoaded,
  value,
  onChange,
  onPick,
  placeholder,
  onActiveChange,
}: {
  isLoaded: boolean;
  value: string;
  onChange: (value: string) => void;
  onPick: (lat: number, lng: number, label: string) => void;
  placeholder: string;
  onActiveChange?: (active: boolean) => void;
}) {
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  useEffect(() => {
    if (!isLoaded || typeof google === "undefined" || !google.maps?.places) return;
    serviceRef.current = new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = value.trim();
    if (!isLoaded || q.length < 2) {
      setPredictions([]);
      onActiveChangeRef.current?.(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      serviceRef.current?.getPlacePredictions(
        {
          input: q,
          types: ["(cities)"],
          componentRestrictions: { country: "il" },
        },
        (results) => {
          const next = results ?? [];
          setPredictions(next);
          onActiveChangeRef.current?.(next.length > 0);
        },
      );
    }, 180);
  }, [value, isLoaded]);

  const pickPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    setResolving(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
      setResolving(false);
      setPredictions([]);
      onActiveChange?.(false);
      if (status !== "OK" || !results?.[0]?.geometry?.location) return;
      const loc = results[0].geometry.location;
      const picked = cityPlaceFromGeocoderResult(results[0]);
      onPick(
        loc.lat(),
        loc.lng(),
        picked?.label || prediction.structured_formatting?.main_text || prediction.description,
      );
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-2xl bg-zinc-800 px-3">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="relative z-30">
      <Search
        className="pointer-events-none absolute left-3 top-3.5 z-[1] h-4 w-4 text-zinc-400"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (predictions.length > 0) onActiveChange?.(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "h-11 rounded-2xl border-0 bg-zinc-800 pl-10 pr-3 text-[15px] text-white shadow-none",
          "placeholder:text-zinc-400",
          "focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-0",
        )}
      />
      {predictions.length > 0 ? (
        <ul className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-2xl bg-zinc-800 py-1 shadow-xl shadow-black/40">
          {predictions.map((prediction) => (
            <li key={prediction.place_id}>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  pickPrediction(prediction);
                }}
                className="flex w-full items-start gap-2 px-3.5 py-3 text-left text-[15px] font-medium text-white"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <span>
                  <span className="block leading-snug">
                    {prediction.structured_formatting?.main_text || prediction.description}
                  </span>
                  {prediction.structured_formatting?.secondary_text ? (
                    <span className="mt-0.5 block text-[12px] font-normal text-zinc-400">
                      {prediction.structured_formatting.secondary_text}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {resolving ? (
        <div className="absolute right-3 top-3">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : null}
    </div>
  );
}

type HelpersMapBlockProps = {
  center: { lat: number; lng: number };
  radiusKm: number;
  hasSearched: boolean;
  results: HelperResult[];
  isLoaded: boolean;
  loadError: Error | undefined;
  mapsApiKey: string;
  onMapClick: (e: google.maps.MapMouseEvent) => void;
  onProfileOpen: (userId: string) => void;
};

function HelpersMapBlock({
  center,
  radiusKm,
  hasSearched,
  results,
  isLoaded,
  loadError,
  mapsApiKey,
  onMapClick,
  onProfileOpen,
}: HelpersMapBlockProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchCircleRef = useRef<google.maps.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);

  /** Imperative circle: mapRef is set in onLoad (after first child paint), so the library <Circle> could miss attaching. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let circle = searchCircleRef.current;
    if (!circle) {
      circle = new google.maps.Circle({
        ...SEARCH_CIRCLE_STYLE,
        map,
        center,
        radius: radiusKm * 1000,
      });
      searchCircleRef.current = circle;
    } else {
      circle.setCenter(center);
      circle.setRadius(radiusKm * 1000);
      circle.setMap(map);
    }

    const bounds = circle.getBounds();
    if (bounds) {
      map.fitBounds(bounds, MAP_SEARCH_CIRCLE_FIT_PADDING);
    }
  }, [mapReady, center.lat, center.lng, radiusKm]);

  useEffect(() => {
    return () => {
      searchCircleRef.current?.setMap(null);
      searchCircleRef.current = null;
    };
  }, []);

  if (loadError || !mapsApiKey) {
    const errText = loadError?.message?.toLowerCase() ?? "";
    const billingIssue =
      errText.includes("billing") || errText.includes("billingnotenabled");
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
        {!mapsApiKey ? (
          <>
            Map unavailable. Set <code className="rounded bg-muted px-1">VITE_GOOGLE_MAPS_API_KEY</code>{" "}
            to show the map. You can still search helpers by distance from your profile location.
          </>
        ) : billingIssue ? (
          <>
            Google Maps billing is not enabled for this API key. Enable billing in Google Cloud
            Console, or search without the map — helper results still load.
          </>
        ) : (
          <>
            Map could not load ({loadError?.message ?? "unknown error"}). You can still search
            helpers by distance from your profile location.
          </>
        )}
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={center}
      zoom={11}
      onLoad={(map) => {
        mapRef.current = map;
        setMapReady(true);
      }}
      onUnmount={() => {
        searchCircleRef.current?.setMap(null);
        searchCircleRef.current = null;
        mapRef.current = null;
        setMapReady(false);
      }}
      onClick={onMapClick}
      options={{
        ...GOOGLE_MAP_EMBED_OPTIONS,
      }}
    >
      <Marker
        position={center}
        title="Search center"
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        }}
      />
      {hasSearched &&
        results.map((h) => {
          const lat = Number(h.location_lat);
          const lng = Number(h.location_lng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
          return (
            <Marker
              key={h.id}
              position={{ lat, lng }}
              title={h.full_name || "Helper"}
              onClick={(e) => {
                e.stop();
                onProfileOpen(h.id);
              }}
            />
          );
        })}
    </GoogleMap>
  );
}

const RAIL_INITIAL_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-blue-600",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
] as const;

function railInitialColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
  }
  return RAIL_INITIAL_COLORS[Math.abs(hash) % RAIL_INITIAL_COLORS.length]!;
}

function railInitials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function HelperRailAvatar({
  name,
  photoUrl,
  seed,
  label,
  ringClass,
  onClick,
}: {
  name: string | null;
  photoUrl: string | null;
  seed: string;
  label: string;
  ringClass: string;
  onClick: () => void;
}) {
  const photo = photoUrl?.trim() || "";
  const displayName = name?.trim() || label;
  return (
    <button
      type="button"
      title={displayName}
      aria-label={`${label}: ${displayName}`}
      onClick={onClick}
      className="flex w-full flex-col items-center gap-1"
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900",
          photo ? "bg-zinc-200 dark:bg-zinc-700" : railInitialColor(seed),
          ringClass,
        )}
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[13px] font-black leading-none text-white">
            {railInitials(name)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 w-full text-center text-[10px] font-semibold leading-tight text-zinc-800 dark:text-zinc-100">
        {displayName}
      </span>
    </button>
  );
}

/** App route `/client/helpers` — same as {@link CLIENT_HELPERS_PAGE_PATH} in `@/lib/clientAppPaths`. */
export default function HelpersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    DEFAULT_CENTER,
  );
  const [radiusKm, setRadiusKm] = useState(RADIUS_MAX);
  const [searchQuery, setSearchQuery] = useState("");
  /** Debounced value used for API fetch + geocode (avoids hammering while typing). */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<HelperResult[]>([]);
  const [helperReplyStatsByHelperId, setHelperReplyStatsByHelperId] = useState<
    Record<string, { avg_seconds: number; sample_count: number }>
  >({});
  /** Completed live help gigs in trailing 7 days (from `get_helpers_live_help_week_counts`). */
  const [liveHelpWeekByHelperId, setLiveHelpWeekByHelperId] = useState<
    Record<string, number>
  >({});
  const [loadingFetch, setLoadingFetch] = useState(false);
  /** True after the user runs a search — helpers list and map pins appear only then. */
  const [hasSearched, setHasSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  /** True when the current debounced query was resolved as a place — map shows radius for everyone there. */
  const [geocodeMatchedPlace, setGeocodeMatchedPlace] = useState(false);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);
  /** First coords from profile — used when clearing search to restore map center. */
  const profileCenterSnapshotRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  /** When set, profile city coords must not overwrite the map center (GPS or user choice wins). */
  const gpsLockRef = useRef(false);
  const geocodeRequestIdRef = useRef(0);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoriteProfiles, setFavoriteProfiles] = useState<
    { id: string; full_name: string | null; photo_url: string | null }[]
  >([]);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  /** Multi-select: show helpers live in any of these categories (OR). Empty = all categories. */
  const [selectedCategories, setSelectedCategories] = useState<
    Set<ServiceCategoryId>
  >(() => {
    const raw = searchParams.get("category");
    return raw && isServiceCategoryId(raw) ? new Set([raw]) : new Set();
  });
  const [selectedOtherSubs, setSelectedOtherSubs] = useState<Set<string>>(
    () => {
      const raw = searchParams.get("category");
      const sub = searchParams.get("sub");
      if (
        raw === "other_help" &&
        sub &&
        OTHER_HELP_SUBCATEGORIES.some((item) => item.id === sub)
      ) {
        return new Set([sub]);
      }
      return new Set();
    },
  );
  const [quickFilter, setQuickFilter] = useState<FindHelpersQuickFilter>("all");
  const [nameQuery, setNameQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<FindHelpersMobilePanel>("none");
  const [citySearchValue, setCitySearchValue] = useState("");
  const [citySearchActive, setCitySearchActive] = useState(false);
  const mobileAutoSearchStartedRef = useRef(false);
  /**
   * After a successful "Search helpers", the top search chrome (categories, map, radius, input)
   * collapses to a bottom-left FAB; tapping the FAB restores it.
   */
  const [searchChromeCollapsed, setSearchChromeCollapsed] = useState(false);
  /** Gallery rows from `public_profile_media`, keyed by helper user id. */
  const [galleryByUserId, setGalleryByUserId] = useState<
    Record<string, PublicProfileGalleryRow[]>
  >({});
  const [offerPreviewsByUserId, setOfferPreviewsByUserId] = useState<
    Record<string, HelperOfferPreview[]>
  >({});

  const toggleCategory = useCallback((id: ServiceCategoryId) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (id === "other_help") setSelectedOtherSubs(new Set());
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleOtherSub = useCallback((id: string) => {
    setSelectedOtherSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedCategories((cats) => {
      if (cats.has("other_help")) return cats;
      const next = new Set(cats);
      next.add("other_help");
      return next;
    });
  }, []);

  const clearCategoryFilters = useCallback(() => {
    setSelectedCategories(new Set());
    setSelectedOtherSubs(new Set());
  }, []);

  const replaceCategoryFilters = useCallback(
    (categories: ServiceCategoryId[], otherSubs: string[]) => {
      setSelectedCategories(new Set(categories));
      setSelectedOtherSubs(new Set(otherSubs));
    },
    [],
  );

  const loadFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavoriteIds(new Set());
      return;
    }
    const { data, error } = await supabase
      .from("profile_favorites")
      .select("favorite_user_id")
      .eq("user_id", user.id);
    if (error) {
      console.error("HelpersPage loadFavorites:", error);
      return;
    }
    setFavoriteIds(
      new Set((data ?? []).map((r) => r.favorite_user_id as string)),
    );
  }, [user?.id]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const favoriteIdsKey = useMemo(
    () => [...favoriteIds].sort().join(","),
    [favoriteIds],
  );

  useEffect(() => {
    if (!favoriteIdsKey) {
      setFavoriteProfiles([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", favoriteIdsKey.split(","));
      if (cancelled || error) return;
      setFavoriteProfiles(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [favoriteIdsKey]);

  const toggleFavorite = useCallback(
    async (favoriteUserId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user?.id || favoriteUserId === user.id) return;
      setFavoriteBusyId(favoriteUserId);
      try {
        if (favoriteIds.has(favoriteUserId)) {
          const { error } = await supabase
            .from("profile_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("favorite_user_id", favoriteUserId);
          if (error) throw error;
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(favoriteUserId);
            return next;
          });
          addToast({ title: "Removed from favorites", variant: "success" });
        } else {
          const { error } = await supabase.from("profile_favorites").insert({
            user_id: user.id,
            favorite_user_id: favoriteUserId,
          });
          if (error) throw error;
          setFavoriteIds((prev) => new Set(prev).add(favoriteUserId));
          addToast({ title: "Saved to favorites", variant: "success" });
        }
      } catch (err) {
        console.error("toggleFavorite:", err);
        addToast({
          title: "Could not update favorite",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "error" as any,
        });
      } finally {
        setFavoriteBusyId(null);
      }
    },
    [user?.id, favoriteIds, addToast],
  );

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    gpsLockRef.current = true;
    setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    setGeocodeMatchedPlace(false);
  }, []);

  const onProfileOpen = useCallback(
    (userId: string) => {
      navigate(`/profile/${userId}`);
    },
    [navigate],
  );

  useEffect(() => {
    const lat =
      profile?.location_lat != null ? Number(profile.location_lat) : null;
    const lng =
      profile?.location_lng != null ? Number(profile.location_lng) : null;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng))
      return;
    if (gpsLockRef.current) return;
    if (!profileCenterSnapshotRef.current) {
      profileCenterSnapshotRef.current = { lat, lng };
      setCenter({ lat, lng });
    }
  }, [profile?.location_lat, profile?.location_lng]);

  /** Debounce search text for geocoding (does not fetch helpers until Search). */
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  const runSearch = useCallback(
    async (opts?: {
      radiusKm?: number;
      /** When deep-linking, search around this pin instead of current `center` state. */
      searchCenter?: { lat: number; lng: number };
    }) => {
      const rk = opts?.radiusKm ?? radiusKm;
      const searchLat = opts?.searchCenter?.lat ?? center.lat;
      const searchLng = opts?.searchCenter?.lng ?? center.lng;
      setLoadingFetch(true);
      try {
        setHelperReplyStatsByHelperId({});
        setLiveHelpWeekByHelperId({});
        const viewerCityNorm = normalizeCityLabel(profile?.city);
        const { data, error } = await supabase.rpc("get_helpers_near_location", {
          search_lat: searchLat,
          search_lng: searchLng,
          radius_km: rk,
          search_query: nameQuery.trim() || searchQuery.trim(),
          viewer_city_norm: viewerCityNorm || "",
          geocode_matched_place: geocodeMatchedPlace,
        });

        if (error) throw error;

        let rows = data as HelperResult[];
        if (user?.id) rows = rows.filter((r) => r.id !== user.id);

        if (rows.length > 0) {
          const { data: categoryRows } = await supabase
            .from("profiles")
            .select("id, categories")
            .in(
              "id",
              rows.map((row) => row.id),
            );
          const categoriesById = new Map(
            (categoryRows ?? []).map((row) => [
              row.id as string,
              (row.categories as string[] | null) ?? [],
            ]),
          );
          rows = rows.map((row) => ({
            ...row,
            categories: categoriesById.get(row.id) ?? [],
          }));
        }

        setResults(rows);

        // Badges: helper avg response time (client msg -> helper reply)
        const helperIds = Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
        if (helperIds.length > 0) {
          const [statRpc, weekRpc] = await Promise.all([
            supabase.rpc("get_helper_chat_response_stats", {
              p_helper_ids: helperIds,
            }),
            supabase.rpc("get_helpers_live_help_week_counts", {
              p_helper_ids: helperIds,
            }),
          ]);
          const { data: statRows, error: statErr } = statRpc;
          const { data: weekRows, error: weekErr } = weekRpc;

          if (statErr && import.meta.env.DEV) {
            console.warn(
              "[HelpersPage] get_helper_chat_response_stats failed:",
              statErr,
            );
          }
          if (weekErr && import.meta.env.DEV) {
            console.warn(
              "[HelpersPage] get_helpers_live_help_week_counts failed:",
              weekErr,
            );
          }
          if (import.meta.env.DEV) {
            console.debug(
              "[HelpersPage] helper reply stats rows:",
              Array.isArray(statRows) ? statRows.length : "not-array",
              statRows,
            );
          }
          if (!statErr && Array.isArray(statRows)) {
            const next: Record<string, { avg_seconds: number; sample_count: number }> = {};
            for (const sr of statRows as {
              helper_id: string;
              avg_seconds: number | null;
              sample_count: number | null;
            }[]) {
              if (!sr.helper_id || sr.avg_seconds == null || sr.sample_count == null)
                continue;
              next[sr.helper_id] = {
                avg_seconds: Number(sr.avg_seconds),
                sample_count: Number(sr.sample_count),
              };
            }
            setHelperReplyStatsByHelperId(next);
          }
          if (!weekErr && Array.isArray(weekRows)) {
            const weekNext: Record<string, number> = {};
            for (const wr of weekRows as {
              helper_id: string;
              live_help_week_count: number | string | null;
            }[]) {
              if (!wr.helper_id || wr.live_help_week_count == null) continue;
              const n = Number(wr.live_help_week_count);
              if (!Number.isFinite(n) || n <= 0) continue;
              weekNext[wr.helper_id] = Math.floor(n);
            }
            setLiveHelpWeekByHelperId(weekNext);
          }
        }

        setHasSearched(true);
        setSearchChromeCollapsed(true);
      } catch (e: unknown) {
        console.error("HelpersPage fetch:", e);
        setResults([]);
        setHelperReplyStatsByHelperId({});
        setLiveHelpWeekByHelperId({});
        const toast = helpersFetchErrorToast(e);
        addToast({
          title: toast.title,
          description: toast.description,
          variant: "error" as const,
        });
      } finally {
        setLoadingFetch(false);
      }
    },
    [
      center.lat,
      center.lng,
      radiusKm,
      searchQuery,
      nameQuery,
      geocodeMatchedPlace,
      user?.id,
      profile?.city,
      addToast,
    ],
  );

  const focusHelperIdFromUrl = (
    searchParams.get(HELPERS_FOCUS_HELPER_QUERY) ?? ""
  ).trim();

  const deepLinkAutoSearchStartedRef = useRef(false);
  const deepLinkScrollDoneRef = useRef(false);
  const deepLinkClearedCategoriesRef = useRef(false);

  /** Deep link: auto-run first search (uses optional anchor coords from query). */
  useEffect(() => {
    if (!focusHelperIdFromUrl) return;
    if (hasSearched) return;
    if (deepLinkAutoSearchStartedRef.current) return;
    deepLinkAutoSearchStartedRef.current = true;

    const latS = searchParams.get(HELPERS_FOCUS_LAT_QUERY);
    const lngS = searchParams.get(HELPERS_FOCUS_LNG_QUERY);
    let searchCenter: { lat: number; lng: number } | undefined;
    if (latS != null && lngS != null) {
      const la = Number(latS);
      const ln = Number(lngS);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        searchCenter = { lat: la, lng: ln };
        gpsLockRef.current = true;
        setCenter({ lat: la, lng: ln });
        setGeocodeMatchedPlace(false);
      }
    }
    void runSearch(searchCenter ? { searchCenter } : undefined);
  }, [focusHelperIdFromUrl, hasSearched, runSearch, searchParams]);

  /** Geocode city/place queries to move the map + circle; name-like queries keep map and filter by text. */
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length === 0) {
      setGeocodeMatchedPlace(false);
      if (profileCenterSnapshotRef.current && !gpsLockRef.current) {
        setCenter(profileCenterSnapshotRef.current);
      }
      return;
    }
    if (!shouldGeocodeSearchQuery(q)) {
      setGeocodeMatchedPlace(false);
      return;
    }
    if (!isLoaded || typeof google === "undefined" || !google.maps?.Geocoder)
      return;

    const reqId = ++geocodeRequestIdRef.current;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { address: q, componentRestrictions: { country: "il" } },
      (geoResults, status) => {
        if (reqId !== geocodeRequestIdRef.current) return;
        if (status !== "OK" || !geoResults?.[0]?.geometry?.location) {
          setGeocodeMatchedPlace(false);
          return;
        }
        const loc = geoResults[0].geometry.location;
        gpsLockRef.current = false;
        setCenter({ lat: loc.lat(), lng: loc.lng() });
        setGeocodeMatchedPlace(true);
      },
    );
  }, [debouncedSearch, isLoaded]);

  const useMyLocation = () => {
    if (profile?.is_admin || !browserLocationPromptAllowed()) return;
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsLockRef.current = true;
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeocodeMatchedPlace(false);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  /** Use all results, not just those in an active 24h window. */
  const allFilteredHelpers = useMemo(() => results, [results]);

  const helpersMatchingCategories = useMemo(
    () =>
      allFilteredHelpers.filter((h) =>
        helperMatchesSelectedCategories(h, selectedCategories, selectedOtherSubs),
      ),
    [allFilteredHelpers, selectedCategories, selectedOtherSubs],
  );

  const displayedHelpers = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    let list = helpersMatchingCategories.filter((h) =>
      q ? (h.full_name ?? "").toLowerCase().includes(q) : true,
    );
    if (quickFilter === "available") {
      list = list.filter((h) =>
        isFreelancerInActive24hLiveWindow(h.freelancer_profiles),
      );
    }
    if (quickFilter === "nearby") {
      list = list.filter((h) => helperIsNearbyForViewer(h, profile));
      list = [...list].sort((a, b) => {
        const da = resolveHelperDistanceKmForViewer(a, profile).km ?? 9999;
        const db = resolveHelperDistanceKmForViewer(b, profile).km ?? 9999;
        return da - db;
      });
    } else if (quickFilter === "high_rated") {
      list = list.filter((h) => (h.average_rating ?? 0) >= 4);
      list = [...list].sort(
        (a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0),
      );
    }
    return list;
  }, [helpersMatchingCategories, nameQuery, quickFilter, profile]);

  const availableNowRail = useMemo(
    () =>
      displayedHelpers.filter(
        (h) =>
          isFreelancerLiveWindowActive(h.freelancer_profiles) ||
          h.is_available_for_jobs !== false,
      ),
    [displayedHelpers],
  );

  const galleryFetchKey = useMemo(
    () =>
      helpersMatchingCategories
        .map((h) => h.id)
        .sort()
        .join(","),
    [helpersMatchingCategories],
  );

  useEffect(() => {
    const userIds = [...new Set(helpersMatchingCategories.map((h) => h.id))];
    if (userIds.length === 0) {
      setGalleryByUserId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("public_profile_media")
        .select("id, user_id, media_type, storage_path, sort_order, created_at")
        .in("user_id", userIds);
      if (cancelled) return;
      if (error) {
        console.warn("HelpersPage public_profile_media:", error);
        setGalleryByUserId({});
        return;
      }
      const rows = (data ?? []) as PublicProfileGalleryRow[];
      const by: Record<string, PublicProfileGalleryRow[]> = {};
      for (const id of userIds) by[id] = [];
      for (const row of rows) {
        const uid = row.user_id;
        if (!by[uid]) by[uid] = [];
        by[uid].push(row);
      }
      for (const uid of userIds) {
        by[uid].sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
        );
      }
      setGalleryByUserId(by);
    })();
    return () => {
      cancelled = true;
    };
  }, [galleryFetchKey]);

  const mediaHelperKey = useMemo(
    () =>
      Object.entries(galleryByUserId)
        .filter(([, rows]) => rows.length > 0)
        .map(([id]) => id)
        .sort()
        .join(","),
    [galleryByUserId],
  );

  useEffect(() => {
    const ids = mediaHelperKey ? mediaHelperKey.split(",") : [];
    if (ids.length === 0) {
      setOfferPreviewsByUserId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profile_posts")
        .select(
          "id, author_id, caption, media_type, storage_path, created_at, post_metadata, custom_category",
        )
        .in("author_id", ids)
        .eq("post_type_id", "offer_service")
        .order("created_at", { ascending: false })
        .limit(Math.min(ids.length * 8, 400));
      if (cancelled) return;
      if (error) {
        console.warn("HelpersPage offer previews:", error);
        setOfferPreviewsByUserId({});
        return;
      }
      const grouped: Record<string, HelperOfferPreview[]> = {};
      for (const row of data ?? []) {
        const authorId = row.author_id as string;
        const list = grouped[authorId] ?? [];
        if (list.length >= 2) continue;
        const meta = (row.post_metadata ?? null) as {
          service?: string | null;
          custom_category?: string | null;
        } | null;
        const categoryId =
          (typeof meta?.service === "string" && meta.service) || null;
        const custom =
          (typeof meta?.custom_category === "string" && meta.custom_category.trim()) ||
          (typeof row.custom_category === "string" && row.custom_category.trim()) ||
          null;
        const title =
          (typeof row.caption === "string" && row.caption.trim()) ||
          postServiceCategoryLabel(categoryId, custom);
        const hasImage =
          row.media_type === "image" &&
          typeof row.storage_path === "string" &&
          row.storage_path.trim().length > 0;
        const imageUrl = hasImage
          ? publicProfileMediaUrl(row.storage_path as string, {
              width: 480,
              quality: 76,
              resize: "cover",
            })
          : getServiceCategoryImage(
              categoryId && isServiceCategoryId(categoryId) ? categoryId : "other_help",
            );
        list.push({
          id: row.id as string,
          title,
          imageUrl,
          photo: hasImage,
        });
        grouped[authorId] = list;
      }
      setOfferPreviewsByUserId(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaHelperKey]);

  useEffect(() => {
    setMatchSearchChromeVisible(false);
    return () => setMatchSearchChromeVisible(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasSearched || mobileAutoSearchStartedRef.current) return;
    if (deepLinkAutoSearchStartedRef.current) return;
    const t = window.setTimeout(() => {
      if (hasSearched || mobileAutoSearchStartedRef.current) return;
      mobileAutoSearchStartedRef.current = true;
      void runSearch();
    }, 500);
    return () => window.clearTimeout(t);
  }, [hasSearched, runSearch]);

  const mobileSnapRef = useRef<HTMLDivElement | null>(null);
  const [mobileSnapIndex, setMobileSnapIndex] = useState(0);
  const pendingRestoreScrollTopRef = useRef<number | null>(null);
  const restoringRef = useRef(false);

  /** Mobile: keep an index for "X more" indicator. */
  const syncMobileSnapIndex = useCallback(() => {
    const el = mobileSnapRef.current;
    if (!el) return;
    const h = el.clientHeight;
    if (h <= 0) return;
    const next = Math.round(el.scrollTop / h);
    setMobileSnapIndex(
      Math.max(0, Math.min(displayedHelpers.length - 1, next)),
    );
  }, [displayedHelpers.length]);

  useEffect(() => {
    // If we have a pending restore scroll position, do NOT reset to top.
    if (pendingRestoreScrollTopRef.current != null) return;
    setMobileSnapIndex(0);
    const el = mobileSnapRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "auto" });
  }, [displayedHelpers.map((h) => h.id).join("|")]);

  const helpersMatchingIdsKey = useMemo(
    () => helpersMatchingCategories.map((h) => h.id).join("|"),
    [helpersMatchingCategories],
  );

  /** Deep link: scroll to the helper card, then strip focus params from the URL. */
  useEffect(() => {
    if (!focusHelperIdFromUrl) {
      deepLinkScrollDoneRef.current = false;
      deepLinkClearedCategoriesRef.current = false;
      deepLinkAutoSearchStartedRef.current = false;
      return;
    }
    if (!hasSearched || loadingFetch) return;
    if (deepLinkScrollDoneRef.current) return;

    const id = focusHelperIdFromUrl;
    let idx = helpersMatchingCategories.findIndex((h) => h.id === id);
    if (idx < 0) {
      const inResults = allFilteredHelpers.some((h) => h.id === id);
      if (
        inResults &&
        selectedCategories.size > 0 &&
        !deepLinkClearedCategoriesRef.current
      ) {
        deepLinkClearedCategoriesRef.current = true;
        setSelectedCategories(new Set());
        return;
      }
      deepLinkScrollDoneRef.current = true;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete(HELPERS_FOCUS_HELPER_QUERY);
          p.delete(HELPERS_FOCUS_LAT_QUERY);
          p.delete(HELPERS_FOCUS_LNG_QUERY);
          return p;
        },
        { replace: true },
      );
      return;
    }

    const clearFocusParams = () => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete(HELPERS_FOCUS_HELPER_QUERY);
          p.delete(HELPERS_FOCUS_LAT_QUERY);
          p.delete(HELPERS_FOCUS_LNG_QUERY);
          return p;
        },
        { replace: true },
      );
    };

    const t = window.setTimeout(() => {
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) {
        document
          .getElementById(`helper-result-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        const el = mobileSnapRef.current;
        if (el && el.clientHeight > 0) {
          el.scrollTo({ top: idx * el.clientHeight, behavior: "smooth" });
          setMobileSnapIndex(idx);
        }
      }
      deepLinkScrollDoneRef.current = true;
      clearFocusParams();
    }, 220);

    return () => window.clearTimeout(t);
  }, [
    focusHelperIdFromUrl,
    hasSearched,
    loadingFetch,
    helpersMatchingIdsKey,
    helpersMatchingCategories,
    allFilteredHelpers,
    selectedCategories.size,
    setSearchParams,
  ]);

  /** Deep link from the header category menu: keep that category selected. */
  useEffect(() => {
    const raw = searchParams.get("category");
    if (!raw || !isServiceCategoryId(raw)) return;
    setSelectedCategories(new Set([raw]));
    const sub = searchParams.get("sub");
    if (
      raw === "other_help" &&
      sub &&
      OTHER_HELP_SUBCATEGORIES.some((item) => item.id === sub)
    ) {
      setSelectedOtherSubs(new Set([sub]));
    } else {
      setSelectedOtherSubs(new Set());
    }
  }, [searchParams]);

  /** Restore previous state (Back navigation / revisit). */
  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    if (searchParams.get(HELPERS_FOCUS_HELPER_QUERY)?.trim()) {
      return;
    }
    const categoryFromUrl = searchParams.get("category");
    if (categoryFromUrl && isServiceCategoryId(categoryFromUrl)) return;
    try {
      const raw = sessionStorage.getItem(HELPERS_PAGE_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        userId: string | null;
        center?: { lat: number; lng: number };
        radiusKm?: number;
        searchQuery?: string;
        geocodeMatchedPlace?: boolean;
        selectedCategories?: string[];
        hasSearched?: boolean;
        searchChromeCollapsed?: boolean;
        mobileSnapIndex?: number;
        mobileSnapScrollTop?: number;
      };
      const currentId = user?.id ?? null;
      if (parsed.userId !== currentId) return;

      if (
        parsed.center &&
        Number.isFinite(parsed.center.lat) &&
        Number.isFinite(parsed.center.lng)
      ) {
        setCenter(parsed.center);
      }
      if (typeof parsed.searchQuery === "string") setSearchQuery(parsed.searchQuery);
      if (typeof parsed.geocodeMatchedPlace === "boolean")
        setGeocodeMatchedPlace(parsed.geocodeMatchedPlace);
      if (Array.isArray(parsed.selectedCategories)) {
        setSelectedCategories(
          new Set(
            parsed.selectedCategories.filter(
              (x): x is ServiceCategoryId => isServiceCategoryId(x),
            ),
          ),
        );
      }
      if (typeof parsed.hasSearched === "boolean") setHasSearched(parsed.hasSearched);
      if (typeof parsed.searchChromeCollapsed === "boolean")
        setSearchChromeCollapsed(parsed.searchChromeCollapsed);
      if (typeof parsed.mobileSnapIndex === "number" && Number.isFinite(parsed.mobileSnapIndex)) {
        setMobileSnapIndex(Math.max(0, parsed.mobileSnapIndex));
      }
      if (
        typeof parsed.mobileSnapScrollTop === "number" &&
        Number.isFinite(parsed.mobileSnapScrollTop)
      ) {
        pendingRestoreScrollTopRef.current = Math.max(0, parsed.mobileSnapScrollTop);
      }
    } catch {
      // ignore corrupted session state
    }
  }, [user?.id, searchParams]);

  /** If restored state says we already searched, refetch results once. */
  useEffect(() => {
    if (!restoringRef.current) return;
    if (!hasSearched) return;
    if (deepLinkAutoSearchStartedRef.current) return;
    void runSearch({ radiusKm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearched]);

  /** Restore the scroll position after results render. */
  useEffect(() => {
    const v = pendingRestoreScrollTopRef.current;
    const el = mobileSnapRef.current;
    if (v == null || !el) return;
    if (helpersMatchingCategories.length === 0) return;
    el.scrollTo({ top: v, behavior: "auto" });
    pendingRestoreScrollTopRef.current = null;
    window.requestAnimationFrame(syncMobileSnapIndex);
  }, [helpersMatchingCategories.length]);

  /** Persist current state when navigating away. */
  useEffect(() => {
    const save = () => {
      try {
        const payload = {
          userId: user?.id ?? null,
          center,
          radiusKm,
          searchQuery,
          geocodeMatchedPlace,
          selectedCategories: [...selectedCategories],
          hasSearched,
          searchChromeCollapsed,
          mobileSnapIndex,
          mobileSnapScrollTop: mobileSnapRef.current?.scrollTop ?? 0,
        };
        sessionStorage.setItem(HELPERS_PAGE_STATE_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [
    user?.id,
    center,
    radiusKm,
    searchQuery,
    geocodeMatchedPlace,
    selectedCategories,
    hasSearched,
    searchChromeCollapsed,
    mobileSnapIndex,
  ]);

  const renderBrowseCard = (h: HelperResult) => {
    const { km, fromViewerPin } = resolveHelperDistanceKmForViewer(h, profile);
    return (
      <HelperResultProfileCard
        helper={{ ...h, distanceKm: km }}
        distanceFromViewerPin={fromViewerPin}
        gallery={galleryByUserId[h.id] ?? []}
        offerPreviews={offerPreviewsByUserId[h.id] ?? []}
        viewerId={user?.id}
        favoriteIds={favoriteIds}
        favoriteBusyId={favoriteBusyId}
        respondsWithinLabel={respondsWithinCardLabel(
          helperReplyStatsByHelperId[h.id]?.avg_seconds,
          helperReplyStatsByHelperId[h.id]?.sample_count,
        )}
        canStartInLabel={canStartInCardLabel(
          h.freelancer_profiles?.live_can_start_in,
        )}
        liveHelpWeekCount={liveHelpWeekByHelperId[h.id]}
        onToggleFavorite={toggleFavorite}
        onOpenProfile={(id) => navigate(`/profile/${id}`)}
        variant="browse"
      />
    );
  };

  const favoriteRail = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; full_name: string | null; photo_url: string | null }
    >();
    for (const person of favoriteProfiles) {
      if (favoriteIds.has(person.id)) byId.set(person.id, person);
    }
    for (const helper of helpersMatchingCategories) {
      if (!favoriteIds.has(helper.id)) continue;
      byId.set(helper.id, {
        id: helper.id,
        full_name: helper.full_name,
        photo_url: helper.photo_url,
      });
    }
    return [...byId.values()];
  }, [favoriteProfiles, favoriteIds, helpersMatchingCategories]);

  return (
    <div
      data-find-helpers-page=""
      data-find-helpers-cards-view=""
      className={cn(
        "min-h-screen bg-background",
        "max-md:h-[100dvh] max-md:overflow-hidden max-md:pb-0 md:pb-8",
      )}
    >
      <aside
        className="fixed end-3 top-20 bottom-4 z-[220] hidden w-[6.5rem] flex-col items-center justify-center md:flex"
        aria-label={t("findHelpersPage.sideRail", {
          defaultValue: "Available now and favorites",
        })}
      >
        <div className="flex max-h-full w-full flex-col items-center gap-4 overflow-y-auto rounded-[28px] bg-white/95 px-2 py-3 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900/95 dark:ring-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {t("common.now")}
            </p>
            {availableNowRail.map((h) => (
                <HelperRailAvatar
                    key={`now-${h.id}`}
                    name={h.full_name}
                    photoUrl={h.photo_url}
                    seed={h.id}
                    label={t("common.now")}
                    ringClass="ring-emerald-500"
                    onClick={() => onProfileOpen(h.id)}
                  />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              {t("common.saved")}
            </p>
            {favoriteRail.map((person) => (
                <HelperRailAvatar
                    key={`saved-${person.id}`}
                    name={person.full_name}
                    photoUrl={person.photo_url}
                    seed={person.id}
                    label={t("common.saved")}
                    ringClass="ring-orange-500"
                    onClick={() => onProfileOpen(person.id)}
                  />
            ))}
          </div>
        </div>
      </aside>
      <div
        className={cn(
          "app-desktop-shell max-md:!px-0",
          "max-md:h-full max-md:space-y-0 max-md:pt-0 md:space-y-0 md:pt-0 md:pe-32",
        )}
      >
        <div
          className={cn(
            "flex flex-col",
            "max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-10 max-md:[bottom:var(--app-bottom-nav-stack)]",
          )}
        >
          <FindHelpersMobileChrome
            quickFilter={quickFilter}
            onQuickFilter={setQuickFilter}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            onClearCategories={clearCategoryFilters}
            onReplaceCategories={replaceCategoryFilters}
            selectedOtherSubs={selectedOtherSubs}
            onToggleOtherSub={toggleOtherSub}
            nameQuery={nameQuery}
            onNameQueryChange={setNameQuery}
            searchOpen={mobileSearchOpen}
            onSearchOpenChange={setMobileSearchOpen}
            filterMenuOpen={filterMenuOpen}
            onFilterMenuOpenChange={setFilterMenuOpen}
            panel={mobilePanel}
            onPanelChange={setMobilePanel}
            onBack={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/client/home");
              }
            }}
            locationPanel={
              <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-3 pb-5">
                <div className="shrink-0 pb-3">
                  <LocationCitySearchBar
                    isLoaded={isLoaded}
                    value={citySearchValue}
                    onChange={setCitySearchValue}
                    placeholder={t("findHelpersPage.searchCity")}
                    onActiveChange={setCitySearchActive}
                    onPick={(lat, lng, label) => {
                      gpsLockRef.current = true;
                      setCenter({ lat, lng });
                      setGeocodeMatchedPlace(true);
                      setCitySearchValue(label);
                    }}
                  />
                </div>
                <div
                  className={cn(
                    "relative h-[48vh] max-h-[380px] shrink-0 overflow-hidden rounded-2xl md:h-[52vh] md:max-h-[520px]",
                    citySearchActive && "pointer-events-none",
                  )}
                >
                  <HelpersMapBlock
                    center={center}
                    radiusKm={radiusKm}
                    hasSearched={hasSearched}
                    results={helpersMatchingCategories}
                    isLoaded={isLoaded}
                    loadError={loadError}
                    mapsApiKey={mapsApiKey}
                    onMapClick={onMapClick}
                    onProfileOpen={onProfileOpen}
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    aria-label="Use my location"
                    className={cn(
                      "absolute left-2.5 top-2.5 z-[12] flex h-9 w-9 items-center justify-center rounded-full",
                      "bg-white/35 shadow-sm backdrop-blur-xl",
                    )}
                  >
                    {locating ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Navigation className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
                <div className="mt-3">
                  <BigRadiusSlider
                    id="helpers-radius-mobile-overlay"
                    value={radiusKm}
                    onChange={setRadiusKm}
                    orientation="horizontal"
                  />
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={loadingFetch}
                  className="mt-4 h-12 w-full rounded-2xl text-base font-bold"
                  onClick={() => {
                    void runSearch();
                    setMobilePanel("none");
                  }}
                >
                  {loadingFetch ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : null}
                  {t("findHelpersPage.applyLocation")}
                </Button>
              </div>
            }
          />
          {(!hasSearched || loadingFetch) && displayedHelpers.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-stretch px-3 pt-2 md:hidden">
              <HelperBrowseCardSkeleton />
            </div>
          ) : displayedHelpers.length === 0 && hasSearched ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm font-medium text-zinc-400 md:hidden">
              {t("findHelpersPage.noMatch")}
            </div>
          ) : (
            <div
              ref={mobileSnapRef}
              onScroll={() => {
                window.requestAnimationFrame(syncMobileSnapIndex);
              }}
              className={cn(
                "min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain md:hidden",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              )}
              aria-label="Helpers"
            >
              {displayedHelpers.map((h) => (
                <div
                  key={h.id}
                  id={`helper-result-mobile-${h.id}`}
                  className="flex h-full w-full shrink-0 snap-start snap-always items-stretch pt-2 pb-0"
                >
                  <div className="h-full w-full min-h-0">{renderBrowseCard(h)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="hidden md:block md:pb-8">
            {(!hasSearched || loadingFetch) && displayedHelpers.length === 0 ? (
              <div className="grid grid-cols-3 items-stretch gap-[14px] px-[14px] lg:gap-5 min-[1680px]:grid-cols-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <HelperBrowseCardSkeleton key={i} />
                ))}
              </div>
            ) : displayedHelpers.length === 0 && hasSearched ? (
              <div
                ref={resultsAnchorRef}
                className="flex min-h-[40vh] items-center justify-center px-5 text-center text-sm font-medium text-zinc-400"
              >
                {t("findHelpersPage.noMatch")}
              </div>
            ) : (
              <div
                ref={resultsAnchorRef}
                className="grid grid-cols-3 items-stretch gap-[14px] px-[14px] lg:gap-5 min-[1680px]:grid-cols-4"
              >
                {displayedHelpers.map((h) => (
                  <div
                    key={h.id}
                    id={`helper-result-${h.id}`}
                    className="contents"
                  >
                    {renderBrowseCard(h)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
