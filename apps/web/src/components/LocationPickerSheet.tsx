import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Navigation,
  User,
  PenLine,
  Check,
  X,
  Loader2,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import type { ActiveLocationResult, LocationMode } from "@/hooks/useActiveLocation";

// ─── Nominatim autocomplete ────────────────────────────────────────────────

type NominatimPlace = {
  place_id: number;
  display_name: string;
  city: string;
  country: string;
  lat: string;
  lon: string;
};

async function searchPlaces(query: string): Promise<NominatimPlace[]> {
  if (!query.trim()) return [];
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("featuretype", "city");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "MamaLama-App/1.0",
      },
    });
    if (!res.ok) return [];

    const raw = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
      };
      lat: string;
      lon: string;
    }>;

    return raw
      .map((r) => {
        const a = r.address;
        const city =
          a?.city ?? a?.town ?? a?.village ?? a?.county ?? a?.state ?? r.display_name.split(",")[0]!;
        const country = a?.country ?? "";
        return {
          place_id: r.place_id,
          display_name: r.display_name,
          city: city.trim(),
          country: country.trim(),
          lat: r.lat,
          lon: r.lon,
        };
      })
      .filter((r) => r.city);
  } catch {
    return [];
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Sheet ─────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: ActiveLocationResult;
};

export function LocationPickerSheet({ open, onOpenChange, location }: Props) {
  const { mode, setMode, gpsCity, gpsCountry, profileCity, gpsLoading, gpsDenied } = location;
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 380);

  // Run Nominatim search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchPlaces(debouncedQuery).then((res) => {
      if (cancelled) return;
      setResults(res);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Focus input when search panel opens
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [showSearch]);

  // Reset search when sheet closes
  useEffect(() => {
    if (!open) {
      setShowSearch(false);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const pick = useCallback(
    (m: LocationMode) => {
      setMode(m);
      setShowSearch(false);
      setQuery("");
      setResults([]);
      onOpenChange(false);
    },
    [setMode, onOpenChange],
  );

  const selectPlace = useCallback(
    (place: NominatimPlace) => {
      pick({ type: "custom", city: place.city, country: place.country || null });
    },
    [pick],
  );

  const isGps = mode.type === "gps";
  const isProfile = mode.type === "profile";
  const isCustom = mode.type === "custom";

  const gpsLabel = gpsLoading
    ? "Detecting…"
    : gpsDenied
      ? "Location access denied"
      : gpsCity
        ? gpsCountry
          ? `${gpsCity}, ${gpsCountry}`
          : gpsCity
        : "Detecting…";

  const customLabel =
    isCustom && mode.type === "custom"
      ? mode.country
        ? `${mode.city}, ${mode.country}`
        : mode.city
      : "Choose a city";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-t-[1.5rem] rounded-b-none border-0 p-0 shadow-2xl",
          "bottom-0 top-auto left-0 right-0 w-full max-w-none translate-x-0 translate-y-0",
          "data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4",
          "md:rounded-2xl md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(26rem,90vw)]",
          "md:-translate-x-1/2 md:-translate-y-1/2",
        )}
      >
        <DialogTitle className="sr-only">Choose location</DialogTitle>

        {/* Handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
              <MapPin className="h-4 w-4 text-slate-600 dark:text-slate-300" strokeWidth={2.25} />
            </span>
            <span className="text-[15px] font-semibold text-slate-900 dark:text-white">
              My location
            </span>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </DialogClose>
        </div>

        {/* Location options */}
        <div className="flex flex-col py-2">

          {/* GPS */}
          <button
            type="button"
            disabled={gpsDenied}
            onClick={() => !gpsDenied && pick({ type: "gps" })}
            className={cn(
              "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors",
              "hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-zinc-800/60",
              gpsDenied && "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <span className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2",
              isGps
                ? "bg-blue-600 ring-blue-600/30 text-white"
                : "bg-slate-100 ring-transparent text-slate-500 dark:bg-zinc-800 dark:text-slate-400",
            )}>
              {gpsLoading && isGps
                ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                : <Navigation className="h-5 w-5" strokeWidth={2} />
              }
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-900 dark:text-white">GPS location</p>
              <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400 truncate">{gpsLabel}</p>
            </div>
            {isGps && !gpsDenied && (
              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
            )}
          </button>

          <div className="mx-5 border-t border-border/30" />

          {/* Profile */}
          <button
            type="button"
            onClick={() => pick({ type: "profile" })}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-zinc-800/60"
          >
            <span className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2",
              isProfile
                ? "bg-violet-600 ring-violet-600/30 text-white"
                : "bg-slate-100 ring-transparent text-slate-500 dark:bg-zinc-800 dark:text-slate-400",
            )}>
              <User className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-900 dark:text-white">Profile location</p>
              <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400 truncate">
                {profileCity ?? "Not set in profile"}
              </p>
            </div>
            {isProfile && (
              <Check className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" strokeWidth={2.5} />
            )}
          </button>

          <div className="mx-5 border-t border-border/30" />

          {/* Custom */}
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-zinc-800/60"
          >
            <span className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2",
              isCustom
                ? "bg-emerald-600 ring-emerald-600/30 text-white"
                : "bg-slate-100 ring-transparent text-slate-500 dark:bg-zinc-800 dark:text-slate-400",
            )}>
              <PenLine className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-900 dark:text-white">Custom location</p>
              <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400 truncate">{customLabel}</p>
            </div>
            {isCustom && (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.5} />
            )}
          </button>

          {/* ── Inline search panel ─────────────────────────────── */}
          {showSearch && (
            <div className="mx-5 mb-3 mt-1 flex flex-col gap-0 overflow-hidden rounded-2xl border border-border/50 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-700/60 shadow-sm">
              {/* Search input */}
              <div className="flex items-center gap-2.5 border-b border-border/40 px-3.5 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" strokeWidth={2.25} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search city…"
                  className={cn(
                    "flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none",
                    "placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500",
                  )}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setResults([]); }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                )}
                {searching && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" strokeWidth={2} />
                )}
              </div>

              {/* Results */}
              {results.length > 0 ? (
                <ul className="max-h-52 overflow-y-auto divide-y divide-border/30">
                  {results.map((place) => (
                    <li key={place.place_id}>
                      <button
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" strokeWidth={2} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                            {place.city}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            {place.country}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query && !searching ? (
                <p className="px-4 py-4 text-center text-[13px] text-slate-400 dark:text-zinc-500">
                  No results found
                </p>
              ) : !query ? (
                <p className="px-4 py-3 text-[12px] text-slate-400 dark:text-zinc-500">
                  Start typing to search for a city…
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Safe area spacer */}
        <div className="shrink-0 md:hidden" style={{ height: "max(0px, env(safe-area-inset-bottom, 0px))" }} />
      </DialogContent>
    </Dialog>
  );
}
