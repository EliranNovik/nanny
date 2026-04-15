import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
  HelpCircle,
  LayoutGrid,
  Sparkles,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
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
  [ALL_HELP_CATEGORY_ID]: {
    pillGradient: "bg-gradient-to-r from-rose-500 to-red-600",
  },
  cleaning: { pillGradient: "bg-gradient-to-r from-emerald-500 to-teal-600" },
  cooking: { pillGradient: "bg-gradient-to-r from-amber-500 to-orange-600" },
  pickup_delivery: {
    pillGradient: "bg-gradient-to-r from-violet-500 to-indigo-600",
  },
  nanny: { pillGradient: "bg-gradient-to-r from-sky-500 to-blue-600" },
  other_help: {
    pillGradient:
      "bg-gradient-to-r from-slate-500 to-zinc-700 dark:from-slate-600 dark:to-zinc-800",
  },
};

const ICONS: Record<DiscoverHomeCategoryId, LucideIcon> = {
  [ALL_HELP_CATEGORY_ID]: LayoutGrid,
  cleaning: Sparkles,
  cooking: UtensilsCrossed,
  pickup_delivery: Truck,
  nanny: Baby,
  other_help: HelpCircle,
};

const TABS: { id: DiscoverHomeCategoryId; label: string; Icon: LucideIcon }[] =
  [
    {
      id: ALL_HELP_CATEGORY_ID,
      label: "All help",
      Icon: ICONS[ALL_HELP_CATEGORY_ID],
    },
    ...SERVICE_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      Icon: ICONS[c.id],
    })),
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
  const index = Math.max(
    0,
    TABS.findIndex((t) => t.id === activeId),
  );

  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : false,
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

  /** Desktop: equal segments. Mobile: active column 2fr, others 1fr → thumb aligns to wider active cell. */
  const thumbStyle = useMemo(() => {
    if (isMdUp) {
      return {
        width: `calc((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n})`,
        left: `calc(0.375rem + ${index} * ((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n} + 0.125rem))`,
      } as const;
    }
    const frTotal = n + 1;
    return {
      left: `calc(0.4375rem + ${index} * (100% - 0.875rem) / ${frTotal})`,
      width: `calc((100% - 0.875rem) * 2 / ${frTotal})`,
    } as const;
  }, [isMdUp, index, n, thumbGapRem, thumbPad]);

  const mobileGridTemplate = useMemo(
    () =>
      TABS.map((_, i) =>
        i === index ? "minmax(0,2fr)" : "minmax(0,1fr)",
      ).join(" "),
    [index],
  );

  const theme = THEMES[activeId] ?? THEMES[ALL_HELP_CATEGORY_ID];

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full px-3 py-3 md:px-5 md:py-4",
          "max-md:px-2 max-md:py-1",
          isMdUp && JOBS_STEPPER_STRIP_BASE,
        )}
      >
        <div className="mx-auto w-full max-w-[min(70rem,calc(100vw-2rem))]">
          <div
            className={cn(
              "relative isolate w-full min-w-0 overflow-hidden rounded-full p-1.5",
              "min-h-[58px] md:min-h-[76px]",
              "transition-[box-shadow,background] duration-300",
              isMdUp
                ? "border border-slate-200/90 bg-slate-100/85 shadow-sm shadow-black/5 dark:border-border/50 dark:bg-zinc-900/55 dark:shadow-black/25"
                : "bg-slate-100/90 border border-slate-200/60 shadow-inner dark:bg-zinc-900/60 dark:border-zinc-800/60",
            )}
            role="tablist"
            aria-label="Availability categories"
          >
            {/* Sliding Thumb */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1.5 bottom-1.5 z-[5] rounded-full",
                "transition-[left,width] duration-300 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
                isMdUp
                  ? cn(
                      "shadow-md shadow-black/15 ring-1 ring-white/25 dark:ring-white/10",
                      theme.pillGradient,
                    )
                  : "bg-white shadow-md ring-1 ring-slate-900/5 dark:bg-zinc-800 dark:ring-white/10 dark:shadow-none",
              )}
              style={thumbStyle}
            >
              {/* Mobile: Subtle category color accent on the solid thumb */}
              {!isMdUp && (
                <div
                  className={cn(
                    "absolute inset-0 rounded-full opacity-[0.14] dark:opacity-[0.22]",
                    theme.pillGradient,
                  )}
                />
              )}
            </div>

            <div
              className={cn(
                "relative z-10 grid h-full w-full gap-0.5",
                isMdUp && "grid-cols-6",
              )}
              style={
                isMdUp ? undefined : { gridTemplateColumns: mobileGridTemplate }
              }
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
                      "max-md:focus-visible:ring-orange-500/30",
                      "md:focus-visible:ring-orange-400/55",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      selected ? "gap-1 max-md:py-1" : "gap-0 max-md:py-2",
                      selected
                        ? isMdUp
                          ? "text-white"
                          : "text-slate-900 dark:text-white"
                        : isMdUp
                          ? "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          : "text-slate-400/90 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-all duration-300 max-md:mx-auto md:h-6 md:w-6",
                        selected && "scale-105",
                        !selected && "opacity-80 grayscale-[0.35]",
                      )}
                      strokeWidth={selected ? 2.5 : 2}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "max-w-full px-0.5 text-center font-bold leading-tight tracking-tight md:text-[11px]",
                        "line-clamp-2 break-words [overflow-wrap:anywhere]",
                        !selected && "max-md:hidden",
                        selected
                          ? "block text-[10px] max-md:min-w-0 max-md:w-full max-md:max-w-none max-md:leading-snug md:text-[11px]"
                          : "text-[10px]",
                      )}
                    >
                      {t.label}
                    </span>
                    {/* Active dot/accent for mobile icons when not selected (optional, keeping it clean for now) */}
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
