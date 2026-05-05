import type { JobSummaryRow } from "@/lib/chatJobContext";

type Props = {
  job: JobSummaryRow;
  participantName: string;
  selfLabel?: string;
  jobHref?: string | null;
  className?: string;
};

/**
 * Job context strip was removed from the embedded chat UI.
 * This stub remains so Vite HMR / stale tabs do not request a deleted module (empty MIME / 404).
 */
export function ChatJobContextStrip(_props: Props) {
  return null;
}
