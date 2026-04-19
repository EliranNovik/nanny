import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";

export type JobSummaryRow = {
  id: string;
  status: string;
  stage: string | null;
  service_type?: string | null;
  care_type?: string | null;
  location_city?: string | null;
  start_at?: string | null;
};

/** Category label for job_requests row */
export function jobCategoryLabel(row: Pick<JobSummaryRow, "service_type" | "care_type">): string {
  if (row.service_type && isServiceCategoryId(row.service_type)) {
    return serviceCategoryLabel(row.service_type);
  }
  if (row.care_type) {
    return row.care_type
      .split("_")
      .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
      .join(" ");
  }
  return "Help";
}

/** Short time phrase for strip + inbox */
export function jobTimeSummary(startAt: string | null | undefined): string {
  if (!startAt) return "Time TBD";
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= dayStart && t < dayStart + 86400000) {
    return `Today · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  const tomorrow = dayStart + 86400000;
  if (t >= tomorrow && t < tomorrow + 86400000) {
    return `Tomorrow · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type InboxStatusVariant = "active" | "waiting" | "completed" | "direct";

export function inboxStatusFromJob(
  job: JobSummaryRow | null | undefined,
  unreadCount: number,
): { label: string; variant: InboxStatusVariant } {
  if (!job) {
    if (unreadCount > 0) return { label: "Needs reply", variant: "waiting" };
    return { label: "Message", variant: "direct" };
  }
  const stage = (job.stage || "").trim();
  const completed =
    stage === "Completed" ||
    stage === "Job Ended" ||
    job.status === "completed" ||
    job.status === "cancelled";
  if (completed) {
    return { label: "Completed", variant: "completed" };
  }
  if (unreadCount > 0) {
    return { label: "Needs reply", variant: "waiting" };
  }
  return { label: "Active", variant: "active" };
}

/** Heuristic: transactional / system copy — centered, not a chat bubble */
export function isLikelySystemMessage(body: string | null | undefined): boolean {
  if (!body?.trim()) return false;
  const t = body.trim();
  if (t.startsWith("✓") || t.startsWith("✔")) return true;
  if (/^declined\b/i.test(t)) return true;
  if (/match accepted/i.test(t)) return true;
  if (/schedule confirmed/i.test(t)) return true;
  if (/payment (accepted|completed|request)/i.test(t)) return true;
  if (/^request sent\b/i.test(t)) return true;
  if (/price offer/i.test(t)) return true;
  return false;
}
