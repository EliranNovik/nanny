import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../supabase";
import { AuthenticatedRequest } from "../middleware/auth";

// Development-only routes for testing
export const devRouter = Router();

// Create a test conversation (for development/testing)
devRouter.post("/test-conversation", async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  
  // Get or create a test job
  const { data: existingJob } = await supabaseAdmin
    .from("job_requests")
    .select("id")
    .eq("client_id", user.id)
    .limit(1)
    .maybeSingle();

  let jobId: string;
  
  if (existingJob) {
    jobId = existingJob.id;
  } else {
    // Create a test job
    const { data: testJob, error: jobErr } = await supabaseAdmin
      .from("job_requests")
      .insert({
        client_id: user.id,
        status: "locked",
        care_type: "nanny",
        children_count: 1,
        children_age_group: "1-3",
        location_city: "Tel Aviv",
      })
      .select("id")
      .single();

    if (jobErr || !testJob) {
      res.status(500).json({ error: "Failed to create test job" });
      return;
    }
    
    jobId = testJob.id;
  }

  // Find any freelancer (or create a test one)
  const { data: freelancers } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "freelancer")
    .limit(1);

  if (!freelancers || freelancers.length === 0) {
    res.status(400).json({ 
      error: "No freelancers found. Please create a freelancer account first." 
    });
    return;
  }

  const freelancerId = freelancers[0].id;

  // Check if conversation already exists
  const { data: existingConvo } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();

  if (existingConvo) {
    res.json({ conversation_id: existingConvo.id });
    return;
  }

  // Create conversation
  const { data: convo, error: convoErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      job_id: jobId,
      client_id: user.id,
      freelancer_id: freelancerId,
    })
    .select("*")
    .single();

  if (convoErr) {
    res.status(500).json({ error: convoErr.message });
    return;
  }

  res.json({ conversation_id: convo.id });
});

