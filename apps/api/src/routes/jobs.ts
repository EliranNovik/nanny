import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase";
import { findCandidates } from "../logic/match";
import { AuthenticatedRequest } from "../middleware/auth";

export const jobsRouter = Router();

// ─── Allowed field lists ───────────────────────────────────────────────────────

/** Safe job fields returned to callers. Never includes internal admin flags. */
const JOB_SAFE_FIELDS = [
  "id", "client_id", "selected_freelancer_id", "status", "stage",
  "service_type", "care_type", "care_frequency", "time_duration",
  "service_details", "children_count", "children_age_group",
  "location_city", "start_at", "created_at", "locked_at",
  "confirm_starts_at", "confirm_ends_at", "confirm_window_seconds",
  "notes", "budget_min", "budget_max", "languages_pref", "requirements",
  "offered_hourly_rate", "price_offer_status", "community_post_id",
  "community_post_expires_at",
].join(", ");

/** Freelancer profile fields safe to expose to another user (client). */
const FREELANCER_PROFILE_SAFE_FIELDS =
  "hourly_rate_min, hourly_rate_max, bio, available_now, languages, categories";

/** Profile fields safe to include in confirmations list. */
const PROFILE_CARD_FIELDS = "id, full_name, photo_url, city";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pull caller role from profiles table. Used for role-gated actions. */
async function getCallerRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role ?? null;
}

