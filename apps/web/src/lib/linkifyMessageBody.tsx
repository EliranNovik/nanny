import * as React from "react";

export const URL_IN_TEXT_RE =
  /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/gi;
export const CHAT_URL_DETECT_RE = URL_IN_TEXT_RE;

export function normalizeChatUrl(raw: string): string {
  const trimmed = raw.replace(/[),.;!?]+$/g, "").trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function extractFirstChatUrl(text?: string | null): string | null {
  const match = text?.trim() ? text.match(URL_IN_TEXT_RE) : null;
  return match?.[0] ? normalizeChatUrl(match[0]) : null;
}

export function splitTextWithUrls(text: string) {
  const parts: Array<{ type: "text" | "url"; value: string; href?: string }> = [];
  const re = new RegExp(URL_IN_TEXT_RE.source, "gi");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    parts.push({
      type: "url",
      value: match[0],
      href: normalizeChatUrl(match[0]),
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts.length ? parts : [{ type: "text" as const, value: text }];
}

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
  const withScheme = normalizeChatUrl(raw);
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
export function extractChatUrlsFromText(body: string, max = 1): string[] {
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
