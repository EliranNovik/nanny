import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";

function categoryDisplayLabel(categoryId: string): string {
  if (isServiceCategoryId(categoryId)) {
    return serviceCategoryLabel(categoryId as ServiceCategoryId);
  }
  return categoryId.replace(/_/g, " ");
}

function viewerDisplayName(fullName: string | null | undefined): string {
  const t = fullName?.trim();
  if (t) return t;
  return "Someone";
}

export type KnockMessageErrorCode =
  | "not_signed_in"
  | "no_role"
  | "messaging_unavailable";

/** Two user IDs in stable order for new job-less DMs (columns are participants, not strict roles). */
function sortedParticipantIds(a: string, b: string): [string, string] {
  return a.localeCompare(b) < 0 ? [a, b] : [b, a];
}

/** Ensures a DM exists and inserts the automated knock message. Works for client↔helper or same-role pairs. */
export async function sendKnockMessage(opts: {
  supabase: SupabaseClient;
  currentUserId: string;
  currentProfileRole: string | null;
  currentProfileName: string | null;
  targetUserId: string;
  targetRole: string | null;
  categoryId: string;
}): Promise<
  | { ok: true; conversationId: string }
  | { ok: false; code: KnockMessageErrorCode; message?: string }
> {
  const {
    supabase,
    currentUserId,
    currentProfileRole,
    currentProfileName,
    targetUserId,
    categoryId,
  } = opts;

  if (targetUserId === currentUserId) {
    return {
      ok: false,
      code: "messaging_unavailable",
      message: "Cannot knock your own profile.",
    };
  }

  const myRole = currentProfileRole;
  if (!myRole) {
    return { ok: false, code: "no_role" };
  }
  if (myRole !== "client" && myRole !== "freelancer") {
    return { ok: false, code: "messaging_unavailable" };
  }

  const name = viewerDisplayName(currentProfileName);
  const catLabel = categoryDisplayLabel(categoryId);
  const body = `${name} is reaching for your help in ${catLabel}.`;

  const pairOr =
    `and(client_id.eq.${currentUserId},freelancer_id.eq.${targetUserId}),` +
    `and(client_id.eq.${targetUserId},freelancer_id.eq.${currentUserId})`;

  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id")
    .is("job_id", null)
    .or(pairOr)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) {
    return {
      ok: false,
      code: "messaging_unavailable",
      message: findErr.message,
    };
  }

  let conversationId = existing?.id as string | undefined;

  if (!conversationId) {
    const [clientId, freelancerId] = sortedParticipantIds(
      currentUserId,
      targetUserId,
    );
    const { data: created, error: insErr } = await supabase
      .from("conversations")
      .insert({
        job_id: null,
        client_id: clientId,
        freelancer_id: freelancerId,
      })
      .select("id")
      .single();

    if (insErr || !created?.id) {
      return {
        ok: false,
        code: "messaging_unavailable",
        message: insErr?.message ?? "Could not start conversation.",
      };
    }
    conversationId = created.id as string;
  }

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: currentUserId,
    body,
  });

  if (msgErr) {
    return {
      ok: false,
      code: "messaging_unavailable",
      message: msgErr.message,
    };
  }

  return { ok: true, conversationId };
}
