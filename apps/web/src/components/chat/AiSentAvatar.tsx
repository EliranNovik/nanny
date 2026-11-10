export const AI_SENT_MARK = "\u200b\u200b\u200b";
/** AI mark plus a word joiner. Only the bot's handoff to the Tebnu team uses this. */
export const HANDOFF_MARK = `${AI_SENT_MARK}\u2060`;

export function messageBodyForDisplay(body: string): string {
  if (body.startsWith(HANDOFF_MARK)) return body.slice(HANDOFF_MARK.length);
  if (body.startsWith(AI_SENT_MARK)) return body.slice(AI_SENT_MARK.length);
  return body;
}

export function isAiSentBody(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(AI_SENT_MARK));
}

export function isHandoffBody(body: string | null | undefined): boolean {
  return Boolean(body?.startsWith(HANDOFF_MARK));
}

/** Round mark shown to the right of a bubble the support bot sent. */
export function AiSentAvatar() {
  return (
    <img
      src="/ai-profile.jpg"
      alt=""
      title="Sent by AI"
      aria-label="Sent by AI"
      className="mb-0.5 h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
    />
  );
}
