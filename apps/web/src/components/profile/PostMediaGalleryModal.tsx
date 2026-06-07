import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import type { ProfilePostMediaItem } from "@/lib/profilePostMedia";

type Props = {
  open: boolean;
  onClose: () => void;
  items: ProfilePostMediaItem[];
  initialIndex?: number;
};

export function PostMediaGalleryModal({
  open,
  onClose,
  items,
  initialIndex = 0,
}: Props) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    setIndex((prev) => Math.min(Math.max(prev, 0), Math.max(items.length - 1, 0)));
  }, [open, items.length]);

  const current = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  if (!current) return null;

  const mediaUrl = publicProfileMediaPublicUrl(current.storage_path);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="flex max-h-[min(92vh,900px)] w-[min(96vw,720px)] flex-col gap-0 overflow-hidden border-0 bg-black p-0 text-white sm:rounded-2xl"
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </button>

          {items.length > 1 ? (
            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-bold tabular-nums backdrop-blur-md">
              {index + 1} / {items.length}
            </div>
          ) : null}

          <div className="relative flex min-h-[min(70vh,640px)] flex-1 items-center justify-center bg-black">
            {current.media_type === "image" ? (
              <img
                src={mediaUrl}
                alt=""
                className="max-h-[min(70vh,640px)] w-full object-contain"
              />
            ) : (
              <video
                key={current.storage_path}
                src={mediaUrl}
                controls
                playsInline
                className="max-h-[min(70vh,640px)] w-full object-contain"
              />
            )}

            {hasPrev ? (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
                aria-label="Previous media"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}

            {hasNext ? (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
                aria-label="Next media"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>

          {items.length > 1 ? (
            <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-black/90 p-3">
              {items.map((item, i) => {
                const thumbUrl = publicProfileMediaPublicUrl(item.storage_path);
                const selected = i === index;
                return (
                  <button
                    key={item.storage_path}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                      selected ? "border-white ring-2 ring-white/40" : "border-white/20 opacity-75 hover:opacity-100",
                    )}
                    aria-label={`View media ${i + 1}`}
                    aria-current={selected}
                  >
                    {item.media_type === "image" ? (
                      <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={thumbUrl} className="h-full w-full object-cover" muted />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
