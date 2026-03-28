import { useState } from "react";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { cn } from "@/lib/utils";

/** Same source as JobDetailsModal: `job.service_details.images` (public URLs). */
export function jobAttachmentImageUrls(
  job: { service_details?: { images?: unknown } } | null | undefined
): string[] {
  const raw = job?.service_details?.images;
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

interface JobAttachedPhotosStripProps {
  images: string[];
  className?: string;
}

/** Desktop only: horizontal scroll of job photos below hero/map; opens lightbox on click. */
export function JobAttachedPhotosStrip({ images, className }: JobAttachedPhotosStripProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          "hidden w-full shrink-0 border-b border-slate-200/80 bg-slate-50/90 dark:border-white/10 dark:bg-zinc-900/60 md:block",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex gap-2 overflow-x-auto px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
          role="list"
        >
          {images.map((src, idx) => (
            <button
              key={`${src}-${idx}`}
              type="button"
              className="relative h-[4.5rem] w-[6.5rem] shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200/90 bg-card shadow-sm transition hover:ring-2 hover:ring-orange-400/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-800"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(idx);
              }}
            >
              <img src={src} alt={`Job photo ${idx + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
      {lightboxIndex !== null && (
        <ImageLightboxModal
          images={images}
          initialIndex={lightboxIndex}
          isOpen
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
