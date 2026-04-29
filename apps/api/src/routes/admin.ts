import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../supabase";
import { requireAdmin } from "../middleware/auth";

export const adminRouter = Router();

// Apply requireAdmin to all routes
adminRouter.use(requireAdmin);

adminRouter.get("/dashboard", async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch Jobs
    const { data: jobs, error: jobsErr } = await supabaseAdmin
      .from("job_requests")
      .select(`
        *,
        client:profiles!job_requests_client_id_fkey(id, full_name, photo_url),
        freelancer:profiles!job_requests_selected_freelancer_id_fkey(id, full_name, photo_url)
      `)
      .order("created_at", { ascending: false });

    if (jobsErr) throw jobsErr;

    console.log("[AdminDashboard] Fetched jobs sample row:", JSON.stringify(jobs?.[0] || {}, null, 2));

    // 2. Fetch Users
    const { data: users, error: usersErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersErr) throw usersErr;

    // 3. Fetch Reports (job_id is null)
    const { data: convs, error: convsErr } = await supabaseAdmin
      .from("conversations")
      .select(`
        *,
        client:profiles!conversations_client_id_fkey(*)
      `)
      .is("job_id", null)
      .order("created_at", { ascending: false });

    if (convsErr) throw convsErr;

    const reports = await Promise.all(
      (convs || []).map(async (conv) => {
        const { data: messages } = await supabaseAdmin
          .from("messages")
          .select("body, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabaseAdmin
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .is("read_at", null);

        return {
          ...conv,
          last_message: messages || undefined,
          unread_count: count || 0,
        };
      })
    );

    // 4. Calculate Statistics
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const totalJobs = jobs?.length || 0;
    const activeJobs = jobs?.filter(j => ["locked", "active"].includes(j.status)).length || 0;
    const completedJobs = jobs?.filter(j => j.status === "completed").length || 0;
    const requestedJobs = jobs?.filter(j => ["notifying", "confirmations_closed"].includes(j.status)).length || 0;

    const totalUsers = users?.filter(u => !u.is_admin).length || 0;
    const totalClients = users?.filter(u => u.role === "client" && !u.is_admin).length || 0;
    const totalFreelancers = users?.filter(u => u.role === "freelancer" && !u.is_admin).length || 0;

    const jobsThisWeek = jobs?.filter(j => new Date(j.created_at) >= weekAgo).length || 0;
    const jobsLastWeek = jobs?.filter(j => {
      const d = new Date(j.created_at);
      return d >= twoWeeksAgo && d < weekAgo;
    }).length || 0;

    res.json({
      jobs: jobs || [],
      users: users || [],
      reports: reports || [],
      statistics: {
        totalJobs,
        activeJobs,
        completedJobs,
        requestedJobs,
        totalUsers,
        totalClients,
        totalFreelancers,
        jobsThisWeek,
        jobsLastWeek
      }
    });
  } catch (err: any) {
    console.error("[AdminRouter] Fetch failure:", err);
    res.status(500).json({ error: `Aggregation error: ${err.message || err}` });
  }
});

adminRouter.post("/users/:id/action", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { action } = req.body;

  if (!action || !["disconnect", "delete"].includes(action)) {
    res.status(400).json({ error: "Invalid action. Must be 'disconnect' or 'delete'." });
    return;
  }

  try {
    if (action === "delete") {
      // Full Delete: Wipes from auth.users, cascading to public.profiles & dependent items
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        res.status(500).json({ error: `Failed to fully delete user: ${error.message}` });
        return;
      }
      res.json({ success: true, message: "User completely deleted from authorization records." });
    } else {
      // Disconnect: Wipes from public.profiles, cascading to dependent records, leaving credentials intact
      const { error } = await supabaseAdmin.from("profiles").delete().eq("id", id);
      if (error) {
        res.status(500).json({ error: `Failed to disconnect user profile: ${error.message}` });
        return;
      }
      res.json({ success: true, message: "User credentials retained; operational logs purged." });
    }
  } catch (err: any) {
    console.error("[AdminRouter] Fatal user management failure:", err);
    res.status(500).json({ error: `Fatal execution trace: ${err.message || err}` });
  }
});
