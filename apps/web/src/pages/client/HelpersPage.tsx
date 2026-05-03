import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  Navigation,
  UsersRound,
  PlusCircle,
  Radar,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HelperResultProfileCard,
  type PublicProfileGalleryRow,
} from "@/components/helpers/HelperResultProfileCard";
import { useToast } from "@/components/ui/toast";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import {
  canStartInCardLabel,
  respondsWithinCardLabel,
} from "@/lib/liveCanStart";
import {
  SERVICE_CATEGORIES,
  type ServiceCategoryId,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { haversineDistanceKm } from "@/lib/geo";
import {
  HELPERS_FOCUS_HELPER_QUERY,
  HELPERS_FOCUS_LAT_QUERY,
  HELPERS_FOCUS_LNG_QUERY,
} from "@/lib/clientAppPaths";

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

function helperMatchesSelectedCategories(
  h: HelperResult,
  selected: ReadonlySet<ServiceCategoryId>,
): boolean {
  if (selected.size === 0) return true;
  const lc = h.freelancer_profiles?.live_categories;
  if (!lc?.length) return false;
  const live = new Set(lc);
  for (const id of selected) {
    if (live.has(id)) return true;
  }
  return false;
}

const RADIUS_MIN = 5;
const RADIUS_MAX = 100;
const RADIUS_STEP = 5;

function BigRadiusSlider({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (km: number) => void;
  id?: string;
}) {
  return (
    <SliderPrimitive.Root
      id={id}
      className="relative flex h-[4.75rem] w-full touch-none select-none items-center py-2"
      value={[value]}
      onValueChange={(v) => {
        const next = v[0] ?? value;
        onChange(
          Math.min(
            RADIUS_MAX,
            Math.max(RADIUS_MIN, Math.round(next / RADIUS_STEP) * RADIUS_STEP),
          ),
        );
      }}
      min={RADIUS_MIN}
      max={RADIUS_MAX}
      step={RADIUS_STEP}
      aria-label="Search radius in kilometers"
    >
      <SliderPrimitive.Track className="relative h-5 w-full grow overflow-hidden rounded-full bg-orange-100/90 shadow-inner dark:bg-orange-950/35">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-white",
          "bg-gradient-to-br from-orange-500 to-amber-500 shadow-xl",
          "ring-4 ring-orange-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400/60",
        )}
        aria-valuetext={`${value} kilometers`}
      >
        <span className="text-[1.65rem] font-black leading-none tabular-nums text-white">
          {value}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-white/90">
          km
        </span>
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
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
      map.fitBounds(bounds, 48);
    }
  }, [mapReady, center.lat, center.lng, radiusKm]);

  useEffect(() => {
    return () => {
      searchCircleRef.current?.setMap(null);
      searchCircleRef.current = null;
    };
  }, []);

  if (loadError || !mapsApiKey) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
        Map unavailable. Set VITE_GOOGLE_MAPS_API_KEY to show the map. You can
        still search helpers by distance from your profile location.
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
        fullscreenControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        clickableIcons: false,
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          search_query: searchQuery.trim(),
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
        window.setTimeout(() => {
          resultsAnchorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
      } catch (e: unknown) {
        console.error("HelpersPage fetch:", e);
        setResults([]);
        setHelperReplyStatsByHelperId({});
        setLiveHelpWeekByHelperId({});
        addToast({
          title: "Error fetching helpers",
          description:
            e && typeof e === "object" && "message" in e
              ? String((e as { message: string }).message)
              : "An unexpected error occurred.",
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

  /** Only helpers in an active 24h go-live window (`live_until` in the future). */
  const helpersInLiveWindow = useMemo(
    () =>
      results.filter((h) =>
        isFreelancerInActive24hLiveWindow(h.freelancer_profiles),
      ),
    [results],
  );

  const helpersMatchingCategories = useMemo(
    () =>
      helpersInLiveWindow.filter((h) =>
        helperMatchesSelectedCategories(h, selectedCategories),
      ),
    [helpersInLiveWindow, selectedCategories],
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

  /** Full search UI until the first successful search; after that, hide when collapsed to FAB. */
  const showSearchChrome = !hasSearched || !searchChromeCollapsed;
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
      Math.max(0, Math.min(helpersMatchingCategories.length - 1, next)),
    );
  }, [helpersMatchingCategories.length]);

  useEffect(() => {
    // If we have a pending restore scroll position, do NOT reset to top.
    if (pendingRestoreScrollTopRef.current != null) return;
    setMobileSnapIndex(0);
    const el = mobileSnapRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "auto" });
  }, [helpersMatchingCategories.map((h) => h.id).join("|")]);

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
      const inLive = helpersInLiveWindow.some((h) => h.id === id);
      if (
        inLive &&
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
    helpersInLiveWindow,
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

  const renderSearchHelpersButton = () => (
    <Button
      type="button"
      size="lg"
      disabled={loadingFetch}
      onClick={() => void runSearch()}
      className="h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
    >
      {loadingFetch ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Searching…
        </>
      ) : (
        <>
          <Radar className="mr-2 h-5 w-5" />
          Search helpers
        </>
      )}
    </Button>
  );

  return (
    <div
      data-find-helpers-no-app-header=""
      className={cn(
        "min-h-screen bg-background",
        /* Room for mobile fixed dock above BottomNav (md+ keeps normal padding). */
        "max-md:pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))] md:pb-8",
      )}
    >
      <div
        className={cn(
          "app-desktop-shell space-y-8 pt-6 md:pt-8",
          hasSearched &&
            searchChromeCollapsed &&
            "max-md:space-y-2 max-md:pt-[max(0.35rem,env(safe-area-inset-top,0px))]",
        )}
      >
        {showSearchChrome ? (
          <>
            <div className="mx-auto w-full max-w-lg px-2 text-center md:max-w-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
                Find helpers
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Only helpers who are live in a 24-hour availability window appear
                here.
              </p>
            </div>

            {hasSearched ? (
              <div className="mx-auto w-full max-w-lg px-2 md:max-w-2xl">
                <p className="text-center text-xs font-semibold text-muted-foreground">
                  {helpersMatchingCategories.length} helper
                  {helpersMatchingCategories.length === 1 ? "" : "s"} match
                  {selectedCategories.size > 0
                    ? " your filters"
                    : " this search"}
                </p>
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-lg md:max-w-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="space-y-6 px-1 pt-2 md:px-0 md:pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span
                  id="helpers-category-label"
                  className="text-sm font-bold text-slate-800 dark:text-slate-100"
                >
                  Categories
                </span>
                {selectedCategories.size > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-orange-600 underline-offset-4 hover:underline dark:text-orange-400"
                    onClick={() => setSelectedCategories(new Set())}
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <p
                id="helpers-category-hint"
                className="text-xs text-muted-foreground"
              >
               
              </p>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-labelledby="helpers-category-label"
                aria-describedby="helpers-category-hint"
              >
                {SERVICE_CATEGORIES.map((cat) => {
                  const on = selectedCategories.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2",
                        on
                          ? "border-orange-500 bg-orange-500 text-white shadow-sm dark:border-orange-400 dark:bg-orange-500"
                          : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/80 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-200 dark:hover:border-orange-900/50",
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-2xl",
                  "shadow-md shadow-black/10 dark:shadow-black/30",
                )}
              >
                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-orange-50/25 to-transparent dark:from-orange-950/20" />
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
                    "absolute left-2.5 top-2.5 z-[12] flex max-w-[min(100%,11rem)] items-center gap-1.5 rounded-full border border-white/55",
                    "bg-white/35 px-2.5 py-1.5 text-left shadow-sm backdrop-blur-xl",
                    "text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-900",
                    "ring-1 ring-inset ring-white/50 transition-colors",
                    "hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "disabled:pointer-events-none disabled:opacity-60",
                  )}
                >
                  {locating ? (
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 truncate">My location</span>
                </button>
                <div className="pointer-events-auto absolute inset-x-2.5 bottom-2.5 z-[12]">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 z-[2] h-4 w-4 -translate-y-1/2 text-slate-600/90 dark:text-slate-800/80"
                      aria-hidden
                    />
                    <Input
                      id="helpers-city-name"
                      placeholder="City or name"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void runSearch();
                        }
                      }}
                      aria-busy={loadingFetch}
                      className={cn(
                        "h-11 rounded-2xl border border-white/55 bg-white/35 pl-10 pr-3 text-[15px] text-slate-900 shadow-sm backdrop-blur-xl",
                        "placeholder:text-slate-600/80",
                        "ring-1 ring-inset ring-white/50",
                        "focus-visible:border-orange-400/60 focus-visible:ring-orange-400/40",
                        "dark:border-white/50 dark:bg-white/30 dark:text-slate-950 dark:placeholder:text-slate-700/80",
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="px-0.5">
                <label
                  htmlFor="helpers-radius"
                  className="text-sm font-bold text-slate-800 dark:text-slate-100"
                >
                
                </label>
              </div>
              <BigRadiusSlider
                id="helpers-radius"
                value={radiusKm}
                onChange={setRadiusKm}
              />
              <div className="flex justify-between px-1 text-xs font-bold text-muted-foreground">
                <span>{RADIUS_MIN} km</span>
                <span>{RADIUS_MAX} km</span>
              </div>
            </div>

            {/* md+: primary CTA in flow. Mobile uses fixed dock below. */}
            <div className="hidden md:block">{renderSearchHelpersButton()}</div>
          </div>
        </div>
          </>
        ) : (
          <div className="max-md:hidden sticky top-[80px] z-40 -mt-4 mb-4 flex justify-center pointer-events-none">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full shadow-lg pointer-events-auto border-orange-500/20 bg-white/95 backdrop-blur-sm px-6 h-10 font-bold text-slate-800 dark:bg-zinc-900/95 dark:text-slate-200"
              onClick={() => {
                setSearchChromeCollapsed(false);
                window.requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                });
              }}
            >
              <Radar className="mr-2 h-4 w-4 text-orange-500" />
              Map & search
            </Button>
          </div>
        )}

        {hasSearched && helpersInLiveWindow.length > 0 && (
          <div
            className="animate-in fade-in slide-in-from-bottom-4 mx-auto hidden w-full max-w-5xl items-center justify-between px-2 duration-700 md:flex md:max-w-6xl"
          >
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              <>
                {helpersMatchingCategories.length} helper
                {helpersMatchingCategories.length === 1 ? "" : "s"}
                <span className="ml-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  (24h window
                  {selectedCategories.size > 0
                    ? ` · ${selectedCategories.size} categor${selectedCategories.size === 1 ? "y" : "ies"}`
                    : ""}
                  )
                </span>
              </>
            </h2>
            {helpersMatchingCategories.length > 0 && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {helpersMatchingCategories.some((r) => r.distanceKm == null)
                  ? "Mixed match"
                  : "By distance"}
              </span>
            )}
          </div>
        )}

        {!hasSearched ? null : results.length === 0 ? (
          <div
            ref={resultsAnchorRef}
            className="animate-in fade-in slide-in-from-bottom-3 mx-auto w-full max-w-5xl px-2 duration-700 md:max-w-6xl"
          >
            <Card className="border border-dashed">
              <CardContent className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <UsersRound className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  No helpers in this area
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Widen the radius or move the map.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = Math.min(RADIUS_MAX, radiusKm + 10);
                      setRadiusKm(next);
                      void runSearch({ radiusKm: next });
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Expand radius (+10 km)
                  </Button>
                  <Button onClick={() => navigate("/client/create")}>
                    Post a request instead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : helpersInLiveWindow.length === 0 ? (
          <div
            ref={resultsAnchorRef}
            className="animate-in fade-in slide-in-from-bottom-3 mx-auto w-full max-w-5xl px-2 duration-700 md:max-w-6xl"
          >
            <Card className="border border-dashed">
              <CardContent className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <UsersRound className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  No live helpers in this area yet
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  No one with an active 24-hour availability window matched this
                  search. Try a wider radius or check back later.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = Math.min(RADIUS_MAX, radiusKm + 10);
                      setRadiusKm(next);
                      void runSearch({ radiusKm: next });
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Expand radius (+10 km)
                  </Button>
                  <Button onClick={() => navigate("/client/create")}>
                    Post a request instead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : helpersMatchingCategories.length === 0 ? (
          <div
            ref={resultsAnchorRef}
            className="animate-in fade-in slide-in-from-bottom-3 mx-auto w-full max-w-5xl px-2 duration-700 md:max-w-6xl"
          >
            <Card className="border border-dashed">
              <CardContent className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <UsersRound className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  No helpers match your categories
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  {helpersInLiveWindow.length} live helper
                  {helpersInLiveWindow.length === 1 ? "" : "s"} found, but none
                  are live in the categories you selected. Deselect categories or
                  pick different ones.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCategories(new Set())}
                  >
                    Clear category filter
                  </Button>
                  <Button onClick={() => navigate("/client/create")}>
                    Post a request instead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Mobile: full-screen fixed snap scroller above bottom dock */}
            {!showSearchChrome ? (
              <div
                className={cn(
                  "fixed inset-x-0 z-[50] md:hidden",
                  "top-[max(0px,env(safe-area-inset-top,0px))]",
                  // Leave room for BottomNav + the fixed dock panel
                  "bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+5.25rem)]",
                  "overflow-y-auto overscroll-y-contain",
                  "snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                  "bg-background",
                )}
                aria-label="Helpers"
                ref={mobileSnapRef}
                onScroll={() => {
                  window.requestAnimationFrame(syncMobileSnapIndex);
                }}
              >
                {helpersMatchingCategories.map((h) => {
                  const { km, fromViewerPin } =
                    resolveHelperDistanceKmForViewer(h, profile);
                  return (
                  <div
                    key={h.id}
                    id={`helper-result-${h.id}`}
                    className="relative h-full w-full snap-start snap-always px-2 py-2"
                  >
                    <div className="h-full w-full overflow-hidden rounded-[22px]">
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
                        variant="fullscreen"
                      />
                    </div>

                    {(() => {
                      const remaining = Math.max(
                        0,
                        helpersMatchingCategories.length - (mobileSnapIndex + 1),
                      );
                      if (remaining <= 0) return null;
                      const badge = remaining > 10 ? "10+" : String(remaining);
                      return (
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-x-0 bottom-3 z-[60] flex items-center justify-center",
                            "px-3",
                          )}
                          aria-hidden
                        >
                          <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/15">
                            <ChevronDown
                              className="h-4 w-4 text-white/85 motion-reduce:animate-none animate-bounce"
                              strokeWidth={2.5}
                              aria-hidden
                            />
                            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-black tabular-nums">
                              {badge}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
                })}
              </div>
            ) : null}

            {/* Desktop/tablet: keep grid */}
            <div
              ref={resultsAnchorRef}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-3 mx-auto hidden w-full max-w-5xl grid-cols-1 gap-5 px-2 duration-700 sm:grid-cols-2 md:grid md:max-w-6xl lg:grid-cols-3",
                "max-md:-mt-1 max-md:scroll-mt-0 max-md:gap-4",
              )}
            >
              {helpersMatchingCategories.map((h) => {
                const { km, fromViewerPin } =
                  resolveHelperDistanceKmForViewer(h, profile);
                return (
                <div key={h.id} id={`helper-result-${h.id}`} className="min-h-0">
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
                  />
                </div>
                );
              })}
            </div>
          </>
        )}

        {/* Mobile: full-width Search helpers fixed above BottomNav while panel is open */}
        {showSearchChrome ? (
          <div
            className={cn(
              "pointer-events-none fixed inset-x-0 z-[130] md:hidden",
              "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto border-t border-slate-200/80 bg-background/95 px-4 pb-2 pt-3",
                "shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.1)] backdrop-blur-md dark:border-white/10",
              )}
            >
              <div className="mx-auto w-full max-w-lg">
                {renderSearchHelpersButton()}
              </div>
            </div>
          </div>
        ) : null}

        {/* Mobile: after search, reopen map/filters when panel is collapsed */}
        {hasSearched && searchChromeCollapsed ? (
          <div
            className={cn(
              "pointer-events-none fixed inset-x-0 z-[130] md:hidden",
              "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto border-t border-slate-200/80 bg-background/95 px-4 pb-2 pt-3",
                "shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.1)] backdrop-blur-md dark:border-white/10",
              )}
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-14 w-full rounded-2xl border-orange-500/30 text-base font-black"
                onClick={() => {
                  setSearchChromeCollapsed(false);
                  window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  });
                }}
              >
                <Radar className="mr-2 h-5 w-5" />
                Map & search
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
