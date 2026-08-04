/** Bumped when push send path changes — search Render logs for this string after deploy. */
export const PUSH_WORKER_VERSION = "push-apns-v3-2026-08-04";

export function pushLog(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[Push] ${message}`, meta);
  } else {
    console.log(`[Push] ${message}`);
  }
}

export function pushWarn(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.warn(`[Push] ${message}`, meta);
  } else {
    console.warn(`[Push] ${message}`);
  }
}

export function pushError(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.error(`[Push] ${message}`, meta);
  } else {
    console.error(`[Push] ${message}`);
  }
}

/** Safe token preview for logs (never full token). */
export function tokenPreview(token: string): string {
  if (!token) return "(empty)";
  if (token.length <= 12) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 8)}…${token.slice(-4)} (len=${token.length})`;
}
