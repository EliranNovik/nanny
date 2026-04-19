import { isJobOpenForDiscoverListing } from "@/lib/discoverOpenJobStatuses";

/**
 * Inbound row shape shared by Jobs → Community's requests and Discover work strip.
 * Hook already drops rows without job_requests or with community_post_id.
 */
export type CommunityInboundNotification = {
  isConfirmed?: boolean;
  job_requests?: {
    status?: string | null;
    community_post_id?: string | null;
    client_id?: string | null;
    service_type?: string | null;
  } | null;
};

/**
 * “Community’s requests” incoming column: same as Jobs tab — not yet confirmed by
 * the freelancer, not a community-post hire, job still in an open status, optional
 * category filter, optional hide-own-client (Discover).
 */
export function matchesCommunityRequestsIncoming(
  n: CommunityInboundNotification,
  opts?: {
    serviceFilter?: string | null;
    excludeClientId?: string | null;
  },
): boolean {
  if (n.isConfirmed) return false;
  const jr = n.job_requests;
  if (!jr || jr.community_post_id) return false;
  if (!isJobOpenForDiscoverListing(jr.status ?? null)) return false;
  const sf = opts?.serviceFilter;
  if (sf && jr.service_type !== sf) return false;
  const ex = opts?.excludeClientId;
  if (ex && jr.client_id === ex) return false;
  return true;
}
