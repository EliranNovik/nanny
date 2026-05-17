import { MoreVertical, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  stripMoreBadgeClass,
  stripMoreBtnClass,
  stripShellWidthClass,
} from "@/components/discover/discoverBottomStripShared";

/** Flush with mobile BottomNav (same as Help others strip). */
const stripBottomFlushClass =
  "bottom-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]";

const stripMainActionClass = cn(
  "flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors",
  "active:bg-zinc-100/90 dark:active:bg-white/[0.06]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "dark:focus-visible:ring-indigo-200/40 dark:focus-visible:ring-offset-zinc-950",
);

type Props = {
  onPostRequest: () => void;
  onMoreClick: () => void;
  moreMenuTotal: number;
  moreMenuOpen: boolean;
};

/**
 * Mobile Discover “I need help” (hire): bottom strip above BottomNav — mirrors Help others strip layout.
 */
export function DiscoverHirePostRequestStrip({
  onPostRequest,
  onMoreClick,
  moreMenuTotal,
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
      <div className={stripShellWidthClass}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border-0 px-2.5 py-1.5 pl-3 shadow-none",
            "bg-white text-zinc-900",
            "dark:bg-zinc-900/90 dark:text-zinc-50",
          )}
        >
          <button
            type="button"
            onClick={onPostRequest}
            className={stripMainActionClass}
            aria-label="Post a request — get help from people near you"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
              <Zap className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-black tracking-tight leading-tight">
                Post a request
              </p>
              <p className="truncate text-[14px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400">
                Get help near you
              </p>
            </div>
          </button>
          <div className="relative ml-auto shrink-0">
            <button
              type="button"
              onClick={onMoreClick}
              className={stripMoreBtnClass}
              aria-label="More discover actions"
              aria-expanded={moreMenuOpen}
            >
              <MoreVertical className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            </button>
            {moreMenuTotal > 0 ? (
              <span
                className={stripMoreBadgeClass}
                aria-label={`${moreMenuTotal} updates`}
              >
                {moreMenuTotal > 99 ? "99+" : moreMenuTotal}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
