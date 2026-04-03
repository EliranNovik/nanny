import { supabase } from "@/lib/supabase";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

export interface NotificationAlert {
  id: string;
  type: "job_request" | "confirmation" | "message" | "job_update";
  title: string;
  description?: string;
  link: string;
  created_at?: string;
  sender_name?: string;
  sender_photo?: string;
  metadata?: Record<string, unknown>;
}

type FetchOpts = {
  /** When false, skips per-conversation unread message rows (inbox shows chats separately). */
  includeUnreadMessageAlerts: boolean;
};

/**
 * Loads job invites, request responses, hire confirmations, and related updates.
 * Optionally includes unread-message summaries (used by the header notifications modal).
 */
export async function fetchInboxActivityAlerts(
  user: { id: string },
  profile: { role: string },
  opts: FetchOpts
): Promise<NotificationAlert[]> {
  const allAlerts: NotificationAlert[] = [];

  if (opts.includeUnreadMessageAlerts) {
    const { data: convos } = await supabase
      .from("conversations")
      .select(
        `
          id,
          client_id,
          freelancer_id,
          job_id,
          job_requests (care_type)
        `
      )
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

    if (convos && convos.length > 0) {
      const convoIds = convos.map((c) => c.id);
      const { data: unreadMsgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false });

      if (unreadMsgs && unreadMsgs.length > 0) {
        const latestByConvo = new Map<string, (typeof unreadMsgs)[0]>();
        for (const m of unreadMsgs) {
          if (!latestByConvo.has(m.conversation_id)) {
            latestByConvo.set(m.conversation_id, m);
          }
        }

        for (const [convoId, msg] of latestByConvo.entries()) {
          const convo = convos.find((c) => c.id === convoId);
          if (!convo) continue;

          const otherId =
            user.id === convo.client_id ? convo.freelancer_id : convo.client_id;

          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name, photo_url")
            .eq("id", otherId)
            .single();

          allAlerts.push({
            id: `msg-${msg.id}`,
            type: "message",
            title: senderProfile?.full_name || "New message",
            description: msg.body ?? undefined,
            link: `/messages?conversation=${convoId}`,
            created_at: msg.created_at,
            sender_name: senderProfile?.full_name || "User",
            sender_photo: senderProfile?.photo_url || undefined,
            metadata: { conversation_id: convoId, sender_id: otherId },
          });
        }
      }
    }
  }

  if (profile.role === "freelancer") {
    const { data: notifications } = await supabase
      .from("job_candidate_notifications")
      .select(
        `
            id, created_at, job_id,
            job_requests (
              id, location_city, service_type, care_type, confirm_ends_at, community_post_id
            )
          `
      )
      .eq("freelancer_id", user.id)
      .in("status", ["pending", "opened"])
      .order("created_at", { ascending: false });

    if (notifications) {
      const now = new Date();
      for (const n of notifications as any[]) {
        const job = n.job_requests;
        if (job?.community_post_id) continue;
        if (
          job &&
          (!job.confirm_ends_at || new Date(job.confirm_ends_at).getTime() > now.getTime())
        ) {
          allAlerts.push({
            id: n.id as string,
            type: "job_request",
            title: `New ${job.care_type || job.service_type || "job"} request`,
            description: job.location_city ? `Location: ${job.location_city}` : "Open to review",
            link: buildJobsUrl("freelancer", "requests"),
            created_at: n.created_at,
            metadata: { table: "job_candidate_notifications", job_id: job.id },
          });
        }
      }
    }

    const { data: liveJobs } = await supabase
      .from("job_requests")
      .select("id, status, care_type, updated_at")
      .eq("selected_freelancer_id", user.id)
      .in("status", ["locked", "active"])
      .gte("updated_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("updated_at", { ascending: false });

    if (liveJobs) {
      for (const job of liveJobs) {
        allAlerts.push({
          id: `job-up-${job.id}`,
          type: "job_update",
          title: "Job confirmed",
          description: `Your ${job.care_type || "job"} is ready to start.`,
          link: buildJobsUrl("freelancer", "jobs"),
          created_at: job.updated_at,
          metadata: { job_id: job.id },
        });
      }
    }
  }

  if (profile.role === "client") {
    const { data: jobs } = await supabase
      .from("job_requests")
      .select("id, care_type")
      .eq("client_id", user.id)
      .in("status", ["notifying", "confirmations_closed"]);

    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      const { data: confirmations } = await supabase
        .from("job_confirmations")
        .select(
          `
                id, created_at, job_id, freelancer_id,
                profiles (full_name, photo_url)
            `
        )
        .in("job_id", jobIds)
        .eq("status", "available");

      if (confirmations) {
        for (const c of confirmations as any[]) {
          allAlerts.push({
            id: c.id as string,
            type: "confirmation",
            title: "Helper available",
            description: `${c.profiles?.full_name || "A helper"} responded to your request.`,
            link: buildJobsUrl("client", "my_requests"),
            created_at: c.created_at,
            sender_name: c.profiles?.full_name,
            sender_photo: c.profiles?.photo_url,
            metadata: { table: "job_confirmations", confirmation_id: c.id },
          });
        }
      }
    }

    const { data: communityHires } = await supabase
      .from("job_requests")
      .select("id, service_type, locked_at, community_post_id")
      .eq("client_id", user.id)
      .not("community_post_id", "is", null)
      .in("status", ["locked", "active"])
      .gte(
        "locked_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("locked_at", { ascending: false });

    for (const job of communityHires || []) {
      const j = job as any;
      allAlerts.push({
        id: `community-hire-${j.id}`,
        type: "job_update",
        title: "Hire confirmed",
        description: "Your booking from an availability post is live.",
        link: buildJobsUrl("client", "jobs"),
        created_at: j.locked_at,
        metadata: { job_id: j.id },
      });
    }
  }

  allAlerts.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return allAlerts;
}

export function inboxActivityKindLabel(type: NotificationAlert["type"]): string {
  switch (type) {
    case "message":
      return "Chat";
    case "job_request":
      return "Job invite";
    case "confirmation":
      return "Response";
    case "job_update":
      return "Update";
    default:
      return "Activity";
  }
}
