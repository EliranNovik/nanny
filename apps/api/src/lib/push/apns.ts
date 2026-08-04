import http2 from "http2";
import { createPrivateKey, sign } from "crypto";

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

function readApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.tebnu.app";
  const privateKeyPem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const production =
    process.env.APNS_PRODUCTION?.trim().toLowerCase() === "true" ||
    process.env.APNS_PRODUCTION?.trim() === "1";

  if (!keyId || !teamId || !privateKeyPem) {
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
    return cachedJwt.token;
  }

  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(JSON.stringify({ iss: config.teamId, iat: now }));
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(config.privateKeyPem);
  // JWT ES256 requires IEEE P-1363 signature encoding (not DER).
  const signature = sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token, expiresAtMs: (now + JWT_TTL_SECONDS) * 1000 };
  return token;
}

export function isApnsConfigured(): boolean {
  return readApnsConfig() !== null;
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
      client.close();
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
    throw new Error(
      "APNs is not configured on the server (need APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY)",
    );
  }

  const jwt = createApnsJwt(config);
  const host = config.production ? APNS_HOST_PRODUCTION : APNS_HOST_SANDBOX;

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
      continue;
    }
    failureCount += 1;
    const detail = result.reason ?? `status ${result.status}`;
    errors.push(`${token.slice(0, 8)}…: ${detail}`);
    if (isInvalidTokenReason(result.status, result.reason)) {
      invalidTokens.push(token);
    }
  }

  return { successCount, failureCount, invalidTokens, errors };
}
