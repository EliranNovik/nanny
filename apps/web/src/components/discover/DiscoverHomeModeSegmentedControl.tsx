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
          "border border-slate-300/80 bg-slate-100 shadow-none",
          "dark:border-zinc-700/85 dark:bg-zinc-900",
          "ring-1 ring-inset ring-white/70 dark:ring-inset dark:ring-white/[0.07]",
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-1px_0_rgba(15,23,42,0.06)]",
          "dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.45)]",
          isHeader
            ? "min-h-[44px] max-w-[19rem] gap-0.5 p-1"
            : cn(
                "mx-auto min-h-[50px] max-w-[26rem] sm:max-w-[28rem] sm:min-h-[58px]",
                "md:max-w-[19rem] md:min-h-[48px] md:gap-0.5 md:p-1",
              ),
        )}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "hire"}
          aria-label={mode === "hire" ? undefined : "I need help"}
          onClick={() => onModeChange("hire")}
          className={cn(
            "relative z-10 flex h-full w-full min-w-0 items-center justify-center gap-2 rounded-full px-2 py-2 transition-[color,transform,box-shadow,background-color] duration-300 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "active:scale-[0.98] motion-reduce:transition-none",
            isHeader
              ? "min-h-[40px] gap-1.5 px-2.5 py-1.5"
              : "min-h-[46px] sm:min-h-[54px] sm:px-3 md:min-h-[40px] md:gap-1.5 md:px-2.5 md:py-1.5",
            mode === "hire"
              ? cn(
                  "bg-white text-neutral-900 shadow-none",
                  "ring-1 ring-inset ring-slate-200/90 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600/75",
                  "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(15,23,42,0.04)]",
                  "dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.35)]",
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
                : "sm:h-6 sm:w-6 md:h-[1.05rem] md:w-[1.05rem]",
              mode === "hire"
                ? "text-[#7B61FF]"
                : "text-slate-400 dark:text-zinc-500",
            )}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 font-semibold leading-tight tracking-tight text-neutral-900 dark:text-zinc-100",
              isHeader
                ? "text-[13px]"
                : "text-[14px] sm:text-[16px] md:text-[13px]",
            )}
          >
            I need help
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "work"}
          aria-label={mode === "work" ? undefined : "Help others"}
          onClick={() => onModeChange("work")}
          className={cn(
            "relative z-10 flex h-full w-full min-w-0 items-center justify-center gap-2 rounded-full px-2 py-2 transition-[color,transform,box-shadow,background-color] duration-300 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "active:scale-[0.98] motion-reduce:transition-none",
            isHeader
              ? "min-h-[40px] gap-1.5 px-2.5 py-1.5"
              : "min-h-[46px] sm:min-h-[54px] sm:px-3 md:min-h-[40px] md:gap-1.5 md:px-2.5 md:py-1.5",
            mode === "work"
              ? cn(
                  "bg-white text-neutral-900 shadow-none",
                  "ring-1 ring-inset ring-slate-200/90 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600/75",
                  "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(15,23,42,0.04)]",
                  "dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.35)]",
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
                : "sm:h-6 sm:w-6 md:h-[1.05rem] md:w-[1.05rem]",
              mode === "work"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-400 dark:text-zinc-500",
            )}
            strokeWidth={DISCOVER_STROKE}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 font-semibold leading-tight tracking-tight text-neutral-900 dark:text-zinc-100",
              isHeader
                ? "text-[13px]"
                : "text-[14px] sm:text-[16px] md:text-[13px]",
            )}
          >
            Help others
          </span>
        </button>
      </div>
    </div>
  );
}
