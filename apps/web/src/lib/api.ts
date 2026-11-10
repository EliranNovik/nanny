import { getSupabaseSession, supabase } from "./supabase";

/** In dev, route local API calls through the Vite proxy (same-origin). */
function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (import.meta.env.DEV) {
    if (
      !configured ||
      configured.includes("localhost:4000") ||
      configured.includes("127.0.0.1:4000")
    ) {
      return "";
    }
    return configured;
  }
  return configured || "http://localhost:4000";
}

const base = resolveApiBase();

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data, error } = await getSupabaseSession();

    if (error) {
      console.error("[authHeader] Error getting session:", error);
      throw new Error(
        "Failed to get authentication session. Please log in again.",
      );
    }

    const token = data.session?.access_token;
    if (!token) {
      console.warn("[authHeader] No auth token available");
      throw new Error("Not authenticated. Please log in.");
    }

    console.log("[authHeader] Token retrieved successfully");
    return { Authorization: `Bearer ${token}` };
  } catch (err: any) {
    console.error("[authHeader] Exception:", err);
    throw err;
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  try {
    const headers = await authHeader();
    console.log("[apiPost] Making request to:", `${base}${path}`);

    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      console.error(
        "[apiPost] API error:",
        errorMessage,
        "Status:",
        res.status,
      );
      throw new Error(errorMessage);
    }

    return res.json();
  } catch (err: any) {
    if (
      err.message?.includes("fetch failed") ||
      err.message?.includes("Failed to fetch")
    ) {
      console.error("[apiPost] Network error - Is the backend running?", err);
      throw new Error(
        "Cannot connect to server. Please make sure the backend is running on port 4000.",
      );
    }
    throw err;
  }
}

/**
 * POST that answers with server-sent events. Calls onEvent for each event until
 * the stream ends. Throws on HTTP errors with the server's message.
 */
export async function apiPostStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await authHeader();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    throw new Error("Cannot connect to server. Please try again.");
  }
  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.error || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf("\n\n");
    while (split >= 0) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf("\n\n");
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.join("\n"));
      } catch {
        continue;
      }
      onEvent(event, parsed);
    }
  }
}

export async function apiPublicPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return res.json();
  } catch (err: any) {
    if (
      err.message?.includes("fetch failed") ||
      err.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        "Cannot connect to server. Please try again later or email us directly.",
      );
    }
    throw err;
  }
}

export type TranslateContentKind =
  | "profile_post"
  | "job_request"
  | "profile_post_comment"
  | "job_request_comment"
  | "chat_message";

export type TranslateContentResponse = {
  fields: { title?: string; body?: string };
  sourceLocale: string | null;
  targetLocale: string;
  cached: boolean;
  alreadyInTargetLanguage: boolean;
  skipped?: boolean;
  skipReason?: string;
};

async function optionalAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    /* guest */
  }
  return {};
}

export async function apiTranslateContent(input: {
  contentKind: TranslateContentKind;
  contentId: string;
  targetLocale?: string;
}): Promise<TranslateContentResponse> {
  const headers = await optionalAuthHeader();
  const res = await fetch(`${base}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    let errorMessage = "Could not translate";
    try {
      const err = await res.json();
      errorMessage = err.error || errorMessage;
    } catch {
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  try {
    const headers = await authHeader();
    console.log("[apiGet] Making request to:", `${base}${path}`);

    const res = await fetch(`${base}${path}`, { headers });

    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      console.error("[apiGet] API error:", errorMessage, "Status:", res.status);
      throw new Error(errorMessage);
    }

    return res.json();
  } catch (err: any) {
    if (
      err.message?.includes("fetch failed") ||
      err.message?.includes("Failed to fetch")
    ) {
      console.error("[apiGet] Network error - Is the backend running?", err);
      throw new Error(
        "Cannot connect to server. Please make sure the backend is running on port 4000.",
      );
    }
    throw err;
  }
}

export async function apiPatch<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  try {
    const headers = await authHeader();
    console.log("[apiPatch] Making request to:", `${base}${path}`);

    const res = await fetch(`${base}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      console.error(
        "[apiPatch] API error:",
        errorMessage,
        "Status:",
        res.status,
      );
      throw new Error(errorMessage);
    }

    return res.json();
  } catch (err: any) {
    if (
      err.message?.includes("fetch failed") ||
      err.message?.includes("Failed to fetch")
    ) {
      console.error("[apiPatch] Network error - Is the backend running?", err);
      throw new Error(
        "Cannot connect to server. Please make sure the backend is running on port 4000.",
      );
    }
    throw err;
  }
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  try {
    const headers = await authHeader();
    console.log("[apiDelete] Making request to:", `${base}${path}`);

    const res = await fetch(`${base}${path}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      let errorMessage = "API error";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
      console.error(
        "[apiDelete] API error:",
        errorMessage,
        "Status:",
        res.status,
      );
      throw new Error(errorMessage);
    }

    return res.json();
  } catch (err: any) {
    if (
      err.message?.includes("fetch failed") ||
      err.message?.includes("Failed to fetch")
    ) {
      console.error("[apiDelete] Network error - Is the backend running?", err);
      throw new Error(
        "Cannot connect to server. Please make sure the backend is running on port 4000.",
      );
    }
    throw err;
  }
}
