import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
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
  variant: _variant,
  className,
}: Props) {
  const { t } = useTranslation();

  const getLabel = (m: "hire" | "work") => {
    const key = m === "hire" ? "explore.getHelpQuestion" : "explore.helpOthersQuestion";
    return t(key).replace(/\?|\s\?/g, "").trim();
  };

  const currentLabel = getLabel(mode);

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <Switch
        checked={mode === "work"}
        onCheckedChange={(checked) => {
          onModeChange(checked ? "work" : "hire");
        }}
        className={cn(
          "h-6 w-11 transition-colors shadow-sm shrink-0",
          "data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500",
          "data-[state=unchecked]:bg-orange-600 dark:data-[state=unchecked]:bg-orange-500"
        )}
      />
      <span className="text-[13.5px] md:text-[14px] font-black text-slate-900 dark:text-zinc-100 transition-colors leading-none min-w-[5.5rem] md:min-w-[6rem] text-left">
        {currentLabel}
      </span>
    </div>
  );
}
