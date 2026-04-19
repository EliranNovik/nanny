import { trackEvent } from "@/lib/analytics";

const SESSION_START = "mml_session_start_ms";
const FIRST_ACTION_DONE = "mml_first_action_recorded";
const PENDING_CHAT_SOURCE = "mml_pending_chat_source";
const PENDING_CHAT_AT = "mml_pending_chat_at";

export function recordSessionStart(): void {
  try {
    if (sessionStorage.getItem(SESSION_START)) return;
    sessionStorage.setItem(SESSION_START, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function recordFirstMeaningfulAction(
  action: string,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    if (sessionStorage.getItem(FIRST_ACTION_DONE)) return;
    sessionStorage.setItem(FIRST_ACTION_DONE, "1");
    const start = Number(sessionStorage.getItem(SESSION_START) || 0);
    const deltaMs = start > 0 ? Date.now() - start : 0;
    trackEvent("time_to_first_action", {
      action,
      delta_ms: deltaMs,
      ...props,
    });
  } catch {
    /* ignore */
  }
}

/** Call after posting a request, swipe match, etc. — ChatPage consumes for funnel. */
export function setPendingChatAfterAction(source: string): void {
  try {
    sessionStorage.setItem(PENDING_CHAT_SOURCE, source);
    sessionStorage.setItem(PENDING_CHAT_AT, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function consumePendingChatOpen(conversationId: string | null): void {
  if (!conversationId) return;
  try {
    const src = sessionStorage.getItem(PENDING_CHAT_SOURCE);
    const at = Number(sessionStorage.getItem(PENDING_CHAT_AT) || 0);
    if (!src || !at) return;
    if (Date.now() - at > 15 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_CHAT_SOURCE);
      sessionStorage.removeItem(PENDING_CHAT_AT);
      return;
    }
    trackEvent("chat_opened_after_action", {
      source: src,
      conversation_id: conversationId,
      delta_ms: Date.now() - at,
    });
    sessionStorage.removeItem(PENDING_CHAT_SOURCE);
    sessionStorage.removeItem(PENDING_CHAT_AT);
  } catch {
    /* ignore */
  }
}

export function trackCtaClick(
  ctaId: string,
  page: string,
  role?: string | null,
): void {
  trackEvent("cta_click", { cta_id: ctaId, page, role: role ?? "" });
}

export function trackMatchInitiation(
  kind: string,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  trackEvent("match_initiation", { kind, ...props });
}
