import { supabaseAdmin } from "../../supabase";
import {
  isTranslateConfigured,
  translateTextsWithGoogle,
} from "./googleTranslateClient";
import {
  SUPPORTED_APP_LOCALES,
  parseAppLocale,
  type AppLocale,
} from "./localeMap";

const BATCH_LIMIT = 20;
const MAX_ATTEMPTS = 5;

type TranslationJob = {
  id: string;
  post_id: string;
  translation_version: number;
  status: string;
  attempts: number;
  last_error: string | null;
};

type ProfilePost = {
  id: string;
  caption: string | null;
  post_type_id: string | null;
  post_metadata: Record<string, unknown> | null;
  original_language: string | null;
  translation_version: number;
};

export type TranslationWorkerResult = {
  ok: true;
  claimed: number;
  completed: number;
  cancelled: number;
  retried: number;
  failed: number;
  skipped: number;
};

function log(message: string, extra?: Record<string, unknown>): void {
  if (extra) console.log("[TranslateQueue]", message, extra);
  else console.log("[TranslateQueue]", message);
}

function logError(message: string, extra?: Record<string, unknown>): void {
  if (extra) console.error("[TranslateQueue]", message, extra);
  else console.error("[TranslateQueue]", message);
}

function nullIfBlank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Mirrors public.profile_post_translatable_title. */
function translatableTitle(
  metadata: Record<string, unknown> | null,
  postTypeId: string | null,
): string | null {
  if (!metadata) return null;
  if (postTypeId === "event") return nullIfBlank(metadata.event_name);
  if (postTypeId === "community") return nullIfBlank(metadata.title);
  return null;
}

function retryDelayMs(attempts: number): number {
  if (attempts <= 1) return 60_000;
  if (attempts === 2) return 5 * 60_000;
  return 30 * 60_000;
}

function asMetadata(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function claimJobs(limit: number): Promise<TranslationJob[]> {
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "claim_translation_jobs",
    { p_limit: limit },
  );

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as TranslationJob[];
  }

  if (rpcError) {
    log("claim RPC unavailable, using fallback", { message: rpcError.message });
  }

  const now = new Date().toISOString();
  const { data: pending, error } = await supabaseAdmin
    .from("translation_jobs")
    .select("id, post_id, translation_version, status, attempts, last_error")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load translation jobs: ${error.message}`);
  }

  const claimed: TranslationJob[] = [];
  for (const row of (pending ?? []) as TranslationJob[]) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("translation_jobs")
      .update({
        status: "processing",
        attempts: (row.attempts ?? 0) + 1,
        claimed_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id, post_id, translation_version, status, attempts, last_error")
      .maybeSingle();

    if (updateError) {
      logError("claim update failed", { id: row.id, message: updateError.message });
      continue;
    }
    if (updated) claimed.push(updated as TranslationJob);
  }

  return claimed;
}

async function updateJob(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("translation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logError("job update failed", { id, message: error.message });
  }
}

async function loadPost(postId: string): Promise<ProfilePost | null> {
  const { data, error } = await supabaseAdmin
    .from("profile_posts")
    .select(
      "id, caption, post_type_id, post_metadata, original_language, translation_version",
    )
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile post ${postId}: ${error.message}`);
  }
  if (!data) return null;

  return {
    ...(data as Omit<ProfilePost, "post_metadata">),
    post_metadata: asMetadata((data as { post_metadata?: unknown }).post_metadata),
  };
}

async function currentPostVersion(postId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("profile_posts")
    .select("translation_version")
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) return null;
  return typeof data.translation_version === "number"
    ? data.translation_version
    : null;
}

async function markPostProcessing(
  postId: string,
  version: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profile_posts")
    .update({ translation_status: "processing" })
    .eq("id", postId)
    .eq("translation_version", version)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark post processing: ${error.message}`);
  }
  return Boolean(data);
}

async function setPostStatus(
  postId: string,
  version: number,
  status: "completed" | "partial" | "failed",
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profile_posts")
    .update({ translation_status: status })
    .eq("id", postId)
    .eq("translation_version", version);

  if (error) {
    logError("post status update failed", { postId, message: error.message });
  }
}

async function targetAlreadyTranslated(
  postId: string,
  language: AppLocale,
  version: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profile_post_translations")
    .select("id")
    .eq("post_id", postId)
    .eq("language", language)
    .eq("translation_version", version)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read translation row: ${error.message}`);
  }
  return Boolean(data);
}

