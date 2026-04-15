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
  discoverLiveAvatars: () => [...queryKeys.communityFeed, "avatars"] as const,

  communityPosts: (category: string | null) => [...queryKeys.community, "posts", category] as const,
  postFavorites: (userId?: string, postIds?: string[]) => [...queryKeys.community, "favorites", userId, postIds?.sort().join(",")] as const,
  pendingHireInterests: (userId?: string, postIds?: string[]) => [...queryKeys.community, "hireInterests", userId, postIds?.sort().join(",")] as const,
};

