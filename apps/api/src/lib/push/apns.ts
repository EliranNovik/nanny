import http2 from "http2";
import { createPrivateKey, sign } from "crypto";
import { normalizePrivateKey } from "./normalizePrivateKey";
import { pushError, pushLog, pushWarn, tokenPreview } from "./log";

const APNS_HOST_SANDBOX = "https://api.sandbox.push.apple.com";
const APNS_HOST_PRODUCTION = "https://api.push.apple.com";
/** Apple allows JWTs up to 1 hour; refresh a bit early. */
const JWT_TTL_SECONDS = 50 * 60;

type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKeyPem: string;
  production: boolean;
};

export type ApnsSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  errors: string[];
};

let cachedJwt: { token: string; expiresAtMs: number } | null = null;
let apnsConfigError: string | null = null;

function describeApnsPrivateKeyEnv(): Record<string, unknown> {
  const raw = process.env.APNS_PRIVATE_KEY ?? "";
  const normalized = normalizePrivateKey(process.env.APNS_PRIVATE_KEY);
  return {
    raw_length: raw.length,
    raw_starts_with_quote: raw.trimStart().startsWith('"') || raw.trimStart().startsWith("'"),
    raw_has_literal_backslash_n: raw.includes("\\n"),
    raw_has_real_newline: raw.includes("\n"),
    normalized_length: normalized?.length ?? 0,
    normalized_has_begin: Boolean(normalized?.includes("BEGIN")),
    normalized_has_end: Boolean(normalized?.includes("END")),
    normalized_line_count: normalized ? normalized.split("\n").length : 0,
  };
}

function readApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.tebnu.app";
  const privateKeyPem = normalizePrivateKey(process.env.APNS_PRIVATE_KEY);
  const production =
    process.env.APNS_PRODUCTION?.trim().toLowerCase() === "true" ||
    process.env.APNS_PRODUCTION?.trim() === "1";

  if (!keyId || !teamId || !privateKeyPem) {
    apnsConfigError = "Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY";
    return null;
  }

  if (!privateKeyPem.includes("BEGIN") || !privateKeyPem.includes("PRIVATE KEY")) {
    apnsConfigError =
      "APNS_PRIVATE_KEY does not look like a PEM .p8 key (expected -----BEGIN PRIVATE KEY-----)";
    return null;
  }

  return { keyId, teamId, bundleId, privateKeyPem, production };
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function createApnsJwt(config: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAtMs > Date.now() + 30_000) {
    pushLog("APNs JWT cache hit");
    return cachedJwt.token;
  }

  pushLog("APNs JWT creating", {
    key_id: config.keyId,
    team_id: config.teamId,
    private_key_env: describeApnsPrivateKeyEnv(),
  });

  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(JSON.stringify({ iss: config.teamId, iat: now }));
  const signingInput = `${header}.${payload}`;
  let key;
  try {
    key = createPrivateKey(config.privateKeyPem);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    pushError("APNs private key parse failed", {
      message,
      private_key_env: describeApnsPrivateKeyEnv(),
    });
    throw new Error(`Failed to parse APNS_PRIVATE_KEY: ${message}`);
  }
  // JWT ES256 requires IEEE P-1363 signature encoding (not DER).
  const signature = sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token, expiresAtMs: (now + JWT_TTL_SECONDS) * 1000 };
  pushLog("APNs JWT created OK");
  return token;
}

export function isApnsConfigured(): boolean {
  return readApnsConfig() !== null;
}

export function getApnsConfigError(): string | null {
  if (readApnsConfig()) return null;
  if (apnsConfigError) return apnsConfigError;
  if (
    !process.env.APNS_KEY_ID?.trim() ||
    !process.env.APNS_TEAM_ID?.trim() ||
    !process.env.APNS_PRIVATE_KEY?.trim()
  ) {
    return "Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY";
  }
  return "APNs is not configured";
}

