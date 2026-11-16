import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../supabase";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { followUpSupportChat } from "../lib/supportBot/supportBotWorker";

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

adminRouter.post("/quality-flags/:id/remove", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const { data: flag, error } = await supabaseAdmin
      .from("quality_post_flags")
      .select("id, profile_post_id, community_post_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!flag) {
      res.status(404).json({ error: "Flagged post not found." });
      return;
    }
    if (flag.profile_post_id) {
      const { error: deleteErr } = await supabaseAdmin
        .from("profile_posts")
        .delete()
        .eq("id", flag.profile_post_id);
      if (deleteErr) throw deleteErr;
    }
    if (flag.community_post_id) {
      const { error: deleteErr } = await supabaseAdmin
        .from("community_posts")
        .delete()
        .eq("id", flag.community_post_id);
      if (deleteErr) throw deleteErr;
    }
    await supabaseAdmin.from("quality_post_flags").delete().eq("id", id);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[AdminRouter] POST /quality-flags/:id/remove failure:", err);
    res.status(500).json({ error: "Could not remove that post." });
  }
});

adminRouter.get("/users/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: "Unknown member." });
    return;
  }
  try {
    const [
      { data: profile, error: profileErr },
      { data: jobs, error: jobsErr },
      { data: ban },
      mediaResult,
      postsResult,
      communityResult,
      authResult,
      helperResult,
      reviewsResult,
    ] = await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabaseAdmin
          .from("job_requests")
          .select("status, client_id, selected_freelancer_id, service_type")
          .or(`client_id.eq.${id},selected_freelancer_id.eq.${id}`),
        supabaseAdmin
          .from("user_bans")
          .select("user_id, reason, duration, expires_at, created_at")
          .eq("user_id", id)
          .is("lifted_at", null)
          .maybeSingle(),
        supabaseAdmin
          .from("public_profile_media")
          .select("id, media_type, storage_path, sort_order, created_at")
          .eq("user_id", id)
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("profile_posts")
          .select("id, caption, media_type, storage_path, created_at, custom_category, post_metadata, post_types(name, emoji)")
          .eq("author_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("community_posts")
          .select("id, title, body, category, status, created_at")
          .eq("author_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin.auth.admin.getUserById(id),
        supabaseAdmin
          .from("freelancer_profiles")
          .select("languages, live_categories, available_now, hourly_rate_min, hourly_rate_max")
          .eq("user_id", id)
          .maybeSingle(),
        supabaseAdmin
          .from("job_reviews")
          .select("id, rating, review_text, created_at, reviewer:profiles!reviewer_id(full_name, photo_url)")
          .eq("reviewee_id", id)
          .order("created_at", { ascending: false }),
      ]);
    if (profileErr) throw profileErr;
    if (jobsErr) throw jobsErr;
    if (!profile) {
      res.status(404).json({ error: "Member not found." });
      return;
    }
    const authUser = authResult.error ? null : authResult.data.user;
    const list = jobs ?? [];
    const openBan =
      ban && (!ban.expires_at || new Date(ban.expires_at).getTime() > Date.now()) ? ban : null;
    const communityPosts = communityResult.error ? [] : (communityResult.data ?? []);
    const communityIds = communityPosts.map((post) => post.id as string);
    let communityImages: Array<{ id: string; post_id: string; image_url: string; sort_order: number }> = [];
    if (communityIds.length > 0) {
      const images = await supabaseAdmin
        .from("community_post_images")
        .select("id, post_id, image_url, sort_order")
        .in("post_id", communityIds)
        .order("sort_order", { ascending: true });
      if (!images.error) communityImages = (images.data ?? []) as typeof communityImages;
    }
    res.json({
      profile,
      completedAsClient: list.filter((job) => job.status === "completed" && job.client_id === id).length,
      completedAsFreelancer: list.filter(
        (job) => job.status === "completed" && job.selected_freelancer_id === id,
      ).length,
      ban: openBan,
      media: mediaResult.error ? [] : (mediaResult.data ?? []),
      posts: postsResult.error ? [] : (postsResult.data ?? []),
      communityPosts: communityPosts.map((post) => ({
        ...post,
        images: communityImages.filter((image) => image.post_id === post.id),
      })),
      account: authUser
        ? {
            email: authUser.email ?? null,
            emailConfirmedAt: authUser.email_confirmed_at ?? null,
            phone: authUser.phone ?? null,
            lastSignInAt: authUser.last_sign_in_at ?? null,
            providers: [
              ...new Set(
                (authUser.identities ?? [])
                  .map((row) => row.provider)
                  .filter((provider): provider is string => Boolean(provider)),
              ),
            ],
          }
        : null,
      helper: helperResult.error ? null : (helperResult.data ?? null),
      reviews: reviewsResult.error ? [] : (reviewsResult.data ?? []),
      askedCategories: [
        ...new Set(
          list
            .filter((job) => job.client_id === id && typeof job.service_type === "string" && job.service_type)
            .map((job) => job.service_type as string),
        ),
      ],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not load this member";
    res.status(500).json({ error: message });
  }
});

