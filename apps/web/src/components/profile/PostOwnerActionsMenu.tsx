import { useEffect, useRef, useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onEdit: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  className?: string;
  /** Compact icon for dense headers / list rows. */
  size?: "sm" | "md";
};

/** Top-right overflow menu for the post owner (Edit / Delete). */
export function PostOwnerActionsMenu({
  onEdit,
  onDelete,
  deleting = false,
  className,
  size = "md",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btnSize = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur-md transition-colors",
          "hover:bg-muted/70 active:scale-[0.97]",
          "dark:border-white/10 dark:bg-zinc-900/80 dark:hover:bg-zinc-800",
          btnSize,
        )}
        aria-label="Post options"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className={iconSize} strokeWidth={2.25} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute end-0 top-[calc(100%+0.4rem)] z-[60] min-w-[11.5rem] overflow-hidden rounded-2xl border border-border/80 bg-white py-1.5 shadow-2xl",
            "dark:border-white/10 dark:bg-zinc-950",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil className="h-4 w-4 text-orange-500" aria-hidden />
            Edit post
          </button>
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              disabled={deleting}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
