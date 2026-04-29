import { supabase } from "@/lib/supabase";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { loadDismissedActivityIds } from "@/lib/inboxDismissedActivity";

export interface NotificationAlert {
  id: string;
  type:
    | "job_request"
    | "confirmation"
    | "message"
    | "job_update"
    | "hire_interest"
    | "job_comment";
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
  opts: FetchOpts,
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
        `,
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

          let link = `/messages?conversation=${convoId}`;
          if (profile.role === "freelancer" && msg.body && (msg.body.includes("replied back in comments") || msg.body.includes("left a comment on your request"))) {
            const { data: latestJob } = await supabase
              .from("job_requests")
              .select("id")
              .eq("client_id", convo.client_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latestJob) {
              link = `/freelancer/jobs/match?openJobId=${latestJob.id}`;
            }
          }

          allAlerts.push({
            id: `msg-${msg.id}`,
            type: "message",
            title: senderProfile?.full_name || "New message",
            description: msg.body ?? undefined,
            link,
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
    // Hire interest on the freelancer's availability posts (community).
    const { data: myPosts } = await supabase
      .from("community_posts")
      .select("id")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);

    const myPostIds = (myPosts ?? [])
      .map((p) => p.id as string)
      .filter(Boolean);
    if (myPostIds.length > 0) {
      const { data: interests, error: iErr } = await supabase
        .from("community_post_hire_interests")
        .select("id, created_at, status, community_post_id, client_id")
        .in("community_post_id", myPostIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (iErr) {
        console.warn("[fetchInboxActivityAlerts] hire interests", iErr);
      } else if (interests && interests.length > 0) {
        const clientIds = Array.from(
          new Set(
            (interests as any[])
              .map((r) => r.client_id as string)
              .filter(Boolean),
          ),
        );
        const { data: clientProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", clientIds);

        const clients = new Map<
          string,
          { full_name: string | null; photo_url: string | null }
        >();
        for (const p of clientProfiles ?? []) {
          clients.set(p.id as string, {
            full_name: (p as any).full_name ?? null,
            photo_url: (p as any).photo_url ?? null,
          });
        }

        for (const r of interests as any[]) {
          const c = clients.get(r.client_id as string);
          const name = c?.full_name?.trim() || "Someone";
          allAlerts.push({
            id: `hire-${r.id as string}`,
            type: "hire_interest",
            title: `${name} wants to connect`,
            description: "New interest on your availability post.",
            link: `/availability/post/${encodeURIComponent(r.community_post_id as string)}/hires`,
            created_at: r.created_at as string | undefined,
            sender_name: c?.full_name ?? undefined,
            sender_photo: c?.photo_url ?? undefined,
            metadata: {
              table: "community_post_hire_interests",
              interest_id: r.id,
              post_id: r.community_post_id,
            },
          });
        }
      }
    }

    const { data: notifications } = await supabase
      .from("job_candidate_notifications")
      .select(
        `
            id, created_at, job_id,
            job_requests (
              id, location_city, service_type, care_type, confirm_ends_at, community_post_id
            )
          `,
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
          (!job.confirm_ends_at ||
            new Date(job.confirm_ends_at).getTime() > now.getTime())
        ) {
          allAlerts.push({
            id: n.id as string,
            type: "job_request",
            title: `New ${job.care_type || job.service_type || "job"} request`,
            description: job.location_city
              ? `Location: ${job.location_city}`
              : "Open to review",
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
      .gte(
        "updated_at",
        new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      )
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
            `,
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
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
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

  // Common: comments on posts
  if (profile.role === "client") {
    const { data: myJobs } = await supabase
      .from("job_requests")
      .select("id, care_type")
      .eq("client_id", user.id);
    
    if (myJobs && myJobs.length > 0) {
      const myJobIds = myJobs.map((j) => j.id);
      const { data: comments } = await supabase
        .from("job_request_comments")
        .select(`
          id,
          body,
          created_at,
          author_id,
          job_request_id
        `)
        .in("job_request_id", myJobIds)
        .neq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (comments && comments.length > 0) {
        const authorIds = [...new Set(comments.map((c) => c.author_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", authorIds);

        const profMap = new Map((profs || []).map((p) => [p.id, p]));

        for (const c of comments) {
          const author = profMap.get(c.author_id);
          allAlerts.push({
            id: `job-comment-${c.id}`,
            type: "job_comment",
            title: `Comment from ${author?.full_name || "Member"}`,
            description: c.body,
            link: buildJobsUrl("client", "my_requests"),
            created_at: c.created_at,
            sender_name: author?.full_name,
            sender_photo: author?.photo_url,
            metadata: { table: "job_request_comments", comment_id: c.id, job_id: c.job_request_id },
          });
        }
      }
    }
  } else if (profile.role === "freelancer") {
    const { data: myNotifs } = await supabase
      .from("job_candidate_notifications")
      .select("job_id")
      .eq("freelancer_id", user.id);

    const { data: myParticipations } = await supabase
      .from("job_request_comments")
      .select("job_request_id")
      .eq("author_id", user.id);

    const myJobIds = new Set<string>();
    if (myNotifs) {
      for (const n of myNotifs) myJobIds.add(n.job_id);
    }
    if (myParticipations) {
      for (const p of myParticipations) myJobIds.add(p.job_request_id);
    }

    if (myJobIds.size > 0) {
      const jobIdsArr = Array.from(myJobIds);
      const { data: comments } = await supabase
        .from("job_request_comments")
        .select(`
          id,
          body,
          created_at,
          author_id,
          job_request_id
        `)
        .in("job_request_id", jobIdsArr)
        .neq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (comments && comments.length > 0) {
        const authorIds = [...new Set(comments.map((c) => c.author_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", authorIds);

        const profMap = new Map((profs || []).map((p) => [p.id, p]));

        for (const c of comments) {
          const author = profMap.get(c.author_id);
          allAlerts.push({
            id: `job-comment-${c.id}`,
            type: "job_comment",
            title: `Comment from ${author?.full_name || "Member"}`,
            description: c.body,
            link: `/freelancer/jobs/match?openJobId=${c.job_request_id}`,
            created_at: c.created_at,
            sender_name: author?.full_name,
            sender_photo: author?.photo_url,
            metadata: { table: "job_request_comments", comment_id: c.id, job_id: c.job_request_id },
          });
        }
      }
    }
  }

  const dismissed = loadDismissedActivityIds(user.id);
  const visible = allAlerts.filter((a) => !dismissed.has(a.id));

  visible.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return visible;
}

export function inboxActivityKindLabel(
  type: NotificationAlert["type"],
): string {
  switch (type) {
    case "message":
      return "Chat";
    case "job_comment":
      return "Comment";
    case "job_request":
      return "Job invite";
    case "confirmation":
      return "Response";
    case "job_update":
      return "Update";
    case "hire_interest":
      return "Interest";
    default:
      return "Activity";
  }
}
