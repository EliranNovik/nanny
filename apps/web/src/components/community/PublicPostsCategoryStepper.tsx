import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Baby, HelpCircle, LayoutGrid, Sparkles, Truck, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_HELP_CATEGORY_ID,
  type DiscoverHomeCategoryId,
  SERVICE_CATEGORIES,
} from "@/lib/serviceCategories";
import { JOBS_STEPPER_STRIP_BASE } from "@/components/jobs/jobsMobileStepperTheme";

type Theme = {
  /** Gradient used only on the active sliding thumb. */
  pillGradient: string;
};

const THEMES: Record<DiscoverHomeCategoryId, Theme> = {
  [ALL_HELP_CATEGORY_ID]: { pillGradient: "bg-gradient-to-r from-rose-500 to-red-600" },
  cleaning: { pillGradient: "bg-gradient-to-r from-emerald-500 to-teal-600" },
  cooking: { pillGradient: "bg-gradient-to-r from-amber-500 to-orange-600" },
  pickup_delivery: { pillGradient: "bg-gradient-to-r from-violet-500 to-indigo-600" },
  nanny: { pillGradient: "bg-gradient-to-r from-sky-500 to-blue-600" },
  other_help: { pillGradient: "bg-gradient-to-r from-slate-500 to-zinc-700 dark:from-slate-600 dark:to-zinc-800" },
};

const ICONS: Record<DiscoverHomeCategoryId, LucideIcon> = {
  [ALL_HELP_CATEGORY_ID]: LayoutGrid,
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  other_help: HelpCircle,
};

const TABS: { id: DiscoverHomeCategoryId; label: string; Icon: LucideIcon }[] = [
  { id: ALL_HELP_CATEGORY_ID, label: "All help", Icon: ICONS[ALL_HELP_CATEGORY_ID] },
  ...SERVICE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, Icon: ICONS[c.id] })),
];

export interface PublicPostsCategoryStepperProps {
  activeId: DiscoverHomeCategoryId;
  onSelect: (id: DiscoverHomeCategoryId) => void;
  className?: string;
}

/** Full-width segmented category bar (Jobs-style). */
export function PublicPostsCategoryStepper({
  activeId,
  onSelect,
  className,
}: PublicPostsCategoryStepperProps) {
  const n = TABS.length;
  const index = Math.max(0, TABS.findIndex((t) => t.id === activeId));

  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsMdUp(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const thumbGapRem = (n - 1) * 0.125;
  const thumbPad = 0.75;

  /** Desktop: equal segments (matches Jobs tab bar). Mobile: active column 2fr, others 1fr → thumb aligns to wider active cell. */
  const thumbStyle = useMemo(() => {
    if (isMdUp) {
      return {
        width: `calc((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n})`,
        left: `calc(0.375rem + ${index} * ((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n} + 0.125rem))`,
      } as const;
    }
    const frTotal = n + 1;
    return {
      left: `calc(0.5rem + ${index} * (100% - 1rem) / ${frTotal})`,
      width: `calc((100% - 1rem) * 2 / ${frTotal})`,
    } as const;
  }, [isMdUp, index, n, thumbGapRem, thumbPad]);

  const mobileGridTemplate = useMemo(
    () => TABS.map((_, i) => (i === index ? "minmax(0,2fr)" : "minmax(0,1fr)")).join(" "),
    [index]
  );

  const theme = THEMES[activeId] ?? THEMES[ALL_HELP_CATEGORY_ID];

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: flat container (pill carries colour, like Liked page). Desktop: frosted strip under jobs tabs. */}
      <div
        className={cn(
          "w-full rounded-2xl px-3 py-3 md:px-5 md:py-4",
          "max-md:border-0 max-md:bg-transparent max-md:px-2 max-md:py-0 max-md:shadow-none",
          "max-md:backdrop-blur-none",
          isMdUp && JOBS_STEPPER_STRIP_BASE
        )}
      >
        <div className="mx-auto w-full max-w-[min(70rem,calc(100vw-2rem))]">
          <div
            className={cn(
              "relative isolate w-full min-w-0 overflow-hidden rounded-full p-2",
              "min-h-[58px] md:min-h-[76px]",
              "transition-[box-shadow] duration-300",
              isMdUp
                ? "border border-slate-200/90 bg-slate-100/85 shadow-sm shadow-black/5 dark:border-border/50 dark:bg-zinc-900/55 dark:shadow-black/25"
                : "border border-white/20 shadow-2xl shadow-black/25 backdrop-blur-md dark:shadow-black/40"
            )}
            role="tablist"
            aria-label="Availability categories"
          >
            {/* Mobile: full pill filled with active category gradient (Liked-style bar) */}
            {!isMdUp && (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-[background] duration-300",
                  theme.pillGradient
                )}
              />
            )}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-2 bottom-2 z-[5] rounded-full",
                "transition-[left,width] duration-300 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
                isMdUp
                  ? cn(
                      "shadow-md shadow-black/15 ring-1 ring-white/25 dark:ring-white/10",
                      theme.pillGradient
                    )
                  : "bg-white/20 shadow-inner backdrop-blur-sm ring-1 ring-white/35"
              )}
              style={thumbStyle}
            />

            <div
              className={cn("relative z-10 grid h-full w-full gap-0.5", isMdUp && "grid-cols-6")}
              style={isMdUp ? undefined : { gridTemplateColumns: mobileGridTemplate }}
            >
              {TABS.map((t) => {
                const selected = t.id === activeId;
                const Icon = t.Icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      "relative z-10 flex min-w-0 flex-col items-center justify-center rounded-full px-0.5 py-1 md:gap-0.5 md:px-1",
                      "bg-transparent [-webkit-tap-highlight-color:transparent]",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                      "max-md:focus-visible:ring-white/60 max-md:focus-visible:ring-offset-0",
                      "md:focus-visible:ring-orange-400/55",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      selected ? "gap-1 max-md:py-1.5" : "gap-0 max-md:py-2",
                      selected
                        ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                        : isMdUp
                          ? "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          : "text-white/65 hover:text-white/85"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-transform duration-300 max-md:mx-auto md:h-6 md:w-6",
                        selected && "scale-105 max-md:drop-shadow-sm"
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {/* Mobile: label only on active tab (more room for long titles). Desktop: always show. */}
                    <span
                      className={cn(
                        "max-w-full px-0.5 text-center font-semibold leading-tight tracking-tight md:text-[11px]",
                        "line-clamp-2 break-words [overflow-wrap:anywhere]",
                        !selected && "max-md:hidden",
                        selected
                          ? "block text-[10px] max-md:min-w-0 max-md:w-full max-md:max-w-none max-md:leading-snug md:text-[11px]"
                          : "text-[10px]"
                      )}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

