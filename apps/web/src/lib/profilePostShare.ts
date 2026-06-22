import {
  debugProfilePostDeepLink,
  listProfilePostDomIds,
  scrollMetrics,
  warnProfilePostDeepLink,
} from "@/lib/profilePostDeepLinkDebug";

export const GLOBAL_POSTS_PATH = "/community/feed";

const DEFAULT_CAPTION_MAX = 140;

const PROFILE_POST_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/**
 * Extract a profile post UUID from a `?post=` value.
 * Messengers sometimes append caption text to the link — take the first UUID only.
 */
export function parseProfilePostShareId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const match = raw.trim().match(PROFILE_POST_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

/** In-app path for a profile post on the global community feed. */
export function globalProfilePostFeedPath(postId: string): string {
  const cleanId = parseProfilePostShareId(postId) ?? postId.trim();
  return `${GLOBAL_POSTS_PATH}?post=${encodeURIComponent(cleanId)}`;
}

/** Canonical deep link for a profile post on the global community feed. */
export function globalProfilePostShareUrl(postId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${globalProfilePostFeedPath(postId)}`;
}

/** Plain-text caption trimmed for share sheets and link previews. */
export function shortenPostCaption(
  caption: string | null | undefined,
  maxLen = DEFAULT_CAPTION_MAX,
): string {
  const trimmed = caption?.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/\s+/g, " ");
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
}

export type ProfilePostShareInput = {
  postId: string;
  authorName?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
};

export type ProfilePostSharePayload = {
  url: string;
  title: string;
  text: string;
  files?: File[];
};

async function imageFileForShare(mediaUrl: string): Promise<File | null> {
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const ext = blob.type.includes("png") ? "png" : "jpg";
    return new File([blob], `post.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export async function buildProfilePostSharePayload(
  input: ProfilePostShareInput,
): Promise<ProfilePostSharePayload> {
  const url = globalProfilePostShareUrl(input.postId);
  const authorName = input.authorName?.trim() || "User";
  const caption = shortenPostCaption(input.caption);
  const title = caption ? `${authorName} on tebnu` : `${authorName} shared a post on tebnu`;
  const text =
    caption || `See ${authorName}'s post on tebnu`;

  const payload: ProfilePostSharePayload = { url, title, text };

  if (input.mediaType === "image" && input.mediaUrl) {
    const file = await imageFileForShare(input.mediaUrl);
    if (file && navigator.canShare?.({ files: [file] })) {
      payload.files = [file];
    }
  }

  return payload;
}

export type ShareProfilePostResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareProfilePost(
  input: ProfilePostShareInput,
): Promise<ShareProfilePostResult> {
  const payload = await buildProfilePostSharePayload(input);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const shareData: ShareData = {
        title: payload.title,
        text: payload.text,
        url: payload.url,
      };
      if (
        payload.files?.length &&
        navigator.canShare?.({ ...shareData, files: payload.files })
      ) {
        await navigator.share({ ...shareData, files: payload.files });
      } else {
        await navigator.share(shareData);
      }
      return "shared";
    }
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === "AbortError") return "cancelled";
  }

  try {
    // URL only — caption in the same clipboard string breaks links in messengers.
    await navigator.clipboard.writeText(payload.url);
    return "copied";
  } catch {
    return "failed";
  }
}

type ScrollToPostOpts = {
  /** Extra top offset (e.g. compose box above the feed on community page). */
  topInset?: number;
  /** Use instant scroll (more reliable on iOS). */
  instant?: boolean;
};

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

function isPostInView(el: HTMLElement, topInset: number, bottomInset: number) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= topInset - 8 &&
    rect.top <= window.innerHeight - bottomInset - 48
  );
}

