import { supabase } from "@/lib/supabase";
import { LEGAL_VERSION } from "@/data/legalContentRevised";

const PENDING_KEY = "tebnu:pending-legal-acceptance";

export function markPendingLegalAcceptance(): void {
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ version: LEGAL_VERSION, acceptedAt: new Date().toISOString() }),
  );
}

export function hasPendingLegalAcceptance(): boolean {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version === LEGAL_VERSION;
  } catch {
    return false;
  }
}

export async function recordLegalAcceptance(userId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      legal_terms_version: LEGAL_VERSION,
      legal_terms_accepted_at: now,
      privacy_version: LEGAL_VERSION,
      privacy_accepted_at: now,
      age_18_confirmed_at: now,
    })
    .eq("id", userId);
  if (error) {
    console.error("[legalAcceptance] update failed", error.message);
    return false;
  }
  localStorage.removeItem(PENDING_KEY);
  return true;
}

export function profileHasCurrentLegalAcceptance(profile: {
  legal_terms_version?: string | null;
  privacy_version?: string | null;
  age_18_confirmed_at?: string | null;
} | null): boolean {
  return Boolean(
    profile?.legal_terms_version === LEGAL_VERSION &&
      profile?.privacy_version === LEGAL_VERSION &&
      profile?.age_18_confirmed_at,
  );
}
