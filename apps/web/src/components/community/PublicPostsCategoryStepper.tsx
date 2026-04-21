import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type Theme = {
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

/** Desktop: full-width segmented bar with gradient thumb. Mobile: Stripe/iOS single-track + sliding white indicator. */
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

  /** Mobile segmented: scrollport + thumb position (viewport-relative px) */
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [mobileThumb, setMobileThumb] = useState({ left: 0, width: 0 });
  const [mobileThumbVisible, setMobileThumbVisible] = useState(false);

  const measureMobileThumb = useCallback(() => {
    const sc = mobileScrollRef.current;
    const btn = mobileBtnRefs.current[index];
    if (!sc || !btn) {
      setMobileThumbVisible(false);
      return;
    }
    // Anchor the thumb to the scroll content (not viewport-relative).
    // That way it moves with the pills while you drag-scroll.
    const left = btn.offsetLeft;
    const width = btn.offsetWidth;
    setMobileThumb({ left, width });
    setMobileThumbVisible(true);
  }, [index]);

  const ensureActiveVisible = useCallback(() => {
    const sc = mobileScrollRef.current;
    const btn = mobileBtnRefs.current[index];
    if (!sc || !btn) return;
    // Minimal, predictable scroll adjustment (no centering).
    // scrollIntoView inline:"nearest" avoids the "random jump" feeling.
    btn.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [index]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsMdUp(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    if (isMdUp) return;
    measureMobileThumb();
  }, [isMdUp, measureMobileThumb, activeId]);

  useEffect(() => {
    if (isMdUp) return;
    const sc = mobileScrollRef.current;
    if (!sc) return;
    const btn = mobileBtnRefs.current[index];
    const ro = new ResizeObserver(() => measureMobileThumb());
    ro.observe(sc);
    if (btn) ro.observe(btn);
    window.addEventListener("resize", measureMobileThumb);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureMobileThumb);
    };
  }, [isMdUp, measureMobileThumb, index]);

  useEffect(() => {
    if (isMdUp) return;
    // Keep it predictable: bring active into view (nearest) and re-measure
    // after scroll starts so the thumb doesn't end up offscreen.
    const t = window.setTimeout(() => measureMobileThumb(), 260);
    requestAnimationFrame(() => {
      ensureActiveVisible();
      measureMobileThumb();
    });
    return () => window.clearTimeout(t);
  }, [activeId, index, isMdUp, ensureActiveVisible, measureMobileThumb]);

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
          className="w-full px-3 py-1 md:px-5 md:py-3"
          role="tablist"
          aria-label="Availability categories"
        >
          <div className="mx-auto w-full max-w-[min(70rem,calc(100vw-2rem))]">
            <div
              ref={mobileScrollRef}
              className={cn(
                "relative max-w-full overflow-x-auto overscroll-x-contain rounded-full",
                "border border-border/50 bg-muted/50 p-1",
                "dark:border-zinc-700/70 dark:bg-zinc-900/75",
                "snap-x snap-mandatory scroll-pl-1 scroll-pr-1 [-webkit-overflow-scrolling:touch]",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              )}
            >
              {/* Single sliding surface — only primary state; no per-segment borders */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1 bottom-1 z-0 rounded-full",
                  "bg-background shadow-sm ring-1 ring-black/[0.07] overflow-hidden",
                  "transition-[left,width,opacity] duration-300 [transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
                  "dark:bg-zinc-950 dark:ring-white/[0.08]",
                  !mobileThumbVisible && "opacity-0",
                )}
                style={{
                  left: mobileThumb.left,
                  width: mobileThumb.width,
                }}
              >
                {/* Subtle category tint so active state is clearly “colored”, not just white. */}
                <div
                  className={cn(
                    "absolute inset-0 opacity-[0.12] dark:opacity-[0.16]",
                    theme.pillGradient,
                  )}
                />
              </div>
              <div className="relative z-10 flex w-max min-w-0 items-stretch gap-0">
                {TABS.map((t, i) => {
                  const selected = t.id === activeId;
                  const Icon = t.Icon;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        mobileBtnRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={t.label}
                      title={t.label}
                      onClick={() => onSelect(t.id)}
                      className={cn(
                        "inline-flex h-9 min-h-9 max-h-10 shrink-0 snap-center items-center gap-1.5 rounded-full px-2.5 sm:px-3",
                        "whitespace-nowrap text-left text-[13px] [-webkit-tap-highlight-color:transparent]",
                        "transition-colors duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "active:opacity-90",
                        selected
                          ? "font-semibold text-foreground"
                          : "font-medium text-muted-foreground hover:text-foreground/90",
                      )}
                    >
                      <Icon
                        className={cn(
                          "shrink-0 transition-[width,height,opacity] duration-200",
                          selected
                            ? "h-4 w-4 text-foreground"
                            : "h-3.5 w-3.5 text-muted-foreground/70",
                        )}
                        strokeWidth={selected ? 2.25 : 2}
                        aria-hidden
                      />
                      <span>{t.label}</span>
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

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full px-3 py-2 md:px-5 md:py-3",
        )}
      >
        <div className="mx-auto w-full max-w-[min(70rem,calc(100vw-2rem))]">
          <div
            className={cn(
              "relative isolate w-full min-w-0 overflow-hidden rounded-full p-1.5",
              "min-h-[60px]",
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
                        "h-5 w-5 shrink-0 transition-all duration-300",
                        selected && "scale-105",
                        !selected && "opacity-90 grayscale-[0.2]",
                      )}
                      strokeWidth={selected ? 2.5 : 2}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "max-w-full px-0.5 text-center text-[10px] font-bold leading-tight tracking-tight",
                        "line-clamp-1 break-words [overflow-wrap:anywhere]",
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
