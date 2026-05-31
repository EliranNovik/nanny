/** True when the user must complete Didit KYC before using the app. */
export function needsKycVerification(profile: {
  kyc_status?: string | null;
  is_admin?: boolean | null;
} | null | undefined): boolean {
  if (!profile || profile.is_admin) return false;
  const status = profile.kyc_status ?? "approved";
  return status !== "approved";
}

export function kycStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "not_started":
      return "Not started";
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
