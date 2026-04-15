import { useState, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
  Polyline,
} from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import { Input } from "./ui/input";
import { Loader2 } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

// Default center (Tel Aviv, Israel)
const defaultCenter = {
  lat: 32.0853,
  lng: 34.7818,
};

interface LocationValue {
  address: string;
  lat?: number;
  lng?: number;
}

interface DualLocationPickerProps {
  fromLabel: string;
  toLabel: string;
  fromValue: LocationValue;
  toValue: LocationValue;
  onFromChange: (value: LocationValue) => void;
  onToChange: (value: LocationValue) => void;
  fromPlaceholder?: string;
  toPlaceholder?: string;
}

export function DualLocationPicker({
  fromLabel,
  toLabel,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  fromPlaceholder,
  toPlaceholder,
}: DualLocationPickerProps) {
  const [activeInput, setActiveInput] = useState<"from" | "to">("from");
  const [fromAutocomplete, setFromAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [toAutocomplete, setToAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Calculate center based on available locations
  const getMapCenter = () => {
    if (fromValue.lat && fromValue.lng && toValue.lat && toValue.lng) {
      return {
        lat: (fromValue.lat + toValue.lat) / 2,
        lng: (fromValue.lng + toValue.lng) / 2,
      };
    }
    if (fromValue.lat && fromValue.lng)
      return { lat: fromValue.lat, lng: fromValue.lng };
    if (toValue.lat && toValue.lng)
      return { lat: toValue.lat, lng: toValue.lng };
    return defaultCenter;
  };

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Reverse geocode to get address
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          const locationData = {
            address:
              status === "OK" && results && results[0]
                ? results[0].formatted_address
                : `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            lat,
            lng,
          };

          // Set location based on which input is active
          if (activeInput === "from") {
            onFromChange(locationData);
          } else {
            onToChange(locationData);
          }
        });
      }
    },
    [activeInput, onFromChange, onToChange],
  );

  const onFromLoad = useCallback(
    (autocompleteInstance: google.maps.places.Autocomplete) => {
      setFromAutocomplete(autocompleteInstance);
    },
    [],
  );

  const onToLoad = useCallback(
    (autocompleteInstance: google.maps.places.Autocomplete) => {
      setToAutocomplete(autocompleteInstance);
    },
    [],
  );

  const onFromPlaceChanged = useCallback(() => {
    if (fromAutocomplete) {
      const place = fromAutocomplete.getPlace();
      if (place.geometry?.location) {
        onFromChange({
          address: place.formatted_address || place.name || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  }, [fromAutocomplete, onFromChange]);

  const onToPlaceChanged = useCallback(() => {
    if (toAutocomplete) {
      const place = toAutocomplete.getPlace();
      if (place.geometry?.location) {
        onToChange({
          address: place.formatted_address || place.name || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  }, [toAutocomplete, onToChange]);

  if (loadError) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">{fromLabel}</label>
          <Input
            placeholder={fromPlaceholder || "Enter pickup address"}
            value={fromValue.address}
            onChange={(e) =>
              onFromChange({ ...fromValue, address: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{toLabel}</label>
          <Input
            placeholder={toPlaceholder || "Enter delivery address"}
            value={toValue.address}
            onChange={(e) =>
              onToChange({ ...toValue, address: e.target.value })
            }
          />
        </div>
        <p className="text-xs text-destructive">Error loading Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 border rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading map...</span>
        </div>
      </div>
    );
  }

  const pathCoordinates =
    fromValue.lat && fromValue.lng && toValue.lat && toValue.lng
      ? [
          { lat: fromValue.lat, lng: fromValue.lng },
          { lat: toValue.lat, lng: toValue.lng },
        ]
      : [];

  return (
    <div className="space-y-4">
      {/* From Address Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{fromLabel}</label>
        <Autocomplete onLoad={onFromLoad} onPlaceChanged={onFromPlaceChanged}>
          <Input
            placeholder={fromPlaceholder || "Enter pickup address"}
            value={fromValue.address}
            onChange={(e) =>
              onFromChange({ ...fromValue, address: e.target.value })
            }
            onFocus={() => setActiveInput("from")}
            className={activeInput === "from" ? "ring-2 ring-primary" : ""}
          />
        </Autocomplete>
      </div>

      {/* To Address Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{toLabel}</label>
        <Autocomplete onLoad={onToLoad} onPlaceChanged={onToPlaceChanged}>
          <Input
            placeholder={toPlaceholder || "Enter delivery address"}
            value={toValue.address}
            onChange={(e) =>
              onToChange({ ...toValue, address: e.target.value })
            }
            onFocus={() => setActiveInput("to")}
            className={activeInput === "to" ? "ring-2 ring-primary" : ""}
          />
        </Autocomplete>
      </div>

      {/* Google Map - Always Visible */}
      <div className="relative">
        <div className="rounded-lg overflow-hidden border-2 border-border">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={getMapCenter()}
            zoom={fromValue.lat && toValue.lat ? 12 : 13}
            onClick={handleMapClick}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {/* From Marker (Green with large A) */}
            {fromValue.lat && fromValue.lng && (
              <Marker
                position={{ lat: fromValue.lat, lng: fromValue.lng }}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
                        <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 36 20 36s20-22 20-36C40 8.954 31.046 0 20 0z" fill="#22c55e"/>
                        <circle cx="20" cy="20" r="12" fill="white"/>
                        <text x="20" y="27" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#22c55e">A</text>
                      </svg>
                    `)}`,
                  scaledSize: new google.maps.Size(40, 56),
                  anchor: new google.maps.Point(20, 56),
                }}
              />
            )}

            {/* To Marker (Red with large B) */}
            {toValue.lat && toValue.lng && (
              <Marker
                position={{ lat: toValue.lat, lng: toValue.lng }}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
                        <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 36 20 36s20-22 20-36C40 8.954 31.046 0 20 0z" fill="#ef4444"/>
                        <circle cx="20" cy="20" r="12" fill="white"/>
                        <text x="20" y="27" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#ef4444">B</text>
                      </svg>
                    `)}`,
                  scaledSize: new google.maps.Size(40, 56),
                  anchor: new google.maps.Point(20, 56),
                }}
              />
            )}
            {/* Route Line */}
            {pathCoordinates.length === 2 && (
              <Polyline
                path={pathCoordinates}
                options={{
                  strokeColor: "#3b82f6",
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                }}
              />
            )}
          </GoogleMap>
        </div>
        <div className="mt-2 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Click on the{" "}
            <span
              className={
                activeInput === "from"
                  ? "text-green-600 font-semibold"
                  : "text-red-600 font-semibold"
              }
            >
              {activeInput === "from" ? "pickup (A)" : "delivery (B)"}
            </span>{" "}
            input field above, then click on the map to set that location. Or
            search for an address using autocomplete.
          </p>
        </div>
      </div>
    </div>
  );
}
