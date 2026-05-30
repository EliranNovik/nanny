import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscoverMobileStripPill } from "@/components/discover/DiscoverMobileStripPill";

type Props = {
  onPostRequest: () => void;
  onMoreClick: () => void;
  moreMenuTotal: number;
  moreMenuOpen: boolean;
};

/**
 * Mobile Discover “I need help” (hire): combined icon pill on the right edge.
 */
export function DiscoverHirePostRequestStrip({
  onPostRequest,
  onMoreClick,
  moreMenuTotal,
  moreMenuOpen,
}: Props) {
  return (
    <DiscoverMobileStripPill
      mainIcon={<Zap className="h-7 w-7" strokeWidth={2.5} aria-hidden />}
      mainLabel="Post a request — get help from people near you"
      onMainClick={onPostRequest}
      mainAccentClass={cn(
        "text-indigo-700 focus-visible:ring-indigo-400/50",
        "dark:text-indigo-200 dark:focus-visible:ring-indigo-200/40",
      )}
      onMoreClick={onMoreClick}
      moreMenuTotal={moreMenuTotal}
      moreMenuOpen={moreMenuOpen}
    />
  );
}
