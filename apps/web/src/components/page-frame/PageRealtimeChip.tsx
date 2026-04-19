import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

type Props = {
  label: string;
  value: string | number;
  className?: string;
  /** When true, show subtle pulse dot */
  live?: boolean;
};

/** Compact real-time signal for headers (counts, status). */
export function PageRealtimeChip({
  label,
  value,
  className,
  live = true,
}: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm",
        className,
      )}
    >
      {live ? (
        <Radio
          className="h-3.5 w-3.5 shrink-0 text-emerald-500"
          aria-hidden
        />
      ) : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
