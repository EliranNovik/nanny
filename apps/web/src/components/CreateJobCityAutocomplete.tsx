import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

function cityLabelFromPlace(place: google.maps.places.PlaceResult): string {
  const ac = place.address_components;
  if (ac?.length) {
    for (const c of ac) {
      if (c.types.includes("locality")) return c.long_name;
    }
    for (const c of ac) {
      if (c.types.includes("administrative_area_level_1")) return c.long_name;
    }
    for (const c of ac) {
      if (c.types.includes("sublocality") || c.types.includes("sublocality_level_1")) {
        return c.long_name;
      }
    }
  }
  const name = place.name?.trim();
  if (name) return name;
  const first = place.formatted_address?.split(",")[0]?.trim();
  return first || "";
}

export interface CreateJobCityAutocompleteProps {
  confirmedCity: string;
  isConfirmed: boolean;
  onPickCity: (city: string) => void;
  onInvalidateSelection: () => void;
  gpsLoading: boolean;
  onGpsClick: () => void;
  inputClassName?: string;
  /** When set, copy and validation tone match optional flows (e.g. post availability). */
  variant?: "required" | "optional";
}

export function CreateJobCityAutocomplete({
  confirmedCity,
  isConfirmed,
  onPickCity,
  onInvalidateSelection,
  gpsLoading,
  onGpsClick,
  inputClassName,
  variant = "required",
}: CreateJobCityAutocompleteProps) {
  const isOptional = variant === "optional";
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(() =>
    isConfirmed ? confirmedCity : "",
  );
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

  const onAcLoad = useCallback((instance: google.maps.places.Autocomplete) => {
    setAutocomplete(instance);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    const label = cityLabelFromPlace(place);
    if (!label) return;
    suppressInvalidateRef.current = true;
    setInputValue(label);
    onPickCity(label);
    document.body.classList.remove("create-job-city-pac");
    queueMicrotask(() => {
      suppressInvalidateRef.current = false;
    });
  }, [autocomplete, onPickCity]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (suppressInvalidateRef.current) return;
    onInvalidateSelection();
  };

  if (loadError) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            disabled
            placeholder="City search unavailable"
            className={cn(
              "h-14 flex-1 border-slate-200/90 bg-white text-lg opacity-80 dark:border-white/[0.12] dark:bg-white/[0.04]",
              inputClassName,
            )}
          />
        </div>
        <p className="text-sm text-destructive">
          Google Maps could not load. Add <code className="rounded bg-muted px-1">VITE_GOOGLE_MAPS_API_KEY</code>{" "}
          to choose a city from suggestions.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-14 items-center gap-2 rounded-md border border-slate-200/90 bg-white px-3 dark:border-white/[0.12] dark:bg-white/[0.04]">
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
            placeholder={
              isOptional
                ? "City (optional) — search and pick"
                : "Start typing, then pick a city from the list"
            }
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={enablePacStyling}
            onBlur={schedulePacStylingOff}
            autoComplete="off"
            className={cn(
              "h-14 flex-1 border-slate-200/90 bg-white text-lg shadow-sm ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.12] dark:bg-white/[0.04]",
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
          onClick={onGpsClick}
          disabled={gpsLoading}
          className="h-14 w-14 shrink-0"
          title="Use my current location (sets city from GPS)"
        >
          {gpsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Navigation className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {isOptional
          ? isConfirmed
            ? "City from the list or GPS is saved. Edit the field to change it."
            : "Optional — pick a city from suggestions or use GPS. You can skip this."
          : isConfirmed
            ? "City selected. Change the text only if you want to pick a different city."
            : "Choose a city from the suggestions — free text alone is not enough to continue."}
      </p>
    </div>
  );
}
