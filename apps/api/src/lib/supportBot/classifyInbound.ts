import type { SupportInboundHint } from "./supportAgent";

/**
 * Automatic reports are inserted for the user (a reason, a post or request).
 * A typed support message does not look like that template.
 */
export function classifyInboundHint(body: string): SupportInboundHint {
  const text = body.trim();
  if (!text) return "user_message";

  const labeledReport =
    /\breason\s*:/i.test(text) &&
    /\b(post|request|report)\b/i.test(text);
  const opening = /^(automatic report|auto report|report(ed)?(\s+(a|this)\s+(post|request))?)\b/i.test(
    text,
  );

  if (labeledReport || opening) return "auto_report";
  return "user_message";
}
