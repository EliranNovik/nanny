import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileMenuRowProps {
  to: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  className?: string;
}

export function ProfileMenuRow({
  to,
  icon: Icon,
  label,
  description,
  className,
}: ProfileMenuRowProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-5 px-5 py-4 md:py-[1.125rem] border border-transparent bg-transparent",
        "hover:bg-slate-50 dark:hover:bg-zinc-800/80 active:scale-[0.99] transition-colors md:rounded-none",
        "group",
        className,
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground/80">
        <Icon className="h-5 w-5 stroke-[1.5]" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[17px] md:text-lg font-medium text-foreground tracking-tight">
          {label}
        </span>
        {description && (
          <span className="mt-1 block text-[15px] md:text-base text-muted-foreground leading-snug">
            {description}
          </span>
        )}
      </span>
      <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}
