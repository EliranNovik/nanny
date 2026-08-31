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
import {
  HelperResultProfileCard,
  type PublicProfileGalleryRow,
} from "@/components/helpers/HelperResultProfileCard";
import {
  FindHelpersMobileChrome,
  type FindHelpersMobilePanel,
  type FindHelpersQuickFilter,
} from "@/components/helpers/FindHelpersMobileChrome";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { useToast } from "@/components/ui/toast";
import {
  canStartInCardLabel,
  respondsWithinCardLabel,
} from "@/lib/liveCanStart";
import {
  isServiceCategoryId,
  OTHER_HELP_SUBCATEGORIES,
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
  RADIUS_MIN,
  RADIUS_STEP,
} from "@/components/search/BigRadiusSlider";
import { setMatchSearchChromeVisible } from "@/lib/matchSearchHeaderState";

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [radiusKm, setRadiusKm] = useState(25);
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
  /** Apply saved profile search radius once when it loads (does not override after user moves slider). */
  const appliedProfileRadiusRef = useRef(false);
  /** First coords from profile — used when clearing search to restore map center. */
  const profileCenterSnapshotRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  /** When set, profile city coords must not overwrite the map center (GPS or user choice wins). */
  const gpsLockRef = useRef(false);
  const geocodeRequestIdRef = useRef(0);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  /** Multi-select: show helpers live in any of these categories (OR). Empty = all categories. */
  const [selectedCategories, setSelectedCategories] = useState<
    Set<ServiceCategoryId>
  >(() => new Set());
  const [selectedOtherSubs, setSelectedOtherSubs] = useState<Set<string>>(
    () => new Set(),
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

  /** Prefer device location when permission is granted; otherwise profile/saved city above applies. */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsLockRef.current = true;
        setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeocodeMatchedPlace(false);
      },
      () => {
        /* keep profile or default center */
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  /** Debounce search text for geocoding (does not fetch helpers until Search). */
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    if (appliedProfileRadiusRef.current) return;
    if (profile?.service_radius == null) return;
    const r = Number(profile.service_radius);
    if (Number.isNaN(r)) return;
    const clamped = Math.min(
      RADIUS_MAX,
      Math.max(RADIUS_MIN, Math.round(r / RADIUS_STEP) * RADIUS_STEP),
    );
    setRadiusKm(clamped);
    appliedProfileRadiusRef.current = true;
  }, [profile?.service_radius]);

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

  /** Restore previous state (Back navigation / revisit). */
  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    if (searchParams.get(HELPERS_FOCUS_HELPER_QUERY)?.trim()) {
      return;
    }
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
      if (typeof parsed.radiusKm === "number" && Number.isFinite(parsed.radiusKm)) {
        setRadiusKm(parsed.radiusKm);
        // Prevent profile radius from overwriting a restored radius.
        appliedProfileRadiusRef.current = true;
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

  return (
    <div
      data-find-helpers-page=""
      data-find-helpers-cards-view=""
      className={cn(
        "min-h-screen bg-background",
        "max-md:h-[100dvh] max-md:overflow-hidden max-md:pb-0 md:pb-8",
      )}
    >
      <div
        className={cn(
          "app-desktop-shell max-md:!px-0",
          "max-md:h-full max-md:space-y-0 max-md:pt-0 md:space-y-0 md:pt-0",
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
            <div className="flex min-h-0 flex-1 items-center justify-center md:hidden">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
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
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
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
                className="grid grid-cols-3 items-stretch gap-5 xl:grid-cols-4"
              >
                {displayedHelpers.map((h) => (
                  <div
                    key={h.id}
                    id={`helper-result-${h.id}`}
                    className="flex min-h-0 h-full flex-col"
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
