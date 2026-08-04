import admin from "firebase-admin";
import { normalizePrivateKey } from "./normalizePrivateKey";
import { pushError, pushLog, pushWarn, tokenPreview } from "./log";

let initialized = false;
let initError: string | null = null;

function describePrivateKeyEnv(): Record<string, unknown> {
  const raw = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const normalized = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  return {
    raw_length: raw.length,
    raw_starts_with_quote: raw.trimStart().startsWith('"') || raw.trimStart().startsWith("'"),
    raw_starts_with_brace: raw.trimStart().startsWith("{"),
    raw_has_literal_backslash_n: raw.includes("\\n"),
    raw_has_real_newline: raw.includes("\n"),
    normalized_length: normalized?.length ?? 0,
    normalized_has_begin: Boolean(normalized?.includes("BEGIN")),
    normalized_has_end: Boolean(normalized?.includes("END")),
    normalized_line_count: normalized ? normalized.split("\n").length : 0,
  };
}

function initFirebaseAdmin(): boolean {
  if (initialized) return true;
  if (initError) return false;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  pushLog("FCM init starting", {
    has_project_id: Boolean(projectId),
    project_id: projectId || null,
    has_client_email: Boolean(clientEmail),
    client_email: clientEmail || null,
    private_key_env: describePrivateKeyEnv(),
  });

  if (!projectId || !clientEmail || !privateKey) {
    initError =
      "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY";
    pushWarn(initError);
    return false;
  }

  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    initError =
      "FIREBASE_PRIVATE_KEY does not look like a PEM private key (expected -----BEGIN PRIVATE KEY-----). Do not paste the full service-account JSON into this var — only the private_key string.";
    pushWarn(initError, { private_key_env: describePrivateKeyEnv() });
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    initError = `Failed to parse FIREBASE_PRIVATE_KEY: ${message}`;
    pushError(initError, { private_key_env: describePrivateKeyEnv() });
    return false;
  }

  initialized = true;
  pushLog("FCM init OK");
  return true;
}

export function isFcmConfigured(): boolean {
  return initFirebaseAdmin();
}

export function getFcmInitError(): string | null {
  initFirebaseAdmin();
  return initError;
}

export type FcmSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  /** First few per-token failure details for queue last_error / logs */
  errors: string[];
};

export async function sendFcmToTokens(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<FcmSendResult> {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], errors: [] };
  }

  pushLog("FCM send start", {
    token_count: tokens.length,
    token_previews: tokens.slice(0, 5).map(tokenPreview),
    title: payload.title,
    data_keys: Object.keys(payload.data ?? {}),
  });

  if (!initFirebaseAdmin()) {
    throw new Error(initError ?? "FCM is not configured on the server");
  }

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    data[key] = typeof value === "string" ? value : JSON.stringify(value);
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data,
    // Android / web FCM only — native iOS APNs tokens are sent via apns.ts, not FCM.
    android: {
      priority: "high",
      notification: {
        channelId: "tebnu_default",
        sound: "default",
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  const invalidTokens: string[] = [];
  const errors: string[] = [];

  response.responses.forEach((res, index) => {
    const tok = tokens[index]!;
    if (res.success) {
      pushLog("FCM token OK", { token: tokenPreview(tok), message_id: res.messageId });
      return;
    }
    const code = res.error?.code ?? "unknown";
    const msg = res.error?.message ?? "no message";
    errors.push(`${tokenPreview(tok)}: ${code} — ${msg}`);
    pushError("FCM token FAIL", {
      token: tokenPreview(tok),
      code,
      message: msg,
    });
    if (
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered"
    ) {
      invalidTokens.push(tok);
    }
  });

  pushLog("FCM send done", {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokenCount: invalidTokens.length,
    sample_errors: errors.slice(0, 5),
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
    errors,
  };
}
