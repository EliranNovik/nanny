import { useState, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
} from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import { Loader2 } from "lucide-react";

/* Fast Refresh: stale HMR can leave orphaned JSX referencing removed imports — hard-reload fixes. */
const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 32.0853,
  lng: 34.7818, // Tel Aviv default
};

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#111111" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
];

/** Responders who confirmed on this job (full avatar pins). */
export type CompanionPinHelperVariant = "open_offer" | "confirmed";

/** Helpers shown alongside the client / route (profiles.location_lat/lng). */
export type CompanionMapPin = {
  id: string;
  lat: number;
  lng: number;
  /** Open-offer accept vs regular confirmation */
  helper_variant: CompanionPinHelperVariant;
  /** Position estimated from route / job anchor (no profile GPS). */
  approximate?: boolean;
  photo_url?: string | null;
  display_name?: string | null;
};

/** 24h “go live” helpers — map dots only (not listed as responders on this job). */
export type LivePresenceMapPin = {
  id: string;
  lat: number;
  lng: number;
  approximate?: boolean;
  photo_url?: string | null;
  display_name?: string | null;
};

interface JobMapProps {
  job: any;
  onRouteInfo?: (info: { distance: string; duration: string }) => void;
  onClose?: () => void;
  darkMode?: boolean;
  companionPins?: CompanionMapPin[];
  /** Active 24h live window elsewhere — small dots +Photo on map only */
  livePresencePins?: LivePresenceMapPin[];
  /** Subtle jitter so pins feel alive (taxi-app style); uses base coords for fitBounds. */
  companionMicroMotion?: boolean;
  fitBoundsPadding?: number | google.maps.Padding;
  /** Client/request pin while a route is shown (e.g. pickup & delivery). */
  clientPin?: { lat: number; lng: number } | null;
}

/**
 * Serialized pin sets for effect deps — avoids tearing down markers/fitBounds when the parent
 * passes new array/object identities on poll with identical map data (main flicker fix).
 */
function companionPinsContentKey(pins: CompanionMapPin[]): string {
  return pins
    .map(
      (p) =>
        `${p.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.helper_variant}:${p.approximate ? 1 : 0}:${encodeURIComponent(p.photo_url ?? "")}:${encodeURIComponent((p.display_name ?? "").slice(0, 64))}`,
    )
    .join("\u001e");
}

function livePresencePinsContentKey(pins: LivePresenceMapPin[]): string {
  return pins
    .map(
      (p) =>
        `${p.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.approximate ? 1 : 0}:${encodeURIComponent(p.photo_url ?? "")}:${encodeURIComponent((p.display_name ?? "").slice(0, 64))}`,
    )
    .join("\u001e");
}

