import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width items; parent uses 1 col on mobile, 3 cols on desktop (`md+`).
 */
export const jobCardCarouselItemClass = "w-full min-w-0 shrink-0";

/**
 * Mobile: vertical stack. Desktop (`md+`): 3-column grid — use on /jobs tab pages
 * (Helping now, requests, pending, My Posted Requests, etc.).
 */
export function JobCardsCarousel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-4",
        "md:mx-auto md:grid md:max-w-6xl md:grid-cols-3 md:gap-6",
        "lg:max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
