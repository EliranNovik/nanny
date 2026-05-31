import { supabase } from "@/lib/supabase";

export type PendingProfilePayload = {
  role: "client" | "freelancer";
  fullName: string;
  city: string;
  city_place_id: string;
  email?: string;
  location_lat?: number | null;
  location_lng?: number | null;
};

const STORAGE_KEY = "pendingProfile";

export function readPendingProfile(): PendingProfilePayload | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PendingProfilePayload>;
    if (
      (data.role !== "client" && data.role !== "freelancer") ||
      !data.fullName?.trim() ||
      !data.city?.trim() ||
      !data.city_place_id?.trim()
    ) {
      return null;
    }
    return {
      role: data.role,
      fullName: data.fullName.trim(),
      city: data.city.trim(),
      city_place_id: data.city_place_id.trim(),
      email: data.email,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
    };
  } catch {
    return null;
  }
}

export function savePendingProfile(payload: PendingProfilePayload): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPendingProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Create profile row from localStorage pending signup data (after email confirm). */
export async function commitPendingProfile(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = readPendingProfile();
  if (!pending) {
    return { ok: false, error: "No pending profile data found." };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    role: pending.role,
    full_name: pending.fullName,
    city: pending.city,
    city_place_id: pending.city_place_id,
    location_lat: pending.location_lat ?? null,
    location_lng: pending.location_lng ?? null,
    kyc_status: "not_started",
  });

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  if (pending.role === "freelancer") {
    await supabase.from("freelancer_profiles").upsert({ user_id: userId });
  }

  clearPendingProfile();
  return { ok: true };
}
