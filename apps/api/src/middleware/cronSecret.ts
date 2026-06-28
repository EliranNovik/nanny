import { Request, Response, NextFunction } from "express";

export function requireCronSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.PUSH_CRON_SECRET?.trim();
  if (!expected) {
    res.status(503).json({ error: "PUSH_CRON_SECRET is not configured" });
    return;
  }

  const provided =
    req.headers["x-cron-secret"]?.toString() ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    "";

  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
