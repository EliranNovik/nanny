import type { ReactNode } from "react";

interface ViewEditFieldRowProps {
  label: string;
  editing: boolean;
  /** Read-only display (title + data) */
  viewContent: ReactNode;
  /** Form controls when editing */
  editContent: ReactNode;
}

/** Minimal view row (label + value); swaps to edit controls when `editing` is true. */
export function ViewEditFieldRow({
  label,
  editing,
  viewContent,
  editContent,
}: ViewEditFieldRowProps) {
  if (editing) {
    return <div className="space-y-3 py-1">{editContent}</div>;
  }
  return (
    <div className="py-5 border-b border-border/35 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90 mb-2">
        {label}
      </p>
      <div className="text-[16px] leading-relaxed text-foreground">
        {viewContent}
      </div>
    </div>
  );
}
