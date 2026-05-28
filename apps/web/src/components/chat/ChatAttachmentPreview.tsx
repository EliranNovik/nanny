import { useEffect, useMemo, useState } from "react";
import { File, Image as ImageIcon, Loader2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getAttachmentKind(file: File): "image" | "video" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi"].includes(ext)) return "video";
  return "file";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ChatAttachmentPreviewProps = {
  file: File;
  onRemove: () => void;
  uploading?: boolean;
  className?: string;
};

export function ChatAttachmentPreview({
  file,
  onRemove,
  uploading = false,
  className,
}: ChatAttachmentPreviewProps) {
  const kind = useMemo(() => getAttachmentKind(file), [file]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "image" && kind !== "video") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  return (
    <div
      className={cn(
        "relative mb-2 overflow-hidden rounded-2xl border border-border/60 bg-zinc-100/90 shadow-sm dark:border-white/10 dark:bg-zinc-900/80",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={uploading}
        className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full bg-black/50 text-white shadow-md hover:bg-black/65 hover:text-white dark:bg-black/60"
        aria-label="Remove attachment"
      >
        <X className="h-5 w-5" strokeWidth={2.25} />
      </Button>

      {uploading ? (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      ) : null}

      {kind === "image" && previewUrl ? (
        <div className="flex max-h-[min(42vh,16rem)] min-h-[8rem] items-center justify-center bg-zinc-200/80 p-1 dark:bg-zinc-950/50">
          <img
            src={previewUrl}
            alt={file.name}
            className="max-h-[min(42vh,16rem)] w-full rounded-xl object-contain"
          />
        </div>
      ) : null}

      {kind === "video" && previewUrl ? (
        <div className="relative flex max-h-[min(42vh,16rem)] min-h-[8rem] items-center justify-center bg-black p-1">
          <video
            src={previewUrl}
            className="max-h-[min(42vh,16rem)] w-full rounded-xl object-contain"
            muted
            playsInline
            preload="metadata"
          />
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm">
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </div>
          </div>
        </div>
      ) : null}

      {kind === "file" ? (
        <div className="flex min-h-[5.5rem] items-center gap-3 px-4 py-4 pr-14">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <File className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {file.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
      ) : null}

      {(kind === "image" || kind === "video") && (
        <div className="flex items-center gap-2 border-t border-border/50 bg-background/80 px-3 py-2 text-xs text-muted-foreground dark:bg-zinc-950/60">
          {kind === "image" ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate font-medium">{file.name}</span>
          <span className="shrink-0 tabular-nums">{formatFileSize(file.size)}</span>
        </div>
      )}
    </div>
  );
}