const OWNED_MEDIA_BUCKETS = new Set(["avatars", "public-profile-media", "job-images", "community-posts"]);

function ownedStorageRef(value: string): { bucket: string; path: string } | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.length > 800) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return { bucket: "public-profile-media", path: trimmed.replace(/^\/+/, "") };
  }
  const match = trimmed.match(/\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/([^?]+)/);
  if (!match || !OWNED_MEDIA_BUCKETS.has(match[1])) return null;
  try {
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

async function removeOwnedFile(value: string | null | undefined) {
  if (!value) return;
  const ref = ownedStorageRef(value);
  if (!ref?.path) return;
  const { error } = await supabaseAdmin.storage.from(ref.bucket).remove([ref.path]);
  if (error) console.warn("[AdminRouter] storage remove failed:", ref.bucket, ref.path, error.message);
}

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

adminRouter.post("/users/:id/media", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const kind = typeof req.body?.kind === "string" ? req.body.kind : "";
  if (!isUuid(id)) {
    res.status(400).json({ error: "Unknown member." });
    return;
  }
  try {
    if (kind === "avatar") {
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("photo_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!profile) {
        res.status(404).json({ error: "Member not found." });
        return;
      }
      const { error: updateErr } = await supabaseAdmin.from("profiles").update({ photo_url: null }).eq("id", id);
      if (updateErr) throw updateErr;
      await removeOwnedFile(profile.photo_url as string | null);
      res.json({ ok: true });
      return;
    }

    if (kind === "gallery") {
      const mediaId = typeof req.body?.mediaId === "string" ? req.body.mediaId : "";
      if (!isUuid(mediaId)) {
        res.status(400).json({ error: "Unknown photo." });
        return;
      }
      const { data: row, error } = await supabaseAdmin
        .from("public_profile_media")
        .select("id, storage_path")
        .eq("id", mediaId)
        .eq("user_id", id)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        res.status(404).json({ error: "That photo is already gone." });
        return;
      }
      const { error: deleteErr } = await supabaseAdmin
        .from("public_profile_media")
        .delete()
        .eq("id", mediaId)
        .eq("user_id", id);
      if (deleteErr) throw deleteErr;
      await removeOwnedFile(row.storage_path as string);
      res.json({ ok: true });
      return;
    }

    if (kind === "post") {
      const postId = typeof req.body?.postId === "string" ? req.body.postId : "";
      const storagePath = typeof req.body?.storagePath === "string" ? req.body.storagePath.trim() : "";
      if (!isUuid(postId) || !storagePath || storagePath.length > 800 || storagePath.includes("..")) {
        res.status(400).json({ error: "Unknown photo." });
        return;
      }
      const { data: post, error } = await supabaseAdmin
        .from("profile_posts")
        .select("id, media_type, storage_path, post_metadata")
        .eq("id", postId)
        .eq("author_id", id)
        .maybeSingle();
      if (error) throw error;
      if (!post) {
        res.status(404).json({ error: "That post is already gone." });
        return;
      }
      const meta =
        post.post_metadata && typeof post.post_metadata === "object" && !Array.isArray(post.post_metadata)
          ? { ...(post.post_metadata as Record<string, unknown>) }
          : {};
      const extras = Array.isArray(meta.media_items) ? meta.media_items : [];
      const kept: Array<{ storage_path: string; media_type: "image" | "video" }> = [];
      const seen = new Set<string>();
      let removed = false;
      const push = (path: unknown, mediaType: unknown) => {
        if (typeof path !== "string" || !path) return;
        if (path === storagePath) {
          removed = true;
          return;
        }
        if ((mediaType !== "image" && mediaType !== "video") || seen.has(path)) return;
        seen.add(path);
        kept.push({ storage_path: path, media_type: mediaType });
      };
      push(post.storage_path, post.media_type);
      for (const raw of extras) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;
        push(row.storage_path, row.media_type);
      }
      if (!removed) {
        res.status(404).json({ error: "That photo is already gone." });
        return;
      }
      const primary = kept[0] ?? null;
      if (kept.length > 1) meta.media_items = kept.slice(1);
      else delete meta.media_items;
      const { error: updateErr } = await supabaseAdmin
        .from("profile_posts")
        .update({
          media_type: primary?.media_type ?? null,
          storage_path: primary?.storage_path ?? null,
          post_metadata: meta,
        })
        .eq("id", postId)
        .eq("author_id", id);
      if (updateErr) throw updateErr;
      await removeOwnedFile(storagePath);
      res.json({ ok: true });
      return;
    }

    if (kind === "board") {
      const imageId = typeof req.body?.imageId === "string" ? req.body.imageId : "";
      if (!isUuid(imageId)) {
        res.status(400).json({ error: "Unknown photo." });
        return;
      }
      const { data: image, error } = await supabaseAdmin
        .from("community_post_images")
        .select("id, image_url, post_id")
        .eq("id", imageId)
        .maybeSingle();
      if (error) throw error;
      if (!image) {
        res.status(404).json({ error: "That photo is already gone." });
        return;
      }
      const { data: post, error: postErr } = await supabaseAdmin
        .from("community_posts")
        .select("id")
        .eq("id", image.post_id)
        .eq("author_id", id)
        .maybeSingle();
      if (postErr) throw postErr;
      if (!post) {
        res.status(404).json({ error: "That photo is already gone." });
        return;
      }
      const { error: deleteErr } = await supabaseAdmin.from("community_post_images").delete().eq("id", imageId);
      if (deleteErr) throw deleteErr;
      await removeOwnedFile(image.image_url as string);
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Unknown photo." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not delete that photo.";
    console.error("[AdminRouter] POST /users/:id/media failure:", message);
    res.status(500).json({ error: "Could not delete that photo." });
  }
});

