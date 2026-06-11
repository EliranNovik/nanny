import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileMenuRowProps {
  to: string;
  icon: LucideIcon;
  label: string;
  className?: string;
  trailing?: ReactNode;
}

export function ProfileMenuRow({
  to,
  icon: Icon,
  label,
  className,
  trailing,
}: ProfileMenuRowProps) {
  return (
    <div
      className={cn(
        "profile-menu-row group flex items-stretch",
        "transition-colors hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-zinc-800/80 md:rounded-none",
        className,
      )}
    >
      <Link
        to={to}
        className="flex min-w-0 flex-1 items-stretch gap-3.5 px-4 md:gap-5 md:px-5"
      >
        <span className="flex w-10 shrink-0 items-center self-center md:w-11">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 text-foreground/80 md:h-11 md:w-11">
            <Icon className="h-[18px] w-[18px] stroke-[1.5] md:h-5 md:w-5" />
          </span>
        </span>
        <span
          className={cn(
            "profile-menu-row-divider flex min-w-0 flex-1 items-center py-3.5 md:py-3.5",
            "border-slate-100 dark:border-white/5",
            !trailing && "gap-3",
          )}
        >
          <span className="min-w-0 flex-1 text-left text-[17px] font-medium tracking-tight text-foreground md:text-[17px]">
            {label}
          </span>
          {!trailing ? (
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground md:h-6 md:w-6" />
          ) : null}
        </span>
      </Link>
      {trailing ? (
        <div
          className="flex shrink-0 items-center self-center gap-2 pr-1 md:pr-2"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {trailing}
        </div>
      ) : null}
      {trailing ? (
        <Link
          to={to}
          className="flex shrink-0 items-center self-center py-3.5 pr-4 md:pr-5"
        >
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground md:h-6 md:w-6" />
        </Link>
      ) : null}
    </div>
  );
}

export const profileMenuListClassName =
  "overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm dark:border-0 dark:bg-zinc-900 dark:shadow-none [&>.profile-menu-row:not(:first-child)_span.profile-menu-row-divider]:border-t";