/** Verify a job exists and belongs to the given client. Returns job or null. */
async function getJobForClient(jobId: string, clientId: string) {
  const { data } = await supabaseAdmin
    .from("job_requests")
    .select(JOB_SAFE_FIELDS)
    .eq("id", jobId)
    .eq("client_id", clientId)
    .single();
  return data ?? null;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const VALID_SERVICE_TYPES = [
  "cleaning", "cooking", "pickup_delivery", "nanny", "other_help",
] as const;

const VALID_CARE_FREQUENCIES = ["one_time", "part_time", "regularly"] as const;
const VALID_TIME_DURATIONS = [
  "1_2_hours", "3_4_hours", "5_6_hours", "full_day",
] as const;

const CreateJobSchema = z.object({
  service_type: z.enum(VALID_SERVICE_TYPES),
  care_frequency: z.enum(VALID_CARE_FREQUENCIES),
  time_duration: z.enum(VALID_TIME_DURATIONS),
  service_details: z.record(z.unknown()).optional(),

  // Old nanny-specific fields (backward compat)
  care_type: z.string().optional(),
  children_count: z.number().int().min(0).max(20).optional(),
  children_age_group: z.string().max(100).optional(),
  shift_hours: z.string().max(100).optional(),

  // Common fields
  location_city: z.string().min(1).max(200),
  start_at: z.string().datetime().optional(),
  languages_pref: z.array(z.string().max(50)).max(10).default([]),
  requirements: z.array(z.string().max(100)).max(20).default([]),
  budget_min: z.number().int().min(0).max(100_000).optional().nullable(),
  budget_max: z.number().int().min(0).max(100_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  confirm_window_seconds: z.number().int().min(30).max(180).default(90),
});

/** Values must match DB job_requests_time_duration_check and CreateJobPage TIME_DURATIONS. */
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

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST / — Create job (CLIENT only)
jobsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;

  // SECURITY: only clients may create job requests
  const role = await getCallerRole(user.id);
  if (role !== "client" && role !== "freelancer") {
    // freelancers with is_available_for_jobs can also post — keep original intent
    // but block requests from unknown/admin-only roles
    res.status(403).json({ error: "Only registered users can create job requests" });
    return;
  }

  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request data", details: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;

  // INTEGRITY: budget_max must be >= budget_min if both present
  if (
    payload.budget_min != null &&
    payload.budget_max != null &&
    payload.budget_max < payload.budget_min
  ) {
    res.status(400).json({ error: "budget_max must be greater than or equal to budget_min" });
    return;
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("job_requests")
    .insert({
      client_id: user.id,
      status: "ready",
      stage: "Request" as const,
      ...payload,
      start_at: payload.start_at ? new Date(payload.start_at).toISOString() : null,
    })
    .select(JOB_SAFE_FIELDS)
    .single();

  if (jobErr) {
    res.status(500).json({ error: jobErr.message });
    return;
  }
  const j = job as any;

  // Find matching candidates
  console.log("[JobsAPI] Finding candidates for job:", j.id);
  const candidates = await findCandidates(j, 30);
  console.log("[JobsAPI] Found", candidates.length, "matching candidates");

  if (candidates.length > 0) {
    const rows = candidates.map((fid) => ({
      job_id: j.id,
      freelancer_id: fid,
      status: "pending" as const,
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

  const starts = new Date();
  const ends = new Date(starts.getTime() + (j.confirm_window_seconds || 90) * 1000);

  await supabaseAdmin
    .from("job_requests")
    .update({
      status: "notifying",
      confirm_starts_at: starts.toISOString(),
      confirm_ends_at: ends.toISOString(),
    })
    .eq("id", j.id);

  res.json({ job_id: j.id, confirm_ends_at: ends.toISOString() });
});

// POST /from-community-post — CLIENT hires from a community post
jobsRouter.post("/from-community-post", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const parsed = z.object({ community_post_id: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid community_post_id" });
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

  // SECURITY: only clients can hire from community posts (freelancers have their own flow)
  if (me.role !== "client") {
    res.status(403).json({ error: "Only client accounts can hire from community posts" });
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
      // INTEGRITY: return existing pending interest instead of error
      const { data: existing } = await supabaseAdmin
        .from("community_post_hire_interests")
        .select("id")
        .eq("community_post_id", post.id)
        .eq("client_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      res.json({ interest_id: existing?.id ?? null, already_pending: true });
      return;
    }
    res.status(500).json({ error: insErr.message });
    return;
  }

  res.json({ interest_id: inserted.id, already_pending: false });
});

// GET /community-post/:postId/hire-interests — Post author lists interests
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

  // SECURITY: only the post author can see hire interests
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
          // SECURITY: only public-safe profile fields
          .select(PROFILE_CARD_FIELDS)
          .in("id", clientIds)
      : { data: [] as Record<string, unknown>[] };
  const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

  const interests = list.map((r) => ({
    ...r,
    profiles: profMap.get(r.client_id) ?? null,
  }));

  res.json({ interests });
});

// POST /community-hire-interest/:interestId/confirm — Post author confirms interest
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

  // INTEGRITY: only pending interests can be confirmed
  if (interest.status !== "pending") {
    res.status(400).json({ error: "This interest is no longer pending" });
    return;
  }

  // INTEGRITY: prevent confirming if a job request was already created
  if (interest.job_request_id) {
    res.status(400).json({ error: "A job has already been created for this interest" });
    return;
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, author_id, category, title, note, expires_at, status, availability_payload")
    .eq("id", interest.community_post_id)
    .single();

  // SECURITY: only the post author can confirm interests
  if (postErr || !post || post.author_id !== user.id) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  // INTEGRITY: the post must still be active
  if (post.status !== "active" || !post.expires_at || new Date(post.expires_at) <= new Date()) {
    res.status(400).json({ error: "This post is no longer active" });
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

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("job_requests")
    .insert(jobRow)
    .select("id")
    .single();

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
    .update({ status: "confirmed", job_request_id: job.id })
    .eq("id", interestId)
    .eq("status", "pending"); // double-check atomicity

  if (upErr) {
    res.status(500).json({ error: upErr.message });
    return;
  }

  res.json({ job_id: job.id, conversation_id: convo.id });
});

// POST /community-hire-interest/:interestId/decline — Post author declines interest
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

  // INTEGRITY: can only decline pending interests
  if (interest.status !== "pending") {
    res.status(400).json({ error: "This interest is no longer pending" });
    return;
  }

  const { data: post } = await supabaseAdmin
    .from("community_posts")
    .select("author_id")
    .eq("id", interest.community_post_id)
    .single();

  // SECURITY: only the post author can decline
  if (!post || post.author_id !== user.id) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("community_post_hire_interests")
    .update({ status: "declined" })
    .eq("id", interestId)
    .eq("status", "pending"); // atomic guard

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// POST /:jobId/notifications/:notifId/open — Freelancer opens notification
jobsRouter.post("/:jobId/notifications/:notifId/open", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId, notifId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success || !z.string().uuid().safeParse(notifId).success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // SECURITY: .eq("job_id", jobId) & .eq("freelancer_id", user.id) prevents cross-user abuse
  const { error } = await supabaseAdmin
    .from("job_candidate_notifications")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", notifId)
    .eq("job_id", jobId)
    .eq("freelancer_id", user.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// POST /:jobId/confirm — Freelancer confirms availability
jobsRouter.post("/:jobId/confirm", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  // SECURITY: verify this freelancer was actually invited to this job
  const { data: notification } = await supabaseAdmin
    .from("job_candidate_notifications")
    .select("id, status")
    .eq("job_id", jobId)
    .eq("freelancer_id", user.id)
    .maybeSingle();

  if (!notification) {
    res.status(403).json({ error: "You were not invited to this job" });
    return;
  }

  // INTEGRITY: check the job is still in a confirmable state
  const { data: job } = await supabaseAdmin
    .from("job_requests")
    .select("id, status, selected_freelancer_id, confirm_ends_at")
    .eq("id", jobId)
    .single();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status === "locked" || job.selected_freelancer_id) {
    res.status(400).json({ error: "This job has already been assigned" });
    return;
  }

  // INTEGRITY: check for duplicate confirmation (idempotent upsert is fine but log)
  const { error } = await supabaseAdmin
    .from("job_confirmations")
    .upsert({ job_id: jobId, freelancer_id: user.id, status: "available" });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// POST /:jobId/accept-open-job — Freelancer accepts an open (expired-window) job
jobsRouter.post("/:jobId/accept-open-job", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const schema = z.object({ note: z.string().min(1).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Note is required (1-500 characters)" });
    return;
  }

  const { note } = parsed.data;

  // SECURITY: verify a notification exists for the caller
  const { data: notification } = await supabaseAdmin
    .from("job_candidate_notifications")
    .select("id")
    .eq("job_id", jobId)
    .eq("freelancer_id", user.id)
    .maybeSingle();

  if (!notification) {
    res.status(403).json({ error: "You were not invited to this job" });
    return;
  }

  const { data: job } = await supabaseAdmin
    .from("job_requests")
    .select("id, status, selected_freelancer_id, confirm_ends_at")
    .eq("id", jobId)
    .single();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const now = new Date();
  if (!job.confirm_ends_at || now <= new Date(job.confirm_ends_at)) {
    res.status(400).json({
      error: "Confirmation window is still open. Use /confirm endpoint instead.",
    });
    return;
  }

  // INTEGRITY: can't accept an already-assigned job
  if (job.status === "locked" || job.selected_freelancer_id) {
    res.status(400).json({ error: "Job has already been assigned" });
    return;
  }

  // INTEGRITY: can't accept completed/cancelled jobs
  if (job.status === "completed" || job.status === "cancelled") {
    res.status(400).json({ error: "This job is no longer available" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("job_confirmations")
    .upsert({
      job_id: jobId,
      freelancer_id: user.id,
      status: "available",
      note,
      is_open_job_accepted: true,
    });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// GET /:jobId/confirmed — Client fetches confirmed candidates
jobsRouter.get("/:jobId/confirmed", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const job = await getJobForClient(jobId, user.id);
  if (!job) {
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
    res.json({ freelancers: [], confirm_ends_at: (job as any).confirm_ends_at, job });
    return;
  }

  // SECURITY: explicit safe field lists, no select(*)
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select(
      `${PROFILE_CARD_FIELDS}, freelancer_profiles(${FREELANCER_PROFILE_SAFE_FIELDS})`
    )
    .in("id", ids);

  if (pErr) {
    res.status(500).json({ error: pErr.message });
    return;
  }

  const confsMap = new Map((confs || []).map((c) => [c.freelancer_id, c]));
  const enrichedProfiles = (profiles || []).map((profile: any) => ({
    ...profile,
    confirmation_note: confsMap.get(profile.id)?.note || null,
    is_open_job_accepted: confsMap.get(profile.id)?.is_open_job_accepted || false,
  }));

  res.json({
    freelancers: enrichedProfiles,
    confirm_ends_at: (job as any).confirm_ends_at,
    job,
  });
});

// POST /:jobId/select — Client selects a freelancer and locks the job
jobsRouter.post("/:jobId/select", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const schema = z.object({ freelancer_id: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  const { freelancer_id } = parsed.data;

  const job = await getJobForClient(jobId, user.id);
  if (!job) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // INTEGRITY: cannot select on an already-locked or completed/cancelled job
  const status = (job as any).status;
  if ((job as any).selected_freelancer_id || status === "locked") {
    res.status(400).json({ error: "Job has already been assigned" });
    return;
  }
  if (status === "completed" || status === "cancelled") {
    res.status(400).json({ error: "Cannot modify a completed or cancelled job" });
    return;
  }

  // SECURITY: verify the selected freelancer actually confirmed this job
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

  // Determine stage based on price offer
  const { data: currentJob } = await supabaseAdmin
    .from("job_requests")
    .select("offered_hourly_rate, price_offer_status")
    .eq("id", jobId)
    .single();

  let newStage = "Request";
  if (currentJob?.offered_hourly_rate) {
    if (
      currentJob.price_offer_status === "accepted" ||
      currentJob.price_offer_status === "pending"
    ) {
      newStage = "Price Offer";
    }
  }

  const { error: lockErr } = await supabaseAdmin
    .from("job_requests")
    .update({
      status: "locked",
      selected_freelancer_id: freelancer_id,
      locked_at: new Date().toISOString(),
      stage: newStage,
    })
    .eq("id", jobId);

  if (lockErr) {
    res.status(500).json({ error: lockErr.message });
    return;
  }

  // Clean up all candidate notifications for this job
  const { error: deleteErr } = await supabaseAdmin
    .from("job_candidate_notifications")
    .delete()
    .eq("job_id", jobId);

  if (deleteErr) {
    console.error("[JobsAPI] Error deleting notifications:", deleteErr);
  }

  const { data: convo, error: convoErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      job_id: jobId,
      client_id: user.id,
      freelancer_id,
    })
    .select("id")
    .single();

  if (convoErr) {
    res.status(500).json({ error: convoErr.message });
    return;
  }

  res.json({ conversation_id: convo.id });
});

// POST /:jobId/decline — Client declines a freelancer's confirmation
jobsRouter.post("/:jobId/decline", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const schema = z.object({ freelancer_id: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error);
    return;
  }

  const { freelancer_id } = parsed.data;

  const job = await getJobForClient(jobId, user.id);
  if (!job) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // INTEGRITY: can't decline on an already-locked job
  if ((job as any).status === "locked" || (job as any).selected_freelancer_id) {
    res.status(400).json({ error: "Job has already been assigned" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("job_confirmations")
    .update({ status: "declined" })
    .eq("job_id", jobId)
    .eq("freelancer_id", freelancer_id)
    .eq("status", "available"); // atomic — only decline if still available

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// POST /:jobId/restart — Client restarts candidate search
jobsRouter.post("/:jobId/restart", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("job_requests")
    .select(JOB_SAFE_FIELDS)
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // SECURITY: only the job's client can restart
  if ((job as any).client_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // INTEGRITY: can only restart jobs that aren't closed
  const status = (job as any).status;
  if (status === "locked" || status === "active" || status === "completed" || status === "cancelled") {
    res.status(400).json({ error: "Cannot restart a job that has been assigned, completed, or cancelled" });
    return;
  }

  await supabaseAdmin.from("job_candidate_notifications").delete().eq("job_id", jobId);
  await supabaseAdmin.from("job_confirmations").delete().eq("job_id", jobId);

  console.log("[JobsAPI] Restarting search for job:", (job as any).id);
  const candidates = await findCandidates(job as any, 30);
  console.log("[JobsAPI] Found", candidates.length, "matching candidates");

  if (candidates.length > 0) {
    const rows = candidates.map((fid) => ({
      job_id: (job as any).id,
      freelancer_id: fid,
      status: "pending" as const,
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

  const starts = new Date();
  const ends = new Date(starts.getTime() + ((job as any).confirm_window_seconds || 90) * 1000);

  const { error: updateErr } = await supabaseAdmin
    .from("job_requests")
    .update({
      status: "notifying",
      stage: "Request",
      confirm_starts_at: starts.toISOString(),
      confirm_ends_at: ends.toISOString(),
      selected_freelancer_id: null,
      locked_at: null,
    })
    .eq("id", jobId);

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  res.json({
    job_id: (job as any).id,
    confirm_ends_at: ends.toISOString(),
    notifications_sent: candidates.length,
  });
});

// GET /:jobId — Get job details (client or selected freelancer only)
jobsRouter.get("/:jobId", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  // SECURITY: explicit field list, no select(*)
  const { data: job, error } = await supabaseAdmin
    .from("job_requests")
    .select(JOB_SAFE_FIELDS)
    .eq("id", jobId)
    .single();

  if (error || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // SECURITY: only the client or the selected freelancer can view
  const clientId = (job as any).client_id;
  const selectedFreelancerId = (job as any).selected_freelancer_id;

  if (clientId !== user.id && selectedFreelancerId !== user.id) {
    // Also allow any candidate who has a notification for this job
    const { data: notif } = await supabaseAdmin
      .from("job_candidate_notifications")
      .select("id")
      .eq("job_id", jobId)
      .eq("freelancer_id", user.id)
      .maybeSingle();

    if (!notif) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  res.json({ job });
});

// POST /:jobId/details — Client updates service details (follow-up questions)
const UpdateJobDetailsSchema = z.object({
  service_details: z.record(z.unknown()),
});

jobsRouter.post("/:jobId/details", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { jobId } = req.params;

  if (!z.string().uuid().safeParse(jobId).success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const parsed = UpdateJobDetailsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    return;
  }

  const { data: job, error: fetchErr } = await supabaseAdmin
    .from("job_requests")
    .select("id, client_id, service_details, status")
    .eq("id", jobId)
    .single();

  if (fetchErr || !job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // SECURITY: only the client can update details
  if (job.client_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // INTEGRITY: cannot update details on closed/completed jobs
  if (job.status === "completed" || job.status === "cancelled") {
    res.status(400).json({ error: "Cannot modify a completed or cancelled job" });
    return;
  }

  const updatedDetails = {
    ...(job.service_details as Record<string, unknown> | null),
    ...parsed.data.service_details,
  };

  const { data: updatedJob, error: updateErr } = await supabaseAdmin
    .from("job_requests")
    .update({ service_details: updatedDetails })
    .eq("id", jobId)
    .select(JOB_SAFE_FIELDS)
    .single();

  if (updateErr) {
    console.error("Error updating job details:", updateErr);
    res.status(500).json({ error: "Failed to update job details" });
    return;
  }

  res.json({ job: updatedJob });
});
