import { cn } from "@/lib/utils";

const frame = "h-7 w-7 shrink-0 sm:h-8 sm:w-8";

/**
 * Home: filled Material-style when active; rounded outline when inactive.
 */
export function BottomNavHomeIcon({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(frame, className)}
      aria-hidden
    >
      {active ? (
        <path
          fill="currentColor"
          d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 10.5 12 4l9 6.5V20h-4v-6H7v6H4v-9.5z"
        />
      )}
    </svg>
  );
}

/**
 * Heart: smooth Feather-style silhouette — filled when active, stroke when inactive.
 */
export function BottomNavHeartIcon({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(frame, className)}
      aria-hidden
    >
      {active ? (
        <path
          fill="currentColor"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      )}
    </svg>
  );
}
