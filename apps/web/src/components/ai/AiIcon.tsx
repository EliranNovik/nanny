import { cn } from "@/lib/utils";

export function AiIcon({ className }: { className?: string }) {
  return (
    <img
      src="/ai-icon.png"
      alt=""
      aria-hidden
      draggable={false}
      className={cn("h-8 w-8 shrink-0 select-none rounded-full", className)}
    />
  );
}
