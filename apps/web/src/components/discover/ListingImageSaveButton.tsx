import { Bookmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bookmark on the top-end corner of a listing image. */
export function ListingImageSaveButton({
  saved,
  busy,
  label,
  onToggle,
}: {
  saved: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={saved}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "absolute top-1.5 end-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white shadow-sm backdrop-blur-sm transition active:scale-95 disabled:opacity-60 md:top-2.5 md:end-2.5 md:h-9 md:w-9",
        saved && "text-amber-300",
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin md:h-4 md:w-4" aria-hidden />
      ) : (
        <Bookmark
          className={cn("h-3.5 w-3.5 md:h-4 md:w-4", saved && "fill-current")}
          strokeWidth={2.25}
          aria-hidden
        />
      )}
    </button>
  );
}
