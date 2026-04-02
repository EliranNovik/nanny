import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatHms(remainingMs: number): string {
  if (remainingMs <= 0) return "00:00:00";
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ExpiryCountdownProps = {
  expiresAtIso: string;
  className?: string;
  endedLabel?: string;
  /** Only the countdown (or ended text); no icon/label — for tight headers. */
  compact?: boolean;
};

/**
 * Live countdown until expiry — label + monospace time.
 */
export function ExpiryCountdown({
  expiresAtIso,
  className,
  endedLabel = "Listing ended",
  compact = false,
}: ExpiryCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const end = new Date(expiresAtIso).getTime();
  const remaining = end - now;

  if (Number.isNaN(end)) {
    return <span className={cn(className)}>—</span>;
  }

  if (remaining <= 0) {
    return (
      <span className={cn("text-xs font-medium text-muted-foreground", className)} title="Expired">
        {endedLabel}
      </span>
    );
  }

  if (compact) {
    return (
      <span
        className={cn("font-mono tabular-nums text-sm font-semibold tracking-tight", className)}
        title="Time remaining until this listing is removed"
      >
        {formatHms(remaining)}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm text-foreground", className)}
      title="Time remaining until this listing is removed"
    >
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium text-muted-foreground">Time left</span>
      <span className="font-mono tabular-nums font-semibold tracking-tight">{formatHms(remaining)}</span>
    </span>
  );
}
