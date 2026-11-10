import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadChatImage,
  peekChatImage,
  peekChatImageDims,
} from "@/lib/chatMediaCache";

type ChatMessageMediaProps = {
  src: string;
  alt?: string;
  type: "image" | "video";
  isOwn: boolean;
  onImageClick?: () => void;
  /** Square the bottom edge so a caption bubble can sit flush against the media. */
  flushBottom?: boolean;
  /** Optional footer overlay (WhatsApp-style time + ticks). */
  footer?: ReactNode;
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

function mediaShellClass(isLandscape: boolean | null, flushBottom: boolean) {
  return cn(
    "relative w-full overflow-hidden rounded-2xl",
    flushBottom && "rounded-b-none",
    "border border-slate-200/80 bg-zinc-100/90 shadow-md",
    flushBottom && "border-b-0 shadow-none",
    "dark:border-white/10 dark:bg-zinc-900/80",
    !flushBottom && "transition duration-300 hover:scale-[1.01] active:scale-[0.99]",
    isLandscape === null &&
      "aspect-[4/3] min-h-[11rem] max-h-[360px] md:min-h-[10rem] md:max-h-[320px]",
    isLandscape === false &&
      "aspect-[3/4] max-h-[min(52vh,360px)] md:max-h-[380px]",
    isLandscape === true && "max-h-[min(48vh,400px)] md:max-h-[420px]",
  );
}

function mediaObjectClass() {
  return cn(
    "h-full w-full object-contain object-center transition-opacity duration-300",
  );
}

export function ChatMessageMedia({
  src,
  alt,
  type,
  isOwn: _isOwn,
  onImageClick,
  flushBottom = false,
  footer,
}: ChatMessageMediaProps) {
  const known = type === "image" ? peekChatImage(src) : null;
  const knownDims = type === "image" ? peekChatImageDims(src) : null;
  const [loaded, setLoaded] = useState(Boolean(known));
  const [failed, setFailed] = useState(false);
  const [dims, setDims] = useState<MediaDimensions | null>(
    known ? { width: known.width, height: known.height } : knownDims,
  );
  const [shownSrc, setShownSrc] = useState(known?.url ?? "");
  const videoRef = useRef<HTMLVideoElement>(null);

  const isLandscape = dims ? dims.width > dims.height : null;

  const shellStyle = {
    ...(dims
      ? ({
          aspectRatio: `${dims.width} / ${dims.height}`,
          width: isLandscape
            ? `min(${flushBottom ? "640px" : "100%, 640px"}, calc(min(48vh, 420px) * ${dims.width / dims.height}))`
            : `min(${flushBottom ? "440px" : "100%, 440px"}, calc(min(52vh, 380px) * ${dims.width / dims.height}))`,
          maxWidth: "100%",
        } as const)
      : {}),
    ...(flushBottom
      ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
      : {}),
  };

  useEffect(() => {
    if (type !== "image") {
      setLoaded(false);
      setFailed(false);
      setDims(null);
      return;
    }
    const cached = peekChatImage(src);
    if (cached) {
      setShownSrc(cached.url);
      setDims({ width: cached.width, height: cached.height });
      setLoaded(true);
      setFailed(false);
      return;
    }
    const storedDims = peekChatImageDims(src);
    setDims(storedDims);
    setLoaded(false);
    setFailed(false);
    let cancelled = false;
    void loadChatImage(src)
      .then((entry) => {
        if (cancelled) return;
        setShownSrc(entry.url);
        setDims({ width: entry.width, height: entry.height });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src, type]);

  const shell = mediaShellClass(isLandscape, flushBottom);
  const objectClass = mediaObjectClass();

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
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              setDims({ width: v.videoWidth, height: v.videoHeight });
            }
            setLoaded(true);
          }}
          onCanPlay={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        {footer ? (
          <div className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-full bg-black/65 px-2 py-1 shadow-sm backdrop-blur-sm">
            {footer}
          </div>
        ) : null}
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

      {!loaded && !failed ? <MediaLoadingOverlay /> : null}

      {shownSrc ? (
      <img
        src={shownSrc}
        alt={alt || "Attachment"}
        decoding="async"
        className={cn(
          "absolute inset-0",
          objectClass,
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setDims({ width: img.naturalWidth, height: img.naturalHeight });
          }
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
      />
      ) : null}

      {loaded && onImageClick ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover/image:opacity-100">
          <ImageIcon className="h-8 w-8 text-white drop-shadow-md" aria-hidden />
        </div>
      ) : null}

      {footer ? (
        <div className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-full bg-black/65 px-2 py-1 shadow-sm backdrop-blur-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