/** Scroll so a profile post card is visible. Returns true when the card is in view. */
export function scrollToProfilePost(
  postId: string,
  opts: ScrollToPostOpts = {},
): boolean {
  const el = document.getElementById(`profile-post-${postId}`);
  if (!el) {
    debugProfilePostDeepLink("scrollToProfilePost: element missing", {
      postId,
      domIds: listProfilePostDomIds(),
    });
    return false;
  }

  const topInset = opts.topInset ?? 12;
  const bottomInset = 88;
  const behavior: ScrollBehavior = opts.instant ? "auto" : "smooth";
  const before = scrollMetrics();
  const rectBefore = el.getBoundingClientRect();
  const roots = scrollRootsFor(el);

  debugProfilePostDeepLink("scrollToProfilePost: attempt", {
    postId,
    topInset,
    instant: opts.instant ?? false,
    behavior,
    rectBefore: {
      top: rectBefore.top,
      bottom: rectBefore.bottom,
      height: rectBefore.height,
    },
    scrollBefore: before,
    roots: roots.map((root) => ({
      tag: root.tagName,
      id: root.id || null,
      className: root.className?.slice?.(0, 80) ?? "",
      scrollTop: root.scrollTop,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
    })),
  });

  for (const root of roots) {
    const rootTop =
      root === document.body || root === document.documentElement
        ? 0
        : root.getBoundingClientRect().top;
    const rect = el.getBoundingClientRect();
    const target = root.scrollTop + rect.top - rootTop - topInset;
    root.scrollTo({ top: Math.max(0, target), behavior });
  }

  const rectAfter = el.getBoundingClientRect();
  const visible = isPostInView(el, topInset, bottomInset);

  debugProfilePostDeepLink("scrollToProfilePost: result", {
    postId,
    visible,
    rectAfter: {
      top: rectAfter.top,
      bottom: rectAfter.bottom,
      height: rectAfter.height,
    },
    scrollAfter: scrollMetrics(),
  });

  if (!visible) {
    warnProfilePostDeepLink("scrollToProfilePost: not in view after scroll", {
      postId,
      topInset,
      bottomInset,
    });
  }

  return true;
}

/** Retry scroll until the post card is mounted and visible. */
export function scrollToProfilePostWhenReady(
  postId: string,
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

  debugProfilePostDeepLink("scrollToProfilePostWhenReady: start", {
    postId,
    topInset,
    maxAttempts,
    domIds: listProfilePostDomIds(),
    scroll: scrollMetrics(),
  });

  const tryScroll = () => {
    if (cancelled) {
      debugProfilePostDeepLink("scrollToProfilePostWhenReady: cancelled", {
        postId,
        attempts,
      });
      return;
    }
    attempts += 1;

    const el = document.getElementById(`profile-post-${postId}`);
    if (!el) {
      debugProfilePostDeepLink("scrollToProfilePostWhenReady: waiting for DOM", {
        postId,
        attempts,
        domIds: listProfilePostDomIds(),
      });
      if (attempts >= maxAttempts) {
        warnProfilePostDeepLink("scrollToProfilePostWhenReady: gave up (no DOM)", {
          postId,
          attempts,
          domIds: listProfilePostDomIds(),
        });
        opts?.onDone?.(false);
        return;
      }
      const delay = delays[attempts - 1] ?? 300 + attempts * 150;
      timeouts.push(window.setTimeout(tryScroll, delay));
      return;
    }

    const useInstant = attempts >= 3;
    const visible = scrollToProfilePost(postId, {
      topInset,
      instant: useInstant,
    });

    if (visible) {
      debugProfilePostDeepLink("scrollToProfilePostWhenReady: success", {
        postId,
        attempts,
        useInstant,
      });
      opts?.onDone?.(true);
      return;
    }

    if (attempts >= maxAttempts) {
      warnProfilePostDeepLink("scrollToProfilePostWhenReady: final instant scroll", {
        postId,
        attempts,
      });
      scrollToProfilePost(postId, { topInset, instant: true });
      opts?.onDone?.(Boolean(document.getElementById(`profile-post-${postId}`)));
      return;
    }

    debugProfilePostDeepLink("scrollToProfilePostWhenReady: retry", {
      postId,
      attempts,
      useInstant,
    });
    const delay = delays[attempts - 1] ?? 300 + attempts * 150;
    timeouts.push(window.setTimeout(tryScroll, delay));
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(tryScroll);
  });

  return () => {
    cancelled = true;
    for (const id of timeouts) window.clearTimeout(id);
  };
}
