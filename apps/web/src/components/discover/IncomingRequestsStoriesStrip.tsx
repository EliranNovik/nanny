import { DiscoverStoriesRingAvatar } from "@/components/discover/DiscoverStoriesRingAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { IncomingJobRequestCardJob } from "@/components/jobs/IncomingJobRequestCard";

type InboundRow = {
  id: string;
  job_requests: IncomingJobRequestCardJob;
};

type Props = {
  inbound: InboundRow[];
  formatJobTitle: (job: { service_type?: string }) => string;
  onOpenPreview: (job: IncomingJobRequestCardJob) => void;
};

/**
 * Stories-style row for incoming job requests: client avatar + service label; tap opens the same
 * preview as the full card (map modal for pickup, job details modal otherwise).
 */
export function IncomingRequestsStoriesStrip({
  inbound,
  formatJobTitle,
  onOpenPreview,
}: Props) {
  return (
    <div
      className={cn(
        "-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "snap-x snap-mandatory [touch-action:pan-x_pan-y] overscroll-x-contain"
      )}
      role="list"
      aria-label="Community needs your help"
    >
      {inbound.map((notif) => {
        const job = notif.job_requests;
        const label = formatJobTitle(job);
        return (
          <button
            key={notif.id}
            type="button"
            role="listitem"
            onClick={() => onOpenPreview(job)}
            className={cn(
              "group flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl pb-0.5 text-center outline-none",
              "transition-transform active:scale-[0.97]",
              "focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <DiscoverStoriesRingAvatar
              variant="work"
              className="transition-transform duration-300 group-hover:scale-[1.03]"
            >
              <Avatar className="h-full w-full border-0 shadow-none ring-0">
                <AvatarImage
                  src={job.profiles?.photo_url ?? undefined}
                  alt=""
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-amber-100 to-orange-100 text-lg font-bold text-amber-900 dark:from-amber-950 dark:to-orange-950 dark:text-amber-100">
                  {(job.profiles?.full_name || "C").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DiscoverStoriesRingAvatar>
            <span
              className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-tight text-foreground"
              title={label}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
