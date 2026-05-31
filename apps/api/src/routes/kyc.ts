import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../supabase";
import {
  createDiditSession,
  extractVerifiedIdentity,
  fetchDiditSessionDecision,
  mapDiditStatusToKyc,
  type DiditSessionDecision,
} from "../lib/didit";
import {
  verifyDiditWebhookSignatureSimple,
  verifyDiditWebhookSignatureV2,
} from "../lib/diditWebhookVerify";
import {
  type AuthenticatedRequest,
  requireUser,
} from "../middleware/auth";

export const kycRouter = Router();

function appOrigin(): string {
  return (
    process.env.APP_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    "http://localhost:5175"
  );
}

async function loadProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, role, full_name, kyc_status, kyc_session_id, kyc_verified_at, is_verified",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function applyKycFromDidit(params: {
  userId: string;
  sessionId: string;
  diditStatus: string;
  decision?: DiditSessionDecision["decision"];
}) {
  const kycStatus = mapDiditStatusToKyc(params.diditStatus);
  const patch: Record<string, unknown> = {
    kyc_session_id: params.sessionId,
    kyc_status: kycStatus,
  };

  if (kycStatus === "approved") {
    const { legalName, dateOfBirth } = extractVerifiedIdentity(params.decision);
    patch.is_verified = true;
    patch.kyc_verified_at = new Date().toISOString();
    if (legalName) patch.kyc_legal_name = legalName;
    if (dateOfBirth) patch.kyc_date_of_birth = dateOfBirth;
  }

  if (kycStatus === "declined") {
    patch.is_verified = false;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(patch)
    .eq("id", params.userId);

  if (error) throw error;
  return kycStatus;
}

/** Start or resume a Didit hosted verification session. */
kycRouter.post("/session", requireUser, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const profile = await loadProfile(user.id);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (profile.kyc_status === "approved") {
      res.json({
        alreadyVerified: true,
        kyc_status: profile.kyc_status,
      });
      return;
    }

    const callbackUrl = `${appOrigin()}/onboarding/verify?return=1`;
    const session = await createDiditSession({
      vendorData: user.id,
      callbackUrl,
      contactEmail: user.email ?? null,
      expectedFullName: profile.full_name,
    });

    await supabaseAdmin
      .from("profiles")
      .update({
        kyc_session_id: session.session_id,
        kyc_status: "in_progress",
      })
      .eq("id", user.id);

    res.json({
      session_id: session.session_id,
      url: session.url,
      kyc_status: "in_progress",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create KYC session";
    console.error("[KYC] create session:", err);
    res.status(500).json({ error: message });
  }
});

/** Defer verification — user can browse the app but cannot post requests or go live. */
kycRouter.post("/skip", requireUser, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const profile = await loadProfile(user.id);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (profile.kyc_status === "approved") {
      res.json({ kyc_status: "approved", alreadyVerified: true });
      return;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: "skipped" })
      .eq("id", user.id);

    res.json({ kyc_status: "skipped" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to skip verification";
    console.error("[KYC] skip:", err);
    res.status(500).json({ error: message });
  }
});

/** Poll current verification status (webhook is source of truth; this refreshes from Didit). */
kycRouter.get("/status", requireUser, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const profile = await loadProfile(user.id);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    if (
      refresh &&
      profile.kyc_session_id &&
      profile.kyc_status !== "approved"
    ) {
      try {
        const decision = await fetchDiditSessionDecision(profile.kyc_session_id);
        await applyKycFromDidit({
          userId: user.id,
          sessionId: profile.kyc_session_id,
          diditStatus: decision.status ?? "",
          decision: decision.decision,
        });
      } catch (pollErr) {
        console.warn("[KYC] status refresh failed:", pollErr);
      }
    }

    const fresh = await loadProfile(user.id);
    res.json({
      kyc_status: fresh?.kyc_status ?? "not_started",
      kyc_session_id: fresh?.kyc_session_id ?? null,
      kyc_verified_at: fresh?.kyc_verified_at ?? null,
      is_verified: fresh?.is_verified ?? false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load KYC status";
    console.error("[KYC] status:", err);
    res.status(500).json({ error: message });
  }
});

/** Didit webhook — mounted with express.json() on this router only. */
export async function handleDiditWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[KYC webhook] DIDIT_WEBHOOK_SECRET not configured");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const signatureV2 = req.get("X-Signature-V2") ?? "";
  const signatureSimple = req.get("X-Signature-Simple") ?? "";
  const timestamp = req.get("X-Timestamp") ?? "";

  if (!timestamp) {
    res.status(401).json({ error: "Missing X-Timestamp" });
    return;
  }

  let verified = false;
  if (
    signatureV2 &&
    verifyDiditWebhookSignatureV2(body, signatureV2, timestamp, secret)
  ) {
    verified = true;
  } else if (
    signatureSimple &&
    verifyDiditWebhookSignatureSimple(body, signatureSimple, timestamp, secret)
  ) {
    verified = true;
  }

  if (!verified) {
    console.warn("[KYC webhook] invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  res.status(200).json({ received: true });

  const webhookType = String(body.webhook_type ?? "");
  const vendorData = typeof body.vendor_data === "string" ? body.vendor_data : null;
  const sessionId =
    typeof body.session_id === "string" ? body.session_id : null;
  const status = typeof body.status === "string" ? body.status : undefined;
  const decision = body.decision as DiditSessionDecision["decision"] | undefined;

  if (!vendorData || !sessionId) return;

  if (
    webhookType !== "status.updated" &&
    webhookType !== "data.updated" &&
    webhookType !== "user.status.updated"
  ) {
    return;
  }

  try {
    await applyKycFromDidit({
      userId: vendorData,
      sessionId,
      diditStatus: status ?? "",
      decision,
    });
    console.log("[KYC webhook] updated profile", {
      userId: vendorData,
      sessionId,
      status,
      webhookType,
    });
  } catch (err) {
    console.error("[KYC webhook] profile update failed:", err);
  }
}
