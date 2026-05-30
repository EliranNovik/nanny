import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  stripFabPillClass,
  stripFabPillClusterClass,
  stripFabPillDividerClass,
  stripFabPillIconBtnClass,
  stripFabPillMainBtnClass,
  stripMoreBadgeClass,
} from "@/components/discover/discoverBottomStripShared";

type Props = {
  mainIcon: ReactNode;
  mainLabel: string;
  onMainClick?: () => void;
  mainAccentClass?: string;
  mainDisabled?: boolean;
  onMoreClick?: () => void;
  moreMenuTotal?: number;
  moreMenuOpen?: boolean;
  /** Extra content between main action and ⋮ (e.g. live timer). */
  middleSlot?: ReactNode;
};

/**
 * Single floating pill: primary icon + optional middle slot + ⋮ menu.
 */
export function DiscoverMobileStripPill({
  mainIcon,
  mainLabel,
  onMainClick,
  mainAccentClass,
  mainDisabled = false,
  onMoreClick,
  moreMenuTotal = 0,
  moreMenuOpen = false,
  middleSlot,
}: Props) {
  const mainIsButton = onMainClick != null && !mainDisabled;
  const hasMore = onMoreClick != null;

  return (
    <div className={stripFabPillClusterClass}>
      <div className={stripFabPillClass}>
        {mainIsButton ? (
          <button
            type="button"
            onClick={onMainClick}
            className={cn(
              stripFabPillMainBtnClass,
              !middleSlot && !hasMore && "rounded-full",
              mainAccentClass,
            )}
            aria-label={mainLabel}
          >
            {mainIcon}
          </button>
        ) : (
          <div
            className={cn(
              stripFabPillMainBtnClass,
              !middleSlot && !hasMore && "rounded-full",
              "pointer-events-none",
              mainAccentClass,
            )}
            aria-label={mainLabel}
          >
            {mainIcon}
          </div>
        )}

        {middleSlot ? (
          <>
            <div className={stripFabPillDividerClass} aria-hidden />
            {middleSlot}
          </>
        ) : null}

        {hasMore ? (
          <>
            <div className={stripFabPillDividerClass} aria-hidden />
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={onMoreClick}
                className={stripFabPillIconBtnClass}
                aria-label="More discover actions"
                aria-expanded={moreMenuOpen}
              >
                <MoreVertical className="h-7 w-7" strokeWidth={2.5} aria-hidden />
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
          </>
        ) : null}
      </div>
    </div>
  );
}
