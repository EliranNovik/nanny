import * as React from "react";

/** Detects bare http(s) and common `www.` URLs in plain chat text */
const URL_IN_TEXT =
  /\b(https?:\/\/[^\s<>()]+[^\s<>().,;:?!'"[\]）]*|(www\.[a-z0-9][-a-z0-9.]+\.[a-z]{2,})(?:\/[^\s<>()]*)?)/gi;

function hrefFromMatch(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Renders `body` as text with URLs turned into anchors (same line breaks via parent `whitespace-pre-wrap`). */
export function linkifyMessageBody(
  body: string,
  linkClassName: string,
): React.ReactNode {
  if (!body) return null;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  const re = new RegExp(URL_IN_TEXT.source, URL_IN_TEXT.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      nodes.push(body.slice(last, m.index));
    }
    const raw = m[0];
    const safe = hrefFromMatch(raw);
    if (safe) {
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
