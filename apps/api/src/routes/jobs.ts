import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase";
import { findCandidates } from "../logic/match";
import { AuthenticatedRequest } from "../middleware/auth";

export const jobsRouter = Router();

const CreateJobSchema = z.object({
  care_type: z.string(),
  children_count: z.number().int().min(1),
  children_age_group: z.string(),
  location_city: z.string(),
  start_at: z.string().datetime().optional(),
  shift_hours: z.string().optional(),
  languages_pref: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  budget_min: z.number().int().optional().nullable(),
  budget_max: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  confirm_window_seconds: z.number().int().min(30).max(180).default(90)
});

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

  // Ensure still in window
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
  if (!job.confirm_ends_at || now > new Date(job.confirm_ends_at)) {
    res.status(400).json({ error: "Confirmation window ended" });
    return;
  }

  // Insert confirmation
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
    res.json({ freelancers: [], confirm_ends_at: job.confirm_ends_at });
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

  res.json({ freelancers: enrichedProfiles || [], confirm_ends_at: job.confirm_ends_at });
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

