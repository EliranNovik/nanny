import express from "express";
import cors from "cors";
import "dotenv/config";
import { corsOriginDelegate } from "./lib/corsOrigins";
import { requireUser } from "./middleware/auth";
import { jobsRouter } from "./routes/jobs";
import { devRouter } from "./routes/dev";
import { adminRouter } from "./routes/admin";
import { freelancerRouter } from "./routes/freelancer";
import { kycRouter, handleDiditWebhook } from "./routes/kyc";
import {
  handleLinkPreviewImageGet,
  linkPreviewRouter,
} from "./routes/linkPreview";
import { ogProfilePostRouter } from "./routes/ogProfilePost";
import { ogJobRequestRouter } from "./routes/ogJobRequest";
import { postsRouter } from "./routes/posts";
import { contactRouter } from "./routes/contact";
import { pushRouter } from "./routes/push";
import { handleProcessPushQueue } from "./routes/pushCron";
import { requireCronSecret } from "./middleware/cronSecret";
import { startPushScheduler } from "./lib/push/startPushScheduler";

const app = express();

app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
  }),
);

/** Didit webhook must receive parsed JSON (signature V2 re-canonicalises the object). */
app.post(
  "/api/kyc/webhook",
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
  handleDiditWebhook,
);

app.use(express.json());

// Health check
app.get("/health", (_, res) => res.json({ ok: true }));

// Public Open Graph HTML for shared profile posts and help requests
app.use("/api/og", ogProfilePostRouter);
app.use("/api/og", ogJobRequestRouter);
app.use("/api/contact", contactRouter);

// Push queue worker — cron secret only (no user JWT)
app.post("/api/push/process-queue", requireCronSecret, handleProcessPushQueue);

// Protected routes
app.use("/api/push", requireUser, pushRouter);
app.use("/api/kyc", requireUser, kycRouter);
app.use("/api/jobs", requireUser, jobsRouter);
app.use("/api/posts", requireUser, postsRouter);
app.use("/api/freelancer", requireUser, freelancerRouter);
app.use("/api/dev", requireUser, devRouter);
app.use("/api/admin", requireUser, adminRouter);
app.get("/api/link-preview/image", handleLinkPreviewImageGet);
app.use("/api/link-preview", requireUser, linkPreviewRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`🚀 API running on port ${port}`);
  startPushScheduler();
});
