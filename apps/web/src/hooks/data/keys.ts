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

  messagesInbox: (userId?: string, role?: string) =>
    [...queryKeys.messages, "inbox", userId ?? "anon", role ?? "unknown"] as const,

  chatThread: (userId?: string, conversationId?: string | null) =>
    [...queryKeys.messages, "thread", userId ?? "anon", conversationId ?? "none"] as const,

  userInvitations: (userId?: string) => [...queryKeys.invitations, userId] as const,

  discoverFeed: () => [...queryKeys.communityFeed, "discover"] as const,
  discoverLiveAvatars: (excludeUserId?: string | null) =>
    [...queryKeys.communityFeed, "avatars", excludeUserId ?? "all"] as const,
  discoverOpenHelpRequests: (excludeUserId?: string | null) =>
    [...queryKeys.jobs, "discoverOpen", excludeUserId ?? "none"] as const,

  /** Explore "Live help now" cards — scoped by viewer + mode so hire/work cache independently. */
  exploreLiveHelp: (userId: string | undefined, mode: "hire" | "work") =>
    [...queryKeys.jobs, "exploreLiveHelp", userId ?? "anon", mode] as const,

  communityPosts: (category: string | null) => [...queryKeys.community, "posts", category] as const,
  postFavorites: (userId?: string, postIds?: string[]) => [...queryKeys.community, "favorites", userId, postIds?.sort().join(",")] as const,
  pendingHireInterests: (userId?: string, postIds?: string[]) => [...queryKeys.community, "hireInterests", userId, postIds?.sort().join(",")] as const,

  /** Saved open help requests (`job_request_favorites`) for the current user. */
  jobRequestFavorites: (userId?: string | null) =>
    [...queryKeys.jobs, "jobRequestFavorites", userId ?? "none"] as const,

  /** Saved profiles (`profile_favorites`) for the current user. */
  profileFavorites: (userId?: string | null) =>
    [...queryKeys.community, "profileFavorites", userId ?? "none"] as const,

  /** Open posted requests authored by the current user's saved profiles. */
  discoverFavoriteRequests: (userId?: string | null) =>
    [...queryKeys.jobs, "discoverFavoriteRequests", userId ?? "none"] as const,

  /** Hydrated profile rows for the current user's saved profiles (favorites). */
  discoverSavedProfiles: (userId?: string | null) =>
    [...queryKeys.community, "discoverSavedProfiles", userId ?? "none"] as const,

  /** Community / profile posts feed — scoped by all filter params so different feed contexts cache independently. */
  profilePostsFeed: (opts: {
    userId?: string | null;
    viewerUserId?: string | null;
    filterTaggedUserId?: string | null;
    filterAuthorId?: string | null;
    authorNameFilter?: string | null;
    sortOrder?: string;
    filterLikedByUserId?: string | null;
    filterPostTypeId?: string | null;
    filterPostTypeIds?: string[] | null;
    filterCommentedOwnPosts?: boolean;
    filterAcceptedRequests?: boolean;
    feedWhen?: string | null;
    feedMyPostsOnly?: boolean;
    feedBudgetMin?: number | null;
    feedBudgetMax?: number | null;
    feedFavoriteProfilesOnly?: boolean;
    limit?: number | null;
  }) =>
    [
      ...queryKeys.community,
      "profilePostsFeed",
      opts.userId ?? "all",
      opts.viewerUserId ?? "anon",
      opts.filterTaggedUserId ?? "",
      opts.filterAuthorId ?? "",
      opts.authorNameFilter ?? "",
      opts.sortOrder ?? "newest",
      opts.filterLikedByUserId ?? "",
      opts.filterPostTypeId ?? "",
      opts.filterPostTypeIds?.join(",") ?? "",
      opts.filterCommentedOwnPosts ? "commented" : "",
      opts.filterAcceptedRequests ? "accepted" : "",
      opts.feedWhen ?? "",
      opts.feedMyPostsOnly ? "mine" : "",
      opts.feedBudgetMin ?? "",
      opts.feedBudgetMax ?? "",
      opts.feedFavoriteProfilesOnly ? "fav" : "",
      opts.limit ?? 0,
    ] as const,

  profilePostById: (postId?: string | null, viewerUserId?: string | null) =>
    [
      ...queryKeys.community,
      "profilePostById",
      postId ?? "",
      viewerUserId ?? "anon",
    ] as const,

  jobRequestById: (jobId?: string | null, viewerUserId?: string | null) =>
    [
      ...queryKeys.jobs,
      "jobRequestById",
      jobId ?? "",
      viewerUserId ?? "anon",
    ] as const,
};

