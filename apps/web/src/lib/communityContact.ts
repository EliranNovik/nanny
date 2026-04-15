import type { NavigateFunction } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRole = "client" | "freelancer" | string | null | undefined;

type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
}) => void;

/** Start or open a DM with a community post author (client ↔ helper only). */
export async function openCommunityContact(opts: {
  supabase: SupabaseClient;
  user: User;
  myRole: ProfileRole;
  targetUserId: string;
  targetRole: ProfileRole;
  navigate: NavigateFunction;
  addToast: ToastFn;
}): Promise<void> {
  const {
    supabase,
    user,
    myRole,
    targetUserId,
    targetRole,
    navigate,
    addToast,
  } = opts;
  if (targetUserId === user.id) return;

  if (myRole !== "client" && myRole !== "freelancer") {
    addToast({ title: "Messaging unavailable", variant: "error" });
    return;
  }
  if (targetRole !== "client" && targetRole !== "freelancer") {
    addToast({ title: "Messaging unavailable", variant: "error" });
    return;
  }
  if (myRole === targetRole) {
    addToast({
      title: "Messaging unavailable",
      description: "Message someone in the opposite role (client ↔ helper).",
      variant: "default",
    });
    return;
  }

  const clientId = myRole === "client" ? user.id : targetUserId;
  const freelancerId = myRole === "freelancer" ? user.id : targetUserId;

  try {
    const { data: existing, error: findErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", clientId)
      .eq("freelancer_id", freelancerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) throw findErr;

    if (existing?.id) {
      navigate(`/messages?conversation=${existing.id}`);
      return;
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
    navigate(`/messages?conversation=${created.id}`);
  } catch (e: unknown) {
    console.error(e);
    addToast({
      title: "Could not open chat",
      description: e instanceof Error ? e.message : "Try again.",
      variant: "error",
    });
  }
}
