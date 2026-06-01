export type GuestAuthPromptVariant = "profile" | "engage" | "create";

export type GuestAuthPromptCopy = {
  title: string;
  description: string;
};

export const GUEST_AUTH_PROMPT_COPY: Record<
  GuestAuthPromptVariant,
  GuestAuthPromptCopy
> = {
  profile: {
    title: "Join the community",
    description:
      "Create a free account to view profiles, connect with helpers, and discover people near you on tebnu.",
  },
  engage: {
    title: "Join the conversation",
    description:
      "Register for free to like posts, leave comments, and save your favorite profiles.",
  },
  create: {
    title: "Share your story",
    description:
      "Sign up for free to post photos, videos, and updates — and become part of the tebnu community.",
  },
};
