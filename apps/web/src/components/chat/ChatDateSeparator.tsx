import { cn } from "@/lib/utils";

type ChatDateSeparatorProps = {
  label: string;
  className?: string;
};

export function ChatDateSeparator({ label, className }: ChatDateSeparatorProps) {
  return (
    <div className={cn("my-5 flex justify-center", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-lg px-3.5 py-1",
          "bg-zinc-100 text-[13px] font-medium text-zinc-500",
          "dark:bg-white/[0.08] dark:text-slate-400",
          "md:px-3.5 md:py-1 md:text-sm",
        )}
      >
        {label}
      </span>
    </div>
  );
}
