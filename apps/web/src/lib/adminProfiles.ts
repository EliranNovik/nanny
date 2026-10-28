import { supabase } from "@/lib/supabase";

export const NOT_ADMIN_PROFILE_FILTER =
  "is_admin.eq.false,is_admin.is.null";
export const SUPPORT_TEAM_NAME = "Support Team";
export const SUPPORT_TEAM_AVATAR_URL = "/Tebnu mobile logo.png";

type AdminAwareProfile = {
  id?: string;
  full_name?: string | null;
  photo_url?: string | null;
  is_admin?: boolean | null;
  [key: string]: unknown;
};

export function isAdminProfile(profile?: AdminAwareProfile | null): boolean {
  return profile?.is_admin === true;
}

export function maskAdminProfile<T extends AdminAwareProfile>(
  profile: T,
  viewerId?: string | null,
): T {
  if (!isAdminProfile(profile) || profile.id === viewerId) return profile;
  return {
    ...profile,
    full_name: SUPPORT_TEAM_NAME,
    photo_url: SUPPORT_TEAM_AVATAR_URL,
    city: null,
    bio: null,
    phone: null,
    categories: [],
    whatsapp_number_e164: null,
    telegram_username: null,
    share_whatsapp: false,
    share_telegram: false,
    last_seen_at: null,
    live_until: null,
    is_busy: false,
    presence_status: undefined,
  };
}

let adminIdsCache: { ids: Set<string>; expiresAt: number } | null = null;

export async function loadAdminProfileIds(): Promise<Set<string>> {
  if (adminIdsCache && adminIdsCache.expiresAt > Date.now()) {
    return adminIdsCache.ids;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  if (error) return new Set();
  const ids = new Set((data ?? []).map((row) => row.id as string));
  adminIdsCache = { ids, expiresAt: Date.now() + 10 * 60 * 1000 };
  return ids;
}

export async function withoutAdminProfiles<T>(
  rows: T[],
  idOf: (row: T) => string | null | undefined,
): Promise<T[]> {
  const adminIds = await loadAdminProfileIds();
  if (adminIds.size === 0) return rows;
  return rows.filter((row) => {
    const id = idOf(row);
    return !id || !adminIds.has(id);
  });
}