async function upsertTranslation(args: {
  postId: string;
  language: AppLocale;
  caption: string | null;
  title: string | null;
  version: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("profile_post_translations").upsert(
    {
      post_id: args.postId,
      language: args.language,
      caption: args.caption,
      title: args.title,
      provider: "google_translate",
      translation_version: args.version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "post_id,language" },
  );

  if (error) {
    throw new Error(`Failed to upsert translation: ${error.message}`);
  }
}

async function countGoogleTargets(
  postId: string,
  version: number,
  targets: AppLocale[],
): Promise<number> {
  if (targets.length === 0) return 0;
  const { data, error } = await supabaseAdmin
    .from("profile_post_translations")
    .select("language")
    .eq("post_id", postId)
    .eq("translation_version", version)
    .eq("provider", "google_translate")
    .in("language", targets);

  if (error) {
    logError("count translations failed", { postId, message: error.message });
    return 0;
  }
  return (data ?? []).length;
}

async function finalizePostStatus(
  postId: string,
  version: number,
  targets: AppLocale[],
): Promise<"completed" | "partial" | "failed"> {
  const count = await countGoogleTargets(postId, version, targets);
  const status =
    count >= targets.length ? "completed" : count > 0 ? "partial" : "failed";
  await setPostStatus(postId, version, status);
  return status;
}

async function scheduleRetry(job: TranslationJob, lastError: string): Promise<"retried" | "failed"> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await updateJob(job.id, {
      status: "failed",
      last_error: lastError,
    });
    return "failed";
  }

  await updateJob(job.id, {
    status: "pending",
    last_error: lastError,
    next_attempt_at: new Date(Date.now() + retryDelayMs(job.attempts)).toISOString(),
  });
  return "retried";
}

async function processClaimedJob(
  job: TranslationJob,
): Promise<"completed" | "cancelled" | "retried" | "failed" | "skipped"> {
  const post = await loadPost(job.post_id);
  if (!post) {
    await updateJob(job.id, {
      status: "failed",
      last_error: "profile_posts row missing",
    });
    return "failed";
  }

  if (job.translation_version !== post.translation_version) {
    await updateJob(job.id, {
      status: "cancelled",
      last_error: "stale translation_version",
    });
    return "cancelled";
  }

  const marked = await markPostProcessing(post.id, job.translation_version);
  if (!marked) {
    await updateJob(job.id, {
      status: "cancelled",
      last_error: "translation_version changed before processing",
    });
    return "cancelled";
  }

  const source = parseAppLocale(post.original_language);
  if (!source) {
    await updateJob(job.id, {
      status: "cancelled",
      last_error: "original_language missing or unsupported",
    });
    return "cancelled";
  }

  const caption = nullIfBlank(post.caption);
  const title = translatableTitle(post.post_metadata, post.post_type_id);
  const targets = SUPPORTED_APP_LOCALES.filter((locale) => locale !== source);

  if (!caption && !title) {
    await setPostStatus(post.id, job.translation_version, "completed");
    await updateJob(job.id, { status: "completed", last_error: null });
    return "completed";
  }

  if (!isTranslateConfigured()) {
    const outcome = await scheduleRetry(job, "Translation service is not configured");
    if (outcome === "failed") {
      await finalizePostStatus(post.id, job.translation_version, targets);
    }
    return outcome;
  }

  try {
    for (const lang of targets) {
      if (await targetAlreadyTranslated(post.id, lang, job.translation_version)) {
        continue;
      }

      const batchKeys: Array<"caption" | "title"> = [];
      const batchTexts: string[] = [];
      if (caption) {
        batchKeys.push("caption");
        batchTexts.push(caption);
      }
      if (title) {
        batchKeys.push("title");
        batchTexts.push(title);
      }

      const google = await translateTextsWithGoogle(batchTexts, lang, source);

      const latestVersion = await currentPostVersion(post.id);
      if (latestVersion !== job.translation_version) {
        await updateJob(job.id, {
          status: "cancelled",
          last_error: "stale translation_version before upsert",
        });
        return "cancelled";
      }

      let translatedCaption: string | null = null;
      let translatedTitle: string | null = null;
      for (let i = 0; i < batchKeys.length; i += 1) {
        const key = batchKeys[i]!;
        const text = google.translatedTexts[i]?.trim() || batchTexts[i] || null;
        if (key === "caption") translatedCaption = text;
        if (key === "title") translatedTitle = text;
      }

      await upsertTranslation({
        postId: post.id,
        language: lang,
        caption: translatedCaption,
        title: translatedTitle,
        version: job.translation_version,
      });
    }

    await finalizePostStatus(post.id, job.translation_version, targets);
    await updateJob(job.id, { status: "completed", last_error: null });
    return "completed";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Translation job failed";
    logError("job failed", { job_id: job.id, post_id: job.post_id, message });
    const outcome = await scheduleRetry(job, message);
    await finalizePostStatus(post.id, job.translation_version, targets);
    return outcome;
  }
}

export async function processTranslationJobs(
  limit = BATCH_LIMIT,
): Promise<TranslationWorkerResult> {
  const claimed = await claimJobs(limit);
  const summary: TranslationWorkerResult = {
    ok: true,
    claimed: claimed.length,
    completed: 0,
    cancelled: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  log("Batch claimed", { count: claimed.length });

  for (const job of claimed) {
    try {
      const outcome = await processClaimedJob(job);
      summary[outcome] += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected job error";
      logError("unhandled job error", { job_id: job.id, message });
      const retryOutcome = await scheduleRetry(job, message);
      summary[retryOutcome] += 1;
    }
  }

  if (claimed.length > 0) {
    log("Batch done", summary);
  }
  return summary;
}
