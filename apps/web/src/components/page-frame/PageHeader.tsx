import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  /** Real-time / live counts — same visual group as title (not a footer strip). */
  realtimeSlot?: ReactNode;
  /** Single dominant action (filled button or equivalent). */
  primaryAction?: ReactNode;
  /** Outline / ghost — max two on mobile per product rules. */
  secondaryActions?: ReactNode;
  className?: string;
};

/**
 * Data-first and list-first pages: title + purpose + optional live context + one primary.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  realtimeSlot,
  primaryAction,
  secondaryActions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-4 px-1", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-slate-900 dark:text-white md:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
          {realtimeSlot ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">{realtimeSlot}</div>
          ) : null}
        </div>
        {(primaryAction || secondaryActions) && (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {primaryAction ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                {primaryAction}
              </div>
            ) : null}
            {secondaryActions ? (
              <div className="flex flex-wrap gap-2">{secondaryActions}</div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