function helperClientPinContentKey(pin: { lat: number; lng: number } | null): string {
  if (!pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return "";
  return `${pin.lat.toFixed(5)}:${pin.lng.toFixed(5)}`;
}

function helperMarkerPositionKey(
  pos: { lat: number; lng: number } | null,
): string {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return "";
  return `${pos.lat.toFixed(5)}:${pos.lng.toFixed(5)}`;
}

function directionsRouteBoundsKey(
  d: google.maps.DirectionsResult | null,
): string {
  const b = d?.routes?.[0]?.bounds;
  if (!b) return "";
  try {
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    return `${ne.lat().toFixed(5)},${ne.lng().toFixed(5)},${sw.lat().toFixed(5)},${sw.lng().toFixed(5)}`;
  } catch {
    return "";
  }
}

/** Above default route A/B pins so helper avatars stay visible over DirectionsRenderer markers. */
const HELPER_MARKER_Z_INDEX = 1_000_000;
const LIVE_PRESENCE_Z_INDEX = 999_000;

function pinInitials(displayName?: string | null): string {
  const n = (displayName ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[parts.length - 1]?.[0];
    return `${a ?? ""}${b ?? ""}`.toUpperCase().slice(0, 2);
  }
  return n.slice(0, 2).toUpperCase();
}

/** SVG initials when no photo (Marker icons only — native markers avoid HTML overlay positioning bugs with routes). */
const VARIANT_MARKER: Record<
  CompanionPinHelperVariant,
  { ring: string; fill: string; text: string; size: number }
> = {
  open_offer: {
    ring: "#f59e0b",
    fill: "#fffbeb",
    text: "#78350f",
    size: 36,
  },
  confirmed: {
    ring: "#38bdf8",
    fill: "#e0f2fe",
    text: "#0c4a6e",
    size: 32,
  },
};

const LIVE_PRESENCE_STYLE = {
  ring: "#34d399",
  fill: "#ecfdf5",
  text: "#064e3b",
  size: 26,
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Small wedge under the avatar so markers read like map pins pointing at coords. */
function markerPinHeight(headSize: number): number {
  return Math.max(7, Math.round(headSize * 0.24));
}

function markerTotalHeight(headSize: number): number {
  return headSize + markerPinHeight(headSize);
}

function initialsCircleIconDataUrl(opts: {
  initials: string;
  size: number;
  ring: string;
  fill: string;
  text: string;
}): string {
  const { initials, size, ring, fill, text } = opts;
  const pinH = markerPinHeight(size);
  const totalH = markerTotalHeight(size);
  const sw = Math.max(1.5, size * 0.065);
  const r = Math.max(5, size / 2 - sw);
  const fs = Math.floor(size * 0.34);
  const cx = size / 2;
  /** Neck where the wedge meets the head (slightly overlaps the badge). */
  const neck = size - Math.max(sw, 3);
  const pinHalf = Math.max(3, Math.round(size * 0.14));
  const tip = totalH - Math.max(1, pinH > 10 ? 2 : 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${totalH}" viewBox="0 0 ${size} ${totalH}">
  <circle cx="${cx}" cy="${size / 2}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="${sw}"/>
  <text x="50%" y="${cx}" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fs}" font-weight="700" fill="${text}">${escapeXml(initials)}</text>
  <path d="M ${cx - pinHalf} ${neck} L ${cx} ${tip} L ${cx + pinHalf} ${neck} Z" fill="${ring}" opacity="0.92"/>
</svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

/**
 * Google Maps marker icons do not reliably paint external URLs inside SVG `<image>` data-URLs
 * (rings draw, photo area stays empty). We load the bitmap and bake a circular PNG with canvas.
 */
const circlePortraitPngCache = new Map<string, Promise<string | null>>();

function drawMarkerPinWedge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headSize: number,
  totalHeight: number,
  ringColor: string,
): void {
  const pinH = totalHeight - headSize;
  if (pinH <= 2) return;
  const pinHalf = Math.max(3, Math.round(headSize * 0.14));
  const neck = headSize - Math.max(3, Math.round(headSize * 0.04));
  const tip = totalHeight - Math.max(1, pinH > 10 ? 2 : 1);
  ctx.beginPath();
  ctx.moveTo(cx - pinHalf, neck);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx + pinHalf, neck);
  ctx.closePath();
  ctx.fillStyle = ringColor + "ea";
  ctx.fill();
}

function photoToCirclePortraitPngDataUrl(
  photoUrl: string,
  size: number,
  ring: string,
): Promise<string | null> {
  const pinH = markerPinHeight(size);
  const totalH = markerTotalHeight(size);
  const cacheKey = `${photoUrl}\0${size}\0${ring}\0pin:${pinH}`;
  let existing = circlePortraitPngCache.get(cacheKey);
  if (!existing) {
    existing = (async () => {
      const loadOnce = (withCors: boolean): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          if (withCors) img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = photoUrl;
        });

      let img = await loadOnce(true);
      if (!img) img = await loadOnce(false);
      if (!img?.naturalWidth) return null;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = totalH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        const cx = size / 2;
        const sw = Math.max(1.5, size * 0.065);
        const clipR = Math.max(2, cx - sw);

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cx, clipR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(size / iw, size / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (size - dw) / 2;
        const dy = (size - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cx, clipR, 0, Math.PI * 2);
        ctx.strokeStyle = ring;
        ctx.lineWidth = sw;
        ctx.stroke();

        drawMarkerPinWedge(ctx, cx, size, totalH, ring);

        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    })();
    circlePortraitPngCache.set(cacheKey, existing);
  }
  return existing;
}

