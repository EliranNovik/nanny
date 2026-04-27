import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import {
  Loader2,
  Navigation,
  Radar,
  Search,
  ChevronDown,
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import {
  getLastCategory,
  setLastCategory,
} from "@/lib/discoverMatchPreferences";
import { useToast } from "@/components/ui/toast";
import {
  OpenJobRequestMatchCard,
  type OpenJobRequestMatchRow,
} from "@/components/jobs/OpenJobRequestMatchCard";
import type { PublicProfileGalleryRow } from "@/components/helpers/HelperResultProfileCard";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";

function canActAsHelper(p: { role?: string; is_available_for_jobs?: boolean } | null | undefined) {
  if (!p?.role) return false;
  if (p.role === "freelancer") return true;
  if (p.role === "client" && p.is_available_for_jobs === true) return true;
  return false;
}

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const SEARCH_CIRCLE_STYLE: google.maps.CircleOptions = {
  fillColor: "#10b981",
  fillOpacity: 0.18,
  strokeColor: "#059669",
  strokeOpacity: 1,
  strokeWeight: 3,
  clickable: false,
  zIndex: 1,
};

const JOBS_MATCH_PAGE_STATE_KEY = "jobs_match_page_state:v1";

const R_MIN = 5;
const R_MAX = 100;

function formatJobTitle(serviceType?: string) {
  const s = (serviceType || "").replace(/_/g, " ");
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1) : "Request";
}

type JobRequestsMapBlockProps = {
  center: { lat: number; lng: number };
  radiusKm: number;
  hasSearched: boolean;
  results: OpenJobRequestMatchRow[];
  isLoaded: boolean;
  loadError: Error | undefined;
  mapsApiKey: string;
  onMapClick: (e: google.maps.MapMouseEvent) => void;
};

function JobRequestsMapBlock({
  center,
  radiusKm,
  hasSearched,
  results,
  isLoaded,
  loadError,
  mapsApiKey,
  onMapClick,
}: JobRequestsMapBlockProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchCircleRef = useRef<google.maps.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
    if (bounds) map.fitBounds(bounds, 48);
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
        Map unavailable. Set VITE_GOOGLE_MAPS_API_KEY to show the map.
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
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        }}
      />
      {hasSearched &&
        results.map((r) => {
          const lat = Number(r.location_lat);
          const lng = Number(r.location_lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return (
            <Marker
              key={r.id}
              position={{ lat, lng }}
              title={r.location_city || "Request"}
            />
          );
        })}
    </GoogleMap>
  );
}

