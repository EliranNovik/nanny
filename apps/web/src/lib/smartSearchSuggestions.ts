import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Calendar,
  ClipboardList,
  Heart,
  Home,
  Hourglass,
  MapPin,
  MessageCircle,
  Plus,
  CircleDot,
  User,
  UsersRound,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

export type SmartSearchSuggestion = {
  id: string;
  title: string;
  subtitle?: string;
  to: string;
  keywords: string[];
  icon: LucideIcon;
};

function norm(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(q: string) {
  return norm(q)
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
}

function scoreItem(query: string, item: SmartSearchSuggestion): number {
  const q = norm(query);
  if (!q) return 0;
  const tokens = tokenize(query);
  let score = 0;
  const hay = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
  for (const kw of item.keywords) {
    if (q.includes(kw)) score += 4;
    else if (tokens.some((t) => t.length >= 2 && kw.includes(t))) score += 2;
  }
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (hay.includes(t)) score += 2;
    if (item.keywords.some((k) => k.includes(t) || t.includes(k))) score += 1;
  }
  return score;
}

export const CLIENT_PAGE_SUGGESTIONS: SmartSearchSuggestion[] = [
  {
    id: "find-helpers",
    title: "Find helpers",
    subtitle: "Browse caregivers and helpers near you",
    to: "/client/helpers",
    keywords: [
      "helper",
      "helpers",
      "nanny",
      "nannies",
      "babysitter",
      "babysitting",
      "childcare",
      "caregiver",
      "sitter",
      "near me",
      "nearby",
      "find",
      "hire",
      "search",
      "looking",
      "need helper",
      "need a helper",
      "babysit",
    ],
    icon: MapPin,
  },
  {
    id: "post-request",
    title: "Post a request",
    subtitle: "Describe what you need — I need a helper",
    to: "/client/create",
    keywords: [
      "post",
      "request",
      "create",
      "need",
      "booking",
      "job post",
      "help me",
      "need help",
      "hire help",
    ],
    icon: Plus,
  },
  {
    id: "home",
    title: "Home",
    subtitle: "Your client home",
    to: "/client/home",
    keywords: ["home", "main", "dashboard", "start"],
    icon: Home,
  },
  {
    id: "inbox",
    title: "Messages",
    subtitle: "Inbox and chats",
    to: "/messages",
    keywords: ["message", "messages", "inbox", "chat", "dm", "conversation"],
    icon: MessageCircle,
  },
  {
    id: "liked",
    title: "Liked",
    subtitle: "Saved profiles",
    to: "/liked",
    keywords: ["liked", "saved", "favorite", "favorites", "heart", "shortlist"],
    icon: Heart,
  },
  {
    id: "jobs-my-requests",
    title: "My posted requests",
    subtitle: "Jobs tab — what you posted",
    to: buildJobsUrl("client", "my_requests"),
    keywords: ["my requests", "posted", "my jobs", "bookings", "incoming", "applications"],
    icon: ClipboardList,
  },
  {
    id: "jobs-live",
    title: "Helping me now",
    subtitle: "Active work with helpers",
    to: buildJobsUrl("client", "jobs"),
    keywords: ["live", "helping now", "helping me now", "active jobs", "current jobs", "ongoing"],
    icon: Briefcase,
  },
  {
    id: "jobs-past",
    title: "History of help",
    subtitle: "Completed history",
    to: buildJobsUrl("client", "past"),
    keywords: ["past", "history", "history of help", "completed", "done"],
    icon: CheckCircle2,
  },
  {
    id: "community",
    title: "Community feed",
    subtitle: "Discover posts from helpers",
    to: "/public/posts",
    keywords: ["community", "discover", "feed", "browse", "everyone", "public"],
    icon: UsersRound,
  },
  {
    id: "availability",
    title: "Availability",
    subtitle: "Short availability posts",
    to: "/availability",
    keywords: ["availability", "available", "now", "today", "offers"],
    icon: CircleDot,
  },
  {
    id: "my-posts",
    title: "My posts",
    subtitle: "Your availability posts",
    to: "/posts",
    keywords: ["my posts", "my availability", "my listings"],
    icon: UsersRound,
  },
  {
    id: "profile",
    title: "Profile & settings",
    subtitle: "Edit your account",
    to: "/client/profile",
    keywords: ["profile", "account", "settings", "edit", "me"],
    icon: User,
  },
  {
    id: "calendar",
    title: "Calendar",
    subtitle: "Schedule",
    to: "/calendar",
    keywords: ["calendar", "schedule", "dates"],
    icon: Calendar,
  },
  {
    id: "payments",
    title: "Payments",
    subtitle: "Billing and payouts",
    to: "/payments",
    keywords: ["payment", "payments", "pay", "billing", "invoice", "money"],
    icon: Wallet,
  },
];

