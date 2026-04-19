import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import type { JobSummaryRow } from "@/lib/chatJobContext";
import { jobCategoryLabel, jobTimeSummary } from "@/lib/chatJobContext";

type Props = {
  job: JobSummaryRow;
  /** Other participant display name */
  participantName: string;
  /** Current user's first name or "You" */
  selfLabel?: string;
  /** Link to jobs UI when live job exists */
  jobHref?: string | null;
  className?: string;
};

/** Compact one-line context: category · location · time · participants */
export function ChatJobContextStrip({
  job,
  participantName,
  selfLabel = "You",
  jobHref,
  className,
}: Props) {
  const cat = jobCategoryLabel(job);
  const city = job.location_city?.trim() || "Location TBD";
  const when = jobTimeSummary(job.start_at);

  return (
    <div
      className={cn(
        "sticky top-0 z-[1] border-b border-border/40 bg-background/90 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/75",
        "dark:border-border/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Job context
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {cat}
            <span className="font-normal text-muted-foreground"> · </span>
            <span className="inline-flex items-center gap-0.5 align-middle">
              <MapPin
                className="inline h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              {city}
            </span>
            <span className="font-normal text-muted-foreground"> · </span>
            {when}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selfLabel} & {participantName}
          </p>
        </div>
        {jobHref ? (
          <Link
            to={jobHref}
            className="shrink-0 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
          >
            View job
          </Link>
        ) : null}
      </div>
    </div>
  );
}
