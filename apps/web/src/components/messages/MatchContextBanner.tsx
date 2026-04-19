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

/** Match decision card — minimal SaaS; actions stay visible */
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
        "rounded-xl border border-border/80 bg-muted/30 p-3 shadow-none dark:bg-muted/15",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        New match
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
        {category}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {location} · {time}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 flex-1 font-semibold"
          disabled={busy}
          onClick={onAccept}
        >
          <Check className="mr-1.5 h-4 w-4" />
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 flex-1 font-semibold"
          disabled={busy}
          onClick={onDecline}
        >
          <X className="mr-1.5 h-4 w-4" />
          Decline
        </Button>
      </div>
    </div>
  );
}
