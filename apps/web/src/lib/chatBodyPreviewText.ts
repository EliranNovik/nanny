import {
  canonicalChatHref,
  CHAT_URL_DETECT_RE,
  previewHrefOmitSet,
  resolveChatHref,
} from "@/lib/linkifyMessageBody";

/** True if `body` has visible text outside preview URLs (show a text row above preview cards). */
export function bodyHasNonPreviewText(
  body: string,
  previewUrls: readonly string[],
): boolean {
  const omit = previewHrefOmitSet(previewUrls);
  let stripped = "";
  let last = 0;
  const re = new RegExp(CHAT_URL_DETECT_RE.source, CHAT_URL_DETECT_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    stripped += body.slice(last, m.index);
    const raw = m[0];
    const h = resolveChatHref(raw);
    if (!h || !omit.has(canonicalChatHref(h))) stripped += raw;
    last = m.index + raw.length;
  }
  stripped += body.slice(last);
  return stripped.trim().length > 0;
}
