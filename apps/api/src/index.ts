import express from "express";
import cors from "cors";
import "dotenv/config";
import { requireUser } from "./middleware/auth";
import { jobsRouter } from "./routes/jobs";
import { devRouter } from "./routes/dev";
import { adminRouter } from "./routes/admin";

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

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`🚀 API running on port ${port}`));

