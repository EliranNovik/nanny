export const queryKeys = {
  // Base scopes
  jobs: ["jobs"] as const,
  messages: ["messages"] as const,
  invitations: ["invitations"] as const,
  communityFeed: ["communityFeed"] as const,
  community: ["community"] as const,

  // Specific entities
  activeJobs: (userId?: string) => [...queryKeys.jobs, "active", userId] as const,
  clientRequests: (userId?: string) => [...queryKeys.jobs, "clientRequests", userId] as const,
  freelancerRequests: (userId?: string) => [...queryKeys.jobs, "freelancerRequests", userId] as const,

  recentMessages: (userId?: string) => [...queryKeys.messages, "recent", userId] as const,

  userInvitations: (userId?: string) => [...queryKeys.invitations, userId] as const,

  discoverFeed: () => [...queryKeys.communityFeed, "discover"] as const,
  discoverLiveAvatars: (excludeUserId?: string | null) =>
    [...queryKeys.communityFeed, "avatars", excludeUserId ?? "all"] as const,
  discoverOpenHelpRequests: (excludeUserId?: string | null) =>
    [...queryKeys.jobs, "discoverOpen", excludeUserId ?? "none"] as const,

  communityPosts: (category: string | null) => [...queryKeys.community, "posts", category] as const,
  postFavorites: (userId?: string, postIds?: string[]) => [...queryKeys.community, "favorites", userId, postIds?.sort().join(",")] as const,
  pendingHireInterests: (userId?: string, postIds?: string[]) => [...queryKeys.community, "hireInterests", userId, postIds?.sort().join(",")] as const,

  /** Saved profiles (`profile_favorites`) for the current user. */
  profileFavorites: (userId?: string | null) =>
    [...queryKeys.community, "profileFavorites", userId ?? "none"] as const,
};

