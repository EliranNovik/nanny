import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface VideoLightboxModalProps {
  src: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Full-viewport video overlay (mobile-friendly safe areas). */
export function VideoLightboxModal({ src, isOpen, onClose }: VideoLightboxModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const el = (
    <div
      className="pointer-events-auto fixed inset-0 z-[10000] flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden bg-black"
      style={{ width: "100vw", height: "100dvh", maxWidth: "100vw", left: 0, top: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Video"
      onClick={onClose}
    >
      <div
        className="relative z-20 flex h-12 w-full shrink-0 items-center justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
          aria-label="Close video"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 w-full flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex max-h-full max-w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <video
            ref={videoRef}
            key={src}
            src={src}
            controls
            playsInline
            className="max-h-[min(100dvh-5rem,100%)] max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(el, document.body);
}
