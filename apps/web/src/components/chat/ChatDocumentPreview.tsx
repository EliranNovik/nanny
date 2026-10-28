import type { ReactNode } from "react";
import { Download, FileArchive, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatDocumentPreviewProps = {
  url: string;
  name?: string | null;
  size?: number | null;
  isOwn: boolean;
  footer?: ReactNode;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes < 1) return null;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatDocumentPreview({
  url,
  name,
  size,
  isOwn,
  footer,
}: ChatDocumentPreviewProps) {
  const filename = name || "Document";
  const extension = filename.split(".").pop()?.toUpperCase() || "FILE";
  const isPdf =
    extension === "PDF" || url.toLowerCase().split("?")[0].endsWith(".pdf");
  const Icon = ["ZIP", "RAR", "7Z"].includes(extension)
    ? FileArchive
    : FileText;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block w-[min(78vw,22rem)] overflow-hidden rounded-2xl border shadow-sm transition-transform hover:scale-[1.01]",
        isOwn
          ? "border-white/20 bg-white/15 text-white"
          : "border-slate-200 bg-white text-foreground dark:border-white/10 dark:bg-zinc-800 dark:text-white",
      )}
    >
      {isPdf ? (
        <div className="relative h-40 overflow-hidden bg-white">
          <iframe
            src={`${url}#page=1&toolbar=0&navpanes=0&scrollbar=0`}
            title={`Preview of ${filename}`}
            loading="lazy"
            className="pointer-events-none h-[210px] w-full border-0"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
      ) : (
        <div
          className={cn(
            "flex h-24 items-center justify-center",
            isOwn ? "bg-black/10" : "bg-slate-50 dark:bg-zinc-900",
          )}
        >
          <Icon
            className={cn(
              "h-12 w-12",
              isOwn ? "text-white/85" : "text-orange-500",
            )}
          />
        </div>
      )}
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{filename}</p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              isOwn ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {[extension, formatBytes(size)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            isOwn ? "bg-white/20" : "bg-orange-50 dark:bg-orange-950/30",
          )}
        >
          <Download
            className={cn(
              "h-4 w-4",
              isOwn ? "text-white" : "text-orange-600 dark:text-orange-400",
            )}
          />
        </span>
      </div>
      {footer ? (
        <div
          className={cn(
            "flex justify-end px-3 pb-2 text-[11px]",
            isOwn ? "text-white/75" : "text-muted-foreground",
          )}
        >
          {footer}
        </div>
      ) : null}
    </a>
  );
}
