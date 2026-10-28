import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import {
  fetchChatLinkPreview,
  type ChatLinkPreviewApiPayload,
} from "@/lib/chatLinkPreviewApi";

const CACHE_KEY = "chatLinkPreviews:v6";
const sessionPreviewCache = new Map<
  string,
  ChatLinkPreviewApiPayload | null
>();
let cacheWriteTimer: number | null = null;
const measuredImageAspects = new Map<string, number>();

if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]") as Array<
      [string, ChatLinkPreviewApiPayload | null]
    >;
    saved.slice(-300).forEach(([url, preview]) => {
      if (preview) sessionPreviewCache.set(url, preview);
    });
  } catch {
    // Ignore malformed or unavailable storage.
  }
}

function persistPreviewCache() {
  if (typeof window === "undefined") return;
  if (cacheWriteTimer !== null) window.clearTimeout(cacheWriteTimer);
  cacheWriteTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify([...sessionPreviewCache.entries()].slice(-300)),
      );
    } catch {
      // Cache persistence is an optional optimization.
    }
  }, 800);
}

type Props = {
  urls: string[];
  variant: "sent" | "received";
  /**
   * Inset styling for tiles inside the gradient/slate bubble.
   * (Standalone chrome is only used if this is ever set false.)
   */
  embedded?: boolean;
};

/** Compact URL/host string for badge overlay without repeating entire href. */
function shortLinkBadge(href: string): string {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const tail = `${u.pathname.replace(/\/$/, "")}${u.search}`;
    const base = tail && tail !== "" ? `${host}${tail}` : host;
    if (base.length <= 44) return base;
    return `${base.slice(0, 18)}…${base.slice(-16)}`;
  } catch {
    return href.length > 44 ? `${href.slice(0, 18)}…${href.slice(-16)}` : href;
  }
}

export function ChatLinkPreviewCards({
  urls,
  variant,
  embedded = true,
}: Props) {
  if (urls.length === 0) return null;

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2">
      {urls.map((url) => (
        <ChatLinkPreviewTile
          key={url}
          url={url}
          variant={variant}
          embedded={embedded}
        />
      ))}
    </div>
  );
}

