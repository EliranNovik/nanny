import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase";
import { findCandidates } from "../logic/match";
import { AuthenticatedRequest } from "../middleware/auth";

export const jobsRouter = Router();

const CreateJobSchema = z.object({
  // New multi-service fields
  service_type: z.string().optional(),
  care_frequency: z.string().optional(),
  time_duration: z.string().optional(),
  service_details: z.record(z.any()).optional(),

  // Old nanny-specific fields (kept for backward compatibility)
  care_type: z.string().optional(),
  children_count: z.number().int().min(1).optional(),
  children_age_group: z.string().optional(),
  shift_hours: z.string().optional(),

  // Common fields
  location_city: z.string(),
  start_at: z.string().datetime().optional(),
  languages_pref: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  budget_min: z.number().int().optional().nullable(),
  budget_max: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  confirm_window_seconds: z.number().int().min(30).max(180).default(90)
});

/** Values must match DB `job_requests_time_duration_check` and CreateJobPage TIME_DURATIONS. */
function timeDurationFromCommunityPayload(payload: unknown): string {
  const p = payload as { quick_details?: string; duration_preset?: string } | null;
  const q = typeof p?.quick_details === "string" ? p.quick_details.trim() : "";
  if (q === "full_day") return "full_day";
  if (q === "1_2h") return "1_2_hours";
  if (q === "emergency") return "1_2_hours";
  if (q === "recurring") return "3_4_hours";
  const d = typeof p?.duration_preset === "string" ? p.duration_preset.trim() : "";
  if (d === "full_day" || d === "full day") return "full_day";
  if (d === "1_2_hours" || d === "1_2h") return "1_2_hours";
  if (d === "3_4_hours") return "3_4_hours";
  if (d === "5_6_hours") return "5_6_hours";
  return "1_2_hours";
}

function buildCommunityHireJobRow(params: {
  post: {
    id: string;
    author_id: string;
    category: string;
    title: string;
    note: string | null;
    expires_at: string;
    availability_payload: unknown;
  };
  clientId: string;
  locationCity: string;
  notes: string;
}): Record<string, unknown> {
  const { post, clientId, locationCity, notes } = params;
  const time_duration = timeDurationFromCommunityPayload(post.availability_payload);
  const isNannyCategory = post.category === "nanny";
  return {
    client_id: clientId,
    status: "locked",
    stage: "Request",
    selected_freelancer_id: post.author_id,
    locked_at: new Date().toISOString(),
    community_post_id: post.id,
    community_post_expires_at: post.expires_at,
    service_type: post.category,
    care_frequency: "one_time",
    time_duration,
    service_details: { source: "community_post" },
    care_type: "occasional",
    children_count: isNannyCategory ? 1 : 0,
    children_age_group: isNannyCategory ? "mixed" : "n/a",
    location_city: locationCity,
    languages_pref: [],
    requirements: [],
    notes,
    confirm_window_seconds: 90,
    confirm_starts_at: null,
    confirm_ends_at: null,
  };
}

// Create job and start notifying immediately
jobsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const parsed = CreateJobSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  const payload = parsed.data;

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("job_requests")
    .insert({
      client_id: user.id,
      status: "ready",
      stage: "Request" as const,
      ...payload,
      start_at: payload.start_at ? new Date(payload.start_at).toISOString() : null
    })
    .select("*")
    .single();

  if (jobErr) {
    res.status(500).json({ error: jobErr.message });
    return;
  }

  // Find matching candidates
  console.log("[JobsAPI] Finding candidates for job:", job.id);
  const candidates = await findCandidates(job, 30);
  console.log("[JobsAPI] Found", candidates.length, "matching candidates");

  // Create notifications for matching freelancers
  if (candidates.length > 0) {
    const rows = candidates.map((fid) => ({
      job_id: job.id,
      freelancer_id: fid,
      status: "pending" as const
    }));
    const { error: notifError } = await supabaseAdmin
      .from("job_candidate_notifications")
      .insert(rows);

    if (notifError) {
      console.error("[JobsAPI] Error creating notifications:", notifError);
      res.status(500).json({ error: `Failed to create notifications: ${notifError.message}` });
      return;
    }

    console.log("[JobsAPI] Created", candidates.length, "notifications");
  } else {
    console.log("[JobsAPI] No matching candidates found");
  }

  // Open confirmation window
  const starts = new Date();
  const ends = new Date(starts.getTime() + (job.confirm_window_seconds || 90) * 1000);

  await supabaseAdmin
    .from("job_requests")
    .update({
      status: "notifying",
      confirm_starts_at: starts.toISOString(),
      confirm_ends_at: ends.toISOString()
    })
    .eq("id", job.id);

  res.json({ job_id: job.id, confirm_ends_at: ends.toISOString() });
});

