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
 * Optimized with batching and parallel execution for SaaS Pro performance.
 */
export async function fetchInboxActivityAlerts(
  user: { id: string },
  profile: { role: string },
  opts: FetchOpts,
): Promise<NotificationAlert[]> {
  const allAlerts: NotificationAlert[] = [];

  // 1. Prepare all independent queries
  const initialFetchPromises: Promise<any>[] = [];
  const promiseLabels: string[] = [];

  if (opts.includeUnreadMessageAlerts) {
    initialFetchPromises.push(
      supabase
        .from("conversations")
        .select(`id, client_id, freelancer_id`)
        .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
    );
    promiseLabels.push("convos");
  }

  if (profile.role === "freelancer") {
    initialFetchPromises.push(
      supabase
        .from("community_posts")
        .select("id")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60)
    );
    promiseLabels.push("myPosts");

    initialFetchPromises.push(
      supabase
        .from("job_candidate_notifications")
        .select(`id, created_at, job_id, job_requests (id, location_city, service_type, care_type, confirm_ends_at, community_post_id)`)
        .eq("freelancer_id", user.id)
        .in("status", ["pending", "opened"])
        .order("created_at", { ascending: false })
    );
    promiseLabels.push("notifications");

    initialFetchPromises.push(
      supabase
        .from("job_requests")
        .select("id, status, care_type, updated_at")
        .eq("selected_freelancer_id", user.id)
        .in("status", ["locked", "active"])
        .gte("updated_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order("updated_at", { ascending: false })
    );
    promiseLabels.push("liveJobs");

    // Community participations (for comments)
    initialFetchPromises.push(
      supabase
        .from("job_request_comments")
        .select("job_request_id")
        .eq("author_id", user.id)
    );
    promiseLabels.push("participations");
  } else if (profile.role === "client") {
    initialFetchPromises.push(
      supabase
        .from("job_requests")
        .select("id, care_type")
        .eq("client_id", user.id)
    );
    promiseLabels.push("myJobs");

    initialFetchPromises.push(
      supabase
        .from("job_requests")
        .select("id, service_type, locked_at, community_post_id")
        .eq("client_id", user.id)
        .not("community_post_id", "is", null)
        .in("status", ["locked", "active"])
        .gte("locked_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("locked_at", { ascending: false })
    );
    promiseLabels.push("communityHires");
  }

  // 2. Execute parallel block
  const results = await Promise.all(initialFetchPromises);
  const dataMap = new Map<string, any>();
  promiseLabels.forEach((label, idx) => {
    dataMap.set(label, results[idx]?.data || []);
  });

  // 3. Process Unread Messages (Batch Profiles)
  const convos = dataMap.get("convos");
  if (convos?.length > 0) {
    const convoIds = convos.map((c: any) => c.id);
    const { data: unreadMsgs } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", convoIds)
      .neq("sender_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false });

    if (unreadMsgs && unreadMsgs.length > 0) {
      const latestByConvo = new Map<string, any>();
      unreadMsgs.forEach(m => {
        if (!latestByConvo.has(m.conversation_id)) latestByConvo.set(m.conversation_id, m);
      });

      const otherUserIds = Array.from(new Set(
        Array.from(latestByConvo.values()).map(m => {
          const c = convos.find((cv: any) => cv.id === m.conversation_id);
          return user.id === c?.client_id ? c?.freelancer_id : c?.client_id;
        }).filter(Boolean)
      ));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", otherUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      latestByConvo.forEach((msg, convoId) => {
        const convo = convos.find((c: any) => c.id === convoId);
        const otherId = user.id === convo.client_id ? convo.freelancer_id : convo.client_id;
        const sender = profileMap.get(otherId);
        allAlerts.push({
          id: `msg-${msg.id}`,
          type: "message",
          title: sender?.full_name || "New message",
          description: msg.body ?? undefined,
          link: `/messages?conversation=${convoId}`,
          created_at: msg.created_at,
          sender_name: sender?.full_name || "User",
          sender_photo: sender?.photo_url || undefined,
          metadata: { conversation_id: convoId, sender_id: otherId },
        });
      });
    }
  }

  // 4. Process Hire Interests (Freelancer)
  if (profile.role === "freelancer") {
    const myPostIds = (dataMap.get("myPosts") || []).map((p: any) => p.id);
    if (myPostIds.length > 0) {
      const { data: interests } = await supabase
        .from("community_post_hire_interests")
        .select("id, created_at, status, community_post_id, client_id")
        .in("community_post_id", myPostIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (interests && interests.length > 0) {
        const clientIds = Array.from(new Set(interests.map(i => i.client_id)));
        const { data: cProfiles } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", clientIds);
        const cMap = new Map(cProfiles?.map(p => [p.id, p]));

        interests.forEach(r => {
          const c = cMap.get(r.client_id);
          allAlerts.push({
            id: `hire-${r.id}`,
            type: "hire_interest",
            title: `${c?.full_name?.trim() || "Someone"} wants to connect`,
            description: "New interest on your availability post.",
            link: `/availability/post/${encodeURIComponent(r.community_post_id)}/hires`,
            created_at: r.created_at,
            sender_name: c?.full_name || undefined,
            sender_photo: c?.photo_url || undefined,
          });
        });
      }
    }

    // Notifications & Live Jobs
    const now = new Date();
    (dataMap.get("notifications") || []).forEach((n: any) => {
      const job = n.job_requests;
      if (!job || job.community_post_id) return;
      if (!job.confirm_ends_at || new Date(job.confirm_ends_at) > now) {
        allAlerts.push({
          id: n.id,
          type: "job_request",
          title: `New ${job.care_type || job.service_type || "job"} request`,
          description: job.location_city ? `Location: ${job.location_city}` : "Open to review",
          link: buildJobsUrl("freelancer", "requests"),
          created_at: n.created_at,
        });
      }
    });

    (dataMap.get("liveJobs") || []).forEach((job: any) => {
      allAlerts.push({
        id: `job-up-${job.id}`,
        type: "job_update",
        title: "Job confirmed",
        description: `Your ${job.care_type || "job"} is ready to start.`,
        link: buildJobsUrl("freelancer", "jobs"),
        created_at: job.updated_at,
      });
    });
  }

  // 5. Process Client Logic
  if (profile.role === "client") {
    const myJobs = dataMap.get("myJobs") || [];
    if (myJobs.length > 0) {
      const jobIds = myJobs.map((j: any) => j.id);
      const { data: confirmations } = await supabase
        .from("job_confirmations")
        .select(`id, created_at, job_id, freelancer_id, profiles (full_name, photo_url)`)
        .in("job_id", jobIds)
        .eq("status", "available");

      confirmations?.forEach((c: any) => {
        allAlerts.push({
          id: c.id,
          type: "confirmation",
          title: "Helper available",
          description: `${c.profiles?.full_name || "A helper"} responded to your request.`,
          link: buildJobsUrl("client", "my_requests"),
          created_at: c.created_at,
          sender_name: c.profiles?.full_name,
          sender_photo: c.profiles?.photo_url,
        });
      });
    }

    (dataMap.get("communityHires") || []).forEach((j: any) => {
      allAlerts.push({
        id: `community-hire-${j.id}`,
        type: "job_update",
        title: "Hire confirmed",
        description: "Your booking from an availability post is live.",
        link: buildJobsUrl("client", "jobs"),
        created_at: j.locked_at,
      });
    });
  }

  // 6. Comments (Shared Logic)
  const myJobIds = new Set<string>();
  if (profile.role === "client") {
    (dataMap.get("myJobs") || []).forEach((j: any) => myJobIds.add(j.id));
  } else {
    (dataMap.get("notifications") || []).forEach((n: any) => myJobIds.add(n.job_id));
    (dataMap.get("participations") || []).forEach((p: any) => myJobIds.add(p.job_request_id));
  }

  if (myJobIds.size > 0) {
    const { data: comments } = await supabase
      .from("job_request_comments")
      .select(`id, body, created_at, author_id, job_request_id`)
      .in("job_request_id", Array.from(myJobIds))
      .neq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (comments && comments.length > 0) {
      const authorIds = Array.from(new Set(comments.map(c => c.author_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", authorIds);
      const profMap = new Map(profs?.map(p => [p.id, p]));

      comments.forEach(c => {
        const author = profMap.get(c.author_id);
        allAlerts.push({
          id: `job-comment-${c.id}`,
          type: "job_comment",
          title: `Comment from ${author?.full_name || "Member"}`,
          description: c.body,
          link: profile.role === "client" ? buildJobsUrl("client", "my_requests") : `/freelancer/jobs/match?openJobId=${c.job_request_id}`,
          created_at: c.created_at,
          sender_name: author?.full_name,
          sender_photo: author?.photo_url,
        });
      });
    }
  }

  // 7. Dismissed filtering and sorting
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
