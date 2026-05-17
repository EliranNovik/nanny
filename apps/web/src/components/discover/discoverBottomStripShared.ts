import { cn } from "@/lib/utils";

export const stripShellWidthClass = "mx-auto w-full max-w-[20rem]";

export const stripMoreBtnClass = cn(
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-600 shadow-none transition-colors active:scale-[0.96]",
  "hover:bg-zinc-100/90 dark:text-zinc-300 dark:hover:bg-white/10",
  "focus-visible:outline-none focus-visible:ring-0",
);

/** Count badge anchored to top-right of the ⋮ control. */
export const stripMoreBadgeClass = cn(
  "pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5",
  "text-[11px] font-black tabular-nums leading-none text-white bg-red-500 shadow-md",
  "border-2 border-white dark:border-zinc-900",
);