function isInvalidTokenReason(status: number, reason: string | undefined): boolean {
  if (status === 410) return true;
  const r = (reason ?? "").toLowerCase();
  return (
    r === "baddevicetoken" ||
    r === "unregistered" ||
    r === "devicetokennotfortopic"
  );
}

async function sendOneApns(
  host: string,
  jwt: string,
  bundleId: string,
  deviceToken: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; reason?: string; raw?: string }> {
  return new Promise((resolve) => {
    const client = http2.connect(host);
    let settled = false;

    const finish = (result: {
      ok: boolean;
      status: number;
      reason?: string;
      raw?: string;
    }) => {
      if (settled) return;
      settled = true;
      try {
        client.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    client.on("error", (err) => {
      finish({
        ok: false,
        status: 0,
        reason: err instanceof Error ? err.message : "APNs connection error",
      });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    const chunks: Buffer[] = [];

    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (status >= 200 && status < 300) {
        finish({ ok: true, status });
        return;
      }
      let reason: string | undefined;
      try {
        const parsed = JSON.parse(raw) as { reason?: string };
        reason = parsed.reason;
      } catch {
        reason = raw || `HTTP ${status}`;
      }
      finish({ ok: false, status, reason, raw });
    });

    req.on("error", (err) => {
      finish({
        ok: false,
        status: 0,
        reason: err instanceof Error ? err.message : "APNs request error",
      });
    });

    req.end(JSON.stringify(payload));
  });
}

/**
 * Send alert pushes to native APNs device tokens (hex).
 * Does not accept FCM registration tokens.
 */
export async function sendApnsToTokens(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<ApnsSendResult> {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], errors: [] };
  }

  const config = readApnsConfig();
  if (!config) {
    pushWarn("APNs send aborted — not configured", {
      error: getApnsConfigError(),
      private_key_env: describeApnsPrivateKeyEnv(),
      has_key_id: Boolean(process.env.APNS_KEY_ID?.trim()),
      has_team_id: Boolean(process.env.APNS_TEAM_ID?.trim()),
    });
    throw new Error(
      getApnsConfigError() ??
        "APNs is not configured on the server (need APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY)",
    );
  }

  const host = config.production ? APNS_HOST_PRODUCTION : APNS_HOST_SANDBOX;
  pushLog("APNs send start", {
    host,
    production: config.production,
    bundle_id: config.bundleId,
    key_id: config.keyId,
    team_id: config.teamId,
    token_count: tokens.length,
    token_previews: tokens.slice(0, 5).map(tokenPreview),
    title: payload.title,
    data_keys: Object.keys(payload.data ?? {}),
  });

  const jwt = createApnsJwt(config);

  // Custom keys live alongside `aps` so the app can deep-link from data.link / data.type.
  const body: Record<string, unknown> = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      badge: 1,
    },
    ...(payload.data ?? {}),
  };

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];
  const errors: string[] = [];

  // Sequential to keep HTTP/2 client lifecycle simple and avoid stampeding APNs.
  for (const token of tokens) {
    const result = await sendOneApns(host, jwt, config.bundleId, token, body);
    if (result.ok) {
      successCount += 1;
      pushLog("APNs token OK", { token: tokenPreview(token), status: result.status });
      continue;
    }
    failureCount += 1;
    const detail = result.reason ?? `status ${result.status}`;
    errors.push(`${tokenPreview(token)}: ${detail}`);
    pushError("APNs token FAIL", {
      token: tokenPreview(token),
      status: result.status,
      reason: result.reason ?? null,
      raw: result.raw ? result.raw.slice(0, 300) : null,
    });
    if (isInvalidTokenReason(result.status, result.reason)) {
      invalidTokens.push(token);
    }
  }

  pushLog("APNs send done", {
    successCount,
    failureCount,
    invalidTokenCount: invalidTokens.length,
    sample_errors: errors.slice(0, 5),
  });

  return { successCount, failureCount, invalidTokens, errors };
}
