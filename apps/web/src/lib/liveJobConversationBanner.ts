import { buildJobsUrl, type JobsPerspective } from "@/components/jobs/jobsPerspective";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";

export type LiveJobBannerPayload = {
  categoryLabel: string;
  href: string;
};

/** Row shape from `job_requests` — used by inbox hook and ChatPage job state */
export function getLiveJobBannerFromRow(
  row: {
    status: string;
    service_type?: string | null;
    care_type?: string | null;
    client_id: string;
    selected_freelancer_id: string | null;
  },
  userId: string | undefined,
): LiveJobBannerPayload | null {
  if (!userId) return null;
  if (row.status !== "locked" && row.status !== "active") return null;
  const isClient = row.client_id === userId;
  const isHelper = row.selected_freelancer_id === userId;
  if (!isClient && !isHelper) return null;
  const mode: JobsPerspective = isClient ? "client" : "freelancer";
  const href = buildJobsUrl(mode, "jobs");
  let categoryLabel = "Help";
  if (row.service_type && isServiceCategoryId(row.service_type)) {
    categoryLabel = serviceCategoryLabel(row.service_type);
  } else if (row.care_type) {
    categoryLabel = row.care_type
      .split("_")
      .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
      .join(" ");
  }
  return { categoryLabel, href };
}
