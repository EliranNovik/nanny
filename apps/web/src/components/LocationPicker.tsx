import { useState, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MapPin, Loader2 } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "300px",
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

interface LocationPickerProps {
  label: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
}

export function LocationPicker({
  label,
  value,
  onChange,
  placeholder,
}: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const center =
    value.lat && value.lng ? { lat: value.lat, lng: value.lng } : defaultCenter;

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Reverse geocode to get address
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            onChange({
              address: results[0].formatted_address,
              lat,
              lng,
            });
          } else {
            onChange({
              address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              lat,
              lng,
            });
          }
        });
      }
    },
    [onChange],
  );

  const onLoad = useCallback(
    (autocompleteInstance: google.maps.places.Autocomplete) => {
      setAutocomplete(autocompleteInstance);
    },
    [],
  );

  const onPlaceChanged = useCallback(() => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        onChange({
          address: place.formatted_address || place.name || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  }, [autocomplete, onChange]);

  const handleAddressChange = (address: string) => {
    onChange({ address, lat: value.lat, lng: value.lng });
  };

  if (loadError) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium">{label}</label>
        <Input
          placeholder={placeholder || "Enter address"}
          value={value.address}
          onChange={(e) => handleAddressChange(e.target.value)}
          className="flex-1"
        />
        <p className="text-xs text-destructive">Error loading Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2 p-3 border rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">{label}</label>

      {/* Address Input with Autocomplete */}
      <div className="flex gap-2">
        <Autocomplete
          onLoad={onLoad}
          onPlaceChanged={onPlaceChanged}
          className="flex-1"
        >
          <Input
            placeholder={placeholder || "Enter address or click on map"}
            value={value.address}
            onChange={(e) => handleAddressChange(e.target.value)}
            className="flex-1"
          />
        </Autocomplete>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowMap(!showMap)}
          title={showMap ? "Hide map" : "Show map"}
        >
          <MapPin className="w-4 h-4" />
        </Button>
      </div>

      {/* Google Map */}
      {showMap && (
        <div className="relative">
          <div className="rounded-lg overflow-hidden border-2 border-border">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={13}
              onClick={handleMapClick}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {value.lat && value.lng && (
                <Marker position={{ lat: value.lat, lng: value.lng }} />
              )}
            </GoogleMap>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Click anywhere on the map to set the location, or search for an
            address above
          </p>
        </div>
      )}
    </div>
  );
}
