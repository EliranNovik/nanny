import type { ReactNode } from "react";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { cn } from "@/lib/utils";

export const liveOnlineDotClass =
  "absolute bottom-0 right-0 z-10 h-3 w-3 rounded-full border-2 border-background bg-emerald-500 shadow-sm";

type Props = {
  children: ReactNode;
  liveUntil?: string | null;
  className?: string;
  dotClassName?: string;
  title?: string;
};

/** Plain avatar wrapper — green dot when author is in an active 24h go-live window. */
export function AvatarWithLiveDot({
  children,
  liveUntil,
  className,
  dotClassName,
  title = "Live now (24h availability)",
}: Props) {
  const isLive = isFreelancerInActive24hLiveWindow({ live_until: liveUntil ?? null });

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {children}
      {isLive ? (
        <span
          className={cn(liveOnlineDotClass, dotClassName)}
          title={title}
          aria-label={title}
        />
      ) : null}
    </span>
  );
}
