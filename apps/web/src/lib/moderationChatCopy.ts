const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment or bullying",
  hate_speech: "Hate speech",
  nudity: "Nudity or sexual content",
  violence: "Violence or threats",
  scam: "Scam or fake account",
  unwanted: "Don't want to see them",
  other: "Other",
};

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function cleanReason(value: string): string | null {
  let text = value.replace(UUID_RE, " ").replace(/\s+/g, " ").trim();
  text = text
    .replace(/\(([^)]+)\)/g, (_, inner: string) => {
      const code = inner.trim().toLowerCase();
      if (REASON_LABELS[code] || /^[a-z0-9_]+$/.test(code)) return "";
      return `(${inner})`;
    })
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/^[:\-–—|]+\s*/, "").replace(/\s*[|]+\s*$/, "").trim();
  if (!text) return null;
  const code = text.toLowerCase().replace(/\s+/g, "_");
  return REASON_LABELS[code] ?? REASON_LABELS[text.toLowerCase()] ?? text;
}

/** Short copy for a block or report alert. Admins keep the original message. */
export function memberModerationNotice(
  raw: string,
): { title: string; body: string } | null {
  const text = raw.replace(/^[\u200b\u2060]+/, "").trim();
  const match = text.match(
    /^\[(USER BLOCK|POST REPORT|USER REPORT|REQUEST REPORT|PROFILE REPORT)\]\s*([\s\S]*)$/i,
  );
  if (!match) return null;

  const kind = match[1].toUpperCase();
  const rest = match[2] ?? "";
  const reasonLine = rest.match(/(?:^|\n|\|)\s*Reason\s*:\s*([^|\n]+)/i)?.[1];
  const inline = rest.split(/[\n|]/)[0] ?? "";
  const reason = cleanReason(reasonLine || inline);

  if (kind === "USER BLOCK") {
    return {
      title: "Block sent",
      body: reason
        ? `You blocked a member. Reason: ${reason}.`
        : "You blocked a member.",
    };
  }
  if (kind === "USER REPORT" || kind === "PROFILE REPORT") {
    return {
      title: "Report sent",
      body: reason
        ? `You reported a member. Reason: ${reason}.`
        : "You reported a member.",
    };
  }
  if (kind === "REQUEST REPORT") {
    return {
      title: "Report sent",
      body: reason
        ? `You reported a request. Reason: ${reason}.`
        : "You reported a request.",
    };
  }
  return {
    title: "Report sent",
    body: reason ? `You reported a post. Reason: ${reason}.` : "You reported a post.",
  };
}
