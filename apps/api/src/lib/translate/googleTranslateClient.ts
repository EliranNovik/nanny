import { v2 } from "@google-cloud/translate";
import {
  normalizeAppLocale,
  toGoogleTargetLanguage,
  type AppLocale,
} from "./localeMap";

type TranslateClient = InstanceType<typeof v2.Translate>;

let client: TranslateClient | null = null;

function parseServiceAccountJson(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("[Translate] Invalid GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON");
    return null;
  }
}

function getTranslateClient(): TranslateClient {
  if (client) return client;

  const credentials = parseServiceAccountJson();
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ||
    (typeof credentials?.project_id === "string" ? credentials.project_id : undefined);

  if (credentials) {
    client = new v2.Translate({
      projectId,
      credentials: credentials as {
        client_email: string;
        private_key: string;
      },
    });
    return client;
  }

  client = new v2.Translate({ projectId });
  return client;
}

export type GoogleTranslateResult = {
  translatedTexts: string[];
  detectedSourceLanguage: string | null;
};

export async function translateTextsWithGoogle(
  texts: string[],
  targetLocale: AppLocale,
): Promise<GoogleTranslateResult> {
  const nonEmpty = texts.map((t) => t.trim()).filter(Boolean);
  if (nonEmpty.length === 0) {
    return { translatedTexts: [], detectedSourceLanguage: null };
  }

  const apiKey = process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY?.trim();
  const target = toGoogleTargetLanguage(normalizeAppLocale(targetLocale));

  if (apiKey) {
    const params = new URLSearchParams();
    params.set("key", apiKey);
    params.set("target", target);
    params.set("format", "text");
    for (const text of nonEmpty) {
      params.append("q", text);
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
      { method: "POST" },
    );

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as {
          error?: { message?: string };
        };
        detail = body.error?.message || detail;
      } catch {
        /* keep default */
      }
      throw new Error(`Google Translate API error: ${detail}`);
    }

    const body = (await res.json()) as {
      data?: {
        translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>;
      };
    };

    const translations = body.data?.translations ?? [];
    return {
      translatedTexts: translations.map((t) => t.translatedText ?? ""),
      detectedSourceLanguage:
        translations.find((t) => t.detectedSourceLanguage)?.detectedSourceLanguage ??
        null,
    };
  }

  const translate = getTranslateClient();
  const [translatedTexts, apiResponse] = await translate.translate(nonEmpty, target);
  const list = Array.isArray(translatedTexts) ? translatedTexts : [translatedTexts];
  const detected =
    (apiResponse as { data?: { translations?: Array<{ detectedSourceLanguage?: string }> } })
      ?.data?.translations?.[0]?.detectedSourceLanguage ?? null;

  return {
    translatedTexts: list,
    detectedSourceLanguage: detected,
  };
}

export function isTranslateConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY?.trim() ||
      process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}
