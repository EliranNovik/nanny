import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

type Props = {
  category: string;
  location: string;
  time: string;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
  className?: string;
};

export function MatchContextBanner({
  category,
  location,
  time,
  onAccept,
  onDecline,
  busy,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 to-amber-50/80 p-4 shadow-sm dark:border-orange-900/50 dark:from-orange-950/40 dark:to-amber-950/20",
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-orange-800/80 dark:text-orange-300/90">
        Match context
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {category}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {location} · {time}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 gap-1.5 font-bold"
          disabled={busy}
          onClick={onAccept}
        >
          <Check className="h-4 w-4" />
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5 font-bold"
          disabled={busy}
          onClick={onDecline}
        >
          <X className="h-4 w-4" />
          Decline
        </Button>
      </div>
    </div>
  );
}
