import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="flex h-full min-h-[220px] items-center justify-center bg-muted/40 px-4 text-center text-sm text-muted-foreground">
        Map unavailable. Set VITE_GOOGLE_MAPS_API_KEY to show the map. You can
        still search helpers by distance from your profile location.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center bg-muted/30">
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
        title="Search center — tap map to move"
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
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [locating, setLocating] = useState(false);
  /** True when the current debounced query was resolved as a place — map shows radius for everyone there. */
  const [geocodeMatchedPlace, setGeocodeMatchedPlace] = useState(false);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);
  const userTriggeredSearchRef = useRef(false);
  /** Apply saved profile search radius once when it loads (does not override after user moves slider). */
  const appliedProfileRadiusRef = useRef(false);
  /** First coords from profile — used when clearing search to restore map center. */
  const profileCenterSnapshotRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const searchDebounceBootRef = useRef(false);
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
    userTriggeredSearchRef.current = true;
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
    if (!profileCenterSnapshotRef.current) {
      profileCenterSnapshotRef.current = { lat, lng };
      setCenter({ lat, lng });
    }
  }, [profile?.location_lat, profile?.location_lng]);

  /** Debounce search: first sync, then 400ms (live filter + geocode without Find). */
  useEffect(() => {
    if (!searchDebounceBootRef.current) {
      searchDebounceBootRef.current = true;
      setDebouncedSearch(searchQuery);
      return;
    }
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    if (appliedProfileRadiusRef.current) return;
    if (profile?.service_radius == null) return;
    const r = Number(profile.service_radius);
    if (Number.isNaN(r)) return;
    const clamped = Math.min(100, Math.max(5, Math.round(r)));
    setRadiusKm(clamped);
    appliedProfileRadiusRef.current = true;
  }, [profile?.service_radius]);

  const fetchProfiles = useCallback(async () => {
    if (!searchDebounceBootRef.current) return;
    
    setLoadingFetch(true);
    try {
      const viewerCityNorm = normalizeCityLabel(profile?.city);
      const { data, error } = await supabase.rpc('get_helpers_near_location', {
        search_lat: center.lat,
        search_lng: center.lng,
        radius_km: radiusKm,
        search_query: debouncedSearch.trim(),
        viewer_city_norm: viewerCityNorm || '',
        geocode_matched_place: geocodeMatchedPlace
      });

      if (error) throw error;
      
      let rows = data as HelperResult[];
      if (user?.id) rows = rows.filter((r) => r.id !== user.id);
      
      setResults(rows);
    } catch (e: any) {
      console.error("HelpersPage fetch:", e);
      setResults([]);
      addToast({
        title: "Error fetching helpers",
        description: e?.message || "An unexpected error occurred.",
        variant: "error" as any,
      });
    } finally {
      setLoadingFetch(false);
      setHasFetchedOnce(true);
    }
  }, [center.lat, center.lng, radiusKm, debouncedSearch, geocodeMatchedPlace, user?.id, profile?.city, addToast]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  /** Geocode city/place queries to move the map + circle; name-like queries keep map and filter by text. */
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length === 0) {
      setGeocodeMatchedPlace(false);
      if (profileCenterSnapshotRef.current) {
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
        setCenter({ lat: loc.lat(), lng: loc.lng() });
        setGeocodeMatchedPlace(true);
      },
    );
  }, [debouncedSearch, isLoaded]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    userTriggeredSearchRef.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
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
      <div className="app-desktop-shell space-y-6 pt-6 md:pt-8">
        <div className="mx-auto w-full max-w-5xl px-1 md:max-w-6xl">
          <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
            Helpers near you
          </h1>
          <p className="mt-1 text-[15px] font-medium text-muted-foreground">
            Type a city to move the map and circle, or a name to filter. Results
            update as you type.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-5xl overflow-hidden border border-slate-200/60 shadow-sm dark:border-white/10 md:max-w-6xl">
          <div className="relative h-[min(42vh,320px)] w-full md:h-[340px]">
            <HelpersMapBlock
              center={center}
              radiusKm={radiusKm}
              hasSearched={hasFetchedOnce}
              results={results}
              isLoaded={isLoaded}
              loadError={loadError}
              mapsApiKey={mapsApiKey}
              onMapClick={onMapClick}
              onProfileOpen={onProfileOpen}
            />
          </div>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                My location
              </Button>
              {/* Available Now toggle */}
              <button
                type="button"
                onClick={() => setAvailableNowFilter((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all border",
                  availableNowFilter
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 dark:bg-zinc-900 dark:text-slate-300 dark:border-white/10 hover:border-emerald-400 hover:text-emerald-600"
                )}
              >
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  availableNowFilter ? "bg-white" : "bg-emerald-400"
                )} />
                Available now
              </button>
              <div className="flex min-w-[180px] flex-1 flex-col gap-1 sm:max-w-xs">
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Radius (km)
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={radiusKm}
                  onChange={(e) => {
                    userTriggeredSearchRef.current = true;
                    setRadiusKm(Number(e.target.value));
                  }}
                  className="h-2 w-full cursor-pointer accent-orange-500"
                />
                <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {radiusKm} km
                </span>
              </div>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {loadingFetch && (
                <Loader2 className="absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 animate-spin text-orange-500" />
              )}
              <Input
                placeholder="City (moves map) or name…"
                value={searchQuery}
                onChange={(e) => {
                  userTriggeredSearchRef.current = true;
                  setSearchQuery(e.target.value);
                }}
                className="h-11 rounded-xl border-slate-200 pl-10 pr-10 dark:border-white/10"
                aria-busy={loadingFetch}
              />
            </div>
          </CardContent>
        </Card>

        <div
          ref={resultsAnchorRef}
          className="mx-auto flex w-full max-w-5xl items-center justify-between px-1 md:max-w-6xl"
        >
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {hasFetchedOnce ? (
              <>
                {filteredResults.length} helper{filteredResults.length === 1 ? "" : "s"}
                {availableNowFilter && (
                  <span className="ml-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">available now</span>
                )}
              </>
            ) : (
              "Results"
            )}
          </h2>
          {hasFetchedOnce && filteredResults.length > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">
              {results.some((r) => r.distanceKm == null)
                ? "Pinned locations by distance; others match search or your city"
                : "Sorted by distance"}
            </span>
          )}
        </div>

        {!hasFetchedOnce ? (
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 md:max-w-6xl lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={`skeleton-${i}`} className="flex h-[440px] flex-col overflow-hidden border-slate-200/80 dark:border-white/5 bg-white dark:bg-zinc-900 rounded-[20px]">
                <Skeleton className="h-[200px] w-full rounded-b-none" />
                <CardContent className="flex-1 p-5 space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-3/4 rounded" />
                    <Skeleton className="h-4 w-1/2 rounded" />
                  </div>
                  <div className="space-y-3 pt-6">
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-2/3 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="mx-auto w-full max-w-5xl md:max-w-6xl">
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
                    ? "Try removing the 'Available now' filter to see all helpers."
                    : "Try expanding your search radius or a different city."}
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
                        userTriggeredSearchRef.current = true;
                        setRadiusKm((r) => Math.min(100, r + 10));
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
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 md:max-w-6xl lg:grid-cols-3">
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
