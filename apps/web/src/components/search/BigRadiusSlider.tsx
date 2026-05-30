import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const RADIUS_MIN = 5;
export const RADIUS_MAX = 100;
export const RADIUS_STEP = 5;

type BigRadiusSliderTheme = "orange" | "emerald";

type BigRadiusSliderProps = {
  value: number;
  onChange: (km: number) => void;
  id?: string;
  theme?: BigRadiusSliderTheme;
  orientation?: "horizontal" | "vertical";
  /** Frosted glass track — for vertical slider overlaid on the map. */
  variant?: "default" | "glass";
};

/** See-through glass shell for the map overlay radius slider. */
export const mapRadiusSliderGlassShellClass = cn(
  "pointer-events-auto absolute right-2 top-1/2 z-[12] h-[min(72%,16rem)] -translate-y-1/2",
  "rounded-full border border-white/25 bg-white/10 p-1.5 shadow-lg backdrop-blur-2xl",
  "dark:border-white/10 dark:bg-black/20",
);

const TRACK_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange: "bg-orange-100/90 dark:bg-orange-950/35",
  emerald: "bg-emerald-100/90 dark:bg-emerald-950/35",
};

const TRACK_OVERLAY_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange: "bg-white/35 dark:bg-white/12",
  emerald: "bg-white/35 dark:bg-white/12",
};

const RANGE_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange: "bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500",
  emerald: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500",
};

const RANGE_VERTICAL_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange: "bg-gradient-to-t from-orange-400 via-orange-500 to-amber-500",
  emerald: "bg-gradient-to-t from-emerald-400 via-emerald-500 to-teal-500",
};

const THUMB_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange:
    "bg-gradient-to-br from-orange-500 to-amber-500 ring-orange-500/30 focus-visible:ring-orange-400/60",
  emerald:
    "bg-gradient-to-br from-emerald-500 to-teal-500 ring-emerald-500/30 focus-visible:ring-emerald-400/60",
};

export function BigRadiusSlider({
  value,
  onChange,
  id,
  theme = "orange",
  orientation = "horizontal",
  variant = "default",
}: BigRadiusSliderProps) {
  const isVertical = orientation === "vertical";
  const isGlass = variant === "glass";

  return (
    <SliderPrimitive.Root
      id={id}
      orientation={orientation}
      className={cn(
        "relative touch-none select-none",
        isVertical
          ? "flex h-full w-[4.25rem] flex-col items-center px-1 py-1"
          : "flex h-[4.75rem] w-full items-center py-2",
      )}
      value={[value]}
      onValueChange={(v) => {
        const next = v[0] ?? value;
        onChange(
          Math.min(
            RADIUS_MAX,
            Math.max(RADIUS_MIN, Math.round(next / RADIUS_STEP) * RADIUS_STEP),
          ),
        );
      }}
      min={RADIUS_MIN}
      max={RADIUS_MAX}
      step={RADIUS_STEP}
      aria-label="Search radius in kilometers"
    >
      <SliderPrimitive.Track
        className={cn(
          "relative grow overflow-hidden rounded-full",
          isVertical ? "h-full w-4" : "h-5 w-full",
          isGlass ? TRACK_OVERLAY_BY_THEME[theme] : TRACK_BY_THEME[theme],
          !isGlass && "shadow-inner",
        )}
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute",
            isVertical
              ? cn("w-full", RANGE_VERTICAL_BY_THEME[theme])
              : cn("h-full", RANGE_BY_THEME[theme]),
          )}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "flex shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-white shadow-xl",
          "ring-4 transition-transform hover:scale-[1.03] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-4",
          isVertical ? "h-14 w-14" : "h-[4.75rem] w-[4.75rem]",
          THUMB_BY_THEME[theme],
        )}
        aria-valuetext={`${value} kilometers`}
      >
        <span
          className={cn(
            "font-black leading-none tabular-nums text-white",
            isVertical ? "text-xl" : "text-[1.65rem]",
          )}
        >
          {value}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-white/90">
          km
        </span>
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
}
