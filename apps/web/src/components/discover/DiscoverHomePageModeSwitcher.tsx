import { DiscoverHomeModeSegmentedControl } from "@/components/discover/DiscoverHomeModeSegmentedControl";
import type { DiscoverHomeIntent } from "@/lib/discoverHomeIntent";
import { cn } from "@/lib/utils";

type Props = {
  mode: DiscoverHomeIntent;
  onModeChange: (mode: DiscoverHomeIntent) => void;
  className?: string;
};

export function DiscoverHomePageModeSwitcher({
  mode,
  onModeChange,
  className,
}: Props) {
  return (
    <div className={cn("px-4 pb-2.5 pt-3 md:hidden", className)}>
      <DiscoverHomeModeSegmentedControl
        mode={mode}
        onModeChange={onModeChange}
        variant="page"
      />
    </div>
  );
}
