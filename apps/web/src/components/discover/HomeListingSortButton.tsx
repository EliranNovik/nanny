import { useEffect, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";
import {
  DISCOVER_HOME_LISTING_SORTS,
  EMPTY_LISTING_FILTERS,
  listingFiltersAreActive,
  type DiscoverHomeListingFilters,
  type DiscoverHomeListingSort,
  type DiscoverHomeWhenFilter,
} from "@/lib/discoverHomeCategoryFilter";

const WHEN_OPTIONS: { id: DiscoverHomeWhenFilter; label: string }[] = [
  { id: "", label: "Any" },
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "This week" },
];

export function HomeListingSortButton({
  value,
  onChange,
  filters = EMPTY_LISTING_FILTERS,
  onFiltersChange,
  tone = "orange",
  className,
}: {
  value: DiscoverHomeListingSort;
  onChange: (next: DiscoverHomeListingSort) => void;
  filters?: DiscoverHomeListingFilters;
  onFiltersChange?: (next: DiscoverHomeListingFilters) => void;
  tone?: "orange" | "emerald";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = value !== "newest" || listingFiltersAreActive(filters);
  const ring = tone === "emerald" ? "ring-emerald-500/40" : "ring-orange-500/40";
  const selectedText =
    tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300";
  const chipOn =
    tone === "emerald"
      ? "bg-emerald-600 text-white"
      : "bg-orange-500 text-white";

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const patch = (next: Partial<DiscoverHomeListingFilters>) => {
    onFiltersChange?.({ ...filters, ...next });
  };

  const toggleCategory = (id: string) => {
    const categories = filters.categories.includes(id)
      ? filters.categories.filter((category) => category !== id)
      : [...filters.categories, id];
    patch({ categories });
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Filter and sort"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-black/5 transition hover:bg-zinc-50 active:scale-[0.97]",
          "dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-800",
          active && cn("ring-2", ring),
        )}
      >
        <SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Filter and sort"
          className="absolute end-0 top-[calc(100%+0.4rem)] z-[120] max-h-[min(70vh,34rem)] w-[20.5rem] overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-zinc-900"
        >
          <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Sort</p>
          {DISCOVER_HOME_LISTING_SORTS.map((option) => {
            const selected = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-semibold",
                  selected
                    ? selectedText
                    : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
              >
                {option.label}
                {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}

          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-white/10">
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Date posted</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-semibold text-zinc-500">
                From
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => patch({ dateFrom: event.target.value })}
                  className="mt-1 h-9 w-full rounded-xl bg-zinc-100 px-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </label>
              <label className="block text-[11px] font-semibold text-zinc-500">
                To
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => patch({ dateTo: event.target.value })}
                  className="mt-1 h-9 w-full rounded-xl bg-zinc-100 px-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </label>
            </div>
          </div>

          <div className="mt-3">
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">When</p>
            <div className="flex flex-wrap gap-1.5">
              {WHEN_OPTIONS.map((option) => (
                <button
                  key={option.id || "any"}
                  type="button"
                  onClick={() => patch({ when: option.id })}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold",
                    filters.when === option.id
                      ? chipOn
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_CATEGORIES.map((category) => {
                const selected = filters.categories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      selected ? chipOn : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                    )}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Reviews</p>
              <p className="text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                {(filters.reviewMin === "" ? 0 : Number(filters.reviewMin)).toFixed(1)}
                {" – "}
                {(filters.reviewMax === "" ? 5 : Number(filters.reviewMax)).toFixed(1)}
              </p>
            </div>
            <SliderPrimitive.Root
              className="relative flex h-8 w-full touch-none select-none items-center"
              min={0}
              max={5}
              step={0.5}
              value={[
                filters.reviewMin === "" ? 0 : Number(filters.reviewMin),
                filters.reviewMax === "" ? 5 : Number(filters.reviewMax),
              ]}
              onValueChange={([min, max]) => {
                const low = min ?? 0;
                const high = max ?? 5;
                patch({
                  reviewMin: low <= 0 ? "" : String(low),
                  reviewMax: high >= 5 ? "" : String(high),
                });
              }}
              aria-label="Review range"
            >
              <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <SliderPrimitive.Range
                  className={cn(
                    "absolute h-full",
                    tone === "emerald" ? "bg-emerald-500" : "bg-orange-500",
                  )}
                />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb
                className={cn(
                  "block h-5 w-5 rounded-full bg-white shadow ring-2 focus-visible:outline-none",
                  tone === "emerald" ? "ring-emerald-500" : "ring-orange-500",
                )}
                aria-label="Minimum review"
              />
              <SliderPrimitive.Thumb
                className={cn(
                  "block h-5 w-5 rounded-full bg-white shadow ring-2 focus-visible:outline-none",
                  tone === "emerald" ? "ring-emerald-500" : "ring-orange-500",
                )}
                aria-label="Maximum review"
              />
            </SliderPrimitive.Root>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Location</p>
              <p className="text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                {filters.distanceMaxKm === "" ? "Any" : `${filters.distanceMaxKm} km`}
              </p>
            </div>
            <SliderPrimitive.Root
              className="relative flex h-8 w-full touch-none select-none items-center"
              min={5}
              max={100}
              step={5}
              value={[filters.distanceMaxKm === "" ? 100 : Number(filters.distanceMaxKm)]}
              onValueChange={([km]) => {
                const next = km ?? 100;
                patch({ distanceMaxKm: next >= 100 ? "" : String(next) });
              }}
              aria-label="Maximum distance in kilometers"
            >
              <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <SliderPrimitive.Range
                  className={cn(
                    "absolute h-full",
                    tone === "emerald" ? "bg-emerald-500" : "bg-orange-500",
                  )}
                />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb
                className={cn(
                  "block h-5 w-5 rounded-full bg-white shadow ring-2 focus-visible:outline-none",
                  tone === "emerald" ? "ring-emerald-500" : "ring-orange-500",
                )}
                aria-label="Maximum kilometers"
              />
            </SliderPrimitive.Root>
          </div>

          {listingFiltersAreActive(filters) ? (
            <button
              type="button"
              onClick={() => onFiltersChange?.(EMPTY_LISTING_FILTERS)}
              className="mt-3 w-full rounded-xl px-2 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
