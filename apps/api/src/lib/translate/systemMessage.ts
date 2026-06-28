/** Mirror of web heuristics — skip translating transactional chat copy. */
export function isLikelySystemMessage(body: string | null | undefined): boolean {
  if (!body?.trim()) return false;
  const t = body.trim();
  if (t.startsWith("✓") || t.startsWith("✔")) return true;
  if (/^declined\b/i.test(t)) return true;
  if (/match accepted/i.test(t)) return true;
  if (/schedule confirmed/i.test(t)) return true;
  if (/payment (accepted|completed|request)/i.test(t)) return true;
  if (/^request sent\b/i.test(t)) return true;
  if (/price offer/i.test(t)) return true;
  return false;
}

export function isNonTranslatableChatBody(body: string | null | undefined): boolean {
  if (!body?.trim()) return true;
  if (body.trim().startsWith("__MATCH_CTX__:")) return true;
  return isLikelySystemMessage(body);
}
