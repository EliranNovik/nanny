/** In-app full-page editor for a profile post (offer / event / community / request_help). */
export function editProfilePostPath(postId: string): string {
  return `/posts/${encodeURIComponent(postId)}/edit`;
}

/** In-app full-page editor for an open help request (job_requests). */
export function editOpenRequestPath(jobId: string): string {
  return `/open-requests/${encodeURIComponent(jobId)}/edit`;
}
