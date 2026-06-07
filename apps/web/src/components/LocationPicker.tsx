import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import {
  GOOGLE_MAP_EMBED_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import {
  createAddressAutocompleteSessionToken,
  fetchAddressSuggestions,
  resolveAddressSuggestion,
  type AddressSuggestion,
} from "@/lib/placesAddressAutocomplete";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Loader2, MapPin } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "300px",
};

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
  /** When true, only autocomplete / map picks update the saved value (not free typing). */
  requireSelection?: boolean;
  labelClassName?: string;
  inputClassName?: string;
}

export function LocationPicker({
  label,
  value,
  onChange,
  placeholder,
  requireSelection = false,
  labelClassName,
  inputClassName,
}: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [draftAddress, setDraftAddress] = useState(value.address);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [resolvingSelection, setResolvingSelection] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressInvalidateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const requestIdRef = useRef(0);

  onChangeRef.current = onChange;

  useEffect(() => {
    setDraftAddress(value.address);
  }, [value.address]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    void (async () => {
      const token = await createAddressAutocompleteSessionToken();
      if (!cancelled) sessionTokenRef.current = token;
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-location-picker-menu]")) {
        return;
      }
      setSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      setDropdownStyle(null);
      return;
    }
    const rect = input.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 10060,
    });
  }, []);

  const showSuggestions =
    suggestionsOpen && (loadingSuggestions || suggestions.length > 0);

  useEffect(() => {
    if (!showSuggestions) {
      setDropdownStyle(null);
      return;
    }
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [showSuggestions, suggestions, loadingSuggestions, updateDropdownPosition]);

  const center =
    value.lat && value.lng ? { lat: value.lat, lng: value.lng } : defaultCenter;

  const applyResolvedAddress = useCallback(
    (resolved: { address: string; lat: number; lng: number }) => {
      suppressInvalidateRef.current = true;
      setDraftAddress(resolved.address);
      onChangeRef.current(resolved);
      setSuggestions([]);
      setSuggestionsOpen(false);
      queueMicrotask(() => {
        suppressInvalidateRef.current = false;
      });
    },
    [],
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          applyResolvedAddress({
            address: results[0].formatted_address,
            lat,
            lng,
          });
          return;
        }
        applyResolvedAddress({
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          lat,
          lng,
        });
      });
    },
    [applyResolvedAddress],
  );

  const queueSuggestionFetch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoadingSuggestions(true);
      void (async () => {
        try {
          const nextSuggestions = await fetchAddressSuggestions(
            trimmed,
            sessionTokenRef.current,
          );
          if (requestId !== requestIdRef.current) return;
          setSuggestions(nextSuggestions);
          setSuggestionsOpen(nextSuggestions.length > 0);
        } finally {
          if (requestId === requestIdRef.current) {
            setLoadingSuggestions(false);
          }
        }
      })();
    }, 220);
  }, []);

  const handleAddressChange = (address: string) => {
    setDraftAddress(address);
    setSuggestionsOpen(true);
    if (suppressInvalidateRef.current) return;
    if (!requireSelection) {
      onChangeRef.current({ address, lat: value.lat, lng: value.lng });
      queueSuggestionFetch(address);
      return;
    }
    if (value.lat != null && value.lng != null) {
      onChangeRef.current({ address: "", lat: undefined, lng: undefined });
    }
    queueSuggestionFetch(address);
  };

  const handleSelectSuggestion = async (suggestion: AddressSuggestion) => {
    setResolvingSelection(true);
    setSuggestionsOpen(false);
    try {
      const resolved = await resolveAddressSuggestion(suggestion);
      if (!resolved) return;
      applyResolvedAddress(resolved);
      sessionTokenRef.current = await createAddressAutocompleteSessionToken();
    } finally {
      setResolvingSelection(false);
    }
  };

  const inputValue = requireSelection ? draftAddress : value.address;
  const hasSelection = value.lat != null && value.lng != null && Boolean(value.address);

  const suggestionsMenu =
    showSuggestions && dropdownStyle
      ? createPortal(
          <ul
            role="listbox"
            data-location-picker-menu
            style={dropdownStyle}
            className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl pointer-events-auto"
          >
            {loadingSuggestions && suggestions.length === 0 ? (
              <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching places…
              </li>
            ) : null}
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} role="option">
                <button
                  type="button"
                  disabled={resolvingSelection}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleSelectSuggestion(suggestion)}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none disabled:opacity-50"
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  if (loadError) {
    return (
      <div className="space-y-3">
        <label className={cn("text-sm font-medium", labelClassName)}>{label}</label>
        <Input
          placeholder={placeholder || "Enter address"}
          value={inputValue}
          onChange={(e) => handleAddressChange(e.target.value)}
          className={cn("flex-1", inputClassName)}
        />
        <p className="text-xs text-destructive">Error loading Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <label className={cn("text-sm font-medium", labelClassName)}>{label}</label>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className={cn("text-sm font-medium", labelClassName)}>{label}</label>

      <div ref={containerRef} className="relative flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            placeholder={placeholder || "Enter address or click on map"}
            value={inputValue}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => {
              updateDropdownPosition();
              if (suggestions.length > 0) setSuggestionsOpen(true);
            }}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            className={cn("w-full", inputClassName)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowMap(!showMap)}
          title={showMap ? "Hide map" : "Show map"}
          className="h-12 w-12 shrink-0 rounded-xl"
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </div>
      {requireSelection ? (
        <p className="text-xs text-muted-foreground">
          {hasSelection
            ? "Location saved. Search again or use the map to change it."
            : "Pick a place from the suggestions or tap the map pin."}
        </p>
      ) : null}

      {showMap ? (
        <div className="relative">
          <div className="overflow-hidden rounded-lg border-2 border-border">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={13}
              onClick={handleMapClick}
              options={{
                ...GOOGLE_MAP_EMBED_OPTIONS,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {value.lat && value.lng ? (
                <Marker position={{ lat: value.lat, lng: value.lng }} />
              ) : null}
            </GoogleMap>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Click anywhere on the map to set the location, or search for an address above
          </p>
        </div>
      ) : null}

      {suggestionsMenu}
    </div>
  );
}
