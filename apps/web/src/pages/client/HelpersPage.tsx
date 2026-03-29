import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { haversineDistanceKm } from "@/lib/geo";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from "@/lib/googleMapsLoader";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/StarRating";

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

const HELPERS_PROFILE_SELECT = `
  id,
  full_name,
  photo_url,
  city,
  location_lat,
  location_lng,
  service_radius,
  average_rating,
  total_ratings,
  role,
  is_available_for_jobs,
  freelancer_profiles ( hourly_rate_min, hourly_rate_max, bio, available_now )
`;

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
        Map unavailable. Set VITE_GOOGLE_MAPS_API_KEY to show the map. You can still search helpers by
        distance from your profile location.
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
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [center, setCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  /** Debounced value used for API fetch + geocode (avoids hammering while typing). */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [profileRows, setProfileRows] = useState<FreelancerRow[]>([]);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [locating, setLocating] = useState(false);
  /** True when the current debounced query was resolved as a place — map shows radius for everyone there. */
  const [geocodeMatchedPlace, setGeocodeMatchedPlace] = useState(false);
  /** Apply saved profile search radius once when it loads (does not override after user moves slider). */
  const appliedProfileRadiusRef = useRef(false);
  /** First coords from profile — used when clearing search to restore map center. */
  const profileCenterSnapshotRef = useRef<{ lat: number; lng: number } | null>(null);
  const searchDebounceBootRef = useRef(false);
  const geocodeRequestIdRef = useRef(0);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    setGeocodeMatchedPlace(false);
  }, []);

  const onProfileOpen = useCallback(
    (userId: string) => {
      navigate(`/profile/${userId}`);
    },
    [navigate]
  );

  useEffect(() => {
    const lat = profile?.location_lat != null ? Number(profile.location_lat) : null;
    const lng = profile?.location_lng != null ? Number(profile.location_lng) : null;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;
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

  const computeResults = useCallback(
    (rows: FreelancerRow[]) => {
      const q = searchQuery.trim().toLowerCase();
      const viewerCityNorm = normalizeCityLabel(profile?.city);
      const withDistance: HelperResult[] = [];

      for (const row of rows) {
        if (user?.id && row.id === user.id) continue;
        const lat =
          row.location_lat != null ? Number(String(row.location_lat).replace(",", ".")) : NaN;
        const lng =
          row.location_lng != null ? Number(String(row.location_lng).replace(",", ".")) : NaN;
        const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

        if (hasCoords) {
          const d = haversineDistanceKm(center.lat, center.lng, lat, lng);
          if (d > radiusKm) continue;
          // If geocode found a place, show everyone in the circle; otherwise filter by name/city text.
          if (q && !geocodeMatchedPlace) {
            const name = (row.full_name || "").toLowerCase();
            const city = (row.city || "").toLowerCase();
            if (!name.includes(q) && !city.includes(q)) continue;
          }
          withDistance.push({ ...row, distanceKm: d });
          continue;
        }

        // No map pin: cannot compute km. Still show if search matches name/city, or same city as viewer.
        const name = (row.full_name || "").toLowerCase();
        const rowCityNorm = normalizeCityLabel(row.city);
        if (q) {
          if (!name.includes(q) && !rowCityNorm.includes(q)) continue;
        } else if (viewerCityNorm.length > 0 && rowCityNorm === viewerCityNorm) {
          // empty search: only surface no-pin profiles in your city
        } else {
          continue;
        }
        withDistance.push({ ...row, distanceKm: null });
      }

      withDistance.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
      return withDistance;
    },
    [
      center.lat,
      center.lng,
      radiusKm,
      searchQuery,
      user?.id,
      profile?.city,
      geocodeMatchedPlace,
    ]
  );

  const results = useMemo(
    () => computeResults(profileRows),
    [profileRows, computeResults]
  );

  const fetchProfiles = useCallback(async () => {
    setLoadingFetch(true);
    try {
      const withLocation = () =>
        supabase
          .from("profiles")
          .select(HELPERS_PROFILE_SELECT)
          .not("location_lat", "is", null)
          .not("location_lng", "is", null)
          .limit(5000);

      const withoutLocation = () =>
        supabase
          .from("profiles")
          .select(HELPERS_PROFILE_SELECT)
          .or("location_lat.is.null,location_lng.is.null")
          .limit(3000);

      // Always merge no-pin rows so name/city text filter works immediately while typing.
      const [freelancersRes, clientsReceivingRes, fNoLoc, cNoLoc] = await Promise.all([
        withLocation().eq("role", "freelancer"),
        withLocation().eq("role", "client").eq("is_available_for_jobs", true),
        withoutLocation().eq("role", "freelancer"),
        withoutLocation().eq("role", "client").eq("is_available_for_jobs", true),
      ]);

      if (freelancersRes.error) throw freelancersRes.error;
      if (clientsReceivingRes.error) throw clientsReceivingRes.error;
      if (fNoLoc.error) throw fNoLoc.error;
      if (cNoLoc.error) throw cNoLoc.error;

      const byId = new Map<string, Record<string, unknown>>();
      for (const r of freelancersRes.data || []) byId.set(r.id as string, r);
      for (const r of clientsReceivingRes.data || []) byId.set(r.id as string, r);
      for (const r of fNoLoc.data || []) {
        if (!byId.has(r.id as string)) byId.set(r.id as string, r);
      }
      for (const r of cNoLoc.data || []) {
        if (!byId.has(r.id as string)) byId.set(r.id as string, r);
      }

      let combined = [...byId.values()];
      if (user?.id) combined = combined.filter((r) => r.id !== user.id);

      const rows = combined.map((r: Record<string, unknown>) => {
        const fp = r.freelancer_profiles;
        const fpObj = Array.isArray(fp) ? fp[0] : fp;
        return { ...r, freelancer_profiles: fpObj ?? null } as FreelancerRow;
      });
      setProfileRows(rows);
    } catch (e) {
      console.error("HelpersPage fetch:", e);
      setProfileRows([]);
    } finally {
      setLoadingFetch(false);
      setHasFetchedOnce(true);
    }
  }, [user?.id]);

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
    if (!isLoaded || typeof google === "undefined" || !google.maps?.Geocoder) return;

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
      }
    );
  }, [debouncedSearch, isLoaded]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeocodeMatchedPlace(false);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="min-h-screen gradient-mesh pb-32 md:pb-24">
      <div className="app-desktop-shell space-y-6 pt-6 md:pt-8">
        <div className="mx-auto w-full max-w-5xl px-1 md:max-w-6xl">
          <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
            Helpers near you
          </h1>
          <p className="mt-1 text-[15px] font-medium text-muted-foreground">
            Type a city to move the map and circle, or a name to filter. Results update as you type.
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
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-slate-200 pl-10 pr-10 dark:border-white/10"
                aria-busy={loadingFetch}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-1 md:max-w-6xl">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {hasFetchedOnce ? (
              <>
                {results.length} helper{results.length === 1 ? "" : "s"}
              </>
            ) : (
              "Results"
            )}
          </h2>
          {hasFetchedOnce && results.length > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">
              {results.some((r) => r.distanceKm == null)
                ? "Pinned locations by distance; others match search or your city"
                : "Sorted by distance"}
            </span>
          )}
        </div>

        {!hasFetchedOnce ? (
          <Card className="mx-auto w-full max-w-5xl border border-dashed border-slate-300/50 bg-muted/20 dark:border-white/10 md:max-w-6xl">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500/70" />
              <p className="text-sm font-medium text-muted-foreground">Loading helpers…</p>
            </CardContent>
          </Card>
        ) : results.length === 0 ? (
          <Card className="mx-auto w-full max-w-5xl border border-dashed md:max-w-6xl">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No helpers match this area and filters. Try a larger radius, search by name or city (includes
              people without a map pin), or set your city on your profile to match others by city.
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 md:max-w-6xl lg:grid-cols-3">
            {results.map((h) => (
              <Card
                key={h.id}
                className={cn(
                  "group flex h-full min-h-[440px] cursor-pointer flex-col overflow-hidden border border-slate-200/70 transition-all",
                  "hover:-translate-y-1 hover:shadow-xl dark:border-white/10"
                )}
                onClick={() => navigate(`/profile/${h.id}`)}
              >
                <CardContent className="flex flex-1 flex-col gap-0 p-0">
                  <div className="relative aspect-[5/4] w-full min-h-[200px] shrink-0 bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-slate-800 dark:to-slate-900">
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
                      <span className="text-xs font-semibold text-muted-foreground">New helper</span>
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
