const CONTACT_MARKER = "tebnu-contact:";

export function formatChatContactMessage(name: string, userId: string): string {
  const display = name.trim() || "Tebnu profile";
  return `👤 ${display}\n${CONTACT_MARKER}${userId}`;
}

export type ChatContactPayload = { userId: string; name: string };

const CONTACT_RE = new RegExp(
  `^👤\\s*(.*?)\\s*\\n\\s*(?:${CONTACT_MARKER}|https?:\\/\\/\\S+?\\/profile\\/)([0-9a-f-]{36})\\s*$`,
  "iu",
);

export function parseChatContactMessage(
  body?: string | null,
): ChatContactPayload | null {
  const match = body?.trim().match(CONTACT_RE);
  if (!match?.[2]) return null;
  return { userId: match[2], name: match[1]?.trim() ?? "" };
}

export function chatContactPreview(body?: string | null): string | null {
  const contact = parseChatContactMessage(body);
  return contact ? `👤 ${contact.name || "Tebnu profile"}` : null;
}
