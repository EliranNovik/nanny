import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessageMediaProps = {
  src: string;
  alt?: string;
  type: "image" | "video";
  isOwn: boolean;
  onImageClick?: () => void;
};

function mediaShellClass() {
  return cn(
    "relative w-full overflow-hidden rounded-3xl",
    "aspect-[4/3] min-h-[10rem] max-h-[320px]",
    "border border-slate-200/80 bg-white/80 shadow-xl shadow-black/10",
    "dark:border-white/10 dark:bg-white/5 dark:shadow-black/30",
    "transition duration-300 hover:scale-[1.02] active:scale-[0.98]",
  );
}

function MediaLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
      <Loader2
        className="h-7 w-7 animate-spin text-white drop-shadow-md"
        aria-hidden
      />
      <span className="sr-only">Loading media</span>
    </div>
  );
}

export function ChatMessageMedia({
  src,
  alt,
  type,
  isOwn: _isOwn,
  onImageClick,
}: ChatMessageMediaProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shell = mediaShellClass();

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useLayoutEffect(() => {
    if (type === "image") {
      const img = imageRef.current;
      if (img?.complete && img.naturalWidth > 0) setLoaded(true);
      return;
    }
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setLoaded(true);
    }
  }, [src, type]);

  if (type === "video") {
    return (
      <div className={shell}>
        <div
          className="absolute inset-0 bg-muted/70 dark:bg-zinc-800/90"
          aria-hidden
        />
        {!loaded && !failed ? <MediaLoadingOverlay /> : null}
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          className={cn(
            "absolute inset-0 h-full w-full border-none object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoadedData={() => setLoaded(true)}
          onCanPlay={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      role={onImageClick ? "button" : undefined}
      tabIndex={onImageClick ? 0 : undefined}
      onKeyDown={
        onImageClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onImageClick();
              }
            }
          : undefined
      }
      className={cn(shell, onImageClick && "cursor-pointer group/image")}
      onClick={onImageClick}
    >
      <div
        className="absolute inset-0 bg-muted/70 dark:bg-zinc-800/90"
        aria-hidden
      />

      {!loaded && !failed ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          />
          <MediaLoadingOverlay />
        </>
      ) : null}

      <img
        ref={imageRef}
        src={src}
        alt={alt || "Attachment"}
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />

      {loaded && onImageClick ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover/image:opacity-100">
          <ImageIcon className="h-8 w-8 text-white drop-shadow-md" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
