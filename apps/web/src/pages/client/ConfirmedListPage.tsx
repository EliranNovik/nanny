import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useJobRequestsRealtime } from "@/hooks/useJobRequestsRealtime";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SERVICE_CATEGORIES, isServiceCategoryId } from "@/lib/serviceCategories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MapPin,
  Clock,
  MessageCircle,
  RotateCcw,
  StopCircle,
  X,
  UploadCloud,
  Plus,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { JobRequestCommentsModal } from "@/components/jobs/JobRequestCommentsModal";
import type { CompanionPinHelperVariant } from "@/components/JobMap";
const JobMap = lazy(() => import("@/components/JobMap"));
const ImageLightboxModal = lazy(() =>
  import("@/components/ImageLightboxModal").then((m) => ({
    default: m.ImageLightboxModal,
  })),
);
const FullscreenMapModal = lazy(() =>
  import("@/components/FullscreenMapModal").then((m) => ({
    default: m.FullscreenMapModal,
  })),
);
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * s2 * s2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))));
}

/** When helpers have no profile GPS, scatter pins near route / job centroid (deterministic per id). */
const MAP_FALLBACK_REGION = { lat: 32.0853, lng: 34.7818 };

/** PostgREST / JSON may return decimals as strings; normalize robustly. */
function parseGeoCoord(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function jobGeoAnchor(job: Record<string, unknown> | null | undefined): {
  lat: number;
  lng: number;
} {
  const jlat = parseGeoCoord(job?.location_lat as unknown);
  const jlng = parseGeoCoord(job?.location_lng as unknown);
  if (jlat !== null && jlng !== null && Math.abs(jlat) <= 90 && Math.abs(jlng) <= 180) {
    return { lat: jlat, lng: jlng };
  }
  const sd = job?.service_details as Record<string, unknown> | undefined;
  if (
    job?.service_type === "pickup_delivery" &&
    sd?.from_lat != null &&
    sd?.from_lng != null &&
    sd?.to_lat != null &&
    sd?.to_lng != null
  ) {
    const a = parseGeoCoord(sd.from_lat);
    const b = parseGeoCoord(sd.from_lng);
    const c = parseGeoCoord(sd.to_lat);
    const d = parseGeoCoord(sd.to_lng);
    if (a !== null && b !== null && c !== null && d !== null) {
      return { lat: (a + c) / 2, lng: (b + d) / 2 };
    }
  }
  if (job?.service_type === "pickup_delivery" && sd?.from_lat != null && sd?.from_lng != null) {
    const a = parseGeoCoord(sd.from_lat);
    const b = parseGeoCoord(sd.from_lng);
    if (a !== null && b !== null) return { lat: a, lng: b };
  }
  return MAP_FALLBACK_REGION;
}

function scatterNearAnchor(
  base: { lat: number; lng: number },
  seed: string,
): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const latStep = (((h >>> 9) % 23) - 11) * 0.0031;
  const lngStep = (((h >> 17) % 23) - 11) * 0.0031;
  const cos = Math.cos((base.lat * Math.PI) / 180);
  return {
    lat: base.lat + latStep,
    lng: base.lng + lngStep / (cos > 0.25 ? cos : 0.35),
  };
}

