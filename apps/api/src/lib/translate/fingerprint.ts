import { createHash } from "crypto";

export function textFingerprint(text: string): string {
  return createHash("sha256").update(text.trim(), "utf8").digest("hex");
}
