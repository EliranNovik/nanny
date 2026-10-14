/** Flip to true to restore ID-check blocks on requests, posts, go-live, and onboarding. */
export const KYC_REQUIRED_FOR_ACTIONS = false;

/** True when identity is fully verified (Didit approved). */
export function isKycApproved(profile: {
  kyc_status?: string | null;
  is_admin?: boolean | null;
} | null | undefined): boolean {
  if (!profile || profile.is_admin) return true;
  return profile.kyc_status === "approved";
}

/** True when Didit approved this user (badge), ignoring the action-gate switch. */
export function isIdentityVerified(profile: {
  kyc_status?: string | null;
} | null | undefined): boolean {
  return profile?.kyc_status === "approved";
}

export function isKycUnderReview(status: string | null | undefined): boolean {
  return status === "in_review" || status === "pending_review";
}

export function isKycInterrupted(status: string | null | undefined): boolean {
  return (
    status === "in_progress" ||
    status === "abandoned" ||
    status === "expired" ||
    status === "declined"
  );
}

/**
 * Show reminders / block start-request and go-live until verified.
 * All in-app gates go through this; KYC_REQUIRED_FOR_ACTIONS turns them off.
 */
export function needsKycVerification(profile: {
  kyc_status?: string | null;
  is_admin?: boolean | null;
} | null | undefined): boolean {
  if (!KYC_REQUIRED_FOR_ACTIONS) return false;
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

export function roleAccountPath(role: "client" | "freelancer" | "admin" | string): string {
  if (role === "freelancer") return "/freelancer/profile/account";
  return "/client/profile/account";
}

export function roleAccountVerifyPath(
  role: "client" | "freelancer" | "admin" | string,
): string {
  return `${roleAccountPath(role)}/verify`;
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
