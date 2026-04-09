import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface JobCardLocationBarProps {
    location: string | null | undefined;
    /** Status badge — aligned to the right, same row as location */
    trailing?: ReactNode;
    className?: string;
}

/** Row above job card — on mobile, transparent with a divider (no tinted top block); on md+, grey bar with city centered and badge on the right. */
export function JobCardLocationBar({ location, trailing, className }: JobCardLocationBarProps) {
    const text = location?.trim() || "Location not set";
    const hasTrailing = trailing != null && trailing !== false;
    return (
        <div
            className={cn(
                "relative z-[110] flex min-h-0 shrink-0 items-center px-3 py-2.5 sm:px-4 md:py-3.5 md:px-5",
                /* Mobile (jobs tab cards): no filled strip — only a light divider */
                "max-md:border-b max-md:border-slate-200/45 max-md:bg-transparent dark:max-md:border-white/10",
                /* Desktop: grey bar as before */
                "md:border-b md:border-slate-200/90 md:bg-slate-100 md:shadow-none dark:md:border-white/10 dark:md:bg-zinc-800/95",
                className
            )}
        >
            {/* With badge: thumb-width column on mobile; without badge: full-width centered */}
            <div
                className={cn(
                    "flex min-w-0 justify-center",
                    hasTrailing
                        ? "w-[5.25rem] shrink-0 md:absolute md:inset-x-0 md:w-auto md:justify-center md:px-20"
                        : "w-full flex-1 md:absolute md:inset-x-0 md:px-5"
                )}
            >
                <span className="max-w-full truncate text-center text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100 md:text-[15px] md:font-bold md:tracking-normal">
                    {text}
                </span>
            </div>
            {hasTrailing && (
                <div
                    className={cn(
                        "flex min-w-0 flex-1 justify-end md:absolute md:right-4 md:top-1/2 md:z-10 md:w-auto md:-translate-y-1/2 md:justify-end",
                        /* Scale status badges on desktop (direct child Badge) */
                        "[&>*]:md:min-h-[2.25rem] [&>*]:md:px-4 [&>*]:md:text-[11px] [&>*]:md:leading-tight"
                    )}
                >
                    {trailing}
                </div>
            )}
        </div>
    );
}