export default function FreelancerJobsMatchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const allowedToAct = canActAsHelper(profile);
  const focusJobId = (searchParams.get("focus_job_id") || "").trim() || null;
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [selectedCategories, setSelectedCategories] = useState<
    Set<ServiceCategoryId>
  >(() => {
    const last = getLastCategory("work");
    return last && isServiceCategoryId(last) ? new Set([last]) : new Set();
  });
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() => {
    const lat =
      profile?.location_lat != null ? Number(profile.location_lat) : NaN;
    const lng =
      profile?.location_lng != null ? Number(profile.location_lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return DEFAULT_CENTER;
  });
  const [radiusKm, setRadiusKm] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OpenJobRequestMatchRow[]>([]);
  const [galleryByUserId, setGalleryByUserId] = useState<
    Record<string, PublicProfileGalleryRow[]>
  >({});
  const [hasSearched, setHasSearched] = useState(false);
  const [searchChromeCollapsed, setSearchChromeCollapsed] = useState(false);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const city = (r.location_city || "").toLowerCase();
      const name = (r.client_display_name || "").toLowerCase();
      return city.includes(q) || name.includes(q);
    });
  }, [rows, searchQuery]);

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
    setMobileSnapIndex(Math.max(0, Math.min(filteredRows.length - 1, next)));
  }, [filteredRows.length]);

  useEffect(() => {
    // If we have a pending restore scroll position, do NOT reset to top.
    if (pendingRestoreScrollTopRef.current != null) return;
    setMobileSnapIndex(0);
    const el = mobileSnapRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "auto" });
  }, [filteredRows.map((r) => r.id).join("|")]);

  /** Restore previous state (Back navigation / revisit). */
  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    try {
      const raw = sessionStorage.getItem(JOBS_MATCH_PAGE_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        userId: string | null;
        center?: { lat: number; lng: number };
        radiusKm?: number;
        searchQuery?: string;
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
      }
      if (typeof parsed.searchQuery === "string") setSearchQuery(parsed.searchQuery);
      if (Array.isArray(parsed.selectedCategories)) {
        const restored = parsed.selectedCategories.filter(
          (x): x is ServiceCategoryId => isServiceCategoryId(x),
        );
        setSelectedCategories(new Set(restored));
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
  }, [user?.id]);

  /** Deep link from Discover home: auto-run search and show cards, then focus the request card. */
  useEffect(() => {
    if (!focusJobId) return;
    if (!user?.id) return;
    // Show cards view
    setHasSearched(true);
    setSearchChromeCollapsed(true);
    // Kick off search (uses current filters / category selection)
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusJobId, user?.id]);

  /** If restored state says we already searched, refetch results once. */
  useEffect(() => {
    if (!restoringRef.current) return;
    if (!hasSearched) return;
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearched]);

  /** Restore the scroll position after results render. */
  useEffect(() => {
    const v = pendingRestoreScrollTopRef.current;
    const el = mobileSnapRef.current;
    if (v == null || !el) return;
    if (filteredRows.length === 0) return;
    el.scrollTo({ top: v, behavior: "auto" });
    pendingRestoreScrollTopRef.current = null;
    window.requestAnimationFrame(syncMobileSnapIndex);
  }, [filteredRows.length]);

  /** After search, focus a specific job card (Discover home deep link). */
  useEffect(() => {
    if (!focusJobId) return;
    if (!filteredRows.length) return;
    const el = mobileSnapRef.current;
    if (!el) return;
    const idx = filteredRows.findIndex((r) => r.id === focusJobId);
    if (idx < 0) return;
    const h = el.clientHeight;
    if (h > 0) {
      el.scrollTo({ top: idx * h, behavior: "auto" });
      setMobileSnapIndex(idx);
      window.requestAnimationFrame(syncMobileSnapIndex);
    }
  }, [focusJobId, filteredRows, syncMobileSnapIndex]);

  /** Persist current state when navigating away. */
  useEffect(() => {
    const save = () => {
      try {
        const payload = {
          userId: user?.id ?? null,
          center,
          radiusKm,
          searchQuery,
          selectedCategories: [...selectedCategories],
          hasSearched,
          searchChromeCollapsed,
          mobileSnapIndex,
          mobileSnapScrollTop: mobileSnapRef.current?.scrollTop ?? 0,
        };
        sessionStorage.setItem(JOBS_MATCH_PAGE_STATE_KEY, JSON.stringify(payload));
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
    selectedCategories,
    hasSearched,
    searchChromeCollapsed,
    mobileSnapIndex,
  ]);

  const toggleCategory = useCallback((id: ServiceCategoryId) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderSearchRequestsButton = () => (
    <Button
      type="button"
      size="lg"
      disabled={loading || selectedCategories.size === 0}
      onClick={() => void runSearch()}
      className="h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Searching…
        </>
      ) : (
        <>
          <Radar className="mr-2 h-5 w-5" />
          Search requests
        </>
      )}
    </Button>
  );

  const runSearch = useCallback(async () => {
    if (!user?.id) return;
    if (selectedCategories.size === 0) {
      addToast({ title: "Pick at least one category", variant: "default" });
      return;
    }
    setLastCategory("work", [...selectedCategories][0] ?? "other_help");
    setLoading(true);
    try {
      const filters = [...selectedCategories];
      const { data, error } = await supabase.rpc("get_job_requests_near_location", {
        search_lat: center.lat,
        search_lng: center.lng,
        radius_km: radiusKm,
        service_filters: filters,
        viewer_id: user.id,
        p_limit: 200,
      });
      if (error) throw error;
      // Safety: never show the viewer's own requests, even if RPC hasn't been redeployed yet.
      const fetched = (data ?? []) as OpenJobRequestMatchRow[];
      setRows(fetched.filter((r) => r.client_id !== user.id));
      // Fetch media for clients (profile photo + gallery)
      const clientIds = Array.from(
        new Set(fetched.map((r) => r.client_id).filter((id) => id !== user.id)),
      ).filter(Boolean);
      if (clientIds.length > 0) {
        const { data: mediaRows, error: mediaErr } = await supabase
          .from("public_profile_media")
          .select("id, user_id, media_type, storage_path, sort_order, created_at")
          .in("user_id", clientIds);
        if (!mediaErr) {
          const by: Record<string, PublicProfileGalleryRow[]> = {};
          for (const id of clientIds) by[id] = [];
          for (const row of (mediaRows ?? []) as PublicProfileGalleryRow[]) {
            const uid = row.user_id;
            if (!by[uid]) by[uid] = [];
            by[uid].push(row);
          }
          for (const uid of clientIds) {
            by[uid].sort(
              (a, b) =>
                a.sort_order - b.sort_order ||
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
          }
          setGalleryByUserId(by);
        }
      }
      setHasSearched(true);
      setSearchChromeCollapsed(true);
      const p = new URLSearchParams();
      p.set("category", filters[0] ?? "other_help");
      p.set("lat", String(center.lat));
      p.set("lng", String(center.lng));
      p.set("radius", String(radiusKm));
      setSearchParams(p, { replace: true });
      window.requestAnimationFrame(() => {
        resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e: unknown) {
      addToast({
        title: "Search failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedCategories, center.lat, center.lng, radiusKm, addToast, setSearchParams]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }, []);

  const acceptJob = useCallback(
    async (jobId: string, row: OpenJobRequestMatchRow) => {
      if (!user?.id || !allowedToAct) {
        throw new Error("Enable a helper profile to accept requests.");
      }
      await apiPost(`/api/jobs/${jobId}/freelancer-confirm-open`, {});
      addToast({
        title: "Accepted",
        description: `Waiting for ${(row.client_display_name || "the client").trim()}.`,
        variant: "success",
      });
      // Mark card as accepted (keep it visible)
      setRows((prev) =>
        prev.map((r) => (r.id === jobId ? { ...r, __accepted: true } : r)),
      );
    },
    [user?.id, allowedToAct, addToast],
  );

  const declineJob = useCallback(
    async (jobId: string) => {
      if (!user?.id || !allowedToAct) {
        throw new Error("Enable a helper profile to decline requests.");
      }
      await apiPost(`/api/jobs/${jobId}/freelancer-decline-open`, {});
      setRows((prev) => prev.filter((r) => r.id !== jobId));
    },
    [user?.id, allowedToAct],
  );

  return (
    <div
      data-freelancer-jobs-match-no-app-header=""
      className={cn(
        "min-h-screen bg-background",
        "max-md:pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))] md:pb-8",
      )}
    >
      <div className={cn("app-desktop-shell space-y-8 pt-6 md:pt-8")}>
        {showSearchChrome ? (
          <>
            <div className="mx-auto w-full max-w-lg px-2 text-center md:max-w-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white md:text-[32px]">
                Browse users requests
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse open requests near your location.
              </p>
            </div>

            {hasSearched ? (
              <div className="mx-auto w-full max-w-lg px-2 md:max-w-2xl">
                <p className="text-center text-xs font-semibold text-muted-foreground">
                  {filteredRows.length} request{filteredRows.length === 1 ? "" : "s"} match
                  {selectedCategories.size > 0 ? " your filters" : " this search"}
                </p>
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-lg md:max-w-xl animate-in fade-in zoom-in-95 duration-300">
              <div className="space-y-6 px-1 pt-2 md:px-0 md:pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Categories
                    </span>
                    {selectedCategories.size > 0 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                        onClick={() => setSelectedCategories(new Set())}
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2",
                            on
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-200 dark:hover:border-emerald-900/50",
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
                    <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-emerald-50/25 to-transparent dark:from-emerald-950/20" />
                    <JobRequestsMapBlock
                      center={center}
                      radiusKm={radiusKm}
                      hasSearched={hasSearched}
                      results={filteredRows}
                      isLoaded={isLoaded}
                      loadError={loadError}
                      mapsApiKey={mapsApiKey}
                      onMapClick={onMapClick}
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
                        "hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                        "disabled:pointer-events-none disabled:opacity-60",
                      )}
                    >
                      {locating ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
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
                          placeholder="City or name"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void runSearch();
                            }
                          }}
                          aria-busy={loading}
                          className={cn(
                            "h-11 rounded-2xl border border-white/55 bg-white/35 pl-10 pr-3 text-[15px] text-slate-900 shadow-sm backdrop-blur-xl",
                            "placeholder:text-slate-600/80 ring-1 ring-inset ring-white/50",
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    Prefer radius context: {radiusKm} km
                  </label>
                  <input
                    type="range"
                    min={R_MIN}
                    max={R_MAX}
                    step={5}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* md+: primary CTA in flow. Mobile uses fixed dock below. */}
                <div className="hidden md:block">{renderSearchRequestsButton()}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="max-md:hidden sticky top-[80px] z-40 -mt-4 mb-4 flex justify-center pointer-events-none">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full bg-white/90 backdrop-blur-md shadow-sm pointer-events-auto dark:bg-zinc-900/90 dark:border-white/10"
              onClick={() => setSearchChromeCollapsed(false)}
            >
              <Search className="mr-2 h-4 w-4" />
              Map & search
            </Button>
          </div>
        )}

        <div ref={resultsAnchorRef} />

        {!hasSearched ? null : filteredRows.length === 0 ? (
          <div className="mx-auto w-full max-w-5xl px-2 md:max-w-6xl">
            <Card className="border border-dashed">
              <CardContent className="py-14 text-center">
                <p className="text-base font-semibold text-foreground mb-1">
                  No requests match this search
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Try increasing radius or changing category.
                </p>
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
                  "bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+5.25rem)]",
                  "overflow-y-auto overscroll-y-contain",
                  "snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                  "bg-background",
                )}
                aria-label="Requests"
                ref={mobileSnapRef}
                onScroll={() => {
                  window.requestAnimationFrame(syncMobileSnapIndex);
                }}
              >
                {filteredRows.map((r) => (
                  <div
                    key={r.id}
                    className="relative h-full w-full snap-start snap-always px-2 py-2"
                  >
                    <div className="h-full w-full overflow-hidden rounded-[22px]">
                      <OpenJobRequestMatchCard
                        row={r}
                        gallery={galleryByUserId[r.client_id] ?? []}
                        formatTitle={(st) => formatJobTitle(st || undefined)}
                        onOpenProfile={(userId) =>
                          navigate(`/profile/${encodeURIComponent(userId)}`)
                        }
                        onAccept={async (jobId) => {
                          try {
                            await acceptJob(jobId, r);
                          } catch (e: unknown) {
                            addToast({
                              title: "Could not accept",
                              description:
                                e instanceof Error ? e.message : "Try again.",
                              variant: "error",
                            });
                          }
                        }}
                        onDecline={async (jobId) => {
                          try {
                            await declineJob(jobId);
                          } catch (e: unknown) {
                            addToast({
                              title: "Could not decline",
                              description:
                                e instanceof Error ? e.message : "Try again.",
                              variant: "error",
                            });
                          }
                        }}
                        variant="fullscreen"
                      />
                    </div>

                    {(() => {
                      const remaining = Math.max(
                        0,
                        filteredRows.length - (mobileSnapIndex + 1),
                      );
                      if (remaining <= 0) return null;
                      const badge = remaining > 10 ? "10+" : String(remaining);
                      return (
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-x-0 z-[60] flex items-center justify-center",
                            "bottom-[5.75rem] px-3",
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
                ))}
              </div>
            ) : null}

            {/* Desktop/tablet: keep grid */}
            <div
              className={cn(
                "animate-in fade-in slide-in-from-bottom-3 mx-auto hidden w-full max-w-5xl grid-cols-1 gap-5 px-2 duration-700 sm:grid-cols-2 md:grid md:max-w-6xl lg:grid-cols-3",
                "max-md:-mt-1 max-md:scroll-mt-0 max-md:gap-4",
              )}
            >
              {filteredRows.map((r) => (
                <OpenJobRequestMatchCard
                  key={r.id}
                  row={r}
                  gallery={galleryByUserId[r.client_id] ?? []}
                  formatTitle={(st) => formatJobTitle(st || undefined)}
                  onOpenProfile={(userId) =>
                    navigate(`/profile/${encodeURIComponent(userId)}`)
                  }
                  onAccept={async (jobId) => {
                    try {
                      await acceptJob(jobId, r);
                    } catch (e: unknown) {
                      addToast({
                        title: "Could not accept",
                        description: e instanceof Error ? e.message : "Try again.",
                        variant: "error",
                      });
                    }
                  }}
                  onDecline={async (jobId) => {
                    try {
                      await declineJob(jobId);
                    } catch (e: unknown) {
                      addToast({
                        title: "Could not decline",
                        description: e instanceof Error ? e.message : "Try again.",
                        variant: "error",
                      });
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}

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
              <div className="mx-auto w-full max-w-lg">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 w-full rounded-2xl border-emerald-500/30 text-base font-black"
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
          </div>
        ) : null}

        {/* Mobile: full-width Search requests fixed above BottomNav while panel is open */}
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
                {renderSearchRequestsButton()}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