adminRouter.post("/users/:id/message", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const adminId = (req as AuthenticatedRequest).user.id;
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: "Unknown member." });
    return;
  }
  if (body.length < 2 || body.length > 2000) {
    res.status(400).json({ error: "Write a message between 2 and 2000 characters." });
    return;
  }
  if (id === adminId) {
    res.status(400).json({ error: "You cannot message yourself." });
    return;
  }
  try {
    const { data: member } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin")
      .eq("id", id)
      .maybeSingle();
    if (!member) {
      res.status(404).json({ error: "Member not found." });
      return;
    }
    let conversationId: string | null = null;
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .is("job_id", null)
      .eq("client_id", adminId)
      .eq("freelancer_id", id)
      .maybeSingle();
    if (existingConv?.id) conversationId = existingConv.id as string;
    if (!conversationId) {
      const { data: reverseConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .is("job_id", null)
        .eq("freelancer_id", adminId)
        .eq("client_id", id)
        .maybeSingle();
      if (reverseConv?.id) conversationId = reverseConv.id as string;
    }
    if (!conversationId) {
      const created = await supabaseAdmin
        .from("conversations")
        .insert({ job_id: null, client_id: adminId, freelancer_id: id })
        .select("id")
        .single();
      if (created.error || !created.data) {
        res.status(500).json({ error: created.error?.message || "Could not open a chat." });
        return;
      }
      conversationId = created.data.id as string;
    }
    const sent = await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: adminId,
      body,
    });
    if (sent.error) {
      res.status(500).json({ error: sent.error.message });
      return;
    }
    res.json({ success: true, conversationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not send the message";
    res.status(500).json({ error: message });
  }
});

adminRouter.post("/profile-flags/:id/dismiss", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from("quality_profile_flags")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .is("dismissed_at", null);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

adminRouter.post("/chat-flags/:id/dismiss", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from("quality_chat_flags")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .is("dismissed_at", null);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

adminRouter.post("/support/follow-up", async (req: Request, res: Response): Promise<void> => {
  const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
    res.status(400).json({ error: "Invalid chat." });
    return;
  }
  try {
    const result = await followUpSupportChat(conversationId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Follow-up failed";
    console.error("[AdminRouter] POST /support/follow-up failure:", message);
    res.status(503).json({ error: "The bot could not follow up." });
  }
});

