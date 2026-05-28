import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard back chevron for the app shell and page headers. */
export function HeaderBackChevron({ className }: { className?: string }) {
  return (
    <ChevronLeft
      className={cn("h-8 w-8 shrink-0", className)}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}
