import { supabase } from "@/lib/supabase";

/**
 * Direct (non–job-scoped) chat between client and freelancer.
 */
export async function findOrCreateDirectConversation(params: {
  clientId: string;
  freelancerId: string;
}): Promise<{ conversationId: string; created: boolean }> {
  const { clientId, freelancerId } = params;

  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("freelancer_id", freelancerId)
    .is("job_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing?.id) {
    return { conversationId: existing.id as string, created: false };
  }

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      job_id: null,
      client_id: clientId,
      freelancer_id: freelancerId,
    })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return { conversationId: (created as { id: string }).id, created: true };
}
