import { supabase } from "@/lib/supabase";

export const PUBLIC_PROFILE_MEDIA_BUCKET = "public-profile-media";

export function publicProfileMediaPublicUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(PUBLIC_PROFILE_MEDIA_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}
