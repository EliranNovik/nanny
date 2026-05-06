import crypto from "crypto";
import { assertSafeHttpUrl } from "./linkPreviewFetcher";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function signingSecret(): string {
  return (
    process.env.LINK_PREVIEW_IMAGE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "link-preview-image-dev-insecure"
  );
}

/** Short-lived HMAC token so <img> can load without Authorization header. */
export function createLinkPreviewImageToken(imageUrl: string): string | null {
  try {
    assertSafeHttpUrl(imageUrl);
  } catch {
    return null;
  }
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({ u: imageUrl, exp });
  const sig = crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function parseLinkPreviewImageToken(
  token: string,
): { url: string } | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const b64 = token.slice(0, i);
  const sig = token.slice(i + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expect = crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
  const expectBuf = Buffer.from(expect);
  const sigBuf = Buffer.from(sig);
  if (expectBuf.length !== sigBuf.length) return null;
  try {
    if (!crypto.timingSafeEqual(expectBuf, sigBuf)) return null;
  } catch {
    return null;
  }

  let parsed: { u?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(payload) as { u?: unknown; exp?: unknown };
  } catch {
    return null;
  }
  if (typeof parsed.u !== "string" || typeof parsed.exp !== "number")
    return null;
  if (Date.now() > parsed.exp) return null;

  try {
    assertSafeHttpUrl(parsed.u);
  } catch {
    return null;
  }
  return { url: parsed.u };
}
