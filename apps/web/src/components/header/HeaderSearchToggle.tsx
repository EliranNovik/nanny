import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserSearch } from "@/components/UserSearch";

export function HeaderSearchToggle({
  open,
  onOpenChange,
  inputClassName,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputClassName?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className={cn("relative flex shrink-0 items-center", className)}>
      {open ? (
        <UserSearch
          autoFocus
          onResultSelect={() => onOpenChange(false)}
          className="w-[min(22rem,32vw)] max-w-none animate-in fade-in slide-in-from-right-2 duration-200 sm:max-w-none md:max-w-none lg:max-w-none"
          inputClassName={inputClassName}
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Search"
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Search className="h-[22px] w-[22px]" strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
