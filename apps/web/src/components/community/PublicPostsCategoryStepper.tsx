import { useEffect, useMemo, useRef, useState } from "react";
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

/** Desktop: full-width segmented bar. Mobile: horizontal scroll chips (no squeezed labels). */
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

  const activeMobileBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsMdUp(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isMdUp) return;
    const el = activeMobileBtnRef.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeId, isMdUp]);

  const thumbGapRem = (n - 1) * 0.125;
  const thumbPad = 0.75;

  const thumbStyle = useMemo(() => {
    return {
      width: `calc((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n})`,
      left: `calc(0.375rem + ${index} * ((100% - ${thumbPad}rem - ${thumbGapRem}rem) / ${n} + 0.125rem))`,
    } as const;
  }, [index, n, thumbGapRem, thumbPad]);

  const theme = THEMES[activeId] ?? THEMES[ALL_HELP_CATEGORY_ID];

  if (!isMdUp) {
    return (
      <div className={cn("w-full", className)}>
        <div
          className="w-full px-3 py-1.5 md:px-5 md:py-4"
          role="tablist"
          aria-label="Availability categories"
        >
          <div className="mx-auto w-full max-w-[min(70rem,calc(100vw-2rem))]">
            <div
              className={cn(
                "flex w-full gap-2 overflow-x-auto overscroll-x-contain py-1",
                "scroll-pl-3 scroll-pr-3 [-webkit-overflow-scrolling:touch]",
                "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5",
                "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80",
                "dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600",
              )}
            >
              {TABS.map((t) => {
                const selected = t.id === activeId;
                const Icon = t.Icon;
                const tabTheme = THEMES[t.id] ?? THEMES[ALL_HELP_CATEGORY_ID];
                return (
                  <button
                    key={t.id}
                    ref={selected ? activeMobileBtnRef : undefined}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2.5",
                      "min-h-[44px] text-left text-sm font-semibold tracking-tight",
                      "whitespace-nowrap [-webkit-tap-highlight-color:transparent]",
                      "transition-[box-shadow,transform,background-color,border-color,color] duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
                      selected
                        ? cn(
                            "border-transparent bg-white text-slate-900 shadow-md shadow-black/10 ring-1 ring-slate-900/10",
                            "dark:bg-zinc-800 dark:text-white dark:shadow-black/40 dark:ring-white/10",
                          )
                        : cn(
                            "border-slate-200/90 bg-white/70 text-slate-600 shadow-sm",
                            "hover:border-slate-300 hover:bg-white hover:text-slate-800",
                            "dark:border-zinc-700/90 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                          ),
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        selected
                          ? cn("text-white shadow-inner", tabTheme.pillGradient)
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    </span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full px-3 py-3 md:px-5 md:py-4",
          JOBS_STEPPER_STRIP_BASE,
        )}
      >
        <div className="mx-auto w-full max-w-[min(70rem,calc(100vw-2rem))]">
          <div
            className={cn(
              "relative isolate w-full min-w-0 overflow-hidden rounded-full p-2",
              "min-h-[80px]",
              "border border-slate-200/90 bg-slate-100/85 shadow-sm shadow-black/5 transition-[box-shadow,background] duration-300 dark:border-border/50 dark:bg-zinc-900/55 dark:shadow-black/25",
            )}
            role="tablist"
            aria-label="Availability categories"
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1.5 bottom-1.5 z-[5] rounded-full",
                "shadow-md shadow-black/15 ring-1 ring-white/25 transition-[left,width] duration-300 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)] dark:ring-white/10",
                theme.pillGradient,
              )}
              style={thumbStyle}
            />

            <div className="relative z-10 grid h-full w-full grid-cols-6 gap-0.5">
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
                      "relative z-10 flex min-w-0 flex-col items-center justify-center rounded-full px-1 py-1 md:gap-0.5",
                      "bg-transparent [-webkit-tap-highlight-color:transparent]",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset md:focus-visible:ring-orange-400/55",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      selected ? "gap-1" : "gap-0",
                      selected
                        ? "text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6 shrink-0 transition-all duration-300",
                        selected && "scale-105",
                        !selected && "opacity-90 grayscale-[0.2]",
                      )}
                      strokeWidth={selected ? 2.5 : 2}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "max-w-full px-0.5 text-center text-[11px] font-bold leading-tight tracking-tight",
                        "line-clamp-2 break-words [overflow-wrap:anywhere]",
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
