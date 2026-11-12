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

/** Feed — a post card. Filled when active, outline when inactive. */
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
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M7.2 3.2h9.6a4 4 0 0 1 4 4v9.6a4 4 0 0 1-4 4H7.2a4 4 0 0 1-4-4V7.2a4 4 0 0 1 4-4zM6.85 8.3a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0zm3.85-.575h5.9a.575.575 0 0 1 0 1.15h-5.9a.575.575 0 0 1 0-1.15zM6.5 11.55h11a.6.6 0 0 1 0 1.2h-11a.6.6 0 0 1 0-1.2zm0 3.4h7.3a.6.6 0 0 1 0 1.2h-7.3a.6.6 0 0 1 0-1.2z"
        />
      ) : (
        <>
          <rect
            x="3.2"
            y="3.2"
            width="17.6"
            height="17.6"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
          />
          <circle
            cx="8.1"
            cy="8.3"
            r="1.25"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
          />
          <path
            d="M11.1 8.3h5.6M6.6 12.15h10.8M6.6 15.55h7.2"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
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
  "M12 3.35c4.75 0 8.6 3.22 8.6 7.2 0 3.97-3.85 7.2-8.6 7.2-.68 0-1.34-.07-1.97-.2l-3.4 2.15a.62.62 0 0 1-.94-.66l.68-2.48C4.22 15.28 3.4 13.38 3.4 10.55 3.4 6.57 7.25 3.35 12 3.35z";

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
      {active ? (
        <path
          fill="currentColor"
          fillRule="evenodd"
          d={`${MESSAGES_BUBBLE_PATH}M8.1 10.55a.95.95 0 1 0 1.9 0 .95.95 0 0 0-1.9 0zm2.95 0a.95.95 0 1 0 1.9 0 .95.95 0 0 0-1.9 0zm2.95 0a.95.95 0 1 0 1.9 0 .95.95 0 0 0-1.9 0z`}
        />
      ) : (
        <>
          <path
            d={MESSAGES_BUBBLE_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
          <g fill="currentColor">
            <circle cx="9.05" cy="10.55" r="0.9" />
            <circle cx="12" cy="10.55" r="0.9" />
            <circle cx="14.95" cy="10.55" r="0.9" />
          </g>
        </>
      )}
    </svg>
  );
}
