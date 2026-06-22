import { GLOBAL_POSTS_PATH, parseProfilePostShareId, shortenPostCaption } from "@/lib/profilePostShare";

export type JobRequestShareInput = {
  jobId: string;
  authorName?: string | null;
  caption?: string | null;
};

export type JobRequestSharePayload = {
  url: string;
  title: string;
  text: string;
};

export function globalJobRequestFeedPath(jobId: string): string {
  const cleanId = parseProfilePostShareId(jobId) ?? jobId.trim();
  return `${GLOBAL_POSTS_PATH}?request=${encodeURIComponent(cleanId)}`;
}

export function globalJobRequestShareUrl(jobId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${globalJobRequestFeedPath(jobId)}`;
}

export function parseJobRequestShareId(raw: string | null | undefined): string | null {
  return parseProfilePostShareId(raw);
}

export function buildJobRequestSharePayload(
  input: JobRequestShareInput,
): JobRequestSharePayload {
  const url = globalJobRequestShareUrl(input.jobId);
  const authorName = input.authorName?.trim() || "Member";
  const caption = shortenPostCaption(input.caption);
  const title = caption
    ? `${authorName} needs help on tebnu`
    : `${authorName} posted a help request on tebnu`;
  const text = caption || `See this help request from ${authorName} on tebnu`;
  return { url, title, text };
}

export type ShareJobRequestResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareJobRequest(
  input: JobRequestShareInput,
): Promise<ShareJobRequestResult> {
  const payload = buildJobRequestSharePayload(input);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    }
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === "AbortError") return "cancelled";
  }

  try {
    await navigator.clipboard.writeText(payload.url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function feedItemDomId(source: "post" | "job_request" | "availability", id: string): string {
  if (source === "post") return `profile-post-${id}`;
  if (source === "job_request") return `job-request-${id}`;
  return `feed-item-${id}`;
}

function scrollRootsFor(el: HTMLElement): HTMLElement[] {
  const roots: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    const scrollable =
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (scrollable && !seen.has(node)) {
      seen.add(node);
      roots.push(node);
    }
    node = node.parentElement;
  }

  for (const candidate of [
    document.scrollingElement,
    document.documentElement,
    document.body,
  ]) {
    if (candidate instanceof HTMLElement && !seen.has(candidate)) {
      seen.add(candidate);
      roots.push(candidate);
    }
  }

  return roots;
}

export function scrollToFeedItem(
  id: string,
  source: "post" | "job_request" | "availability",
  opts: { topInset?: number; instant?: boolean } = {},
): boolean {
  const el = document.getElementById(feedItemDomId(source, id));
  if (!el) return false;

  const topInset = opts.topInset ?? 12;
  const behavior: ScrollBehavior = opts.instant ? "auto" : "smooth";
  for (const root of scrollRootsFor(el)) {
    const rootTop =
      root === document.body || root === document.documentElement
        ? 0
        : root.getBoundingClientRect().top;
    const rect = el.getBoundingClientRect();
    const target = root.scrollTop + rect.top - rootTop - topInset;
    root.scrollTo({ top: Math.max(0, target), behavior });
  }
  return true;
}

export function scrollToFeedItemWhenReady(
  id: string,
  source: "post" | "job_request" | "availability",
  opts?: {
    maxAttempts?: number;
    topInset?: number;
    onDone?: (found: boolean) => void;
  },
) {
  const maxAttempts = opts?.maxAttempts ?? 16;
  const topInset = opts?.topInset ?? 12;
  const delays = [0, 100, 250, 450, 700, 1000, 1300, 1600, 2000, 2500, 3000];
  let attempts = 0;
  let cancelled = false;
  const timeouts: number[] = [];

  const tryScroll = () => {
    if (cancelled) return;
    attempts += 1;

    const el = document.getElementById(feedItemDomId(source, id));
    if (!el) {
      if (attempts >= maxAttempts) {
        opts?.onDone?.(false);
        return;
      }
      const delay = delays[attempts - 1] ?? 300 + attempts * 150;
      timeouts.push(window.setTimeout(tryScroll, delay));
      return;
    }

    const visible = scrollToFeedItem(id, source, {
      topInset,
      instant: attempts >= 3,
    });

    if (visible || attempts >= maxAttempts) {
      if (!visible && attempts >= maxAttempts) {
        scrollToFeedItem(id, source, { topInset, instant: true });
      }
      opts?.onDone?.(true);
      return;
    }

    const delay = delays[attempts - 1] ?? 300 + attempts * 150;
    timeouts.push(window.setTimeout(tryScroll, delay));
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(tryScroll);
  });

  return () => {
    cancelled = true;
    for (const t of timeouts) window.clearTimeout(t);
  };
}
