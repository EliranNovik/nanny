import { loadOpenAiApiKey, supportBotModel } from "./env";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export class SupportBotError extends Error {
  constructor(
    message: string,
    readonly code: "missing_key" | "openai_error" | "invalid_response",
  ) {
    super(message);
    this.name = "SupportBotError";
  }
}

export type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenAiContentPart[];
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

export async function createSupportChatCompletion(
  messages: OpenAiChatMessage[],
): Promise<string> {
  const apiKey = loadOpenAiApiKey();
  if (!apiKey) {
    throw new SupportBotError(
      "OPENAI_API_KEY is not set. Add it to backend/.env.",
      "missing_key",
    );
  }

  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: supportBotModel(),
      // GPT-6.1 Sol always reasons, so temperature is not accepted.
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages,
    }),
    signal: AbortSignal.timeout(
      messages.some((message) => Array.isArray(message.content)) ? 60_000 : 45_000,
    ),
  });

  const payload = (await response.json().catch(() => null)) as
    | ChatCompletionResponse
    | null;

  if (!response.ok) {
    throw new SupportBotError(
      payload?.error?.message || `OpenAI request failed (${response.status})`,
      "openai_error",
    );
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new SupportBotError(
      "OpenAI returned an empty support reply.",
      "invalid_response",
    );
  }
  return content;
}
