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
        client:profiles!job_requests_client_id_fkey(id, full_name, photo_url, is_verified),
        freelancer:profiles!job_requests_selected_freelancer_id_fkey(id, full_name, photo_url, is_verified)
      `)
      .order("created_at", { ascending: false });

    if (jobsErr) throw jobsErr;

    const { data: cancellations, error: cancellationsErr } = await supabaseAdmin
      .from("job_match_cancellations")
      .select("id, job_id, client_id, freelancer_id, cancelled_by, cancelled_by_role, reason, note, matched_at, created_at")
      .order("created_at", { ascending: false });

    if (cancellationsErr) throw cancellationsErr;

    const cancellationsByJob = new Map<string, any[]>();
    for (const cancellation of cancellations || []) {
      const existing = cancellationsByJob.get(cancellation.job_id) || [];
      existing.push(cancellation);
      cancellationsByJob.set(cancellation.job_id, existing);
    }

    const jobsWithCancellations = (jobs || []).map((job) => {
      const jobCancellations = cancellationsByJob.get(job.id) || [];
      return {
        ...job,
        latest_cancellation: jobCancellations[0] || null,
        cancellation_count: jobCancellations.length,
      };
    });

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

    const totalJobs = jobsWithCancellations.length;
    const activeJobs = jobsWithCancellations.filter(j => ["locked", "active"].includes(j.status)).length;
    const completedJobs = jobsWithCancellations.filter(j => j.status === "completed").length;
    const requestedJobs = jobsWithCancellations.filter(j => ["notifying", "confirmations_closed"].includes(j.status)).length;

    const totalUsers = users?.filter(u => !u.is_admin).length || 0;
    const totalClients = users?.filter(u => u.role === "client" && !u.is_admin).length || 0;
    const totalFreelancers = users?.filter(u => u.role === "freelancer" && !u.is_admin).length || 0;

    const jobsThisWeek = jobsWithCancellations.filter(j => new Date(j.created_at) >= weekAgo).length;
    const jobsLastWeek = jobsWithCancellations.filter(j => {
      const d = new Date(j.created_at);
      return d >= twoWeeksAgo && d < weekAgo;
    }).length || 0;

    res.json({
      jobs: jobsWithCancellations,
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

// Update user details
adminRouter.patch("/users/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true, user: data });
  } catch (err: any) {
    console.error("[AdminRouter] PATCH /users/:id failure:", err);
    res.status(500).json({ error: `Failed to update user profile: ${err.message || err}` });
  }
});

// Update job request status/stage/details
adminRouter.patch("/jobs/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("job_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true, job: data });
  } catch (err: any) {
    console.error("[AdminRouter] PATCH /jobs/:id failure:", err);
    res.status(500).json({ error: `Failed to update job request: ${err.message || err}` });
  }
});

// Delete job request
adminRouter.delete("/jobs/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from("job_requests")
      .delete()
      .eq("id", id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true, message: "Job request deleted successfully." });
  } catch (err: any) {
    console.error("[AdminRouter] DELETE /jobs/:id failure:", err);
    res.status(500).json({ error: `Failed to delete job request: ${err.message || err}` });
  }
});

// Get advanced platform stats
adminRouter.get("/statistics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [profilesRes, jobsRes, postsRes, msgsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("created_at, role, is_admin, is_verified, city"),
      supabaseAdmin.from("job_requests").select("created_at, status, stage, care_type, location_city, client_id"),
      supabaseAdmin.from("profile_posts").select("created_at, author_id, post_type_id, custom_category, post_metadata, post_types (id, name, emoji, color)"),
      supabaseAdmin.from("messages").select("created_at, sender_id").gte("created_at", thirtyDaysAgo)
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (jobsRes.error) throw jobsRes.error;
    if (postsRes.error) throw postsRes.error;
    if (msgsRes.error) throw msgsRes.error;

    const profiles = profilesRes.data || [];
    const jobs = jobsRes.data || [];
    const posts = postsRes.data || [];
    const messages = msgsRes.data || [];

    // 1. User metrics
    const totalUsers = profiles.filter(u => !u.is_admin).length;
    const totalClients = profiles.filter(u => u.role === "client" && !u.is_admin).length;
    const totalFreelancers = profiles.filter(u => u.role === "freelancer" && !u.is_admin).length;
    const verifiedUsers = profiles.filter(u => u.is_verified && !u.is_admin).length;

    // 2. Active users in last 30 days
    const activeUserIds = new Set<string>();
    
    // Check message senders
    messages.forEach(m => {
      if (m.sender_id) activeUserIds.add(m.sender_id);
    });

    // Check recent posters
    const recentPosts = posts.filter(p => new Date(p.created_at) >= new Date(thirtyDaysAgo));
    recentPosts.forEach(p => {
      if (p.author_id) activeUserIds.add(p.author_id);
    });

    // Check recent job creators
    const recentJobs = jobs.filter(j => new Date(j.created_at) >= new Date(thirtyDaysAgo));
    recentJobs.forEach(j => {
      if (j.client_id) activeUserIds.add(j.client_id);
    });

    const activeUsersCount = activeUserIds.size;
    const activityRate = totalUsers > 0 ? Math.round((activeUsersCount / totalUsers) * 100) : 0;

    // 3. Post Type counts
    const postTypeMap: Record<string, { count: number; name: string; emoji: string; color: string; subcategories?: Record<string, number> }> = {};
    posts.forEach(p => {
      const type = p.post_types as any;
      if (type) {
        if (!postTypeMap[type.name]) {
          postTypeMap[type.name] = { count: 0, name: type.name, emoji: type.emoji || "", color: type.color || "" };
        }
        postTypeMap[type.name].count++;
      } else {
        const typeName = "Other";
        if (!postTypeMap[typeName]) {
          postTypeMap[typeName] = { count: 0, name: typeName, emoji: "📝", color: "#6b7280", subcategories: {} };
        }
        postTypeMap[typeName].count++;

        // Find subcategory name
        const customCat = (p.custom_category || (p.post_metadata as any)?.custom_category || "").trim();
        const subName = customCat || "General / Unspecified";

        const subs = postTypeMap[typeName].subcategories!;
        subs[subName] = (subs[subName] || 0) + 1;
      }
    });

    const postTypesStats = Object.values(postTypeMap).map(pt => {
      if (pt.name === "Other" && pt.subcategories) {
        return {
          ...pt,
          subcategories: Object.entries(pt.subcategories)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        };
      }
      return pt;
    }).sort((a, b) => b.count - a.count);

    // 4. Job breakdown
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => ["locked", "active"].includes(j.status)).length;
    const completedJobs = jobs.filter(j => j.status === "completed").length;
    const requestedJobs = jobs.filter(j => ["notifying", "confirmations_closed"].includes(j.status)).length;

    // 5. Growth over 8 weeks
    const getWeekIndex = (dateStr: string) => {
      const d = new Date(dateStr);
      const diff = Date.now() - d.getTime();
      return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
    };

    const weeklySignups = Array(8).fill(0).map((_, i) => ({ weekLabel: `W-${i}`, clients: 0, freelancers: 0 }));
    profiles.forEach(p => {
      if (p.is_admin) return;
      const wIdx = getWeekIndex(p.created_at);
      if (wIdx >= 0 && wIdx < 8) {
        const idx = 7 - wIdx; // Reverse so chronologically ascending (oldest first)
        if (p.role === "client") weeklySignups[idx].clients++;
        else weeklySignups[idx].freelancers++;
      }
    });

    const weeklyJobs = Array(8).fill(0).map((_, i) => ({ weekLabel: `W-${i}`, jobsCreated: 0 }));
    jobs.forEach(j => {
      const wIdx = getWeekIndex(j.created_at);
      if (wIdx >= 0 && wIdx < 8) {
        const idx = 7 - wIdx;
        weeklyJobs[idx].jobsCreated++;
      }
    });

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalClients,
        totalFreelancers,
        verifiedUsers,
        activeUsersCount,
        activityRate,
        totalJobs,
        activeJobs,
        completedJobs,
        requestedJobs
      },
      postTypesStats,
      weeklySignups,
      weeklyJobs
    });
  } catch (err: any) {
    console.error("[AdminRouter] Statistics failure:", err);
    res.status(500).json({ error: `Aggregation failure: ${err.message || err}` });
  }
});

// ── GET /admin/posts ──────────────────────────────────────────────────────────
// Returns all community posts with author info, supporting filtering by date
// range, category (post_type_id), and type (custom_category).
adminRouter.get("/posts", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, type_id, custom_category } = req.query as Record<string, string | undefined>;

    let query = supabaseAdmin
      .from("profile_posts")
      .select(`
        id,
        caption,
        media_type,
        storage_path,
        created_at,
        custom_category,
        post_metadata,
        post_type_id,
        author_id,
        post_types (id, name, emoji, color),
        author:profiles!author_id (id, full_name, photo_url, role)
      `)
      .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", new Date(from).toISOString());
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt("created_at", toDate.toISOString());
    }
    if (type_id && type_id !== "all") query = query.eq("post_type_id", type_id);
    if (custom_category && custom_category !== "all") {
      query = query.ilike("custom_category", `%${custom_category}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const posts = data || [];
    const postIds = posts.map((post: any) => post.id);
    let reports: any[] = [];
    if (postIds.length > 0) {
      const reportResult = await supabaseAdmin
        .from("profile_post_reports")
        .select(`
          id, post_id, job_request_id, reporter_id, reason, details, status, created_at, resolved_at, resolved_by,
          reporter:profiles!profile_post_reports_reporter_id_fkey(id, full_name, photo_url)
        `)
        .in("post_id", postIds)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (reportResult.error && reportResult.error.code !== "PGRST205") {
        throw reportResult.error;
      }
      reports = reportResult.data || [];
    }

    const reportsByPost = new Map<string, any[]>();
    for (const report of reports) {
      const current = reportsByPost.get(report.post_id) || [];
      current.push(report);
      reportsByPost.set(report.post_id, current);
    }

    res.json({
      success: true,
      posts: posts.map((post: any) => {
        const postReports = reportsByPost.get(post.id) || [];
        return { ...post, report_count: postReports.length, reports: postReports };
      }),
    });
  } catch (err: any) {
    console.error("[AdminRouter] GET /posts failure:", err);
    res.status(500).json({ error: `Failed to fetch posts: ${err.message || err}` });
  }
});

