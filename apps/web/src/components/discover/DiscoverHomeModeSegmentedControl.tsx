import { HeartHandshake, HelpingHand } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import type { DiscoverHomeIntent } from "@/lib/discoverHomeIntent";

type Props = {
  mode: DiscoverHomeIntent;
  onModeChange: (mode: DiscoverHomeIntent) => void;
  /** Mobile strip under status bar vs compact desktop header chip */
  variant: "page" | "header";
  className?: string;
};

export function DiscoverHomeModeSegmentedControl({
  mode,
  onModeChange,
  variant,
  className,
}: Props) {
  const isHeader = variant === "header";

  return (
    <div
      role="tablist"
      aria-label="What are you here for?"
      className={cn(className)}
    >
      <div
        className={cn(
          "relative isolate grid w-full grid-cols-2 items-stretch gap-1 overflow-hidden rounded-full p-1.5 leading-none",
          "bg-slate-100/80 shadow-none",
          "dark:bg-zinc-900",
          isHeader
            ? "min-h-[44px] max-w-[19rem] gap-0.5 p-1"
            : cn(
                "mx-auto min-h-[60px] max-w-[26rem] sm:max-w-[28rem] sm:min-h-[64px]",
                "md:max-w-[19rem] md:min-h-[48px] md:gap-0.5 md:p-1",
              ),
        )}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "hire"}
          aria-label={mode === "hire" ? undefined : "Get help now"}
          onClick={() => onModeChange("hire")}
          className={cn(
            "relative z-10 flex h-full w-full min-w-0 items-center justify-center gap-2 rounded-full px-2 py-2 transition-[color,transform,box-shadow,background-color] duration-300 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "active:scale-[0.98] motion-reduce:transition-none",
            isHeader
              ? "min-h-[40px] gap-1.5 px-2.5 py-1.5"
              : "min-h-[52px] sm:min-h-[60px] sm:px-4 md:min-h-[40px] md:gap-1.5 md:px-2.5 md:py-1.5",
            mode === "hire"
              ? cn(
                  "bg-[#7B61FF] text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100",
                )
              : "bg-transparent text-neutral-900 hover:bg-slate-200/55 dark:hover:bg-zinc-800/55",
          )}
        >
          <HeartHandshake
            className={cn(
              discoverIcon.md,
              "shrink-0 transition-colors duration-300",
              isHeader
                ? "h-[1.05rem] w-[1.05rem]"
                : "h-7 w-7 sm:h-[1.85rem] sm:w-[1.85rem] md:h-[1.05rem] md:w-[1.05rem]",
              mode === "hire"
                ? "text-white dark:text-[#7B61FF]"
                : "text-slate-400 dark:text-zinc-500",
            )}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 font-semibold leading-tight tracking-tight",
              mode === "hire" ? "text-white dark:text-zinc-100" : "text-neutral-900 dark:text-zinc-100",
              isHeader
                ? "text-[13px]"
                : "text-[16px] sm:text-[18px] md:text-[13px]",
            )}
          >
            Get help now
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "work"}
          aria-label={mode === "work" ? undefined : "Help others now"}
          onClick={() => onModeChange("work")}
          className={cn(
            "relative z-10 flex h-full w-full min-w-0 items-center justify-center gap-2 rounded-full px-2 py-2 transition-[color,transform,box-shadow,background-color] duration-300 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "active:scale-[0.98] motion-reduce:transition-none",
            isHeader
              ? "min-h-[40px] gap-1.5 px-2.5 py-1.5"
              : "min-h-[52px] sm:min-h-[60px] sm:px-4 md:min-h-[40px] md:gap-1.5 md:px-2.5 md:py-1.5",
            mode === "work"
              ? cn(
                  "bg-emerald-600 text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100",
                )
              : "bg-transparent text-neutral-900 hover:bg-slate-200/55 dark:hover:bg-zinc-800/55",
          )}
        >
          <HelpingHand
            className={cn(
              discoverIcon.md,
              "shrink-0 transition-colors duration-300",
              isHeader
                ? "h-[1.05rem] w-[1.05rem]"
                : "h-7 w-7 sm:h-[1.85rem] sm:w-[1.85rem] md:h-[1.05rem] md:w-[1.05rem]",
              mode === "work"
                ? "text-white dark:text-emerald-400"
                : "text-slate-400 dark:text-zinc-500",
            )}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 font-semibold leading-tight tracking-tight",
              mode === "work" ? "text-white dark:text-zinc-100" : "text-neutral-900 dark:text-zinc-100",
              isHeader
                ? "text-[13px]"
                : "text-[16px] sm:text-[18px] md:text-[13px]",
            )}
          >
            Help others now
          </span>
        </button>
      </div>
    </div>
  );
}
