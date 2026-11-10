import { supabaseAdmin } from "../../supabase";
import type { SupportUserProfile } from "./supportAgent";

const VERIFICATION_LABEL: Record<string, string> = {
  approved: "verified",
  in_progress: "started, not finished",
  in_review: "submitted, waiting for review",
  pending_review: "submitted, waiting for review",
  declined: "declined",
  expired: "expired, needs to be done again",
  abandoned: "started, not finished",
  skipped: "skipped",
  not_started: "not started",
};

/**
 * The only profile facts the AI may see. Select an explicit, short column list:
 * phone, WhatsApp, Telegram, email, and ids must never reach the model.
 */
export async function userProfileSummary(userId: string): Promise<SupportUserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name, is_verified, kyc_status, role, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const fullName = String(data.full_name ?? "").trim().slice(0, 80) || null;
  const status = String(data.kyc_status ?? "");
  return {
    fullName,
    firstName: fullName?.split(/\s+/)[0] ?? null,
    verified: data.is_verified === true || status === "approved",
    verification: VERIFICATION_LABEL[status] ?? (data.is_verified ? "verified" : "unknown"),
    role:
      data.role === "freelancer"
        ? "helps others"
        : data.role === "client"
          ? "needs help"
          : null,
    memberSince: data.created_at ? String(data.created_at).slice(0, 10) : null,
  };
}
