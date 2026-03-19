import { useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Loader2, Navigation } from "lucide-react";
import { Button } from "./ui/button";

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "260px",
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
}

const RADIUS_OPTIONS = [1, 2, 5, 10, 15, 20, 30, 50];

export function LocationRadiusPicker({ value, onChange }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const center =
    value.lat != null && value.lng != null
      ? { lat: value.lat, lng: value.lng }
      : DEFAULT_CENTER;

  // ---------- imperative circle ----------
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    if (circleRef.current) {
      // update existing circle
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(value.radius * 1000);
    } else {
      // create new circle
      circleRef.current = new google.maps.Circle({
        map: mapRef.current,
        center,
        radius: value.radius * 1000,
        fillColor: "#f97316",
        fillOpacity: 0.18,
        strokeColor: "#f97316",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        clickable: false,
      });
    }
  }, [isLoaded, center.lat, center.lng, value.radius]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // reverse-geocode then call onChange
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
      <div className="flex items-center gap-2 p-3 border rounded-xl">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading map…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map */}
      <div className="rounded-xl overflow-hidden border-2 border-border">
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
        <p className="text-xs text-muted-foreground px-3 py-2">
          📍 Tap the map or drag the pin to set your service area center
        </p>
      </div>

      {/* GPS + radius label */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          className="gap-2 text-xs"
        >
          <Navigation className="w-3.5 h-3.5" />
          Use my location
        </Button>
        <span className="text-sm font-semibold text-primary whitespace-nowrap">
          {value.radius} km radius
        </span>
      </div>

      {/* Slider */}
      <div className="space-y-2">
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
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ ...value, radius: r })}
              className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                value.radius === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
