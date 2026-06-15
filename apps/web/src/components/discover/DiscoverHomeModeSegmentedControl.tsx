import { HeartHandshake, HelpingHand } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DISCOVER_STROKE } from "@/components/discover/discoverHomeIcons";
import type { DiscoverHomeIntent } from "@/lib/discoverHomeIntent";

type Props = {
  mode: DiscoverHomeIntent;
  onModeChange: (mode: DiscoverHomeIntent) => void;
  /** Mobile strip under status bar vs compact desktop header chip */
  variant: "page" | "header";
  className?: string;
};

const PAGE_TRACK_PAD_REM = 0.25;
const PAGE_TRACK_GAP_REM = 0.125;

function pageThumbStyle(mode: DiscoverHomeIntent) {
  const index = mode === "hire" ? 0 : 1;
  const segmentWidth = `calc((100% - ${PAGE_TRACK_PAD_REM * 2}rem - ${PAGE_TRACK_GAP_REM}rem) / 2)`;
  const segmentStep = `calc(${segmentWidth} + ${PAGE_TRACK_GAP_REM}rem)`;

  return {
    width: segmentWidth,
    left: `calc(${PAGE_TRACK_PAD_REM}rem + ${index} * ${segmentStep})`,
  } as const;
}

export function DiscoverHomeModeSegmentedControl({
  mode,
  onModeChange,
  variant,
  className,
}: Props) {
  const { t } = useTranslation();
  const isHeader = variant === "header";
  const pageThumb = useMemo(() => pageThumbStyle(mode), [mode]);

  const tabButtonClass = (selected: boolean, accent: "hire" | "work") =>
    cn(
      "relative z-10 flex min-w-0 items-center justify-center rounded-full transition-[color,transform] duration-300 ease-out",
      "[-webkit-tap-highlight-color:transparent]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
      accent === "hire"
        ? "focus-visible:ring-orange-500/35"
        : "focus-visible:ring-emerald-500/35",
      "active:scale-[0.98] motion-reduce:transition-none",
      isHeader
        ? "min-h-[44px] gap-2.5 px-5 py-2"
        : "min-h-[44px] gap-2 px-2.5 py-2 sm:min-h-[46px] sm:px-3",
      selected
        ? isHeader
          ? "text-white"
          : cn(
              "font-bold text-white",
            )
        : isHeader
          ? "bg-transparent text-neutral-900 hover:bg-slate-200/55 dark:text-zinc-100 dark:hover:bg-zinc-800/55"
          : "font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300",
    );

  const iconClass = (selected: boolean) =>
    cn(
      "shrink-0 transition-all duration-300",
      isHeader
        ? "h-5 w-5"
        : "h-6 w-6 sm:h-[1.375rem] sm:w-[1.375rem]",
      selected
        ? isHeader
          ? "text-white"
          : "text-white"
        : isHeader
          ? "text-slate-400 dark:text-zinc-500"
          : "text-zinc-400 opacity-80 dark:text-zinc-500",
      selected && !isHeader && "scale-105",
    );

  const labelClass = (selected: boolean) =>
    cn(
      "min-w-0 leading-tight tracking-tight",
      isHeader
        ? cn("text-sm font-semibold", selected ? "text-white dark:text-zinc-100" : "text-neutral-900 dark:text-zinc-100")
        : cn(
            "text-[13.5px] sm:text-sm",
            selected ? "font-bold" : "font-semibold",
          ),
    );

  return (
    <div
      role="tablist"
      aria-label={t("discover.whatAreYouHereFor")}
      className={cn(className)}
    >
      <div
        className={cn(
          "relative isolate grid w-full grid-cols-2 items-stretch leading-none",
          isHeader
            ? cn(
                "min-h-[48px] w-full max-w-[32rem] gap-0.5 overflow-hidden rounded-full p-1",
                "bg-slate-100/80 shadow-none dark:bg-zinc-900",
              )
            : cn(
                "mx-auto w-full min-h-[50px] max-w-[min(24rem,calc(100vw-2rem))] gap-0.5 overflow-hidden rounded-full p-1",
                "border-0 bg-zinc-100/90 shadow-none",
                "dark:bg-zinc-900/70",
                "sm:min-h-[52px] sm:max-w-[26rem]",
              ),
        )}
      >
        {!isHeader ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1 bottom-1 z-[5] rounded-full",
              "shadow-md transition-[left,width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
              "dark:shadow-none",
              mode === "hire"
                ? "bg-gradient-to-br from-orange-400 via-orange-600 to-orange-900 dark:from-orange-300 dark:via-orange-500 dark:to-orange-800"
                : "bg-gradient-to-br from-emerald-300 via-emerald-600 to-emerald-900 dark:from-emerald-400 dark:via-emerald-600 dark:to-emerald-800",
            )}
            style={pageThumb}
          />
        ) : null}

        <button
          type="button"
          role="tab"
          aria-selected={mode === "hire"}
          aria-label={mode === "hire" ? undefined : t("discover.getHelpNow")}
          onClick={() => onModeChange("hire")}
          className={cn(
            tabButtonClass(mode === "hire", "hire"),
            isHeader &&
              mode === "hire" &&
              "bg-gradient-to-br from-orange-400 via-orange-600 to-orange-900 shadow-sm dark:from-orange-300 dark:via-orange-500 dark:to-orange-800",
          )}
        >
          <HeartHandshake
            className={iconClass(mode === "hire")}
            strokeWidth={mode === "hire" ? 2.5 : DISCOVER_STROKE}
            aria-hidden
          />
          <span className={labelClass(mode === "hire")}>{t("discover.getHelpNow")}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "work"}
          aria-label={mode === "work" ? undefined : t("discover.helpOthersNow")}
          onClick={() => onModeChange("work")}
          className={cn(
            tabButtonClass(mode === "work", "work"),
            isHeader &&
              mode === "work" &&
              "bg-gradient-to-br from-emerald-300 via-emerald-600 to-emerald-900 shadow-sm dark:from-emerald-400 dark:via-emerald-600 dark:to-emerald-800",
          )}
        >
          <HelpingHand
            className={iconClass(mode === "work")}
            strokeWidth={mode === "work" ? 2.5 : DISCOVER_STROKE}
            aria-hidden
          />
          <span className={labelClass(mode === "work")}>{t("discover.helpOthersNow")}</span>
        </button>
      </div>
    </div>
  );
}
