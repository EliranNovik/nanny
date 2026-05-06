import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  fetchChatLinkPreview,
  type ChatLinkPreviewApiPayload,
} from "@/lib/chatLinkPreviewApi";

const sessionPreviewCache = new Map<string, ChatLinkPreviewApiPayload>();

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
  const [data, setData] = useState<ChatLinkPreviewApiPayload | null>(() =>
    sessionPreviewCache.get(url) ?? null,
  );
  const [loading, setLoading] = useState(!sessionPreviewCache.has(url));

  useEffect(() => {
    setHideImage(false);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    const cached = sessionPreviewCache.get(url);
    if (cached) {
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
        setData(res);
      } else setData(null);
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

  const tileShell = embedded
    ? variant === "sent"
      ? "border border-white/20 bg-black/25 shadow-inner backdrop-blur-[2px]"
      : "border border-black/10 bg-black/[0.08] shadow-inner backdrop-blur-[2px] dark:border-white/10 dark:bg-white/10"
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
      <div className={cn("min-w-0 max-w-full overflow-hidden rounded-xl", tileShell)}>
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
    <div className="flex items-center gap-2 border-b border-black/10 px-2.5 py-2 dark:border-white/10">
      <span
        className={cn("min-w-0 flex-1 truncate rounded-full px-2 py-0.5", badgeClass)}
        title={href}
      >
        {shortLinkBadge(href)}
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
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-xl bg-white dark:bg-zinc-950",
        embedded ? cn("bg-transparent", tileShell) : "ring-1",
      )}
    >
      {imageSrc ? (
        <div className="relative min-h-[7rem] min-w-0 max-w-full overflow-hidden bg-muted/80 dark:bg-zinc-900/60 md:min-h-[6rem]">
          <img
            src={imageSrc}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-44 min-h-[7rem] w-full min-w-0 max-w-full object-cover md:max-h-36 md:min-h-[6rem]"
            loading="lazy"
            onError={() => setHideImage(true)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          {overlayBar}
        </div>
      ) : (
        noImageHeader
      )}

      <div className="min-w-0 max-w-full space-y-0.5 px-3 pb-2.5 pt-2">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", mutedFooter)}>
          {site}
          {data && !data.ok && data.error ? (
            <span className="ml-1 normal-case font-normal text-amber-300/95 dark:text-amber-400/90">
              · preview limited
            </span>
          ) : null}
        </span>
        <p
          className={cn(
            "text-[14px] font-semibold leading-snug line-clamp-2 md:text-[13px]",
            footerText,
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              "text-[11.5px] leading-relaxed line-clamp-3 md:text-[11px]",
              mutedFooter,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
