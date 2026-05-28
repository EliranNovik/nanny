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
};

const TRACK_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange: "bg-orange-100/90 dark:bg-orange-950/35",
  emerald: "bg-emerald-100/90 dark:bg-emerald-950/35",
};

const RANGE_BY_THEME: Record<BigRadiusSliderTheme, string> = {
  orange: "bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500",
  emerald: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500",
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
}: BigRadiusSliderProps) {
  return (
    <SliderPrimitive.Root
      id={id}
      className="relative flex h-[4.75rem] w-full touch-none select-none items-center py-2"
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
          "relative h-5 w-full grow overflow-hidden rounded-full shadow-inner",
          TRACK_BY_THEME[theme],
        )}
      >
        <SliderPrimitive.Range
          className={cn("absolute h-full", RANGE_BY_THEME[theme])}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-white shadow-xl",
          "ring-4 transition-transform hover:scale-[1.03] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-4",
          THUMB_BY_THEME[theme],
        )}
        aria-valuetext={`${value} kilometers`}
      >
        <span className="text-[1.65rem] font-black leading-none tabular-nums text-white">
          {value}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-white/90">
          km
        </span>
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
}
