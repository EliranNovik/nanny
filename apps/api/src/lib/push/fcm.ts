import admin from "firebase-admin";
import { normalizePrivateKey } from "./normalizePrivateKey";

let initialized = false;
let initError: string | null = null;

function initFirebaseAdmin(): boolean {
  if (initialized) return true;
  if (initError) return false;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "[FCM] Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY — push sending disabled",
    );
    return false;
  }

  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    initError =
      "FIREBASE_PRIVATE_KEY does not look like a PEM private key (expected -----BEGIN PRIVATE KEY-----). Do not paste the full service-account JSON into this var — only the private_key string.";
    console.warn(`[FCM] ${initError}`);
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
    console.warn(`[FCM] ${initError}`);
    return false;
  }

  initialized = true;
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
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

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

  response.responses.forEach((res, index) => {
    if (res.success) return;
    const code = res.error?.code ?? "";
    if (
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered"
    ) {
      invalidTokens.push(tokens[index]!);
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}
