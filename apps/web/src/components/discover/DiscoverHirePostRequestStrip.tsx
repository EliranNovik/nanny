import { MoreVertical, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Flush with mobile BottomNav (same as Help others strip). */
const stripBottomFlushClass =
  "bottom-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]";

const stripPostRequestFabClass = cn(
  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-[0.96]",
  "motion-safe:animate-dock-primary-breathe bg-gradient-to-br from-indigo-600 to-violet-700 shadow-indigo-950/40",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "dark:focus-visible:ring-indigo-200/40 dark:focus-visible:ring-offset-zinc-950",
);

const stripMoreBtnClass = cn(
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-600 shadow-none transition-colors active:scale-[0.96]",
  "hover:bg-zinc-100/90 dark:text-zinc-300 dark:hover:bg-white/10",
  "focus-visible:outline-none focus-visible:ring-0",
);

type Props = {
  onPostRequest: () => void;
  onMoreClick: () => void;
  moreMenuOpen: boolean;
};

/**
 * Mobile Discover “I need help” (hire): bottom strip above BottomNav — mirrors Help others strip layout.
 */
export function DiscoverHirePostRequestStrip({
  onPostRequest,
  onMoreClick,
  moreMenuOpen,
}: Props) {
  return (
    <div
      className={cn(
        "md:hidden pointer-events-auto fixed inset-x-0 z-[125]",
        stripBottomFlushClass,
        "px-3",
      )}
    >
      <div className="mx-auto max-w-lg">
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 pl-3 shadow-md",
            "border-zinc-200 bg-white text-zinc-900",
            "dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-50 dark:shadow-lg",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
              <Zap className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black tracking-tight leading-tight">
                Post a request
              </p>
              <p className="truncate text-[12px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400">
                Get help from people near you
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onPostRequest}
              className={stripPostRequestFabClass}
              aria-label="Request help now"
            >
              <Zap className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onMoreClick}
              className={stripMoreBtnClass}
              aria-label="More discover actions"
              aria-expanded={moreMenuOpen}
            >
              <MoreVertical className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
