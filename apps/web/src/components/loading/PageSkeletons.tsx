import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Home tab — hero actions + story strip + content cards. */
export function HomePageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 px-4 pb-28 pt-4 md:px-0 md:pb-12 md:pt-7",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl md:h-28" />
        ))}
      </div>

      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-[5.5rem] shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-[5.5rem] w-[5.5rem] rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Messages inbox list + empty chat pane on desktop. */
export function MessagesPageSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-messages-page=""
      className={cn(
        "flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-white dark:bg-[#0c0a09] md:h-full md:max-h-full",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex h-full min-h-0 w-full flex-shrink-0 flex-col overflow-hidden md:w-[340px]">
        <div className="hidden shrink-0 flex-col gap-3 px-5 pb-3 pt-3 md:flex">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3 md:hidden">
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex w-full items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden min-h-0 flex-1 flex-col items-center justify-center bg-white dark:bg-[#0c0a09] md:flex">
        <Skeleton className="mb-4 h-16 w-16 rounded-full" />
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
    </div>
  );
}

/** Profile hub — identity card + menu rows. */
export function ProfileHubSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("min-h-screen bg-background pb-6 md:pb-8", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="app-desktop-shell pt-6 md:pt-8">
        <div className="app-desktop-centered-wide space-y-6">
          <div className="flex items-center gap-4 rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-900">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single list card used by My requests / My offers. */
export function ListingCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3.5 dark:bg-zinc-900",
        className,
      )}
    >
      <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
    </div>
  );
}

export function ListingPageSkeleton({
  count = 6,
  className,
  gridClassName,
}: {
  count?: number;
  className?: string;
  gridClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
        gridClassName,
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
