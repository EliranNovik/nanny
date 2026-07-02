import type { TFunction } from "i18next";

export type ProfilePostListingStatus =
  | "helper_found"
  | "already_helping"
  | "expired";

const LISTING_STATUS_BY_POST_TYPE: Record<string, ProfilePostListingStatus> = {
  request_help: "helper_found",
  offer_service: "already_helping",
  event: "expired",
};

export function listingStatusForPostType(
  postTypeId: string | null | undefined,
): ProfilePostListingStatus | null {
  if (!postTypeId) return null;
  return LISTING_STATUS_BY_POST_TYPE[postTypeId] ?? null;
}

export function getProfilePostListingStatus(
  metadata: unknown,
): ProfilePostListingStatus | null {
  const raw = (metadata as Record<string, unknown> | null | undefined)
    ?.listing_status;
  if (
    raw === "helper_found" ||
    raw === "already_helping" ||
    raw === "expired"
  ) {
    return raw;
  }
  return null;
}

export function isProfilePostListingStatusActive(
  postTypeId: string | null | undefined,
  metadata: unknown,
): boolean {
  const expected = listingStatusForPostType(postTypeId);
  const current = getProfilePostListingStatus(metadata);
  return expected !== null && current === expected;
}

export function profilePostListingStatusLabel(
  t: TFunction,
  status: ProfilePostListingStatus,
): string {
  switch (status) {
    case "helper_found":
      return t("feed.listingStatus.helperFound");
    case "already_helping":
      return t("feed.listingStatus.alreadyHelping");
    case "expired":
      return t("feed.listingStatus.expired");
  }
}

export function profilePostListingStatusMarkLabel(
  t: TFunction,
  status: ProfilePostListingStatus,
): string {
  switch (status) {
    case "helper_found":
      return t("feed.listingStatus.markHelperFound");
    case "already_helping":
      return t("feed.listingStatus.markAlreadyHelping");
    case "expired":
      return t("feed.listingStatus.markExpired");
  }
}

export function profilePostListingStatusBadgeClass(
  status: ProfilePostListingStatus,
): string {
  switch (status) {
    case "helper_found":
      return "bg-emerald-600/90 text-white dark:bg-emerald-700/90";
    case "already_helping":
      return "bg-sky-600/90 text-white dark:bg-sky-700/90";
    case "expired":
      return "bg-neutral-600/90 text-white dark:bg-neutral-700/90";
  }
}

export function profilePostListingStatusButtonActiveClass(
  status: ProfilePostListingStatus,
): string {
  switch (status) {
    case "helper_found":
      return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60";
    case "already_helping":
      return "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/60";
    case "expired":
      return "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-200 dark:hover:bg-neutral-800";
  }
}
