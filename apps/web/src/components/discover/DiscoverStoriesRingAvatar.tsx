import { cn } from "@/lib/utils";

/** Slow-rotating conic ring — Available now: 3 orange tones; Community requests: 3 green tones. */
const CONIC_HIRE =
  "conic-gradient(from 0deg, #ea580c 0deg, #f97316 120deg, #fb923c 240deg, #ea580c 360deg)";
const CONIC_WORK =
  "conic-gradient(from 0deg, #15803d 0deg, #16a34a 120deg, #22c55e 240deg, #15803d 360deg)";

type Props = {
  children: React.ReactNode;
  variant?: "hire" | "work";
  className?: string;
};

export function DiscoverStoriesRingAvatar({
  children,
  variant = "hire",
  className,
}: Props) {
  const bg = variant === "work" ? CONIC_WORK : CONIC_HIRE;
  return (
    <div
      className={cn(
        "relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 animate-[spin_14s_linear_infinite] rounded-full will-change-transform motion-reduce:animate-none"
        style={{ background: bg }}
        aria-hidden
      />
      <div className="relative z-10 flex h-[calc(100%-5px)] w-[calc(100%-5px)] items-center justify-center overflow-hidden rounded-full bg-background p-[2px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.35)]">
        {children}
      </div>
    </div>
  );
}
