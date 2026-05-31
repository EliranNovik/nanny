/** True when identity is fully verified (Didit approved). */
export function isKycApproved(profile: {
  kyc_status?: string | null;
  is_admin?: boolean | null;
} | null | undefined): boolean {
  if (!profile || profile.is_admin) return true;
  return profile.kyc_status === "approved";
}

/** Show reminders / block start-request and go-live until verified. */
export function needsKycVerification(profile: {
  kyc_status?: string | null;
  is_admin?: boolean | null;
} | null | undefined): boolean {
  return !isKycApproved(profile);
}

export function kycStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "skipped":
      return "Skipped";
    case "in_progress":
      return "In progress";
    case "approved":
      return "Verified";
    case "declined":
      return "Declined";
    case "in_review":
    case "pending_review":
      return "Under review";
    case "expired":
      return "Expired";
    case "abandoned":
      return "Incomplete";
    default:
      return "Pending";
  }
}

export function roleHomePath(role: "client" | "freelancer" | "admin" | string): string {
  if (role === "client") return "/client/home";
  if (role === "freelancer") return "/freelancer/home";
  return "/";
}

export type KycBlockedAction = "start_request" | "go_live" | "share_post";

export function kycBlockedActionMessage(action: KycBlockedAction): string {
  switch (action) {
    case "go_live":
      return "Verify your identity before going live. You can complete verification anytime from your account.";
    case "share_post":
      return "Verify your identity before sharing a post. You can complete verification anytime from your account.";
    default:
      return "Verify your identity before posting a request. You can complete verification anytime from your account.";
  }
}
