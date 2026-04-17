import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  MapPin,
  Search,
  Navigation,
  ChevronRight,
  Heart,
  UsersRound,
  PlusCircle,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/ui/toast";

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const SEARCH_CIRCLE_STYLE: google.maps.CircleOptions = {
  fillColor: "#f97316",
  fillOpacity: 0.22,
  strokeColor: "#ea580c",
  strokeOpacity: 1,
  strokeWeight: 3,
  clickable: false,
  zIndex: 1,
};

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
  freelancer_profiles: {
    hourly_rate_min: number | null;
    hourly_rate_max: number | null;
    bio: string | null;
    available_now: boolean | null;
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
      className="relative flex h-12 w-full touch-none select-none items-center py-2"
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
          "block h-12 w-12 shrink-0 rounded-full border-[3px] border-white bg-orange-500 shadow-xl",
          "ring-4 ring-orange-500/25 transition-transform hover:scale-[1.03] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400/60",
        )}
      />
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

export default function HelpersPage() {
  const navigate = useNavigate();
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
  const [availableNowFilter, setAvailableNowFilter] = useState(false);

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
    async (opts?: { radiusKm?: number }) => {
      const rk = opts?.radiusKm ?? radiusKm;
      setLoadingFetch(true);
      try {
        const viewerCityNorm = normalizeCityLabel(profile?.city);
        const { data, error } = await supabase.rpc("get_helpers_near_location", {
          search_lat: center.lat,
          search_lng: center.lng,
          radius_km: rk,
          search_query: searchQuery.trim(),
          viewer_city_norm: viewerCityNorm || "",
          geocode_matched_place: geocodeMatchedPlace,
        });

        if (error) throw error;

        let rows = data as HelperResult[];
        if (user?.id) rows = rows.filter((r) => r.id !== user.id);

        setResults(rows);
        setHasSearched(true);
        window.setTimeout(() => {
          resultsAnchorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
      } catch (e: unknown) {
        console.error("HelpersPage fetch:", e);
        setResults([]);
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

  const filteredResults = availableNowFilter
    ? results.filter((h) => h.is_available_for_jobs === true)
    : results;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background pb-6 md:pb-8">
      <div className="app-desktop-shell space-y-8 pt-6 md:pt-8">
        <div className="mx-auto w-full max-w-lg px-2 text-center md:max-w-2xl">
          <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
            Find helpers
          </h1>
        </div>

        <Card className="mx-auto w-full max-w-lg overflow-visible border border-slate-200/70 bg-white/80 shadow-lg shadow-orange-500/5 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/80 md:max-w-xl">
          <CardContent className="space-y-6 p-5 pt-6 md:p-8">
            <div className="relative mx-auto w-full max-w-md">
              <div
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-2xl",
                  "ring-2 ring-orange-200/80 ring-offset-2 ring-offset-slate-50",
                  "shadow-lg shadow-orange-500/15 dark:ring-orange-900/50 dark:ring-offset-zinc-950",
                )}
              >
                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-orange-50/25 to-transparent dark:from-orange-950/20" />
                <HelpersMapBlock
                  center={center}
                  radiusKm={radiusKm}
                  hasSearched={hasSearched}
                  results={results}
                  isLoaded={isLoaded}
                  loadError={loadError}
                  mapsApiKey={mapsApiKey}
                  onMapClick={onMapClick}
                  onProfileOpen={onProfileOpen}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 px-0.5">
                <label
                  htmlFor="helpers-radius"
                  className="text-sm font-bold text-slate-800 dark:text-slate-100"
                >
                  Radius
                </label>
                <span
                  className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xl font-black tabular-nums text-white shadow-md"
                  aria-live="polite"
                >
                  {radiusKm} km
                </span>
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

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-900"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                Use my location
              </Button>
              <button
                type="button"
                onClick={() => setAvailableNowFilter((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all border",
                  availableNowFilter
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    availableNowFilter ? "bg-white" : "bg-emerald-400",
                  )}
                />
                Available now
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="City or name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                className="h-12 rounded-2xl border-slate-200 pl-10 pr-4 text-[15px] dark:border-white/10"
                aria-busy={loadingFetch}
              />
            </div>

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
          </CardContent>
        </Card>

        {hasSearched && (
          <div
            ref={resultsAnchorRef}
            className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-5xl items-center justify-between px-2 duration-700 md:max-w-6xl"
          >
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              <>
                {filteredResults.length} helper
                {filteredResults.length === 1 ? "" : "s"}
                {availableNowFilter && (
                  <span className="ml-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    available now
                  </span>
                )}
              </>
            </h2>
            {filteredResults.length > 0 && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {results.some((r) => r.distanceKm == null)
                  ? "Mixed match"
                  : "By distance"}
              </span>
            )}
          </div>
        )}

        {!hasSearched ? null : filteredResults.length === 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-3 mx-auto w-full max-w-5xl px-2 duration-700 md:max-w-6xl">
            <Card className="border border-dashed">
              <CardContent className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <UsersRound className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  {availableNowFilter ? "No helpers available right now" : "No helpers in this area"}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  {availableNowFilter
                    ? "Turn off “Available now” to see everyone."
                    : "Widen the radius or move the map."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {availableNowFilter ? (
                    <Button variant="outline" onClick={() => setAvailableNowFilter(false)}>
                      Show all helpers
                    </Button>
                  ) : (
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
                  )}
                  <Button onClick={() => navigate("/client/create")}>
                    Post a request instead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div
            className="animate-in fade-in slide-in-from-bottom-3 mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-2 duration-700 sm:grid-cols-2 md:max-w-6xl lg:grid-cols-3"
          >
            {filteredResults.map((h) => (
              <Card
                key={h.id}
                className={cn(
                  "group flex h-full min-h-[440px] cursor-pointer flex-col overflow-hidden border border-slate-200/80 shadow-sm bg-white dark:bg-zinc-900 dark:border-white/5 transition-all duration-300 rounded-[20px]",
                  "hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/80",
                )}
                onClick={() => navigate(`/profile/${h.id}`)}
              >
                <CardContent className="flex flex-1 flex-col gap-0 p-0">
                  <div className="relative aspect-[5/4] w-full min-h-[200px] shrink-0 bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-slate-800 dark:to-slate-900">
                    {h.is_available_for_jobs && (
                      <div
                        className="pointer-events-none absolute left-3 top-3 z-[11] max-w-[calc(100%-5rem)]"
                        role="status"
                        aria-label="Available for jobs now"
                      >
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border border-white/20",
                            "bg-slate-950/75 px-2.5 py-1.5 shadow-lg shadow-black/15 backdrop-blur-md",
                            "text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-white",
                            "ring-1 ring-inset ring-white/10",
                          )}
                        >
                          <span
                            className="relative flex h-2 w-2 shrink-0"
                            aria-hidden
                          >
                            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                          </span>
                          <span className="pr-0.5">Available now</span>
                        </span>
                      </div>
                    )}
                    {user?.id && (
                      <button
                        type="button"
                        aria-label={
                          favoriteIds.has(h.id)
                            ? "Remove from favorites"
                            : "Add to favorites"
                        }
                        aria-pressed={favoriteIds.has(h.id)}
                        disabled={favoriteBusyId === h.id}
                        onClick={(e) => void toggleFavorite(h.id, e)}
                        className={cn(
                          "absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-md backdrop-blur-sm transition-colors",
                          "hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                          "disabled:opacity-60",
                        )}
                      >
                        {favoriteBusyId === h.id ? (
                          <Loader2
                            className="h-5 w-5 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Heart
                            className={cn(
                              "h-5 w-5 text-white drop-shadow-sm",
                              favoriteIds.has(h.id) &&
                                "fill-red-500 text-red-500",
                            )}
                            strokeWidth={favoriteIds.has(h.id) ? 0 : 2.25}
                          />
                        )}
                      </button>
                    )}
                    <Avatar className="h-full w-full rounded-none border-0 shadow-none">
                      <AvatarImage
                        src={h.photo_url || undefined}
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <AvatarFallback className="rounded-none bg-gradient-to-br from-white via-orange-50/95 to-orange-100/80 text-5xl font-bold tracking-tight text-orange-400/90 antialiased dark:from-slate-900 dark:via-orange-950/35 dark:to-orange-950/55 dark:text-orange-300/75">
                        {(h.full_name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
                    <div className="min-w-0 space-y-1.5">
                      <p className="line-clamp-2 text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                        {h.full_name || "Helper"}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-orange-500/90" />
                        <span className="line-clamp-1">{h.city || "—"}</span>
                      </div>
                      {h.distanceKm != null && (
                        <p className="text-xs font-bold tabular-nums leading-snug text-orange-600 dark:text-orange-400">
                          {h.distanceKm < 1
                            ? `${Math.round(h.distanceKm * 1000)} m away`
                            : `${h.distanceKm.toFixed(1)} km away`}
                        </p>
                      )}
                    </div>

                    {h.average_rating != null && h.average_rating > 0 ? (
                      <StarRating
                        rating={h.average_rating}
                        size="sm"
                        showCount
                        totalRatings={h.total_ratings ?? 0}
                        className="origin-left scale-100"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        New helper
                      </span>
                    )}

                    {(h.freelancer_profiles?.hourly_rate_min != null ||
                      h.freelancer_profiles?.hourly_rate_max != null) && (
                      <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {h.freelancer_profiles?.hourly_rate_min != null &&
                        h.freelancer_profiles?.hourly_rate_max != null
                          ? `₪${h.freelancer_profiles.hourly_rate_min}–${h.freelancer_profiles.hourly_rate_max}/hr`
                          : h.freelancer_profiles?.hourly_rate_min != null
                            ? `From ₪${h.freelancer_profiles.hourly_rate_min}/hr`
                            : `Up to ₪${h.freelancer_profiles?.hourly_rate_max}/hr`}
                      </p>
                    )}

                    {h.freelancer_profiles?.bio && (
                      <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {h.freelancer_profiles.bio}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-end gap-0.5 border-t border-slate-100 pt-3 text-primary dark:border-white/10">
                      <span className="text-sm font-bold">View profile</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