/** Client or freelancer expresses hire interest; post author confirms on availability page (no incoming-requests flow). */
jobsRouter.post("/from-community-post", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const parsed = z.object({ community_post_id: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  const { data: me, error: meErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, city")
    .eq("id", user.id)
    .single();

  if (meErr || !me) {
    res.status(500).json({ error: meErr?.message ?? "Profile not found" });
    return;
  }
  if (me.role !== "client" && me.role !== "freelancer") {
    res.status(403).json({ error: "Only client and freelancer accounts can hire from community posts" });
    return;
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, author_id, category, title, body, note, expires_at, status, availability_payload")
    .eq("id", parsed.data.community_post_id)
    .single();

  if (postErr || !post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (post.status !== "active" || !post.expires_at || new Date(post.expires_at) <= new Date()) {
    res.status(400).json({ error: "This post is no longer available" });
    return;
  }
  if (post.author_id === user.id) {
    res.status(400).json({ error: "You cannot hire yourself" });
    return;
  }

  const { data: author, error: authorErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, city")
    .eq("id", post.author_id)
    .single();

  if (authorErr || !author) {
    res.status(500).json({ error: "Could not load post author" });
    return;
  }
  if (author.role !== "freelancer") {
    res.status(400).json({ error: "This offer is not from a helper account" });
    return;
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("community_post_hire_interests")
    .insert({
      community_post_id: post.id,
      client_id: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("community_post_hire_interests")
        .select("id")
        .eq("community_post_id", post.id)
        .eq("client_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      res.json({
        interest_id: existing?.id ?? null,
        already_pending: true,
      });
      return;
    }
    res.status(500).json({ error: insErr.message });
    return;
  }

  res.json({ interest_id: inserted.id, already_pending: false });
});

/** Post author: list hire interests for a community post. */
jobsRouter.get("/community-post/:postId/hire-interests", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const postId = req.params.postId;
  if (!z.string().uuid().safeParse(postId).success) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, author_id")
    .eq("id", postId)
    .single();

  if (postErr || !post || post.author_id !== user.id) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const { data: rows, error } = await supabaseAdmin
    .from("community_post_hire_interests")
    .select("id, client_id, status, created_at, job_request_id")
    .eq("community_post_id", postId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const list = rows ?? [];
  const clientIds = [...new Set(list.map((r) => r.client_id))];
  const { data: profs } =
    clientIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, photo_url, city, role")
          .in("id", clientIds)
      : { data: [] as Record<string, unknown>[] };
  const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

  const interests = list.map((r) => ({
    ...r,
    profiles: profMap.get(r.client_id) ?? null,
  }));

  res.json({ interests });
});

/** Post author: confirm a pending interest → locked job + conversation. */
jobsRouter.post("/community-hire-interest/:interestId/confirm", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const interestId = req.params.interestId;
  if (!z.string().uuid().safeParse(interestId).success) {
    res.status(400).json({ error: "Invalid interest id" });
    return;
  }

  const { data: interest, error: intErr } = await supabaseAdmin
    .from("community_post_hire_interests")
    .select("id, community_post_id, client_id, status, job_request_id")
    .eq("id", interestId)
    .single();

  if (intErr || !interest) {
    res.status(404).json({ error: "Interest not found" });
    return;
  }
  if (interest.status !== "pending") {
    res.status(400).json({ error: "This interest is no longer pending" });
    return;
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, author_id, category, title, note, expires_at, status, availability_payload")
    .eq("id", interest.community_post_id)
    .single();

  if (postErr || !post || post.author_id !== user.id) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const { data: clientProf } = await supabaseAdmin
    .from("profiles")
    .select("id, city")
    .eq("id", interest.client_id)
    .single();

  const { data: authorProf } = await supabaseAdmin
    .from("profiles")
    .select("id, city")
    .eq("id", post.author_id)
    .single();

  const payload = post.availability_payload as { area_tag?: string } | null;
  const area =
    typeof payload?.area_tag === "string" && payload.area_tag.trim()
      ? payload.area_tag.trim()
      : "";
  const location_city = area || authorProf?.city || clientProf?.city || "As discussed";

  const noteLines = [
    `Confirmed from community availability post.`,
    `Post: ${post.title}`,
    post.note ? `Note: ${post.note}` : null,
  ].filter(Boolean);

  const jobRow = buildCommunityHireJobRow({
    post: {
      id: post.id,
      author_id: post.author_id,
      category: post.category,
      title: post.title,
      note: post.note,
      expires_at: post.expires_at,
      availability_payload: post.availability_payload,
    },
    clientId: interest.client_id,
    locationCity: location_city,
    notes: noteLines.join("\n"),
  });

  const { data: job, error: jobErr } = await supabaseAdmin.from("job_requests").insert(jobRow).select("id").single();

  if (jobErr || !job) {
    res.status(500).json({ error: jobErr?.message ?? "Failed to create job" });
    return;
  }

  const { data: convo, error: convoErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      job_id: job.id,
      client_id: interest.client_id,
      freelancer_id: post.author_id,
    })
    .select("id")
    .single();

  if (convoErr || !convo) {
    await supabaseAdmin.from("job_requests").delete().eq("id", job.id);
    res.status(500).json({ error: convoErr?.message ?? "Failed to start chat" });
    return;
  }

  const { error: upErr } = await supabaseAdmin
    .from("community_post_hire_interests")
    .update({
      status: "confirmed",
      job_request_id: job.id,
    })
    .eq("id", interestId)
    .eq("status", "pending");

  if (upErr) {
    res.status(500).json({ error: upErr.message });
    return;
  }

  res.json({ job_id: job.id, conversation_id: convo.id });
});

/** Post author: decline a pending interest. */
jobsRouter.post("/community-hire-interest/:interestId/decline", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const interestId = req.params.interestId;
  if (!z.string().uuid().safeParse(interestId).success) {
    res.status(400).json({ error: "Invalid interest id" });
    return;
  }

  const { data: interest, error: intErr } = await supabaseAdmin
    .from("community_post_hire_interests")
    .select("id, community_post_id, status")
    .eq("id", interestId)
    .single();

  if (intErr || !interest) {
    res.status(404).json({ error: "Interest not found" });
    return;
  }

  const { data: post } = await supabaseAdmin
    .from("community_posts")
    .select("author_id")
    .eq("id", interest.community_post_id)
    .single();

  if (!post || post.author_id !== user.id) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  if (interest.status !== "pending") {
    res.status(400).json({ error: "This interest is no longer pending" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("community_post_hire_interests")
    .update({ status: "declined" })
    .eq("id", interestId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// Freelancer opens notification
jobsRouter.post("/:jobId/notifications/:notifId/open", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { notifId } = req.params;

  const { error } = await supabaseAdmin
    .from("job_candidate_notifications")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", notifId)
    .eq("freelancer_id", user.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// Freelancer confirms availability
jobsRouter.post("/:jobId/confirm", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  // Insert confirmation (Expiration window check removed)
  const { error } = await supabaseAdmin
    .from("job_confirmations")
    .upsert({ job_id: jobId, freelancer_id: user.id, status: "available" });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// Freelancer accepts open job request with note
jobsRouter.post("/:jobId/accept-open-job", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  const schema = z.object({ note: z.string().min(1).max(500) });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Note is required (1-500 characters)" });
    return;
  }

  const { note } = parsed.data;

  // Check job exists and window has expired (making it an open job)
  const { data: job } = await supabaseAdmin
    .from("job_requests")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const now = new Date();
  if (!job.confirm_ends_at || now <= new Date(job.confirm_ends_at)) {
    res.status(400).json({ error: "Confirmation window is still open. Use /confirm endpoint instead." });
    return;
  }

  // Check if job is already locked
  if (job.status === "locked" || job.selected_freelancer_id) {
    res.status(400).json({ error: "Job has already been assigned" });
    return;
  }

  // Insert open job acceptance confirmation
  const { error } = await supabaseAdmin
    .from("job_confirmations")
    .upsert({
      job_id: jobId,
      freelancer_id: user.id,
      status: "available",
      note: note,
      is_open_job_accepted: true
    });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// Client fetches confirmed candidates after window
jobsRouter.get("/:jobId/confirmed", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  const { data: job } = await supabaseAdmin
    .from("job_requests")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job || job.client_id !== user.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { data: confs, error } = await supabaseAdmin
    .from("job_confirmations")
    .select("freelancer_id, note, is_open_job_accepted")
    .eq("job_id", jobId)
    .eq("status", "available");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const ids = (confs || []).map((c) => c.freelancer_id);

  if (ids.length === 0) {
    res.json({
      freelancers: [],
      confirm_ends_at: job.confirm_ends_at,
      job,
    });
    return;
  }

  // Pull profile data for cards
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, photo_url, city, freelancer_profiles(*)")
    .in("id", ids);

  // Map confirmations to freelancers
  const confsMap = new Map((confs || []).map((c) => [c.freelancer_id, c]));
  const enrichedProfiles = (profiles || []).map((profile) => ({
    ...profile,
    confirmation_note: confsMap.get(profile.id)?.note || null,
    is_open_job_accepted: confsMap.get(profile.id)?.is_open_job_accepted || false,
  }));

  if (pErr) {
    res.status(500).json({ error: pErr.message });
    return;
  }

  res.json({
    freelancers: enrichedProfiles || [],
    confirm_ends_at: job.confirm_ends_at,
    // Full row — client uses one round-trip (no extra Supabase fetch for job)
    job,
  });
});

// Client selects freelancer and locks job + creates conversation
jobsRouter.post("/:jobId/select", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  const schema = z.object({ freelancer_id: z.string().uuid() });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  const { freelancer_id } = parsed.data;

  const { data: job } = await supabaseAdmin
    .from("job_requests")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job || job.client_id !== user.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Check if freelancer has confirmed (either during window or open job acceptance)
  const { data: confirmation } = await supabaseAdmin
    .from("job_confirmations")
    .select("id")
    .eq("job_id", jobId)
    .eq("freelancer_id", freelancer_id)
    .eq("status", "available")
    .single();

  if (!confirmation) {
    res.status(400).json({ error: "Freelancer has not confirmed availability for this job" });
    return;
  }

  // Lock the job - set stage based on price offer status
  // If no price offer has been sent yet, keep at "Request"
  // If price offer is pending, set to "Price Offer"
  // If price offer is accepted, set to "Price Offer" (will move to "Schedule" when schedule is confirmed)
  const { data: currentJob } = await supabaseAdmin
    .from("job_requests")
    .select("offered_hourly_rate, price_offer_status")
    .eq("id", jobId)
    .single();

  let newStage = "Request"; // Default: stay at Request if no price offer sent
  if (currentJob?.offered_hourly_rate) {
    if (currentJob.price_offer_status === "accepted") {
      // Price offer accepted but schedule not yet confirmed - stay at "Price Offer"
      newStage = "Price Offer";
    } else if (currentJob.price_offer_status === "pending") {
      newStage = "Price Offer";
    }
    // If declined or null, stay at "Request"
  }

  const { error: lockErr } = await supabaseAdmin
    .from("job_requests")
    .update({
      status: "locked",
      selected_freelancer_id: freelancer_id,
      locked_at: new Date().toISOString(),
      stage: newStage
    })
    .eq("id", jobId);

  if (lockErr) {
    res.status(500).json({ error: lockErr.message });
    return;
  }

  // Remove job from all freelancers' requests (delete all notifications for this job)
  // This ensures the job disappears from all freelancers' request lists
  const { error: deleteErr } = await supabaseAdmin
    .from("job_candidate_notifications")
    .delete()
    .eq("job_id", jobId);

  if (deleteErr) {
    console.error("[JobsAPI] Error deleting notifications:", deleteErr);
    // Continue anyway - the job is already locked
  }

  // Create conversation
  const { data: convo, error: convoErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      job_id: jobId,
      client_id: user.id,
      freelancer_id
    })
    .select("*")
    .single();

  if (convoErr) {
    res.status(500).json({ error: convoErr.message });
    return;
  }

  res.json({ conversation_id: convo.id });
});

// Client declines a freelancer's confirmation
jobsRouter.post("/:jobId/decline", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  const schema = z.object({ freelancer_id: z.string().uuid() });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  const { freelancer_id } = parsed.data;

  const { data: job } = await supabaseAdmin
    .from("job_requests")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job || job.client_id !== user.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Check if job is already locked
  if (job.status === "locked" || job.selected_freelancer_id) {
    res.status(400).json({ error: "Job has already been assigned" });
    return;
  }

  // Update confirmation status to declined
  const { error } = await supabaseAdmin
    .from("job_confirmations")
    .update({ status: "declined" })
    .eq("job_id", jobId)
    .eq("freelancer_id", freelancer_id)
    .eq("status", "available");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// Restart search for a job (resend notifications without going through questions)
jobsRouter.post("/:jobId/restart", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  // Get the existing job
  const { data: job, error: jobErr } = await supabaseAdmin
    .from("job_requests")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Only the client who created the job can restart it
  if (job.client_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Can only restart if job is not locked/active/completed
  if (job.status === "locked" || job.status === "active" || job.status === "completed") {
    res.status(400).json({ error: "Cannot restart a job that has been assigned or completed" });
    return;
  }

  // Delete old notifications
  await supabaseAdmin
    .from("job_candidate_notifications")
    .delete()
    .eq("job_id", jobId);

  // Delete old confirmations
  await supabaseAdmin
    .from("job_confirmations")
    .delete()
    .eq("job_id", jobId);

  // Find matching candidates again
  console.log("[JobsAPI] Restarting search for job:", job.id);
  const candidates = await findCandidates(job, 30);
  console.log("[JobsAPI] Found", candidates.length, "matching candidates");

  // Create new notifications for matching freelancers
  if (candidates.length > 0) {
    const rows = candidates.map((fid) => ({
      job_id: job.id,
      freelancer_id: fid,
      status: "pending" as const
    }));
    const { error: notifError } = await supabaseAdmin
      .from("job_candidate_notifications")
      .insert(rows);

    if (notifError) {
      console.error("[JobsAPI] Error creating notifications:", notifError);
      res.status(500).json({ error: `Failed to create notifications: ${notifError.message}` });
      return;
    }

    console.log("[JobsAPI] Created", candidates.length, "new notifications");
  } else {
    console.log("[JobsAPI] No matching candidates found");
  }

  // Reset confirmation window
  const starts = new Date();
  const ends = new Date(starts.getTime() + (job.confirm_window_seconds || 90) * 1000);

  const { error: updateErr } = await supabaseAdmin
    .from("job_requests")
    .update({
      status: "notifying",
      stage: "Request",
      confirm_starts_at: starts.toISOString(),
      confirm_ends_at: ends.toISOString(),
      selected_freelancer_id: null,
      locked_at: null
    })
    .eq("id", jobId);

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  res.json({
    job_id: job.id,
    confirm_ends_at: ends.toISOString(),
    notifications_sent: candidates.length
  });
});

// Get job details
jobsRouter.get("/:jobId", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  const { data: job, error } = await supabaseAdmin
    .from("job_requests")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Only client or selected freelancer can view
  if (job.client_id !== user.id && job.selected_freelancer_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({ job });
});

// POST /:jobId/details - Update job service details (follow-up questions)
const UpdateJobDetailsSchema = z.object({
  service_details: z.record(z.any()),
});

jobsRouter.post("/:jobId/details", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;
  const parsed = UpdateJobDetailsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  // Fetch the job to verify ownership
  const { data: job, error: fetchErr } = await supabaseAdmin
    .from("job_requests")
    .select("id, client_id, service_details")
    .eq("id", jobId)
    .single();

  if (fetchErr || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Only the client who created the job can update details
  if (job.client_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Merge new details with existing service_details
  const updatedDetails = {
    ...job.service_details,
    ...parsed.data.service_details,
  };

  // Update the job
  const { data: updatedJob, error: updateErr } = await supabaseAdmin
    .from("job_requests")
    .update({ service_details: updatedDetails })
    .eq("id", jobId)
    .select()
    .single();

  if (updateErr) {
    console.error("Error updating job details:", updateErr);
    res.status(500).json({ error: "Failed to update job details" });
    return;
  }

  res.json({ job: updatedJob });
});

