import { cn } from "@/lib/utils";

const frame = "h-6 w-6 shrink-0 sm:h-7 sm:w-7";

/** Home — filled when active, outline when inactive. */
export function BottomNavHomeIcon({
  active = true,
  className,
}: {
  active?: boolean;
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
          strokeWidth={1.85}
          strokeLinejoin="round"
          d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H16v-7H8v7H4.5A1.5 1.5 0 0 1 3 20v-9.5z"
        />
      )}
    </svg>
  );
}

/** Feed — filled when active, outline when inactive. */
export function BottomNavFeedIcon({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(frame, className)}
      aria-hidden
    >
      {active ? (
        <>
          <circle cx="5.18" cy="18.82" r="2.18" fill="currentColor" />
          <path
            fill="currentColor"
            d="M3 10.2v3.18c4.55 0 8.62 4.07 8.62 8.62H14.8C14.8 15.4 8.6 10.2 3 10.2z"
          />
          <path
            fill="currentColor"
            d="M3 4v3.18C12.05 7.18 19.82 14.95 19.82 24H23C23 13.18 13.82 4 3 4z"
          />
        </>
      ) : (
        <>
          <circle
            cx="5.18"
            cy="18.82"
            r="1.85"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            d="M3 10.5v2.9c4.2 0 7.6 3.4 7.6 7.6H13.5C13.5 15.4 8.6 10.5 3 10.5z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            d="M3 4.2v2.9C11.6 7.1 18.9 14.4 18.9 23h2.9C21.8 12.9 13.1 4.2 3 4.2z"
          />
        </>
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
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      )}
    </svg>
  );
}

const MESSAGES_BUBBLE_PATH =
  "M7 5.25h10a2.25 2.25 0 0 1 2.25 2.25v6.75A2.25 2.25 0 0 1 17 16.5h-2.65l-1.35 2.25-1.35-2.25H7A2.25 2.25 0 0 1 4.75 14.25V7.5A2.25 2.25 0 0 1 7 5.25z";

/** Profile — filled when active, outline when inactive. */
export function BottomNavProfileIcon({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(frame, className)}
      aria-hidden
    >
      {active ? (
        <>
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path
            fill="currentColor"
            d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"
          />
        </>
      ) : (
        <>
          <circle
            cx="12"
            cy="8"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            d="M20 21a8 8 0 0 0-16 0"
          />
        </>
      )}
    </svg>
  );
}

/** Messages — filled when active, outline when inactive. */
export function BottomNavMessagesTabIcon({
  active = false,
  className,
  size = 30,
}: {
  active?: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d={MESSAGES_BUBBLE_PATH}
        fill={active ? "currentColor" : "none"}
        stroke={active ? "none" : "currentColor"}
        strokeWidth={active ? 0 : 1.85}
        strokeLinejoin="round"
      />
    </svg>
  );
}
