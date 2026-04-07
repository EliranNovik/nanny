import { cn } from "@/lib/utils";

/** Slow-rotating conic ring — hire tab: cool spectrum; work tab: warm spectrum. */
const CONIC_HIRE =
  "conic-gradient(from 0deg, #0ea5e9, #22d3ee, #6366f1, #a855f7, #ec4899, #0ea5e9)";
const CONIC_WORK =
  "conic-gradient(from 0deg, #eab308, #fb923c, #f472b6, #a78bfa, #2dd4bf, #eab308)";

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
