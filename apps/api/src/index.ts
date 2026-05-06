import express from "express";
import cors from "cors";
import "dotenv/config";
import { requireUser } from "./middleware/auth";
import { jobsRouter } from "./routes/jobs";
import { devRouter } from "./routes/dev";
import { adminRouter } from "./routes/admin";
import {
  handleLinkPreviewImageGet,
  linkPreviewRouter,
} from "./routes/linkPreview";

const app = express();

app.use(cors({ 
  origin: process.env.CORS_ORIGIN || "http://localhost:5175", 
  credentials: true 
}));
app.use(express.json());

// Health check
app.get("/health", (_, res) => res.json({ ok: true }));

// Protected routes
app.use("/api/jobs", requireUser, jobsRouter);
app.use("/api/dev", requireUser, devRouter);
app.use("/api/admin", requireUser, adminRouter);
app.get("/api/link-preview/image", handleLinkPreviewImageGet);
app.use("/api/link-preview", requireUser, linkPreviewRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`🚀 API running on port ${port}`));

