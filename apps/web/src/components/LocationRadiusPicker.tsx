import { useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "220px",
};

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };

export interface LocationRadiusValue {
  address: string;
  lat?: number;
  lng?: number;
  radius: number; // km
}

interface Props {
  value: LocationRadiusValue;
  onChange: (value: LocationRadiusValue) => void;
  /** Softer chrome for minimal profile layouts */
  variant?: "default" | "minimal";
}

const RADIUS_OPTIONS = [1, 2, 5, 10, 15, 20, 30, 50];

export function LocationRadiusPicker({ value, onChange, variant = "default" }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const minimal = variant === "minimal";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const center =
    value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER;

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const stroke = minimal ? "#64748b" : "#f97316";
    const fill = minimal ? "rgba(100, 116, 139, 0.12)" : "rgba(249, 115, 22, 0.14)";

    if (circleRef.current) {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(value.radius * 1000);
      circleRef.current.setOptions({
        fillColor: fill,
        strokeColor: stroke,
      });
    } else {
      circleRef.current = new google.maps.Circle({
        map: mapRef.current,
        center,
        radius: value.radius * 1000,
        fillColor: fill,
        fillOpacity: 1,
        strokeColor: stroke,
        strokeOpacity: 0.85,
        strokeWeight: 1.5,
        clickable: false,
      });
    }
  }, [isLoaded, center.lat, center.lng, value.radius, minimal]);

  useEffect(() => {
    return () => {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const applyPosition = useCallback(
    (lat: number, lng: number) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const address =
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChange({ ...value, address, lat, lng });
      });
    },
    [onChange, value]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) applyPosition(e.latLng.lat(), e.latLng.lng());
    },
    [applyPosition]
  );

  const handleMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) applyPosition(e.latLng.lat(), e.latLng.lng());
    },
    [applyPosition]
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const { latitude: lat, longitude: lng } = coords;
      applyPosition(lat, lng);
      mapRef.current?.panTo({ lat, lng });
    });
  }, [applyPosition]);

  if (loadError) return <p className="text-sm text-destructive">Error loading Google Maps</p>;

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading map…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-muted/10",
          minimal ? "border-border/50 shadow-none" : "border-border/60"
        )}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={11}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControl: true,
          }}
        >
          <Marker
            position={center}
            draggable
            onDragEnd={handleMarkerDragEnd}
            title="Drag to move your service area"
          />
        </GoogleMap>
        <p className="flex items-start gap-2 border-t border-border/40 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          <span>Tap the map or drag the pin to set your area center.</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          className="h-9 gap-2 rounded-full border-border/60 bg-background/80 px-4 text-[13px] font-medium text-foreground/90 shadow-none"
        >
          <Navigation className="h-3.5 w-3.5 opacity-70" />
          Use my location
        </Button>
        <span className="text-[13px] font-semibold tabular-nums tracking-tight text-foreground/90">{value.radius} km</span>
      </div>

      <div className="space-y-3">
        <input
          type="range"
          className="slider w-full"
          min={1}
          max={50}
          step={1}
          value={value.radius}
          onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })}
        />
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_OPTIONS.map((r) => {
            const active = value.radius === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ ...value, radius: r })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm dark:bg-foreground dark:text-background"
                    : "border border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {r} km
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
