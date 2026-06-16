import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import {
  cityPlaceFromPlace,
  geocodeCoordsToCityPlace,
  type CityPlaceSelection,
} from "@/lib/cityPlace";
import { getCurrentLocation } from "@/lib/location";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

export type { CityPlaceSelection };

export interface CreateJobCityAutocompleteProps {
  confirmedCity: string;
  isConfirmed: boolean;
  onPickCity: (selection: CityPlaceSelection) => void;
  onInvalidateSelection: () => void;
  /** Parent-driven GPS (e.g. OpenStreetMap). Omit to use built-in Google geocoder. */
  onGpsClick?: () => void;
  /** Required when `onGpsClick` is provided. Ignored when using built-in GPS. */
  gpsLoading?: boolean;
  inputClassName?: string;
  /** Compact styling for onboarding and other dense forms. */
  size?: "default" | "compact";
  /** When set, copy and validation tone match optional flows (e.g. post availability). */
  variant?: "required" | "optional";
}

export function CreateJobCityAutocomplete({
  confirmedCity,
  isConfirmed,
  onPickCity,
  onInvalidateSelection,
  onGpsClick,
  gpsLoading: externalGpsLoading = false,
  inputClassName,
  size = "default",
  variant = "required",
}: CreateJobCityAutocompleteProps) {
  const isOptional = variant === "optional";
  const isCompact = size === "compact";
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(() =>
    isConfirmed ? confirmedCity : "",
  );
  const [internalGpsLoading, setInternalGpsLoading] = useState(false);
  const gpsLoading = onGpsClick ? externalGpsLoading : internalGpsLoading;
  /** Avoid onChange firing after dropdown pick from clearing parent state before confirm lands */
  const suppressInvalidateRef = useRef(false);
  const pacClassBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    return () => {
      if (pacClassBlurTimeoutRef.current) {
        clearTimeout(pacClassBlurTimeoutRef.current);
      }
      document.body.classList.remove("create-job-city-pac");
    };
  }, []);

  const enablePacStyling = useCallback(() => {
    if (pacClassBlurTimeoutRef.current) {
      clearTimeout(pacClassBlurTimeoutRef.current);
      pacClassBlurTimeoutRef.current = null;
    }
    document.body.classList.add("create-job-city-pac");
  }, []);

  const schedulePacStylingOff = useCallback(() => {
    if (pacClassBlurTimeoutRef.current) {
      clearTimeout(pacClassBlurTimeoutRef.current);
    }
    pacClassBlurTimeoutRef.current = setTimeout(() => {
      document.body.classList.remove("create-job-city-pac");
      pacClassBlurTimeoutRef.current = null;
    }, 280);
  }, []);

  useEffect(() => {
    if (isConfirmed && confirmedCity) {
      setInputValue(confirmedCity);
    }
  }, [isConfirmed, confirmedCity]);

  const applySelection = useCallback(
    (selection: CityPlaceSelection) => {
      suppressInvalidateRef.current = true;
      setInputValue(selection.label);
      onPickCity(selection);
      document.body.classList.remove("create-job-city-pac");
      queueMicrotask(() => {
        suppressInvalidateRef.current = false;
      });
    },
    [onPickCity],
  );

  const onAcLoad = useCallback((instance: google.maps.places.Autocomplete) => {
    setAutocomplete(instance);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    const selection = cityPlaceFromPlace(place);
    if (!selection) return;
    applySelection(selection);
  }, [autocomplete, applySelection]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (suppressInvalidateRef.current) return;
    onInvalidateSelection();
  };

  const handleGpsClick = useCallback(async () => {
    if (onGpsClick) {
      onGpsClick();
      return;
    }
    setInternalGpsLoading(true);
    try {
      const { lat, lng } = await getCurrentLocation();
      const selection = await geocodeCoordsToCityPlace(lat, lng);
      if (!selection) {
        return;
      }
      applySelection(selection);
    } finally {
      setInternalGpsLoading(false);
    }
  }, [onGpsClick, applySelection]);

  const fieldHeightClass = isCompact ? "h-10" : "h-14";
  const textSizeClass = isCompact ? "text-base" : "text-lg";
  const gpsButtonClass = isCompact ? "h-10 w-10" : "h-14 w-14";
  const helperText = isOptional
    ? isConfirmed
      ? "City from the list or GPS is saved. Edit the field to change it."
      : "Optional — pick a city from suggestions or use GPS. You can skip this."
    : isConfirmed
      ? "City selected. Change the text only if you want to pick a different city."
      : null;

  if (loadError) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            disabled
            placeholder="City search unavailable"
            className={cn(
              fieldHeightClass,
              "flex-1 border-slate-200/90 bg-white opacity-80 dark:border-white/[0.12] dark:bg-white/[0.04]",
              textSizeClass,
              inputClassName,
            )}
          />
        </div>
        <p className="text-sm text-destructive">
          Google Maps could not load. Add{" "}
          <code className="rounded bg-muted px-1">VITE_GOOGLE_MAPS_API_KEY</code>{" "}
          to choose a city from suggestions.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-slate-200/90 bg-white px-3 dark:border-white/[0.12] dark:bg-white/[0.04]",
          fieldHeightClass,
        )}
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading city search…</span>
      </div>
    );
  }

  return (
    <div className="create-job-city-field space-y-2">
      <div className="flex gap-2">
        <Autocomplete
          onLoad={onAcLoad}
          onPlaceChanged={onPlaceChanged}
          options={{
            types: ["(cities)"],
            componentRestrictions: { country: "il" },
          }}
        >
          <Input
            id="city"
            placeholder="Start typing, then pick a city from the list"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={enablePacStyling}
            onBlur={schedulePacStylingOff}
            autoComplete="off"
            className={cn(
              fieldHeightClass,
              "min-w-0 flex-1 border-slate-200/90 bg-white shadow-sm ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.12] dark:bg-white/[0.04]",
              textSizeClass,
              inputClassName,
            )}
            aria-invalid={
              isOptional ? false : !isConfirmed && inputValue.length > 0
            }
          />
        </Autocomplete>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleGpsClick}
          disabled={gpsLoading}
          className={cn("shrink-0", gpsButtonClass)}
          title="Use my current location (sets city from GPS)"
        >
          {gpsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Navigation className="h-5 w-5" />
          )}
        </Button>
      </div>
      {helperText ? (
        <p
          className={cn(
            "text-slate-500 dark:text-slate-400",
            isCompact ? "text-xs" : "text-sm",
          )}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
