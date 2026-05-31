import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase";
import { assertKycApproved } from "../lib/kycGate";
import { type AuthenticatedRequest } from "../middleware/auth";

export const freelancerRouter = Router();

const GoLiveSchema = z.object({
  live_categories: z.array(z.string()).min(1),
  live_can_start_in: z.string().min(1),
});

/** Start 24h go-live window (requires approved KYC). */
freelancerRouter.post("/go-live", async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const kyc = await assertKycApproved(user.id);
    if (!kyc.ok) {
      res.status(403).json({ error: kyc.error, code: kyc.code });
      return;
    }

    const parsed = GoLiveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid go-live payload" });
      return;
    }

    const liveUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const payload = {
      live_until: liveUntil,
      live_categories: parsed.data.live_categories,
      live_can_start_in: parsed.data.live_can_start_in,
      available_now: true,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("freelancer_profiles")
      .update(payload)
      .eq("user_id", user.id)
      .select("user_id");

    if (updateErr) {
      if (updateErr.message.includes("KYC_REQUIRED")) {
        res.status(403).json({
          error:
            "Verify your identity before going live. Complete verification from your account.",
          code: "KYC_REQUIRED",
        });
        return;
      }
      res.status(500).json({ error: updateErr.message });
      return;
    }

    if (!updated?.length) {
      const { error: insertErr } = await supabaseAdmin
        .from("freelancer_profiles")
        .insert({ user_id: user.id, ...payload });
      if (insertErr) {
        if (insertErr.message.includes("KYC_REQUIRED")) {
          res.status(403).json({
            error:
              "Verify your identity before going live. Complete verification from your account.",
            code: "KYC_REQUIRED",
          });
          return;
        }
        res.status(500).json({ error: insertErr.message });
        return;
      }
    }

    res.json({ live_until: liveUntil });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to go live";
    console.error("[Freelancer] go-live:", err);
    res.status(500).json({ error: message });
  }
});
