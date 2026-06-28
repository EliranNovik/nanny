import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase";
import { AuthenticatedRequest } from "../middleware/auth";
import { isFcmConfigured } from "../lib/push/fcm";

export const pushRouter = Router();

const registerDeviceSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["ios", "android", "web"]),
  device_id: z.string().max(200).optional(),
  app_version: z.string().max(50).optional(),
});

const preferencesSchema = z.object({
  push_enabled: z.boolean().optional(),
  messages_enabled: z.boolean().optional(),
  new_match_enabled: z.boolean().optional(),
  request_accepted_enabled: z.boolean().optional(),
  match_selected_enabled: z.boolean().optional(),
  favorite_profile_post_enabled: z.boolean().optional(),
  comment_enabled: z.boolean().optional(),
  like_enabled: z.boolean().optional(),
  post_expiry_enabled: z.boolean().optional(),
  post_expiry_timing: z.enum(["at_expiry", "today", "tomorrow"]).optional(),
  timezone: z.string().max(80).optional(),
});

const unregisterSchema = z.object({
  token: z.string().min(20).max(4096),
});

async function ensurePreferences(userId: string): Promise<void> {
  await supabaseAdmin
    .from("push_notification_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}

// POST /api/push/devices — register or refresh FCM token
pushRouter.post("/devices", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.id;
  const parsed = registerDeviceSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { token, platform, device_id, app_version } = parsed.data;

  await ensurePreferences(userId);

  const { data, error } = await supabaseAdmin
    .from("push_device_tokens")
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        device_id: device_id ?? null,
        app_version: app_version ?? null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    )
    .select("id, platform, device_id, app_version, last_seen_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ device: data });
});

// DELETE /api/push/devices — unregister token (logout / permission revoked)
pushRouter.delete("/devices", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.id;
  const parsed = unregisterSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { error } = await supabaseAdmin
    .from("push_device_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", parsed.data.token);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// GET /api/push/preferences
pushRouter.get("/preferences", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.id;
  await ensurePreferences(userId);

  const { data, error } = await supabaseAdmin
    .from("push_notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ preferences: data });
});

// PATCH /api/push/preferences
pushRouter.patch("/preferences", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthenticatedRequest).user.id;
  const parsed = preferencesSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await ensurePreferences(userId);

  const { data, error } = await supabaseAdmin
    .from("push_notification_preferences")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (parsed.data.post_expiry_timing || parsed.data.timezone) {
    await supabaseAdmin.rpc("refresh_user_push_expiry_schedules", {
      p_user_id: userId,
    });
  }

  res.json({ preferences: data });
});

// GET /api/push/status — health for mobile app bootstrap
pushRouter.get("/status", async (_req: Request, res: Response): Promise<void> => {
  res.json({
    ok: true,
    fcm_configured: isFcmConfigured(),
  });
});
