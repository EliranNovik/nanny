import { supabaseAdmin } from "../supabase";

export const KYC_REQUIRED_CODE = "KYC_REQUIRED";

export async function loadProfileKycStatus(
  userId: string,
): Promise<{ kyc_status: string; is_admin: boolean | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("kyc_status, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function isKycApprovedProfile(profile: {
  kyc_status?: string | null;
  is_admin?: boolean | null;
} | null): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  return profile.kyc_status === "approved";
}

export async function assertKycApproved(userId: string): Promise<
  | { ok: true }
  | { ok: false; error: string; code: typeof KYC_REQUIRED_CODE }
> {
  const profile = await loadProfileKycStatus(userId);
  if (!profile) {
    return { ok: false, error: "Profile not found", code: KYC_REQUIRED_CODE };
  }
  if (isKycApprovedProfile(profile)) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      "Verify your identity before using this feature. You can complete verification anytime from your account.",
    code: KYC_REQUIRED_CODE,
  };
}
