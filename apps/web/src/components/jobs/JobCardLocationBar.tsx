import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface JobCardLocationBarProps {
    location: string | null | undefined;
    /** Status badge — aligned to the right, same row as location */
    trailing?: ReactNode;
    className?: string;
}

/**
 * Top row on job cards: city + optional status badge.
 * Transparent strip + bottom divider only (no grey fill on desktop). Badge stays in normal flex flow so it stays inside the card.
 */
export function JobCardLocationBar({ location, trailing, className }: JobCardLocationBarProps) {
    const text = location?.trim() || "Location not set";
    const hasTrailing = trailing != null && trailing !== false;
    return (
        <div
            className={cn(
                "relative flex min-h-0 shrink-0 items-center gap-2 border-b border-slate-200/45 bg-transparent px-3 py-2.5 dark:border-white/10 sm:px-4 md:px-5 md:py-3",
                className
            )}
        >
            <div
                className={cn(
                    "flex min-w-0 items-center",
                    hasTrailing
                        ? "w-[5.25rem] shrink-0 justify-center md:w-auto md:min-w-0 md:flex-1 md:justify-start"
                        : "w-full flex-1 justify-center"
                )}
            >
                <span className="max-w-full truncate text-center text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100 md:text-left md:text-[15px] md:font-bold md:tracking-normal">
                    {text}
                </span>
            </div>
            {hasTrailing && (
                <div className="flex min-w-0 shrink-0 items-center justify-end self-center pl-1">{trailing}</div>
            )}
        </div>
    );
}
