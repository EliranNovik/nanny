import * as React from "react";

/** Detects bare http(s) and common `www.` URLs in plain chat text */
export const CHAT_URL_DETECT_RE =
  /\b(https?:\/\/[^\s<>()]+[^\s<>().,;:?!'"[\]）]*|(www\.[a-z0-9][-a-z0-9.]+\.[a-z]{2,})(?:\/[^\s<>()]*)?)/gi;

/** Canonical form for comparing URLs (matches preview list vs linkify targets). */
export function canonicalChatHref(href: string): string {
  try {
    return new URL(href).href.split("#")[0];
  } catch {
    return href;
  }
}

export function previewHrefOmitSet(
  urls: readonly string[],
): Set<string> {
  return new Set(urls.map(canonicalChatHref));
}

export function resolveChatHref(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Renders `body` as text with URLs turned into anchors (`whitespace-pre-wrap` from parent).
 * When `omitAnchorsForCanonicalHrefs` is set, URLs that match a preview card href are omitted
 * inline so they are not duplicated under the bubble.
 */
export function linkifyMessageBody(
  body: string,
  linkClassName: string,
  omitAnchorsForCanonicalHrefs?: ReadonlySet<string>,
): React.ReactNode {
  if (!body) return null;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  const re = new RegExp(CHAT_URL_DETECT_RE.source, CHAT_URL_DETECT_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      nodes.push(body.slice(last, m.index));
    }
    const raw = m[0];
    const safe = resolveChatHref(raw);
    if (safe) {
      if (
        omitAnchorsForCanonicalHrefs?.size &&
        omitAnchorsForCanonicalHrefs.has(canonicalChatHref(safe))
      ) {
        last = m.index + raw.length;
        continue;
      }
      nodes.push(
        <a
          key={`u-${m.index}-${raw.slice(0, 32)}`}
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {raw}
        </a>,
      );
    } else {
      nodes.push(raw);
    }
    last = m.index + raw.length;
  }
  if (last < body.length) {
    nodes.push(body.slice(last));
  }
  if (nodes.length === 0) return body;
  return <>{nodes}</>;
}

/** Unique canonical http(s) URLs from plain text (for previews); cap count. */
export function extractChatUrlsFromText(body: string, max = 2): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = new RegExp(CHAT_URL_DETECT_RE.source, CHAT_URL_DETECT_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[0];
    const href = resolveChatHref(raw);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(href);
    if (out.length >= max) break;
  }
  return out;
}
