import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MutableRefObject,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/lib/googleMapsLoader";
import {
  cityPlaceFromGeocoderResult,
  geocodeCoordsToCityPlace,
  type CityPlaceSelection,
} from "@/lib/cityPlace";
import { getCurrentLocation } from "@/lib/location";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

export type { CityPlaceSelection };

type CityPrediction = {
  placeId: string;
  label: string;
  secondary?: string;
};

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
  inputRef?: Ref<HTMLInputElement>;
  enterKeyHint?: HTMLAttributes<HTMLInputElement>["enterKeyHint"];
  onInputKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
  /** Floating label inside the field (used on registration). */
  label?: string;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as MutableRefObject<T | null>).current = value;
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
  inputRef,
  enterKeyHint,
  onInputKeyDown,
  autoFocus,
  label,
}: CreateJobCityAutocompleteProps) {
  const isOptional = variant === "optional";
  const isCompact = size === "compact";
  const floating = Boolean(label);
  const generatedId = useId();
  const inputId = "city";
  const listId = `${generatedId}-city-suggestions`;
  const [inputValue, setInputValue] = useState(() =>
    isConfirmed ? confirmedCity : "",
  );
  const [predictions, setPredictions] = useState<CityPrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [internalGpsLoading, setInternalGpsLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const gpsLoading = onGpsClick ? externalGpsLoading : internalGpsLoading;
  const suppressInvalidateRef = useRef(false);
  const pickingRef = useRef(false);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(
    null,
  );
  const inputElRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    id: GOOGLE_MAPS_SCRIPT_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const setInputNode = useCallback(
    (node: HTMLInputElement | null) => {
      inputElRef.current = node;
      assignRef(inputRef, node);
    },
    [inputRef],
  );

  useEffect(() => {
    if (!isLoaded || typeof google === "undefined" || !google.maps?.places) {
      return;
    }
    serviceRef.current = new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  useEffect(() => {
    if (isConfirmed && confirmedCity) {
      setInputValue(confirmedCity);
      setPredictions([]);
      setOpen(false);
    }
  }, [isConfirmed, confirmedCity]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const applySelection = useCallback(
    (selection: CityPlaceSelection) => {
      suppressInvalidateRef.current = true;
      setInputValue(selection.label);
      onPickCity(selection);
      setPredictions([]);
      setOpen(false);
      queueMicrotask(() => {
        suppressInvalidateRef.current = false;
      });
    },
    [onPickCity],
  );

  const fetchPredictions = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = query.trim();
      if (!isLoaded || trimmed.length < 2) {
        requestIdRef.current += 1;
        setPredictions([]);
        setOpen(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        const requestId = ++requestIdRef.current;
        serviceRef.current?.getPlacePredictions(
          {
            input: trimmed,
            types: ["(cities)"],
            componentRestrictions: { country: "il" },
          },
          (results, status) => {
            if (requestId !== requestIdRef.current) return;
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !results?.length
            ) {
              setPredictions([]);
              setOpen(false);
              return;
            }
            setPredictions(
              results.map((result) => ({
                placeId: result.place_id,
                label:
                  result.structured_formatting?.main_text || result.description,
                secondary:
                  result.structured_formatting?.secondary_text || undefined,
              })),
            );
            setHighlight(0);
            setOpen(true);
          },
        );
      }, 140);
    },
    [isLoaded],
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (suppressInvalidateRef.current) return;
    onInvalidateSelection();
    fetchPredictions(value);
  };

  const pickPrediction = useCallback(
    (prediction: CityPrediction) => {
      if (pickingRef.current) return;
      pickingRef.current = true;
      setResolving(true);
      const finish = (selection: CityPlaceSelection) => {
        applySelection(selection);
        setResolving(false);
        pickingRef.current = false;
      };
      const fallback: CityPlaceSelection = {
        label: prediction.label,
        placeId: prediction.placeId,
        lat: null,
        lng: null,
      };

      if (typeof google === "undefined" || !google.maps?.Geocoder) {
        finish(fallback);
        return;
      }

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ placeId: prediction.placeId }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const selection = cityPlaceFromGeocoderResult(results[0]);
          finish(
            selection ?? {
              ...fallback,
              lat: results[0].geometry?.location?.lat() ?? null,
              lng: results[0].geometry?.location?.lng() ?? null,
            },
          );
          return;
        }
        finish(fallback);
      });
    },
    [applySelection],
  );

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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open && predictions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((index) => (index + 1) % predictions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight(
          (index) => (index - 1 + predictions.length) % predictions.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        pickPrediction(predictions[highlight] ?? predictions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
    }
    onInputKeyDown?.(event);
  };

  useEffect(() => {
    if (!open || predictions.length === 0) {
      setMenuBox(null);
      return;
    }

    const updateBox = () => {
      const el = inputElRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [open, predictions.length, inputValue]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (inputElRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const fieldHeightClass = floating ? "h-14" : isCompact ? "h-10" : "h-14";
  const textSizeClass = floating || isCompact ? "text-base" : "text-lg";
  const gpsButtonClass = floating || !isCompact ? "h-14 w-14" : "h-10 w-10";
  const helperText =
    floating || isOptional
      ? isOptional
        ? isConfirmed
          ? "City from the list or GPS is saved. Edit the field to change it."
          : "Optional — pick a city from suggestions or use GPS. You can skip this."
        : null
      : isConfirmed
        ? "City selected. Change the text only if you want to pick a different city."
        : null;

  const inputClass = cn(
    fieldHeightClass,
    "min-w-0 w-full border-slate-200/90 bg-white shadow-sm ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/[0.12] dark:bg-white/[0.04]",
    textSizeClass,
    floating &&
      "rounded-xl border-2 pt-5 shadow-none placeholder:text-transparent focus-visible:ring-offset-0",
    inputClassName,
  );

  const suggestionMenu =
    open && predictions.length > 0 && menuBox && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
            className="z-[80] max-h-64 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-xl"
          >
            {predictions.map((prediction, index) => {
              const active = index === highlight;
              return (
                <li key={prediction.placeId} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start rounded-xl px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-primary/12 text-foreground"
                        : "text-foreground hover:bg-muted/70",
                    )}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      pickPrediction(prediction);
                    }}
                  >
                    <span className="text-sm font-semibold">
                      {prediction.label}
                    </span>
                    {prediction.secondary ? (
                      <span className="text-xs text-muted-foreground">
                        {prediction.secondary}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  if (loadError) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            disabled
            placeholder={label || "City search unavailable"}
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
          "flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 dark:border-white/[0.12] dark:bg-white/[0.04]",
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
        <div className="relative min-w-0 flex-1">
          <Input
            id={inputId}
            ref={setInputNode}
            placeholder={floating ? " " : "Start typing, then pick a city from the list"}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (!isConfirmed && inputValue.trim().length >= 2) {
                fetchPredictions(inputValue);
              }
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoFocus={autoFocus}
            enterKeyHint={enterKeyHint}
            inputMode="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            disabled={resolving}
            className={cn(inputClass, floating && "peer")}
            aria-invalid={
              isOptional ? false : !isConfirmed && inputValue.length > 0
            }
          />
          {floating ? (
            <label
              htmlFor={inputId}
              className={cn(
                "pointer-events-none absolute start-3 z-10 origin-start bg-background px-1 text-muted-foreground transition-all duration-200",
                inputValue
                  ? "top-0 -translate-y-1/2 text-[11px] font-semibold"
                  : "top-1/2 -translate-y-1/2 text-base",
                "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-primary",
                "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold",
              )}
            >
              {label}
            </label>
          ) : null}
          {resolving ? (
            <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
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
      {suggestionMenu}
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