/** Helper marker icon: anchored at tip of wedge (defaults to square `size`). */
function gmIcon(url: string, width: number, height?: number): google.maps.Icon {
  const h = height ?? width;
  const ax = Math.floor(width / 2);
  return {
    url,
    scaledSize: new google.maps.Size(width, h),
    anchor: new google.maps.Point(ax, h),
    labelOrigin: new google.maps.Point(ax, Math.floor(h * 0.32)),
  };
}

/** Photo URLs usable as raster marker textures (HTTPS avatars etc.). */
function isRasterPhotoUrl(raw: string | null | undefined): raw is string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return false;
  return /^https?:\/\//i.test(s) || (s.startsWith("blob:") && s.length > 8);
}

function responderIcon(p: CompanionMapPin): google.maps.Icon {
  const theme = VARIANT_MARKER[p.helper_variant];
  const initials = pinInitials(p.display_name);
  /** Direct bitmap URL renders reliably until async swap (circle portrait + wedge). */
  if (isRasterPhotoUrl(p.photo_url)) {
    return gmIcon(p.photo_url.trim(), theme.size);
  }
  const headH = markerTotalHeight(theme.size);
  return gmIcon(
    initialsCircleIconDataUrl({
      initials,
      size: theme.size,
      ring: theme.ring,
      fill: theme.fill,
      text: theme.text,
    }),
    theme.size,
    headH,
  );
}

function livePresenceIcon(p: LivePresenceMapPin): google.maps.Icon {
  const { size } = LIVE_PRESENCE_STYLE;
  const initials = pinInitials(p.display_name);
  if (isRasterPhotoUrl(p.photo_url)) {
    return gmIcon(p.photo_url.trim(), size);
  }
  const th = markerTotalHeight(size);
  return gmIcon(
    initialsCircleIconDataUrl({
      initials,
      size,
      ring: LIVE_PRESENCE_STYLE.ring,
      fill: LIVE_PRESENCE_STYLE.fill,
      text: LIVE_PRESENCE_STYLE.text,
    }),
    size,
    th,
  );
}

