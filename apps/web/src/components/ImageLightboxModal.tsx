import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(url);
}

interface ImageLightboxModalProps {
  /** Image or video URLs (same `service_details.images` array). */
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightboxModal({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, goNext, goPrev, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || images.length === 0) return null;

  const el = (
    <div
      className="pointer-events-auto fixed inset-0 z-[10000] flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden bg-black"
      style={{
        width: "100vw",
        height: "100dvh",
        maxWidth: "100vw",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Media gallery"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="relative z-20 flex h-12 w-full shrink-0 items-center justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur-md">
          {currentIndex + 1} / {images.length}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
          aria-label="Close gallery"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Main stage: image or video + nav overlaid inside same stacking context */}
      <div
        className="relative z-10 flex min-h-0 w-full flex-1 items-center justify-center px-0 md:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideoMediaUrl(images[currentIndex]) ? (
          <video
            key={images[currentIndex]}
            src={images[currentIndex]}
            controls
            playsInline
            className="relative z-0 max-h-full w-full max-w-full object-contain md:max-h-[85vh] md:max-w-[90vw] md:rounded-2xl md:shadow-2xl"
          />
        ) : (
          <img
            src={images[currentIndex]}
            alt={`Job photo ${currentIndex + 1}`}
            className="relative z-0 h-full w-full max-h-full object-contain select-none md:max-h-[85vh] md:max-w-[90vw] md:rounded-2xl md:shadow-2xl"
            draggable={false}
          />
        )}

        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] md:pl-4 md:pr-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/50 p-3 text-white backdrop-blur-md transition-colors hover:bg-black/70 active:scale-95"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/50 p-3 text-white backdrop-blur-md transition-colors hover:bg-black/70 active:scale-95"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails — above image layer, explicit hit targets */}
      {images.length > 1 && (
        <div
          className="relative z-20 flex w-full shrink-0 items-center justify-center gap-2 overflow-x-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex max-w-full items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-sm">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  idx === currentIndex
                    ? "scale-105 border-white shadow-lg"
                    : "border-white/20 opacity-60 hover:opacity-100"
                }`}
              >
                {isVideoMediaUrl(img) ? (
                  <video
                    src={img}
                    muted
                    playsInline
                    className="pointer-events-none h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={img}
                    alt=""
                    className="pointer-events-none h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(el, document.body);
}
