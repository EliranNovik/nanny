import crypto from "crypto";

/** Match Didit float normalisation: whole-valued floats serialised as ints. */
function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        key,
        shortenFloats(value),
      ]),
    );
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

function timingSafeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyDiditWebhookSignatureV2(
  jsonBody: Record<string, unknown>,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

  const canonical = JSON.stringify(sortKeys(shortenFloats(jsonBody)));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(canonical, "utf8")
    .digest("hex");

  return timingSafeEqualHex(expected, signatureHeader);
}

export function verifyDiditWebhookSignatureSimple(
  jsonBody: Record<string, unknown>,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

  const canonical = [
    jsonBody.timestamp ?? "",
    jsonBody.session_id ?? "",
    jsonBody.status ?? "",
    jsonBody.webhook_type ?? "",
  ].join(":");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  return timingSafeEqualHex(expected, signatureHeader);
}