function ChatLinkPreviewTile({
  url,
  variant,
  embedded,
}: {
  url: string;
  variant: Props["variant"];
  embedded: boolean;
}) {
  const [hideImage, setHideImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageAspect, setImageAspect] = useState(1.6);
  const [data, setData] = useState<ChatLinkPreviewApiPayload | null>(
    () => sessionPreviewCache.get(url) ?? null,
  );
  const [loading, setLoading] = useState(!sessionPreviewCache.has(url));

  useEffect(() => {
    setHideImage(false);
    setImageLoaded(false);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    const cached = sessionPreviewCache.get(url);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);
      const res = await fetchChatLinkPreview(url);
      if (cancelled) return;
      if (res) {
        sessionPreviewCache.set(url, res);
        persistPreviewCache();
        setData(res);
      } else {
        setData(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const title =
    data?.title ||
    (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })();
  const site =
    data?.siteName ||
    (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "Link";
      }
    })();
  const description = data?.description;
  const href = data?.url ?? url;
  const titleIsRtl = /[\u0590-\u08ff]/.test(title);
  const isTebnuPreview = (() => {
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      return host === "tebnu.com" || host.endsWith(".tebnu.com");
    } catch {
      return false;
    }
  })();

  const proxiedImg =
    data?.imageToken && data.imageToken.length > 0
      ? `${(import.meta.env.VITE_API_BASE_URL ||
          "http://localhost:4000") as string}/api/link-preview/image?token=${encodeURIComponent(data.imageToken)}`
      : null;
  const imageSrc =
    proxiedImg && !hideImage
      ? proxiedImg
      : data?.image && !hideImage
        ? data.image
        : null;
  const hostname = (() => {
    try {
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return site;
    }
  })();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  const faviconOnly =
    !imageSrc || imageSrc.includes("google.com/s2/favicons");
  const displayedImage = faviconOnly ? faviconUrl : imageSrc;

  useEffect(() => {
    if (!displayedImage || faviconOnly) return;
    setImageAspect(measuredImageAspects.get(displayedImage) ?? 1.6);
  }, [displayedImage, faviconOnly]);

  const tileShell = embedded
    ? variant === "sent"
      ? "border border-white/20 bg-black/25 shadow-inner backdrop-blur-[2px]"
      : "border border-slate-200/80 bg-white/95 shadow-inner backdrop-blur-[2px] dark:border-white/10 dark:bg-white/10"
    : "shadow-md ring-1 ring-black/10 dark:ring-white/10";

  const footerText = embedded
    ? variant === "sent"
      ? "text-white"
      : "text-slate-900 dark:text-white"
    : "text-zinc-900 dark:text-white";

  const mutedFooter = embedded
    ? variant === "sent"
      ? "text-white/75"
      : "text-muted-foreground"
    : "text-muted-foreground";

  const openButtonClass =
    embedded && variant === "sent"
      ? "h-7 shrink-0 rounded-full border-0 bg-white px-3 text-[11px] font-bold text-orange-700 shadow-md hover:bg-white/95"
      : embedded && variant === "received"
        ? "h-7 shrink-0 rounded-full border-0 bg-orange-500 px-3 text-[11px] font-bold text-white shadow-md hover:bg-orange-600 dark:bg-orange-600"
        : "h-7 shrink-0 rounded-full border-0 bg-orange-500 px-3 text-[11px] font-bold text-white shadow-md hover:bg-orange-600";

  const badgeClass =
    embedded && variant === "sent"
      ? "border border-white/15 bg-black/55 text-[10px] font-medium text-white shadow backdrop-blur-sm"
      : embedded && variant === "received"
        ? "border border-black/15 bg-black/50 text-[10px] font-medium text-white shadow backdrop-blur-sm dark:bg-zinc-950/85 dark:text-white"
        : "border border-black/15 bg-black/55 text-[10px] font-medium text-white backdrop-blur-sm";

  if (loading) {
    return (
      <div className={cn("w-[min(100%,24rem)] min-w-0 max-w-full overflow-hidden rounded-2xl", tileShell)}>
        <div className="h-[7rem] w-full animate-pulse bg-black/25 dark:bg-white/15 md:h-[6rem]" />
        <div className="space-y-2 p-3">
          <div className="h-2 w-16 animate-pulse rounded bg-black/25 dark:bg-white/20 md:h-1.5" />
          <div className="h-4 w-[88%] animate-pulse rounded bg-black/20 dark:bg-white/15 md:h-3" />
          <div className="h-3 w-full animate-pulse rounded bg-black/15 dark:bg-white/10 md:h-2.5" />
        </div>
      </div>
    );
  }

  const overlayBar = (
    <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex items-start justify-between gap-2">
      <span
        className={cn(
          "pointer-events-none max-w-[calc(100%-5.75rem)] truncate rounded-full px-2 py-0.5 tabular-nums",
          badgeClass,
        )}
        title={href}
      >
        {shortLinkBadge(href)}
      </span>
      <span className="pointer-events-auto shrink-0 [&_a]:leading-none">
        <Button size="sm" className={openButtonClass} asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            Open link
          </a>
        </Button>
      </span>
    </div>
  );

  const noImageHeader = (
    <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2.5 dark:border-white/10">
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        variant === "sent" ? "bg-white/15 text-white" : "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400",
      )}>
        <Link2 className="h-4 w-4" aria-hidden />
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-xs font-semibold", footerText)}>
        {site}
      </span>
      <Button size="sm" className={openButtonClass} asChild>
        <a href={href} target="_blank" rel="noopener noreferrer">
          Open link
        </a>
      </Button>
    </div>
  );

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) return;
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }}
      className={cn(
        "w-[min(100%,24rem)] min-w-0 max-w-full cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm transition-opacity hover:opacity-[0.88] active:opacity-[0.88] dark:bg-zinc-950",
        embedded ? cn("bg-transparent", tileShell) : tileShell,
      )}
    >
      {displayedImage ? (
        <div
          className={cn(
            "relative min-w-0 max-w-full overflow-hidden",
            faviconOnly
              ? variant === "sent"
                ? "h-[72px] bg-black/15"
                : "h-[72px] bg-muted"
              : isTebnuPreview
                ? "bg-white p-2"
                : "bg-black/10",
          )}
          style={faviconOnly ? undefined : { aspectRatio: imageAspect }}
        >
          {!imageLoaded ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <span
                className={cn(
                  "h-5 w-5 animate-spin rounded-full border-2 border-transparent",
                  variant === "sent"
                    ? "border-t-white/85"
                    : "border-t-orange-500",
                )}
              />
            </div>
          ) : null}
          <img
            src={displayedImage}
            alt=""
            referrerPolicy="no-referrer"
            className={cn(
              "h-full w-full min-w-0 max-w-full",
              faviconOnly
                ? "object-contain p-4"
                : isTebnuPreview
                  ? "rounded-lg bg-white object-contain object-center"
                  : "object-cover",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            onLoad={(event) => {
              setImageLoaded(true);
              if (!faviconOnly) {
                const measured =
                  event.currentTarget.naturalWidth /
                  event.currentTarget.naturalHeight;
                const clamped = Math.max(0.8, Math.min(2, measured || 1.6));
                measuredImageAspects.set(displayedImage, clamped);
                setImageAspect(clamped);
              }
            }}
            onError={() => {
              setHideImage(true);
              setImageLoaded(false);
            }}
          />
          {!faviconOnly && !isTebnuPreview ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              {overlayBar}
            </>
          ) : null}
        </div>
      ) : (
        noImageHeader
      )}

      <div className="min-w-0 max-w-full space-y-[5px] px-3.5 pb-3.5 pt-3">
        <p
          dir="auto"
          className={cn(
            "line-clamp-2 text-[15px] font-bold leading-5",
            footerText,
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            dir="auto"
            className={cn(
              "line-clamp-2 text-[13px] font-medium leading-[18px]",
              mutedFooter,
            )}
          >
            {description}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-0.5 truncate text-[12px] font-semibold lowercase",
            mutedFooter,
            titleIsRtl && "text-right",
          )}
        >
          {hostname}
        </p>
      </div>
    </div>
  );
}
