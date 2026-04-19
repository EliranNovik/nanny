import { supabase } from "@/lib/supabase";

/** One conversation per job (unique job_id when set). */
export async function findOrCreateJobConversation(params: {
  jobId: string;
  clientId: string;
  freelancerId: string;
}): Promise<{ conversationId: string; created: boolean }> {
  const { jobId, clientId, freelancerId } = params;

  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing?.id) {
    return { conversationId: existing.id as string, created: false };
  }

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      job_id: jobId,
      client_id: clientId,
      freelancer_id: freelancerId,
    })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return { conversationId: (created as { id: string }).id, created: true };
}
