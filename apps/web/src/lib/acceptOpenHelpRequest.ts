import { apiPost } from "@/lib/api";

/** Confirm availability on an open posted request (discover / browse, no notification gate). */
export async function acceptOpenHelpRequest(
  jobId: string,
  note?: string,
): Promise<void> {
  await apiPost(`/api/jobs/${jobId}/freelancer-confirm-open`, note ? { note } : {});
}