adminRouter.patch("/reports/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  if (!status || !["resolved", "dismissed"].includes(status)) {
    res.status(400).json({ error: "Status must be resolved or dismissed." });
    return;
  }
  try {
    const adminId = (req as any).user?.id;
    const { data, error } = await supabaseAdmin
      .from("profile_post_reports")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: adminId || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, report: data });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to close report: ${err.message || err}` });
  }
});

// ── GET /admin/post-types ─────────────────────────────────────────────────────
adminRouter.get("/post-types", async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("post_types")
      .select("id, name, emoji, color")
      .order("name");
    if (error) throw error;
    res.json({ success: true, postTypes: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch post types: ${err.message || err}` });
  }
});

// ── POST /admin/posts/:id/delete ──────────────────────────────────────────────
// Deletes a post and sends a system notification message to the author.
adminRouter.post("/posts/:id/delete", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };

  if (!reason || !reason.trim()) {
    res.status(400).json({ error: "A deletion reason is required." });
    return;
  }

  try {
    // 1. Fetch the post
    const { data: post, error: postErr } = await supabaseAdmin
      .from("profile_posts")
      .select("id, author_id, caption, post_types(name)")
      .eq("id", id)
      .maybeSingle();

    if (postErr) throw postErr;
    if (!post) {
      res.status(404).json({ error: "Post not found." });
      return;
    }

    // 2. Find admin profile
    const { data: adminProfile, error: adminErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .limit(1)
      .maybeSingle();

    if (adminErr) throw adminErr;

    // 3. Delete the post (cascades to likes, comments, etc.)
    const { error: deleteErr } = await supabaseAdmin
      .from("profile_posts")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    // 4. Send notification message to the author
    if (adminProfile?.id && adminProfile.id !== post.author_id) {
      let conversationId: string | null = null;

      // Try to find existing admin DM with this user
      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .is("job_id", null)
        .eq("client_id", adminProfile.id)
        .eq("freelancer_id", post.author_id)
        .maybeSingle();

      if (existingConv?.id) {
        conversationId = existingConv.id;
      } else {
        const { data: reverseConv } = await supabaseAdmin
          .from("conversations")
          .select("id")
          .is("job_id", null)
          .eq("freelancer_id", adminProfile.id)
          .eq("client_id", post.author_id)
          .maybeSingle();

        if (reverseConv?.id) {
          conversationId = reverseConv.id;
        } else {
          const { data: newConv, error: convErr } = await supabaseAdmin
            .from("conversations")
            .insert({
              job_id: null,
              client_id: adminProfile.id,
              freelancer_id: post.author_id,
            })
            .select("id")
            .single();

          if (!convErr && newConv) conversationId = newConv.id;
        }
      }

      if (conversationId) {
        const postType = (post.post_types as any)?.name || "post";
        const snippet = post.caption
          ? `"${post.caption.slice(0, 60)}${post.caption.length > 60 ? "..." : ""}"`
          : "your post";
        const messageBody = `🛡️ Tebnu Admin Notice\n\nYour ${postType} (${snippet}) has been removed by our moderation team.\n\nReason: ${reason.trim()}\n\nIf you have questions, please contact us at info@tebnu.com.`;

        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: adminProfile.id,
          body: messageBody,
        });
      }
    }

    res.json({ success: true, message: "Post deleted and author notified." });
  } catch (err: any) {
    console.error("[AdminRouter] POST /posts/:id/delete failure:", err);
    res.status(500).json({ error: `Failed to delete post: ${err.message || err}` });
  }
});

