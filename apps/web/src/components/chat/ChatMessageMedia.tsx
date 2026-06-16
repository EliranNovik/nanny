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

type MediaDimensions = { width: number; height: number };

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

function mediaShellClass(isLandscape: boolean | null) {
  return cn(
    "relative w-full overflow-hidden rounded-2xl",
    "border border-slate-200/80 bg-zinc-100/90 shadow-md",
    "dark:border-white/10 dark:bg-zinc-900/80",
    "transition duration-300 hover:scale-[1.01] active:scale-[0.99]",
    isLandscape === null &&
      "aspect-[4/3] min-h-[11rem] max-h-[360px] md:min-h-[10rem] md:max-h-[320px]",
    isLandscape === false &&
      "aspect-[3/4] max-h-[min(52vh,360px)] md:max-h-[380px]",
    isLandscape === true && "max-h-[min(48vh,400px)] md:max-h-[420px]",
  );
}

function mediaObjectClass(isLandscape: boolean | null) {
  return cn(
    "h-full w-full transition-opacity duration-300",
    isLandscape === true
      ? "object-contain object-center"
      : "object-cover object-center",
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
  const [dims, setDims] = useState<MediaDimensions | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isLandscape = dims ? dims.width > dims.height : null;

  const shellStyle =
    isLandscape && dims
      ? ({ aspectRatio: `${dims.width} / ${dims.height}` } as const)
      : undefined;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setDims(null);
  }, [src]);

  const applyDimensions = (width: number, height: number) => {
    if (width > 0 && height > 0) {
      setDims({ width, height });
    }
  };

  useLayoutEffect(() => {
    if (type === "image") {
      const img = imageRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        applyDimensions(img.naturalWidth, img.naturalHeight);
        setLoaded(true);
      }
      return;
    }
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (video.videoWidth > 0) {
        applyDimensions(video.videoWidth, video.videoHeight);
      }
      setLoaded(true);
    }
  }, [src, type]);

  const shell = mediaShellClass(isLandscape);
  const objectClass = mediaObjectClass(isLandscape);

  if (type === "video") {
    return (
      <div className={shell} style={shellStyle}>
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
            "absolute inset-0 border-none",
            objectClass,
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            applyDimensions(v.videoWidth, v.videoHeight);
            setLoaded(true);
          }}
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
      style={shellStyle}
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
            className={cn(
              "absolute inset-0 scale-110 blur-2xl",
              objectClass,
            )}
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
          "absolute inset-0",
          objectClass,
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={(e) => {
          const img = e.currentTarget;
          applyDimensions(img.naturalWidth, img.naturalHeight);
          setLoaded(true);
        }}
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
