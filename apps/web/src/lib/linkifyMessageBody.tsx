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

export type ChatRichPart =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; value: string; href: string };

const URL_AT_START = /^(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/i;
const EMAIL_AT_START = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MD_LINK_AT_START =
  /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^)\s]+)\)/i;
const BOLD_AT_START = /^\*\*([^*\n]+)\*\*/;

/** Inbox preview: drop the chat markup and keep the words. */
export function chatMessagePlainText(body: string): string {
  return body
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^)\s]+\)/gi, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1");
}

export function splitChatRichText(text: string): ChatRichPart[] {
  const parts: ChatRichPart[] = [];
  let index = 0;
  while (index < text.length) {
    const slice = text.slice(index);
    const markdownLink = MD_LINK_AT_START.exec(slice);
    if (markdownLink) {
      const rawHref = markdownLink[2];
      const href = rawHref.toLowerCase().startsWith("mailto:")
        ? rawHref
        : resolveChatHref(rawHref);
      if (href) {
        parts.push({ type: "link", value: markdownLink[1], href });
        index += markdownLink[0].length;
        continue;
      }
    }
    const bold = BOLD_AT_START.exec(slice);
    if (bold) {
      parts.push({ type: "bold", value: bold[1] });
      index += bold[0].length;
      continue;
    }
    const url = URL_AT_START.exec(slice);
    if (url) {
      const href = resolveChatHref(url[0]);
      if (href) {
        parts.push({ type: "link", value: url[0], href });
        index += url[0].length;
        continue;
      }
    }
    const email = EMAIL_AT_START.exec(slice);
    if (email) {
      const raw = email[0].replace(/[),.;!?]+$/g, "");
      if (raw) {
        parts.push({ type: "link", value: raw, href: `mailto:${raw}` });
        index += raw.length;
        continue;
      }
    }

    const rest = slice.slice(1);
    let jump = rest.length;
    for (const marker of [
      rest.indexOf("["),
      rest.indexOf("**"),
      rest.search(/https?:\/\//i),
      rest.search(/\bwww\./i),
      rest.search(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i),
    ]) {
      if (marker >= 0 && marker < jump) jump = marker;
    }
    const value = slice.slice(0, jump + 1);
    const previous = parts[parts.length - 1];
    if (previous?.type === "text") previous.value += value;
    else parts.push({ type: "text", value });
    index += value.length;
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

/**
 * Renders `body` as text with bold, markdown links, and bare URLs.
 * Line breaks come from the parent `whitespace-pre-wrap`.
 * When `omitAnchorsForCanonicalHrefs` is set, URLs that match a preview card href are omitted
 * inline so they are not duplicated under the bubble.
 */
export function linkifyMessageBody(
  body: string,
  linkClassName: string,
  omitAnchorsForCanonicalHrefs?: ReadonlySet<string>,
): React.ReactNode {
  if (!body) return null;
  const parts = splitChatRichText(body);
  const nodes = parts.map((part, index) => {
    if (part.type === "bold") {
      return (
        <strong key={`b-${index}`} className="font-extrabold">
          {part.value}
        </strong>
      );
    }
    if (part.type === "link") {
      const hidden =
        omitAnchorsForCanonicalHrefs?.size &&
        !part.href.startsWith("mailto:") &&
        omitAnchorsForCanonicalHrefs.has(canonicalChatHref(part.href));
      if (hidden) {
        return part.value.includes("://") || part.value.startsWith("www.")
          ? null
          : part.value;
      }
      return (
        <a
          key={`u-${index}`}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {part.value}
        </a>
      );
    }
    return <React.Fragment key={`t-${index}`}>{part.value}</React.Fragment>;
  });
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