/** Normalize profile city labels for deduping geocoded coordinates. */
function normalizeCityKey(city: string | null | undefined): string | null {
  const t = (city ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return t.length > 0 ? t : null;
}

function clientRequestPin(job: Record<string, unknown> | null | undefined): {
  lat: number;
  lng: number;
} | null {
  const lat = parseGeoCoord(job?.location_lat as unknown);
  const lng = parseGeoCoord(job?.location_lng as unknown);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const LIVE_INSIGHTS_SEARCHING = [
  "Connecting to helpers nearby…",
  "Matching based on availability…",
] as const;
const LIVE_INSIGHTS_RESPONDERS = [
  "Helpers nearby are seeing your request…",
  "Matching based on availability…",
] as const;

function LiveRequestHero({
  job,
  freelancers,
  freelancersLoading,
  liveMapHelpers,
}: {
  job: any | null | undefined;
  freelancers: Freelancer[];
  freelancersLoading: boolean;
  liveMapHelpers: LiveMapHelperSpot[];
}) {
  const [insightIx, setInsightIx] = useState(0);
  const [matchPulse, setMatchPulse] = useState(false);
  const acceptedSigRef = useRef("0");
  /** When GPS missing, geocode `profiles.city` so pins sit near the helper’s stated city vs the job centroid. */
  const [cityAnchors, setCityAnchors] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const cityAnchorsRef = useRef(cityAnchors);
  cityAnchorsRef.current = cityAnchors;
  const cityGeocodePending = useRef<Set<string>>(new Set());

  const acceptedLead = useMemo(
    () => freelancers.find((f) => f.is_open_job_accepted),
    [freelancers],
  );

  const acceptedOpenCount = useMemo(
    () => freelancers.filter((f) => f.is_open_job_accepted).length,
    [freelancers],
  );

  const respondersCount = freelancers.length;

  /** Stable anchor inputs so polling merges (new `job` object refs) don't rebuild pin clusters. */
  const pickupSdKey = (
    [
      (job?.service_details as Record<string, unknown> | undefined)?.from_lat,
      (job?.service_details as Record<string, unknown> | undefined)?.from_lng,
      (job?.service_details as Record<string, unknown> | undefined)?.to_lat,
      (job?.service_details as Record<string, unknown> | undefined)?.to_lng,
    ] as unknown[]
  )
    .map((v) => String(v ?? ""))
    .join("|");

  const jobAnchorKey = useMemo(() => {
    const a = jobGeoAnchor(job as Record<string, unknown>);
    return `${a.lat.toFixed(6)}|${a.lng.toFixed(6)}`;
  }, [job?.location_lat, job?.location_lng, job?.service_type, pickupSdKey]);

  /** Responders who confirmed — full avatar pins. */
  const MAX_HELPER_MAP_PINS = 14;
  /** 24h live nearby — compact dots only; separate cap. */
  const MAX_LIVE_PRESENCE_PINS = 22;

  const companionPins = useMemo(() => {
    const anchor = jobGeoAnchor(job);
    const ranked = [...freelancers].sort((a, b) => {
      const ao = a.is_open_job_accepted ? 1 : 0;
      const bo = b.is_open_job_accepted ? 1 : 0;
      return bo - ao;
    });
    return ranked.slice(0, MAX_HELPER_MAP_PINS).map((f) => {
      const plat = parseGeoCoord(f.location_lat);
      const plng = parseGeoCoord(f.location_lng);
      const hasGps =
        plat !== null &&
        plng !== null &&
        Math.abs(plat) <= 90 &&
        Math.abs(plng) <= 180;
      const cityKey = normalizeCityKey(f.city);
      const geoFromCity =
        cityKey &&
        cityAnchors[cityKey] &&
        Number.isFinite(cityAnchors[cityKey]?.lat);

      let pos: { lat: number; lng: number };
      if (hasGps) {
        pos = { lat: plat, lng: plng };
      } else if (geoFromCity && cityAnchors[cityKey!]) {
        pos = scatterNearAnchor(cityAnchors[cityKey!], f.id);
      } else {
        pos = scatterNearAnchor(anchor, f.id);
      }

      return {
        id: f.id,
        lat: pos.lat,
        lng: pos.lng,
        helper_variant: companionHelperVariant(f),
        approximate: !hasGps,
        photo_url: f.photo_url,
        display_name: f.full_name,
      };
    });
  }, [freelancers, jobAnchorKey, cityAnchors]);

  const livePresencePins = useMemo(() => {
    const anchor = jobGeoAnchor(job);
    return liveMapHelpers.slice(0, MAX_LIVE_PRESENCE_PINS).map((h) => {
      const plat = parseGeoCoord(h.location_lat);
      const plng = parseGeoCoord(h.location_lng);
      const hasGps =
        plat !== null &&
        plng !== null &&
        Math.abs(plat) <= 90 &&
        Math.abs(plng) <= 180;

      const cityKey = normalizeCityKey(h.city);
      const geoFromCity =
        cityKey &&
        cityAnchors[cityKey] &&
        Number.isFinite(cityAnchors[cityKey]?.lat);

      let pos: { lat: number; lng: number };
      if (hasGps) {
        pos = { lat: plat, lng: plng };
      } else if (geoFromCity && cityAnchors[cityKey!]) {
        pos = scatterNearAnchor(cityAnchors[cityKey!], `live-${h.id}`);
      } else {
        pos = scatterNearAnchor(anchor, `live-${h.id}`);
      }

      return {
        id: h.id,
        lat: pos.lat,
        lng: pos.lng,
        approximate: !hasGps,
        photo_url: h.photo_url,
        display_name: h.full_name,
      };
    });
  }, [liveMapHelpers, jobAnchorKey, cityAnchors]);

  /** Geocode unique profile cities when lat/lng are missing (runs after Maps script exposes Geocoder). */
  useEffect(() => {
    let cancelled = false;

    const tryGeocode = () => {
      if (cancelled) return;
      if (typeof google === "undefined" || !google.maps?.Geocoder) return;

      const anchors = cityAnchorsRef.current;
      const geo = new google.maps.Geocoder();

      const needKeys = new Set<string>();
      const collectNeeds = (
        plat: unknown,
        plng: unknown,
        cityVal: string | null | undefined,
      ) => {
        const platN = parseGeoCoord(plat);
        const plngN = parseGeoCoord(plng);
        const hasGps =
          platN !== null &&
          plngN !== null &&
          Math.abs(platN) <= 90 &&
          Math.abs(plngN) <= 180;
        if (hasGps) return;
        const ck = normalizeCityKey(cityVal ?? null);
        if (ck && !anchors[ck] && !cityGeocodePending.current.has(ck)) {
          needKeys.add(ck);
        }
      };

      for (const f of freelancers) {
        collectNeeds(f.location_lat, f.location_lng, f.city);
      }
      for (const h of liveMapHelpers) {
        collectNeeds(h.location_lat, h.location_lng, h.city);
      }

      for (const normalizedKey of needKeys) {
        cityGeocodePending.current.add(normalizedKey);
        const request: google.maps.GeocoderRequest = {
          address: `${normalizedKey}, Israel`,
          componentRestrictions: { country: "il" },
          region: "il",
        };
        const applyLoc = (loc: google.maps.LatLng) => {
          setCityAnchors((prev) =>
            prev[normalizedKey]
              ? prev
              : {
                  ...prev,
                  [normalizedKey]: { lat: loc.lat(), lng: loc.lng() },
                },
          );
        };
        geo.geocode(request, (results, status) => {
          if (cancelled) {
            cityGeocodePending.current.delete(normalizedKey);
            return;
          }
          if (status === "OK" && results?.[0]?.geometry?.location) {
            cityGeocodePending.current.delete(normalizedKey);
            applyLoc(results[0].geometry.location);
            return;
          }
          geo.geocode({ address: normalizedKey }, (resultsB, statusB) => {
            cityGeocodePending.current.delete(normalizedKey);
            if (cancelled) return;
            if (statusB !== "OK" || !resultsB?.[0]?.geometry?.location) return;
            applyLoc(resultsB[0].geometry.location);
          });
        });
      }
    };

    tryGeocode();
    const pollId = window.setInterval(() => {
      if (
        cancelled ||
        typeof google === "undefined" ||
        !google.maps?.Geocoder
      )
        return;
      window.clearInterval(pollId);
      tryGeocode();
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [freelancers, liveMapHelpers]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug(
      "[LiveRequestHero] map pins — responders:",
      companionPins.length,
      "live dots:",
      livePresencePins.length,
    );
  }, [companionPins, livePresencePins]);

  /** While a driving route is shown, also show the client's saved pin (if the job has coords). */
  const routeClientPin = useMemo(() => {
    if (!job || job.service_type !== "pickup_delivery") return null;
    return clientRequestPin(job as Record<string, unknown>);
  }, [job?.service_type, job?.location_lat, job?.location_lng]);

  const headline = acceptedLead
    ? "You're connected"
    : freelancersLoading && freelancers.length === 0
      ? "Finding nearby helpers"
      : freelancers.length === 0
        ? "Finding nearby helpers"
        : "Connecting to helpers nearby";

  const insights = acceptedLead
    ? []
    : freelancers.length === 0
      ? [...LIVE_INSIGHTS_SEARCHING]
      : [...LIVE_INSIGHTS_RESPONDERS];

  useEffect(() => {
    setInsightIx(0);
  }, [freelancers.length, acceptedLead?.id]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const tick = window.setInterval(
      () => setInsightIx((i) => (i + 1) % insights.length),
      4500,
    );
    return () => clearInterval(tick);
  }, [insights.length]);

  const insightLine =
    insights[insightIx % insights.length] ?? insights[0] ?? "";

  const distanceKm = useMemo(() => {
    if (!acceptedLead || !job) return null;
    const jLat = job.location_lat;
    const jLng = job.location_lng;
    const hLat = acceptedLead.location_lat;
    const hLng = acceptedLead.location_lng;
    if (
      jLat == null ||
      jLng == null ||
      hLat == null ||
      hLng == null ||
      Number.isNaN(Number(jLat)) ||
      Number.isNaN(Number(jLng)) ||
      Number.isNaN(Number(hLat)) ||
      Number.isNaN(Number(hLng))
    )
      return null;
    return haversineKm(
      Number(jLat),
      Number(jLng),
      Number(hLat),
      Number(hLng),
    );
  }, [acceptedLead, job]);

  /** Big moment when acceptance first appears (repeat if list later loses/regains acceptance). */
  useEffect(() => {
    if (!acceptedLead) {
      acceptedSigRef.current = "0";
      return;
    }
    if (acceptedSigRef.current === "1") return;
    acceptedSigRef.current = "1";
    setMatchPulse(true);
    const t = window.setTimeout(() => setMatchPulse(false), 780);
    return () => clearTimeout(t);
  }, [acceptedLead]);

  if (!job) {
    return (
      <div className="relative mb-6 mt-4 h-[200px] w-full animate-pulse rounded-[32px] bg-muted" />
    );
  }

  return (
    <div className="group relative mb-6 mt-4 h-[460px] w-full animate-fade-in overflow-hidden rounded-[32px] border border-border/80 bg-white shadow-2xl ring-1 ring-black/5 md:mb-0 md:mt-0 md:h-[min(400px,calc(100vh-18rem))] md:max-h-[432px] md:rounded-[28px] lg:h-[420px] dark:bg-background">
      <div
        className={cn(
          "absolute inset-0 z-0 transition-[transform,filter] duration-700 ease-out",
          matchPulse && "scale-[1.02] brightness-[0.92]",
        )}
      >
        <Suspense
          fallback={<div className="h-full w-full animate-pulse bg-zinc-100" />}
        >
          <JobMap
            job={job}
            darkMode={false}
            companionPins={companionPins}
            livePresencePins={livePresencePins}
            companionMicroMotion
            fitBoundsPadding={68}
            clientPin={routeClientPin}
          />
        </Suspense>
      </div>

      {/* Top-left — headline + loading spinner (no accepted lead yet) */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-7.5rem)] pr-2 sm:max-w-[min(85%,22rem)]">
        <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-white/95 px-4 py-2.5 text-[15px] font-semibold text-foreground shadow-lg backdrop-blur-md dark:bg-zinc-950/95">
          <span className="min-w-0 text-foreground">{headline}</span>
          {!acceptedLead ? (
            <span className="inline-flex items-center shrink-0" aria-label="Loading">
              <Loader2
                className="h-[1.125rem] w-[1.125rem] animate-spin text-primary"
                aria-hidden
              />
            </span>
          ) : null}
        </div>
      </div>

      {/* Top-right — helpers count, fixed on map corner */}
      {respondersCount > 0 ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 flex w-[4.85rem] flex-col rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-50 to-white px-2.5 py-2 text-center shadow-md backdrop-blur-sm dark:border-sky-500/35 dark:from-sky-950/70 dark:to-zinc-950/95">
          <span className="block text-[9px] font-black uppercase tracking-wide text-sky-900/90 dark:text-sky-200/95">
            Helpers
          </span>
          <span className="mt-0.5 block text-[22px] font-black tabular-nums leading-none text-sky-800 dark:text-sky-200">
            {respondersCount}
          </span>
          {acceptedOpenCount > 0 ? (
            <span className="mt-1 block text-[9px] font-bold leading-tight text-amber-700 dark:text-amber-300">
              {acceptedOpenCount} open-offer accept
              {acceptedOpenCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Bottom tray — rotating human copy (never notification counts / dashboard) */}
      {!acceptedLead ? (
        <div className="pointer-events-none absolute bottom-5 left-4 right-4 z-10 md:right-auto md:max-w-xl">
          <div className="rounded-2xl border border-white/25 bg-neutral-950/95 px-4 py-3 text-center shadow-xl shadow-black/30 backdrop-blur-md md:text-left">
            <p className="text-sm font-semibold leading-snug tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] transition-opacity duration-300">
              {insightLine}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 z-20 animate-in fade-in duration-400 bg-black/25 backdrop-blur-[1px]" />
          <div
            key={acceptedLead.id}
            className="absolute bottom-5 left-4 right-4 z-30 animate-in fade-in zoom-in-[0.985] slide-in-from-bottom-6 duration-500 md:left-auto md:right-6 md:w-full md:max-w-sm"
          >
            <div className="rounded-[24px] border border-border/80 bg-white p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.32)] dark:bg-zinc-950">
              <div className="relative mx-auto mb-3 inline-flex">
                <Avatar className="h-16 w-16 ring-[3px] ring-emerald-500/25 md:h-[4.75rem] md:w-[4.75rem]">
                  <AvatarImage src={acceptedLead.photo_url ?? undefined} />
                  <AvatarFallback className="text-xl font-black">
                    {acceptedLead.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md dark:border-zinc-950">
                  <CheckCircle2 className="h-5 w-5 text-white" aria-hidden />
                </span>
              </div>
              <h3 className="text-[17px] font-black tracking-tight text-foreground">
                {acceptedLead.full_name} is ready to help
              </h3>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {distanceKm != null ? (
                  distanceKm < 1 ? (
                    <>Less than a kilometer away</>
                  ) : (
                    <>About {distanceKm.toFixed(1)} km from your pin</>
                  )
                ) : acceptedLead.city ? (
                  <>
                    Around {acceptedLead.city}
                  </>
                ) : (
                  <>Listed on your request</>
                )}
              </p>
              <Button
                type="button"
                className="mt-5 h-11 w-full rounded-xl text-xs font-bold shadow-md"
                onClick={() => {
                  const el = document.getElementById("applicants-section");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                View helper
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const HOME_SIZES = [
  { id: "1_room", label: "1 Room" },
  { id: "2_rooms", label: "2 Rooms" },
  { id: "3_rooms", label: "3 Rooms" },
  { id: "4_rooms", label: "4 Rooms" },
  { id: "5_plus_rooms", label: "5+ Rooms" },
];

export const COOKING_WHO_FOR = [
  { id: "kids", label: "Kids" },
  { id: "adults", label: "Adults" },
  { id: "family", label: "Family" },
];

export const DELIVERY_WEIGHTS = [
  { id: "light", label: "Light (up to 5kg)" },
  { id: "medium", label: "Medium (5-15kg)" },
  { id: "heavy", label: "Heavy (15kg+)" },
];

export const NANNY_AGE_GROUPS = [
  { id: "0_1", label: "0-1 years" },
  { id: "1_3", label: "1-3 years" },
  { id: "3_6", label: "3-6 years" },
  { id: "6_plus", label: "6+ years" },
];

export const MOBILITY_LEVELS = [
  { id: "independent", label: "Independent" },
  { id: "needs_assistance", label: "Needs Assistance" },
  { id: "wheelchair", label: "Wheelchair Bound" },
  { id: "bedridden", label: "Bedridden" },
];

interface FreelancerProfile {
  bio: string | null;
  languages: string[];
  has_first_aid: boolean;
  newborn_experience: boolean;
  special_needs_experience: boolean;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  rating_avg: number;
  rating_count: number;
}

interface Freelancer {
  id: string;
  full_name: string;
  photo_url: string | null;
  city: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  freelancer_profiles: FreelancerProfile;
  confirmation_note?: string | null;
  is_open_job_accepted?: boolean;
}

/** Map-only layer from API `live_map_helpers` (24h go-live, not job responders). */
interface LiveMapHelperSpot {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  city?: string | null;
}

function companionHelperVariant(f: Freelancer): CompanionPinHelperVariant {
  return f.is_open_job_accepted ? "open_offer" : "confirmed";
}

function formatElapsedTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function ElapsedTimer({
  createdAt,
  startTime,
}: {
  createdAt?: string | null;
  startTime: number;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      const start = createdAt ? new Date(createdAt).getTime() : startTime;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setElapsedSeconds(elapsed >= 0 ? elapsed : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt, startTime]);
  return <>{formatElapsedTime(elapsedSeconds)}</>;
}

function freelancerListSignature(rows: Freelancer[]): string {
  return rows
    .map(
      (f) =>
        `${f.id}\u001f${f.confirmation_note ?? ""}\u001f${f.is_open_job_accepted ? "1" : "0"}`,
    )
    .join("\u001e");
}

function liveMapHelpersSignature(rows: LiveMapHelperSpot[]): string {
  return rows
    .map(
      (r) =>
        `${r.id}\u001f${String(r.location_lat ?? "")}\u001f${String(r.location_lng ?? "")}\u001f${r.city ?? ""}`,
    )
    .join("\u001e");
}

export default function ConfirmedListPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const seededJob = useMemo(
    () => (location.state as { job?: any } | null)?.job ?? null,
    // Re-read when navigation entry changes
    [location.key],
  );

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [requestComments, setRequestComments] = useState<any[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  /** Full-page blocker only when we have no job to paint yet */
  const [loading, setLoading] = useState(() => !seededJob);
  const [freelancersLoading, setFreelancersLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [startTime] = useState(Date.now());
  const [job, setJob] = useState<any>(seededJob);
  const [customDetails, setCustomDetails] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDuration, setEditDuration] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updatingDetails, setUpdatingDetails] = useState(false);
  useAuth();

  const fetchInFlight = useRef(false);
  const lastFreelancerSig = useRef<string>("");
  const [liveMapHelpers, setLiveMapHelpers] = useState<LiveMapHelperSpot[]>([]);

  useEffect(() => {
    const j = (location.state as { job?: any } | null)?.job;
    if (j) setJob(j);
  }, [location.key]);

  async function handleInlineEditDetails() {
    setUpdatingDetails(true);
    try {
      const updatedDetails = {
        ...(job?.service_details || {}),
        description: editNotes,
        custom: editNotes
      };
      
      const { error } = await supabase
        .from("job_requests")
        .update({
          time_duration: editDuration,
          service_details: updatedDetails
        })
        .eq("id", jobId);

      if (error) throw error;
      
      setJob((prev: any) => ({
        ...prev,
        time_duration: editDuration,
        service_details: updatedDetails
      }));
      setIsEditOpen(false);
      addToast({ title: "Success", description: "Job details updated successfully!" });
    } catch (err: any) {
      addToast({ title: "Error", description: err.message || "Failed to update details" });
    } finally {
      setUpdatingDetails(false);
    }
  }

  const fetchConfirmed = useCallback(async () => {
    if (!jobId || fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const debugParam =
        typeof window !== "undefined" &&
        window.localStorage?.getItem("CONFIRMED_MAP_DEBUG") === "1"
          ? "?debug=1"
          : "";

      const data = await apiGet<{
        freelancers: Freelancer[];
        live_map_helpers?: LiveMapHelperSpot[];
        confirm_ends_at: string;
        job: any;
        _map_debug?: Record<string, unknown>;
      }>(`/api/jobs/${jobId}/confirmed${debugParam}`);

      if (data._map_debug && (import.meta.env.DEV || debugParam)) {
        console.warn("[ConfirmedListPage] /confirmed _map_debug:", data._map_debug);
      }
      if (import.meta.env.DEV || debugParam) {
        console.debug(
          "[ConfirmedListPage] responders (list):",
          data.freelancers?.length ?? 0,
          "live_map_helpers (map dots):",
          data.live_map_helpers?.length ?? 0,
        );
      }

      if (data.job) {
        setJob((prev: any) => (prev ? { ...prev, ...data.job } : data.job));
      }

      const sorted = [...data.freelancers].sort((a, b) => {
        const ao = a.is_open_job_accepted ? 1 : 0;
        const bo = b.is_open_job_accepted ? 1 : 0;
        return bo - ao;
      });

      const liveHelpers = data.live_map_helpers ?? [];
      const combinedSig = `${freelancerListSignature(sorted)}\u001e${liveMapHelpersSignature(liveHelpers)}`;
      if (combinedSig !== lastFreelancerSig.current) {
        lastFreelancerSig.current = combinedSig;
        setFreelancers(sorted);
        setLiveMapHelpers(liveHelpers);
      }
    } catch (err) {
      console.error(
        "[ConfirmedListPage] Error fetching confirmed freelancers:",
        err,
      );
      setError("Failed to load job details");
    } finally {
      fetchInFlight.current = false;
      setLoading(false);
      setFreelancersLoading(false);
    }
  }, [jobId]);

  /** Refresh full job row after local edits (notes/images). API already returns full job on poll. */
  async function fetchJobDirectly() {
    if (!jobId) return;
    try {
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .eq("id", jobId)
        .single();

      if (data && !error) {
        setJob((prev: any) => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error("Error fetching job directly:", e);
    }
  }

  useJobRequestsRealtime({
    jobId,
    onJobUpdate: () => {
      void fetchConfirmed();
      void fetchJobDirectly();
    },
  });

  // Instant-match / browse-only flows removed from this page (kept in helpers browse).

  const handleSaveDetails = async () => {
    if (!jobId || !customDetails.trim()) return;
    setSavingDetails(true);
    try {
      const currentDetails = job?.service_details || {};
      const updatedDetails = {
        ...currentDetails,
        custom: customDetails,
      };

      const { error } = await supabase
        .from("job_requests")
        .update({ service_details: updatedDetails })
        .eq("id", jobId);

      if (error) throw error;

      addToast({
        title: "Details Saved",
        description: "Your custom details have been added to the request.",
        variant: "success",
      });
      fetchJobDirectly();
    } catch (err: any) {
      console.error("[ConfirmedListPage] Error saving details:", err);
      addToast({
        title: "Failed to save details",
        description: err.message || "An error occurred.",
        variant: "error",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    void fetchConfirmed();

    const POLL_MS = 5000;
    const tick = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      void fetchConfirmed();
    };
    const interval = setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchConfirmed();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jobId, fetchConfirmed]);

  const fetchRequestComments = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data, error } = await supabase
        .from("job_request_comments")
        .select(`
          id,
          body,
          created_at,
          author_id
        `)
        .eq("job_request_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const authorIds = [...new Set(data.map((c) => c.author_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", authorIds);

        const profMap = new Map((profs || []).map((p) => [p.id, p]));
        const enriched = data.map((c) => ({
          ...c,
          author: profMap.get(c.author_id) || null,
        }));
        setRequestComments(enriched);
      } else {
        setRequestComments([]);
      }
    } catch (err) {
      console.error("Error fetching request comments:", err);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      void fetchRequestComments();
      const interval = setInterval(fetchRequestComments, 5000);
      return () => clearInterval(interval);
    }
  }, [jobId, fetchRequestComments]);

  async function handleFiles(files: File[]) {
    if (!files.length || !jobId) return;
    setSavingDetails(true);
    try {
      const newImages: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${jobId}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("job-images")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("job-images").getPublicUrl(filePath);

        newImages.push(publicUrl);
      }

      const currentImages = job?.service_details?.images || [];
      const updatedDetails = {
        ...(job?.service_details || {}),
        images: [...currentImages, ...newImages],
      };

      const { error: dbError } = await supabase
        .from("job_requests")
        .update({ service_details: updatedDetails })
        .eq("id", jobId);

      if (dbError) throw dbError;

      addToast({
        title: "Images Uploaded",
        description: "Your images have been added to the request.",
        variant: "success",
      });
      fetchJobDirectly();
    } catch (err: any) {
      console.error("[ConfirmedListPage] Error uploading images:", err);
      addToast({
        title: "Upload Failed",
        description: err.message || "Could not upload images.",
        variant: "error",
      });
    } finally {
      setSavingDetails(false);
    }
  }

  // Sync customDetails from job data (v2)
  useEffect(() => {
    if (job?.service_details?.custom !== undefined && customDetails === "") {
      setCustomDetails(job.service_details.custom || "");
    }
  }, [job?.service_details?.custom]);

  async function handleSelect(freelancerId: string) {
    setSelecting(freelancerId);
    setError("");

    try {
      const result = await apiPost<{ conversation_id: string }>(
        `/api/jobs/${jobId}/select`,
        { freelancer_id: freelancerId },
      );
      navigate(`/chat/${result.conversation_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select");
      setSelecting(null);
    }
  }

  async function handleDecline(freelancerId: string) {
    if (!jobId) return;

    setDeclining(freelancerId);
    setError("");

    try {
      await apiPost(`/api/jobs/${jobId}/decline`, {
        freelancer_id: freelancerId,
      });

      // Remove from local state
      setFreelancers((prev) => prev.filter((f) => f.id !== freelancerId));
    } catch (err) {
      console.error("[ConfirmedListPage] Error declining freelancer:", err);
      setError(
        err instanceof Error ? err.message : "Failed to decline freelancer",
      );
    } finally {
      setDeclining(null);
    }
  }

  async function handleStopRequest() {
    if (!jobId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("job_requests")
        .delete()
        .eq("id", jobId);
      if (error) throw error;
      addToast({
        title: "Request stopped",
        description: "Your job request has been removed.",
        variant: "success",
        duration: 3000,
      });
      navigate("/client/jobs");
    } catch (err: any) {
      addToast({
        title: "Failed to stop request",
        description: err?.message || "Could not delete the job.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestartSearch() {
    if (!jobId) return;

    setRestarting(true);
    setError("");

    try {
      await apiPost(`/api/jobs/${jobId}/restart`, {});
      // Refresh the page to reset timer
      window.location.reload();
    } catch (err) {
      console.error("[ConfirmedListPage] Error restarting search:", err);
      setError(err instanceof Error ? err.message : "Failed to restart search");
    } finally {
      setRestarting(false);
    }
  }

  const liveStatusLine = useMemo(() => {
    if (!job) return "";
    if (freelancers.some((f) => f.is_open_job_accepted)) {
      return "A helper confirmed they can work this request.";
    }
    if (freelancersLoading && freelancers.length === 0) {
      return "Finding nearby helpers…";
    }
    if (freelancers.length === 0) {
      return "Finding nearby helpers…";
    }
    return "Helpers are connecting to your request…";
  }, [job, freelancersLoading, freelancers]);

  const categoryImageSrc = useMemo(() => {
    const raw = (job?.service_type as string | null | undefined) ?? null;
    if (!isServiceCategoryId(raw)) return null;
    return SERVICE_CATEGORIES.find((c) => c.id === raw)?.imageSrc ?? null;
  }, [job?.service_type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">loading request...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-10">
      <div className="app-desktop-shell max-w-6xl pt-5 md:pt-6">
        {/* Desktop: tighter asymmetric grid — sidebar + map/dashboard (less empty middle) */}
        <div className="animate-fade-in md:grid md:grid-cols-[292px,minmax(0,1fr)] md:items-start md:gap-5 lg:grid-cols-[minmax(0,318px)_minmax(0,1fr)] lg:gap-6 xl:gap-7">
          {/* Desktop: Request summary — single elevated panel */}
          {job ? (
            <section className="hidden min-h-0 min-w-0 md:block">
              <div className="flex h-full flex-col rounded-[28px] border border-border/70 bg-muted/35 p-5 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] backdrop-blur-sm dark:bg-muted/25 dark:ring-white/[0.06] lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  Request summary
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditDuration(job?.time_duration || "");
                    setEditNotes(job?.service_details?.description || job?.service_details?.custom || "");
                    setIsEditOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50"
                >
                  Edit details
                </Button>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-2xl bg-background ring-1 ring-border/60 lg:h-20 lg:w-20">
                    {categoryImageSrc ? (
                      <img
                        src={categoryImageSrc}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="eager"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl">
                        {job.service_type === "cleaning" && "🧹"}
                        {job.service_type === "cooking" && "👨‍🍳"}
                        {job.service_type === "pickup_delivery" && "📦"}
                        {job.service_type === "nanny" && "👶"}
                        {job.service_type === "other_help" && "🔧"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold capitalize text-foreground">
                      {job.service_type?.replace("_", " & ")}
                      {job.service_type === "other_help" &&
                        job.service_details?.other_type &&
                        ` - ${job.service_details.other_type.replace(/_/g, " ").charAt(0).toUpperCase() + job.service_details.other_type.replace(/_/g, " ").slice(1)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {job.location_city ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          <span>{job.location_city}</span>
                        </div>
                      ) : null}
                      {job.time_duration ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          <span className="capitalize">
                            {job.time_duration.replace(/_/g, " ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {job.service_details?.description || job.service_details?.custom ? (
                  <div className="rounded-2xl border border-border/50 bg-background/80 px-3.5 py-3 dark:bg-background/40">
                    <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                      Notes
                    </div>
                    {job.service_details?.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {job.service_details.description}
                      </p>
                    ) : null}
                    {job.service_details?.custom ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {job.service_details.custom}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div 
                  className="mt-1 cursor-pointer rounded-2xl border border-border/50 bg-background/80 px-3.5 py-3 shadow-sm transition-colors hover:bg-muted/50 dark:bg-background/40"
                  onClick={() => setIsCommentsOpen(true)}
                >
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wide text-muted-foreground mb-2">
                    <span>Comments ({requestComments.length})</span>
                    <span className="text-emerald-600 text-[10px] font-bold normal-case flex items-center">Reply &rsaquo;</span>
                  </div>
                  {requestComments.length > 0 ? (
                    <div className="space-y-3">
                      {requestComments.slice(0, 3).map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-sm">
                          <Avatar className="h-6 w-6 shrink-0 ring-1 ring-black/5">
                            <AvatarImage src={c.author?.photo_url || undefined} />
                            <AvatarFallback className="text-[8px] font-bold">
                              {c.author?.full_name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-foreground text-xs mr-1.5 truncate">
                              {c.author?.full_name || "Member"}
                            </span>
                            <span className="text-muted-foreground text-xs leading-snug line-clamp-2">
                              {c.body}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic py-1">No comments yet. Click to reply or add thoughts.</p>
                  )}
                </div>
              </div>
              </div>
            </section>
          ) : null}

          {/* Map + live status — primary column */}
          <div className="min-h-0 min-w-0">
            <LiveRequestHero
              job={job}
              freelancers={freelancers}
              freelancersLoading={freelancersLoading}
              liveMapHelpers={liveMapHelpers}
            />
            <div className="mt-4 md:rounded-[28px] md:border md:border-border/65 md:bg-muted/30 md:p-5 md:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.12)] lg:p-6 dark:bg-muted/20">
              <div className="flex flex-col gap-1 text-center md:gap-1.5 md:text-left">
                <h1 className="text-xl font-black tracking-tight md:text-[1.65rem]">
                  Your request is active
                </h1>
                <p className="text-sm font-medium leading-relaxed text-muted-foreground md:max-w-prose">
                  {liveStatusLine}
                </p>
                <div className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/70 px-3 py-2 shadow-sm backdrop-blur-sm md:justify-start dark:bg-background/35">
                  <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                    <ElapsedTimer createdAt={job?.created_at} startTime={startTime} />
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2.5 md:justify-start">
              <Button
                variant="default"
                size="sm"
                onClick={handleRestartSearch}
                disabled={restarting || deleting}
              >
                {restarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart Search
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-white [&_svg]:text-white"
                onClick={handleStopRequest}
                disabled={deleting || restarting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <StopCircle className="w-4 h-4 mr-2" />
                    Stop Request
                  </>
                )}
              </Button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 border-y border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8 border-t border-border/50 md:mt-10" />

        {/* Request summary — central context (same card body also below for map/details flow) */}
        {job && (
          <section className="py-6 md:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
                Request summary
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditDuration(job?.time_duration || "");
                  setEditNotes(job?.service_details?.description || job?.service_details?.custom || "");
                  setIsEditOpen(true);
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50"
              >
                Edit details
              </Button>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60 md:h-20 md:w-20">
                  {categoryImageSrc ? (
                    <img
                      src={categoryImageSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">
                      {job.service_type === "cleaning" && "🧹"}
                      {job.service_type === "cooking" && "👨‍🍳"}
                      {job.service_type === "pickup_delivery" && "📦"}
                      {job.service_type === "nanny" && "👶"}
                      {job.service_type === "other_help" && "🔧"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold capitalize text-foreground">
                    {job.service_type?.replace("_", " & ")}
                    {job.service_type === "other_help" &&
                      job.service_details?.other_type &&
                      ` - ${job.service_details.other_type.replace(/_/g, " ").charAt(0).toUpperCase() + job.service_details.other_type.replace(/_/g, " ").slice(1)}`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {job.location_city ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location_city}</span>
                      </div>
                    ) : null}
                    {job.time_duration ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span className="capitalize">
                          {job.time_duration.replace(/_/g, " ")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {job.service_details?.description || job.service_details?.custom ? (
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    Notes
                  </div>
                  {job.service_details?.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {job.service_details.description}
                    </p>
                  ) : null}
                  {job.service_details?.custom ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {job.service_details.custom}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div 
                className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 mt-3 cursor-pointer hover:bg-muted/30 transition-colors shadow-sm"
                onClick={() => setIsCommentsOpen(true)}
              >
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wide text-muted-foreground mb-2">
                  <span>Comments ({requestComments.length})</span>
                  <span className="text-emerald-600 text-[10px] font-bold normal-case flex items-center">Reply &rsaquo;</span>
                </div>
                {requestComments.length > 0 ? (
                  <div className="space-y-3">
                    {requestComments.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-start gap-2 text-sm">
                        <Avatar className="h-6 w-6 shrink-0 ring-1 ring-black/5">
                          <AvatarImage src={c.author?.photo_url || undefined} />
                          <AvatarFallback className="text-[8px] font-bold">
                            {c.author?.full_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-foreground text-xs mr-1.5 truncate">
                            {c.author?.full_name || "Member"}
                          </span>
                          <span className="text-muted-foreground text-xs leading-snug line-clamp-2">
                            {c.body}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic py-1">No comments yet. Click to reply or add thoughts.</p>
                )}
              </div>
            </div>
            <div className="mt-6 border-t border-border/60" />
          </section>
        )}

        {job && jobId && freelancers.length > 0 && (
          <div className="mb-6 md:rounded-2xl md:border md:border-border/50 md:bg-muted/25 md:p-4 dark:bg-muted/15">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Live interest
            </p>
            <div className="flex flex-wrap gap-2">
              {freelancers.slice(0, 10).map((f) => {
                const initials =
                  f.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?";
                return (
                  <Avatar
                    key={f.id}
                    className="h-12 w-12 border-2 border-orange-400/35"
                  >
                    <AvatarImage src={f.photo_url || undefined} />
                    <AvatarFallback className="text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
            </div>
          </div>
        )}

        {/* Freelancer cards — directly under action buttons */}
        {freelancers.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              {freelancers.length} helper{freelancers.length !== 1 ? "s" : ""}{" "}
              available
            </span>
            {freelancers.length > 1 && (
              <Badge variant="secondary" className="text-xs">
                +{freelancers.length - 1} more
              </Badge>
            )}
          </div>
        )}
        <div
          id="applicants-section"
          className={cn(
            "flex gap-4 overflow-x-auto overflow-y-hidden pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scroll-smooth mb-8",
            freelancers.length === 0 && "hidden",
          )}
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex gap-4 flex-shrink-0 pr-1">
            {freelancers.map((freelancer, index) => {
              const fp = freelancer.freelancer_profiles;
              const initials =
                freelancer.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "?";

              return (
                <div
                  key={freelancer.id}
                  className={cn(
                    "flex w-[min(82vw,300px)] flex-shrink-0 snap-start flex-col overflow-hidden",
                    "rounded-3xl border border-border/60 bg-white shadow-none",
                    "dark:bg-background",
                  )}
                >
                  <div className="flex flex-1 flex-col p-0">
                    {/* Portrait hero — tap opens public profile */}
                    <button
                      type="button"
                      className={cn(
                        "relative w-full shrink-0 overflow-hidden aspect-[3/4] border-0 bg-transparent p-0 text-left",
                        "cursor-pointer rounded-t-[26px] transition-[transform,filter] hover:brightness-[1.02] active:scale-[0.995]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      )}
                      onClick={() => navigate(`/profile/${freelancer.id}`)}
                      aria-label={`View public profile of ${freelancer.full_name}`}
                    >
                      {freelancer.photo_url ? (
                        <img
                          src={freelancer.photo_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-primary/10">
                          <Avatar className="h-28 w-28 border-4 border-white/80 shadow-xl ring-2 ring-primary/20">
                            <AvatarFallback className="bg-primary/15 text-3xl font-black text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"
                        aria-hidden
                      />
                      <div className="absolute bottom-0 left-0 right-0 z-[1] p-4 pt-16 pointer-events-none">
                        <h3 className="text-[22px] font-black leading-tight tracking-tight text-white drop-shadow-md">
                          {freelancer.full_name}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StarRating
                            rating={fp?.rating_avg || 0}
                            totalRatings={fp?.rating_count || 0}
                            size="md"
                            showCount={true}
                            numberClassName="text-white drop-shadow-sm"
                            countClassName="text-white/85"
                            starClassName="text-amber-400 drop-shadow-sm"
                            emptyStarClassName="text-white/35"
                          />
                        </div>
                      </div>
                    </button>

                    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-primary/80" />
                        <span className="truncate">
                          {freelancer.city || "Location not set"}
                        </span>
                      </div>

                      {(fp?.hourly_rate_min || fp?.hourly_rate_max) && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Rate </span>
                          <span className="font-bold text-foreground">
                            {fp.hourly_rate_min && fp.hourly_rate_max
                              ? `₪${fp.hourly_rate_min}–${fp.hourly_rate_max}/hr`
                              : fp.hourly_rate_min
                                ? `From ₪${fp.hourly_rate_min}/hr`
                                : `Up to ₪${fp.hourly_rate_max}/hr`}
                          </span>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {fp?.has_first_aid && (
                          <Badge
                            variant="success"
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          >
                            🩹 First Aid
                          </Badge>
                        )}
                        {fp?.newborn_experience && (
                          <Badge
                            variant="secondary"
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          >
                            👶 Newborn
                          </Badge>
                        )}
                        {fp?.special_needs_experience && (
                          <Badge
                            variant="secondary"
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          >
                            💜 Special Needs
                          </Badge>
                        )}
                      </div>

                      {fp?.bio && (
                        <p className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                          {fp.bio}
                        </p>
                      )}

                      {freelancer.confirmation_note && (
                        <div
                          className={cn(
                            "rounded-2xl border p-3",
                            freelancer.is_open_job_accepted
                              ? "border-amber-500/25 bg-amber-500/10"
                              : "border-primary/25 bg-primary/8",
                          )}
                        >
                          <p
                            className={cn(
                              "mb-1 text-[11px] font-bold uppercase tracking-wide",
                              freelancer.is_open_job_accepted
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-primary",
                            )}
                          >
                            Note from helper
                          </p>
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              freelancer.is_open_job_accepted
                                ? "text-amber-900 dark:text-amber-200"
                                : "text-foreground",
                            )}
                          >
                            {freelancer.confirmation_note}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex items-stretch gap-2 border-t border-border/60 bg-muted/40 px-3 py-3 dark:bg-muted/20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDecline(freelancer.id)}
                        disabled={
                          declining === freelancer.id ||
                          selecting === freelancer.id
                        }
                        className="h-11 flex-1 gap-1 rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {declining === freelancer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSelect(freelancer.id)}
                        disabled={
                          selecting === freelancer.id ||
                          declining === freelancer.id
                        }
                        className="h-11 flex-[1.15] gap-1.5 rounded-2xl font-bold shadow-sm"
                      >
                        {selecting === freelancer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        Select & Chat
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {freelancersLoading && freelancers.length === 0 && (
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 mb-8">
            {[0, 1].map((k) => (
              <div
                key={k}
                className="w-[min(82vw,300px)] flex-shrink-0 snap-start rounded-[28px] border border-border/40 bg-muted/40 overflow-hidden"
              >
                <div className="aspect-[3/4] bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded-2xl bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!freelancersLoading && freelancers.length === 0 && (
          <div className="py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Confirmations</h3>
            <p className="text-muted-foreground mb-4">
              Still waiting for helpers to confirm availability.
            </p>
            <Button onClick={() => navigate("/client/create")}>
              Try Again
            </Button>
          </div>
        )}

        {/* Structured fields & map — avoids duplicating the summary card above */}
        {job && (
          <section className="py-6">
            <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
              More specifics
            </h3>
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                {job.care_frequency && (
                  <div className="capitalize">
                    {job.care_frequency.replace("_", " ")}
                  </div>
                )}
                {job.service_details?.kids_count && (
                  <div>
                    {job.service_details.kids_count.replace("_", "-")} kids
                  </div>
                )}
                {job.service_type === "cleaning" &&
                  job.service_details?.home_size && (
                    <div>
                      {HOME_SIZES.find(
                        (s) => s.id === job.service_details.home_size,
                      )?.label ||
                        job.service_details.home_size.replace(/_/g, " ")}
                    </div>
                  )}
                {job.service_type === "cooking" &&
                  job.service_details?.who_for && (
                    <div>
                      For:{" "}
                      {COOKING_WHO_FOR.find(
                        (w) => w.id === job.service_details.who_for,
                      )?.label ||
                        job.service_details.who_for.replace(/_/g, " ")}
                    </div>
                  )}
                {job.service_type === "pickup_delivery" &&
                  job.service_details?.weight && (
                    <div>
                      {DELIVERY_WEIGHTS.find(
                        (w) => w.id === job.service_details.weight,
                      )?.label ||
                        job.service_details.weight.replace(/_/g, " ")}
                    </div>
                  )}
                {job.service_type === "nanny" &&
                  job.service_details?.age_group && (
                    <div>
                      Ages:{" "}
                      {NANNY_AGE_GROUPS.find(
                        (g) => g.id === job.service_details.age_group,
                      )?.label ||
                        job.service_details.age_group.replace(/_/g, " ")}
                    </div>
                  )}
                {job.service_type === "other_help" &&
                  job.service_details?.mobility_level && (
                    <div>
                      {job.service_details.mobility_level.replace(/_/g, " ")}
                    </div>
                  )}
              </div>
              {job.service_type === "pickup_delivery" &&
                job.service_details?.from_address &&
                job.service_details?.to_address && (
                  <div className="space-y-2 border-t pt-4 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="min-w-[40px] font-semibold text-green-600">
                        From:
                      </span>
                      <span className="flex-1 text-muted-foreground">
                        {job.service_details.from_address}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="min-w-[40px] font-semibold text-red-600">
                        To:
                      </span>
                      <span className="flex-1 text-muted-foreground">
                        {job.service_details.to_address}
                      </span>
                    </div>
                  </div>
                )}
              {(job.service_type === "pickup_delivery" ||
                job.location_city) && (
                <div className="relative h-28 overflow-hidden rounded-2xl border border-slate-200/80 ring-1 ring-black/5 dark:border-border/40 dark:ring-white/10">
                  <button
                    type="button"
                    className="absolute inset-0 z-10 cursor-pointer rounded-2xl bg-transparent p-0 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => setMapModalOpen(true)}
                    aria-label="Open full map"
                  />
                  <div className="h-full w-full">
                    <Suspense
                      fallback={
                        <div className="h-full min-h-[7rem] w-full bg-muted animate-pulse" />
                      }
                    >
                      <JobMap job={job} />
                    </Suspense>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 border-t border-border/60" />
          </section>
        )}

        {/* Additional Details + Job Images — side-by-side on desktop */}
        {job && (
          <div className="grid gap-10 md:grid-cols-2 md:gap-8">
            {/* Additional Details Section */}
            <section className="py-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
                Additional details
              </h3>
              <div className="mt-3">
                <p className="mb-4 text-sm text-muted-foreground">
                  Add any extra details, instructions, or requirements for this
                  job. These will be visible to helpers.
                </p>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Type your custom job details here..."
                    className="min-h-[110px] resize-y border border-border/60 bg-transparent focus-visible:bg-transparent"
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                  />
                  <div className="flex justify-end border-t border-border/60 pt-3">
                    <Button
                      onClick={handleSaveDetails}
                      disabled={
                        savingDetails ||
                        customDetails.trim() ===
                          (job?.service_details?.custom || "").trim()
                      }
                    >
                      {savingDetails ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-border/60 md:hidden" />
            </section>

            {/* Job Images Section */}
            <section className="py-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
                Job images
              </h3>
              <div className="mt-3">
                <p className="mb-4 text-sm text-muted-foreground">
                  Upload photos to help helpers understand the task better (e.g.,
                  items to pick up, area to clean).
                </p>

                <div className="space-y-6">
                <input
                  type="file"
                  id="job-image-upload"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length || !jobId) return;
                    await handleFiles(Array.from(files));
                  }}
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add(
                      "border-primary",
                      "bg-primary/5",
                    );
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(
                      "border-primary",
                      "bg-primary/5",
                    );
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(
                      "border-primary",
                      "bg-primary/5",
                    );
                    const files = Array.from(e.dataTransfer.files).filter((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (files.length > 0 && jobId) await handleFiles(files);
                  }}
                  className={cn(
                    "relative group cursor-pointer transition-all duration-300",
                    "border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5",
                    "rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3",
                    savingDetails && "opacity-50 pointer-events-none",
                  )}
                  onClick={() =>
                    document.getElementById("job-image-upload")?.click()
                  }
                >
                  <div className="w-20 h-20 rounded-[1.8rem] bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-foreground">
                      Drag & Drop or Add Photos
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 px-4">
                      Tap to choose camera or library — or drag files here on
                      desktop
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2 rounded-2xl font-black gap-2 px-8 py-6 h-auto"
                    disabled={savingDetails}
                  >
                    <Plus className="w-5 h-5" />
                    Add Photos
                  </Button>

                  {savingDetails && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] rounded-3xl flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">
                          Uploading...
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {job?.service_details?.images &&
                  job.service_details.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                      {job.service_details.images.map(
                        (img: string, idx: number) => (
                          <div
                            key={idx}
                            className="relative aspect-square overflow-hidden rounded-2xl border border-border/60 group cursor-zoom-in"
                          >
                            <img
                              src={img}
                              alt={`Job detail ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onClick={() => setLightboxIndex(idx)}
                            />
                            <div className="absolute inset-x-0 top-0 p-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full p-2 shadow-lg scale-90 hover:scale-100 transition-all"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    !confirm(
                                      "Are you sure you want to remove this image?",
                                    )
                                  )
                                    return;
                                  setSavingDetails(true);
                                  try {
                                    const newImgList =
                                      job.service_details.images.filter(
                                        (_: any, i: number) => i !== idx,
                                      );
                                    const updatedDetails = {
                                      ...job.service_details,
                                      images: newImgList,
                                    };

                                    const { error } = await supabase
                                      .from("job_requests")
                                      .update({
                                        service_details: updatedDetails,
                                      })
                                      .eq("id", jobId);

                                    if (error) throw error;
                                    addToast({
                                      title: "Image Removed",
                                      description: "Image successfully deleted",
                                      variant: "success",
                                    });
                                    fetchJobDirectly();
                                  } catch (err: any) {
                                    addToast({
                                      title: "Error",
                                      description: err.message,
                                      variant: "error",
                                    });
                                  } finally {
                                    setSavingDetails(false);
                                  }
                                }}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
              </div>
              </div>
              <div className="mt-6 border-t border-border/60 md:hidden" />
            </section>
          </div>
        )}
        {lightboxIndex !== null && (
          <Suspense fallback={null}>
            <ImageLightboxModal
              images={job.service_details?.images || []}
              initialIndex={lightboxIndex}
              isOpen={lightboxIndex !== null}
              onClose={() => setLightboxIndex(null)}
            />
          </Suspense>
        )}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 border-none bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden rounded-[32px] animate-fade-in">
            <DialogHeader className="p-6 pb-4 border-b border-border/30">
              <DialogTitle className="text-xl font-black tracking-tight">Edit Request Details</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Duration</label>
                <select
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-zinc-900"
                >
                  <option value="1_2_hours">1-2 hours</option>
                  <option value="half_day">Half Day (3-4 hours)</option>
                  <option value="full_day">Full Day (6-8 hours)</option>
                  <option value="multi_day">Multi-day</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Notes / Instructions</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add any extra information or specific needs..."
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none h-32"
                />
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-border/30 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
              <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} disabled={updatingDetails}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleInlineEditDetails} disabled={updatingDetails} className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6">
                {updatingDetails ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {jobId && (
          <JobRequestCommentsModal
            jobId={jobId}
            isOpen={isCommentsOpen}
            onClose={() => setIsCommentsOpen(false)}
            onCommentAdded={fetchRequestComments}
          />
        )}
        {job && (
          <Suspense fallback={null}>
            <FullscreenMapModal
              job={job}
              isOpen={mapModalOpen}
              onClose={() => setMapModalOpen(false)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
