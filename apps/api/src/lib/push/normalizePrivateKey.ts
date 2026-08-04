/**
 * Normalize PEM private keys from env vars (Render / dotenv often mangle newlines).
 * Also extracts `private_key` if the full Firebase service-account JSON was pasted by mistake.
 */
export function normalizePrivateKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  // Strip wrapping single/double quotes (common when pasting into Render UI).
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  // Accidental full service-account JSON in FIREBASE_PRIVATE_KEY.
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as { private_key?: string };
      if (typeof parsed.private_key === "string" && parsed.private_key.trim()) {
        value = parsed.private_key.trim();
      }
    } catch {
      // keep original; cert init will fail with a clear error
    }
  }

  // Render / .env: literal \n sequences → real newlines
  value = value.replace(/\\n/g, "\n");

  // Sometimes people paste with spaces instead of newlines between PEM lines
  if (!value.includes("\n") && value.includes("-----BEGIN")) {
    value = value
      .replace(/-----BEGIN ([A-Z ]+)-----/g, "-----BEGIN $1-----\n")
      .replace(/-----END ([A-Z ]+)-----/g, "\n-----END $1-----");
  }

  return value.trim() || null;
}
