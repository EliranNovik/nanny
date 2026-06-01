import { cn } from "@/lib/utils";

type ChatDateSeparatorProps = {
  label: string;
  className?: string;
};

export function ChatDateSeparator({ label, className }: ChatDateSeparatorProps) {
  return (
    <div className={cn("my-8 flex justify-center", className)}>
      <span
        className={cn(
          "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em]",
          "border-slate-200/80 bg-white/80 text-slate-500",
          "dark:border-white/10 dark:bg-white/5 dark:text-slate-400",
        )}
      >
        {label}
      </span>
    </div>
  );
}