export const FREELANCER_PAGE_SUGGESTIONS: SmartSearchSuggestion[] = [
  {
    id: "home",
    title: "Home",
    subtitle: "Your freelancer home",
    to: "/freelancer/home",
    keywords: ["home", "main", "dashboard", "start"],
    icon: Home,
  },
  {
    id: "incoming",
    title: "Community's requests",
    subtitle: "New leads and requests",
    to: buildJobsUrl("freelancer", "requests"),
    keywords: ["incoming", "community", "community's", "requests", "leads", "new", "bell", "notifications jobs"],
    icon: Bell,
  },
  {
    id: "pending",
    title: "Pending response",
    subtitle: "Awaiting confirmation",
    to: buildJobsUrl("freelancer", "pending"),
    keywords: ["pending", "pending response", "waiting", "hourglass"],
    icon: Hourglass,
  },
  {
    id: "jobs-live",
    title: "Helping now",
    subtitle: "Active jobs",
    to: buildJobsUrl("freelancer", "jobs"),
    keywords: ["live", "helping now", "active", "current", "ongoing"],
    icon: Briefcase,
  },
  {
    id: "jobs-past",
    title: "History of help",
    subtitle: "Completed work",
    to: buildJobsUrl("freelancer", "past"),
    keywords: ["past", "history", "history of help", "completed"],
    icon: CheckCircle2,
  },
  {
    id: "inbox",
    title: "Messages",
    subtitle: "Inbox and chats",
    to: "/messages",
    keywords: ["message", "messages", "inbox", "chat", "dm"],
    icon: MessageCircle,
  },
  {
    id: "liked",
    title: "Liked",
    subtitle: "Saved profiles",
    to: "/liked",
    keywords: ["liked", "saved", "favorite", "heart"],
    icon: Heart,
  },
  {
    id: "community",
    title: "Community feed",
    subtitle: "Discover posts",
    to: "/public/posts",
    keywords: ["community", "discover", "feed", "browse", "public"],
    icon: UsersRound,
  },
  {
    id: "availability",
    title: "Set availability",
    subtitle: "Your availability posts",
    to: "/availability",
    keywords: ["availability", "available", "post", "my window"],
    icon: UsersRound,
  },
  {
    id: "my-posts",
    title: "My posts",
    subtitle: "Manage listings",
    to: "/posts",
    keywords: ["my posts", "listings"],
    icon: ClipboardList,
  },
  {
    id: "profile",
    title: "Profile & settings",
    subtitle: "Edit your freelancer profile",
    to: "/freelancer/profile",
    keywords: ["profile", "account", "settings", "edit", "me"],
    icon: User,
  },
  {
    id: "calendar",
    title: "Calendar",
    subtitle: "Schedule",
    to: "/calendar",
    keywords: ["calendar", "schedule"],
    icon: Calendar,
  },
  {
    id: "payments",
    title: "Payments",
    subtitle: "Earnings and payouts",
    to: "/payments",
    keywords: ["payment", "payments", "pay", "billing", "money", "earn"],
    icon: Wallet,
  },
];

export function suggestionsForRole(role: "client" | "freelancer" | null | undefined): SmartSearchSuggestion[] {
  return role === "freelancer" ? FREELANCER_PAGE_SUGGESTIONS : CLIENT_PAGE_SUGGESTIONS;
}

export function filterPageSuggestions(
  query: string,
  role: "client" | "freelancer" | null | undefined
): SmartSearchSuggestion[] {
  const list = suggestionsForRole(role);
  const q = norm(query);
  if (!q) return [];
  const scored = list
    .map((item) => ({ item, score: scoreItem(query, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.item);
}