export default function JobMap({
  job,
  onRouteInfo,
  onClose,
  darkMode,
  companionPins = [],
  livePresencePins = [],
  companionMicroMotion = false,
  fitBoundsPadding = 52,
  clientPin = null,
}: JobMapProps) {
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    defaultCenter,
  );
  const [markerPosition, setMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  /** Native google.maps.Marker instances (not React Marker) render reliably with routes + raster avatars. */
  const imperativeHelperMarkersRef = useRef<google.maps.Marker[]>([]);

  const companionPinsKey = companionPinsContentKey(companionPins);
  const livePresencePinsKey = livePresencePinsContentKey(livePresencePins);
  const clientPinKeyStable = helperClientPinContentKey(clientPin ?? null);
  const markerPosKeyStable = helperMarkerPositionKey(markerPosition);
  const directionsBoundsKeyStable = directionsRouteBoundsKey(directions);

  void companionMicroMotion;

  /** Imperative helpers / live-presence dots — avoids react-google-maps Marker edge cases beside routes. */
  useEffect(() => {
    const map = mapInstRef.current;
    if (!map || !mapReady || !isLoaded) return;

    imperativeHelperMarkersRef.current.forEach((m) => {
      google.maps.event.clearInstanceListeners(m);
      m.setMap(null);
    });
    imperativeHelperMarkersRef.current = [];

    let cancelled = false;

    const attach = (
      lat: number,
      lng: number,
      icon: google.maps.Icon,
      zIdx: number,
      title: string,
      opacity: number,
    ): google.maps.Marker | null => {
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      ) {
        return null;
      }
      const m = new google.maps.Marker({
        map,
        position: { lat, lng },
        icon,
        zIndex: zIdx,
        title,
        opacity,
        clickable: false,
        optimized: false,
      });
      imperativeHelperMarkersRef.current.push(m);
      return m;
    };

    for (const p of companionPins) {
      const suffix =
        p.helper_variant === "open_offer"
          ? " · Open-offer accepted"
          : " · Responded on this job";
      const title = p.display_name?.trim()
        ? `${p.display_name.trim()}${suffix}`
        : `Helper${suffix}`;
      const icon = responderIcon(p);
      const m = attach(
        p.lat,
        p.lng,
        icon,
        HELPER_MARKER_Z_INDEX,
        title,
        p.approximate ? 0.92 : 1,
      );
      if (m && isRasterPhotoUrl(p.photo_url)) {
        const theme = VARIANT_MARKER[p.helper_variant];
        const th = markerTotalHeight(theme.size);
        void photoToCirclePortraitPngDataUrl(
          p.photo_url.trim(),
          theme.size,
          theme.ring,
        ).then((png) => {
          if (cancelled || !png) return;
          m.setIcon(gmIcon(png, theme.size, th));
        });
      }
    }

    for (const p of livePresencePins) {
      const title = p.display_name?.trim()
        ? `${p.display_name.trim()} · Live nearby (not on this request)`
        : "Live availability nearby";
      const lpIcon = livePresenceIcon(p);
      const m = attach(
        p.lat,
        p.lng,
        lpIcon,
        LIVE_PRESENCE_Z_INDEX,
        title,
        p.approximate ? 0.9 : 1,
      );
      if (m && isRasterPhotoUrl(p.photo_url)) {
        const { size, ring } = LIVE_PRESENCE_STYLE;
        const totalH = markerTotalHeight(size);
        void photoToCirclePortraitPngDataUrl(
          p.photo_url.trim(),
          size,
          ring,
        ).then((png) => {
          if (cancelled || !png) return;
          m.setIcon(gmIcon(png, size, totalH));
        });
      }
    }

    return () => {
      cancelled = true;
      imperativeHelperMarkersRef.current.forEach((m) => {
        google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      });
      imperativeHelperMarkersRef.current = [];
    };
  }, [companionPinsKey, livePresencePinsKey, mapReady, isLoaded]);

  // Fit map to helpers + route / pin when companions or live-presence dots are present.
  useEffect(() => {
    const map = mapInstRef.current;
    /** Do not gate on `loading` — Directions may finish after helpers arrive; pins must still zoom into view. */
    const pinCount = companionPins.length + livePresencePins.length;
    if (!map || !mapReady || !isLoaded || pinCount === 0) return;

    const bounds = new google.maps.LatLngBounds();

    companionPins.forEach((p) =>
      bounds.extend(new google.maps.LatLng(p.lat, p.lng)),
    );
    livePresencePins.forEach((p) =>
      bounds.extend(new google.maps.LatLng(p.lat, p.lng)),
    );

    if (markerPosition) bounds.extend(markerPosition);
    else if (directions?.routes[0]?.bounds) {
      bounds.union(directions.routes[0].bounds as google.maps.LatLngBounds);
    }
    if (clientPin)
      bounds.extend(new google.maps.LatLng(clientPin.lat, clientPin.lng));

    map.fitBounds(bounds, fitBoundsPadding);
  }, [
    clientPinKeyStable,
    companionPinsKey,
    livePresencePinsKey,
    directionsBoundsKeyStable,
    fitBoundsPadding,
    isLoaded,
    mapReady,
    markerPosKeyStable,
    // intentional: keyed props only — avoids fitBounds jitter when polls merge identical job rows
    // companionPins / directions / markerPosition come from closure at key-change time.
  ]);

  // Detect Google Maps auth/runtime errors and show actionable guidance.
  useEffect(() => {
    if (!containerRef.current || !isLoaded) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const hasError =
            containerRef.current?.querySelector(".gm-err-container");
          if (hasError) {
            setMapError(
              "Google Maps authorization failed for this domain. Please check API key restrictions and billing.",
            );
          }
        }
      }
    });

    observer.observe(containerRef.current, { childList: true, subtree: true });

    // Google invokes this global callback on auth failures.
    const previousAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setMapError(
        "Google Maps auth failure. This usually means the deployed domain is not allowed in API key referrers.",
      );
      if (typeof previousAuthFailure === "function") previousAuthFailure();
    };

    return () => {
      observer.disconnect();
      (window as any).gm_authFailure = previousAuthFailure;
    };
  }, [isLoaded]);

  // Use a ref to track if we've initialized for this specific job ID to prevent infinite loops/re-renders
  // but allow updates if job ID changes
  const processedJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !job) return;

    // Check if we need to process this job
    // We process if we haven't processed ANY job yet, or if the job ID changed
    const shouldProcess =
      !processedJobIdRef.current || processedJobIdRef.current !== job.id;

    if (!shouldProcess && !loading) return;

    const setupMap = async () => {
      processedJobIdRef.current = job.id;

      // Pickup & Delivery Route Logic
      if (
        job.service_type === "pickup_delivery" &&
        job.service_details?.from_lat &&
        job.service_details?.to_lat
      ) {
        setLoading(true);
        const directionsService = new google.maps.DirectionsService();

        const origin = {
          lat: Number(job.service_details.from_lat),
          lng: Number(job.service_details.from_lng),
        };
        const destination = {
          lat: Number(job.service_details.to_lat),
          lng: Number(job.service_details.to_lng),
        };

        // Center map on midpoint initially
        setCenter({
          lat: (origin.lat + destination.lat) / 2,
          lng: (origin.lng + destination.lng) / 2,
        });

        directionsService.route(
          {
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            setLoading(false);
            if (status === "OK" && result) {
              setDirections(result);
              const route = result.routes[0];
              if (route && route.legs[0] && onRouteInfo) {
                onRouteInfo({
                  distance: route.legs[0].distance?.text || "",
                  duration: route.legs[0].duration?.text || "",
                });
              }
            } else {
              console.error("Directions request failed due to " + status);
              if (
                status === "OVER_QUERY_LIMIT" ||
                status === "REQUEST_DENIED"
              ) {
                setMapError(
                  "Google Maps request denied. Check Maps API enablement, billing, and HTTP referrer restrictions.",
                );
              }
            }
          },
        );
      }
      // Single Location Logic (Geocoding City)
      else if (job.location_city) {
        setLoading(true);
        setDirections(null); // Clear directions if switching to single point
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: job.location_city }, (results, status) => {
          setLoading(false);
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            const pos = { lat: loc.lat(), lng: loc.lng() };
            setCenter(pos);
            setMarkerPosition(pos);
          } else {
            console.error(
              "Geocode was not successful for the following reason: " + status,
            );
            if (status === "OVER_QUERY_LIMIT" || status === "REQUEST_DENIED") {
              setMapError(
                "Google Geocoding request denied. Check API restrictions and billing.",
              );
            }
          }
        });
      }
    };

    setupMap();
  }, [isLoaded, job?.id, job?.service_type, job?.location_city]);

  if (!mapsApiKey) {
    return (
      <div className="h-full w-full bg-muted rounded-lg border border-destructive/20 p-4 flex items-center justify-center text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-destructive">
            Google Maps API key is missing
          </p>
          <p className="text-xs text-muted-foreground">
            Set `VITE_GOOGLE_MAPS_API_KEY` in the deployed web environment.
          </p>
        </div>
      </div>
    );
  }

  if (loadError || mapError) {
    return (
      <div className="h-full w-full bg-muted rounded-lg border border-destructive/20 p-4 flex items-center justify-center text-center">
        <div className="space-y-3 max-w-md">
          <p className="text-sm font-semibold text-destructive">
            Google Maps failed to load
          </p>
          <p className="text-xs text-muted-foreground">
            {mapError ||
              "Script load failed. Verify the API key, enabled APIs, billing, and allowed HTTP referrers."}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Current host:{" "}
            <span className="font-mono">{window.location.host}</span>
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            {onClose && (
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-md border border-border"
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (!isLoaded)
    return (
      <div className="h-full w-full bg-muted animate-pulse rounded-lg flex items-center justify-center text-muted-foreground flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest opacity-50">
          Initializing Map...
        </span>
      </div>
    );

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={10}
        center={center}
        onLoad={(m) => {
          mapInstRef.current = m;
          setMapReady(true);
        }}
        onUnmount={() => {
          mapInstRef.current = null;
          setMapReady(false);
        }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          draggable: false,
          zoomControl: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          styles: darkMode ? darkMapStyles : undefined,
        }}
      >
        {directions ? (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: "#F97316", // Primary orange
                strokeWeight: 4,
              },
            }}
          />
        ) : (
          markerPosition && (
            <Marker
              position={markerPosition}
              zIndex={50}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#10b981",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            />
          )
        )}
        {clientPin && (
          <Marker
            position={clientPin}
            zIndex={58}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: "#10b981",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
