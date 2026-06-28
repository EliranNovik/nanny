import { supabaseAdmin } from "../../supabase";
import { isNonTranslatableChatBody } from "./systemMessage";
import type { ContentKind, TranslateField } from "./cache";

export type GeneratedCopy = {
  title?: string;
  short_text?: string;
  feed_preview?: string;
};

export type ResolvedContent = {
  fields: Partial<Record<TranslateField, string>>;
  skipped?: boolean;
  skipReason?: string;
};

function humanizeCategory(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value
    .trim()
    .replace(/(\d)_(\d)/g, "$1-$2")
    .replace(/_/g, " ")
    .split(" ")
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(" ");
}

function resolveProfilePostFields(row: {
  caption: string | null;
  ai_generated_copy: GeneratedCopy | null;
  post_type_id: string | null;
  post_metadata: Record<string, unknown> | null;
}): Partial<Record<TranslateField, string>> {
  const copy = row.ai_generated_copy;
  const caption = row.caption?.trim() ?? "";
  const fields: Partial<Record<TranslateField, string>> = {};

  let title: string | null = copy?.title?.trim() || null;
  if (!title && row.post_type_id === "event") {
    const eventName = row.post_metadata?.event_name;
    if (typeof eventName === "string" && eventName.trim()) {
      title = eventName.trim();
    }
  }

  const bodySource = (copy?.short_text ?? caption).trim();
  let body = bodySource;
  if (title && body.toLowerCase() === title.toLowerCase()) {
    body = "";
  }

  if (title) fields.title = title;
  if (body) fields.body = body;
  else if (!title && caption) fields.body = caption;

  return fields;
}

function resolveJobRequestFields(row: {
  notes: string | null;
  ai_generated_copy: GeneratedCopy | null;
  service_type: string | null;
  care_type: string | null;
}): Partial<Record<TranslateField, string>> {
  const copy = row.ai_generated_copy;
  const fields: Partial<Record<TranslateField, string>> = {};

  let title = copy?.title?.trim() || null;
  if (!title) {
    const category =
      humanizeCategory(row.service_type) ?? humanizeCategory(row.care_type);
    if (category) title = `${category} help needed`;
  }

  const notes = row.notes?.trim() ?? "";
  const bodySource = (copy?.short_text ?? notes).trim();
  let body = bodySource;
  if (title && body.toLowerCase() === title.toLowerCase()) {
    body = "";
  }

  if (title) fields.title = title;
  if (body) fields.body = body;
  else if (!title && notes) fields.body = notes;

  return fields;
}

async function verifyChatAccess(
  messageId: string,
  userId: string,
): Promise<ResolvedContent> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select(
      "id, body, conversation_id, conversations!inner(client_id, freelancer_id)",
    )
    .eq("id", messageId)
    .maybeSingle();

  if (error || !data) {
    return { fields: {}, skipped: true, skipReason: "not_found" };
  }

  const conversationRaw = data.conversations as
    | { client_id: string; freelancer_id: string }
    | { client_id: string; freelancer_id: string }[]
    | null;
  const conversation = Array.isArray(conversationRaw)
    ? conversationRaw[0]
    : conversationRaw;

  if (
    !conversation ||
    (conversation.client_id !== userId &&
      conversation.freelancer_id !== userId)
  ) {
    return { fields: {}, skipped: true, skipReason: "forbidden" };
  }

  const body = data.body?.trim() ?? "";
  if (isNonTranslatableChatBody(body)) {
    return { fields: {}, skipped: true, skipReason: "non_translatable" };
  }

  return { fields: { body } };
}

export async function resolveContentForTranslation(
  contentKind: ContentKind,
  contentId: string,
  userId: string | null,
): Promise<ResolvedContent> {
  switch (contentKind) {
    case "profile_post": {
      const { data, error } = await supabaseAdmin
        .from("profile_posts")
        .select("caption, ai_generated_copy, post_type_id, post_metadata")
        .eq("id", contentId)
        .maybeSingle();
      if (error || !data) {
        return { fields: {}, skipped: true, skipReason: "not_found" };
      }
      const fields = resolveProfilePostFields(data);
      if (Object.keys(fields).length === 0) {
        return { fields: {}, skipped: true, skipReason: "empty" };
      }
      return { fields };
    }

    case "job_request": {
      const { data, error } = await supabaseAdmin
        .from("job_requests")
        .select("notes, ai_generated_copy, service_type, care_type")
        .eq("id", contentId)
        .maybeSingle();
      if (error || !data) {
        return { fields: {}, skipped: true, skipReason: "not_found" };
      }
      const fields = resolveJobRequestFields(data);
      if (Object.keys(fields).length === 0) {
        return { fields: {}, skipped: true, skipReason: "empty" };
      }
      return { fields };
    }

    case "profile_post_comment": {
      const { data, error } = await supabaseAdmin
        .from("profile_post_comments")
        .select("body, post_id")
        .eq("id", contentId)
        .maybeSingle();
      if (error || !data?.body?.trim()) {
        return { fields: {}, skipped: true, skipReason: "not_found" };
      }
      return { fields: { body: data.body.trim() } };
    }

    case "job_request_comment": {
      const { data, error } = await supabaseAdmin
        .from("job_request_comments")
        .select("body, job_request_id")
        .eq("id", contentId)
        .maybeSingle();
      if (error || !data?.body?.trim()) {
        return { fields: {}, skipped: true, skipReason: "not_found" };
      }
      return { fields: { body: data.body.trim() } };
    }

    case "chat_message": {
      if (!userId) {
        return { fields: {}, skipped: true, skipReason: "auth_required" };
      }
      return verifyChatAccess(contentId, userId);
    }

    default:
      return { fields: {}, skipped: true, skipReason: "unsupported" };
  }
}
