import { postServiceCategoryLabel } from "@/lib/serviceCategories";

export type AdminJobPresentation = {
  status: string;
  care_type?: string | null;
  service_type?: string | null;
  service_details?: {
    other_type?: string | null;
    custom_category?: string | null;
    subcategory?: string | null;
  } | null;
  latest_cancellation?: { reason: string } | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_rate_type?: string | null;
};

const REASONS: Record<string, string> = {
  helper_no_show: "Helper didn't show up",
  helper_unresponsive: "Helper stopped responding",
  helper_not_good_enough: "Helper wasn't good enough",
  helper_unprofessional: "Helper was unprofessional",
  price_disagreement: "Price disagreement",
  schedule_changed: "Client schedule changed",
  client_unresponsive: "Client stopped responding",
  job_not_as_described: "Job wasn't as described",
  schedule_conflict: "Helper schedule conflict",
  personal_emergency: "Personal emergency",
  other: "Other reason",
};

export function adminJobCategory(job: AdminJobPresentation): string {
  const category = job.service_type || job.care_type;
  const detail =
    job.service_details?.other_type ||
    job.service_details?.custom_category ||
    job.service_details?.subcategory;
  return postServiceCategoryLabel(category, detail);
}

export function adminJobStatus(job: AdminJobPresentation): "In process" | "Cancelled" | "Completed" {
  if (job.status === "completed") return "Completed";
  if (job.status === "cancelled" || (job.status === "ready" && job.latest_cancellation)) {
    return "Cancelled";
  }
  return "In process";
}

export function adminJobCancellationReason(job: AdminJobPresentation): string {
  const reason = job.latest_cancellation?.reason;
  return reason ? REASONS[reason] || reason.replace(/_/g, " ") : "—";
}

export function adminJobBudget(job: AdminJobPresentation): string {
  const min = job.budget_min;
  const max = job.budget_max;
  if (min == null && max == null) return "No rate specified";
  const suffix = job.budget_rate_type === "fixed" ? " fixed" : "/hr";
  if (min != null && max != null && min !== max) return `₪${min}–₪${max}${suffix}`;
  const amount = min ?? max;
  if (job.budget_rate_type === "fixed" || min === max) return `₪${amount}${suffix}`;
  if (min != null) return `From ₪${min}${suffix}`;
  return `Up to ₪${max}${suffix}`;
}
