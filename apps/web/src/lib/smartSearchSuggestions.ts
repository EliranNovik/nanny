import {
  Bell,
  Briefcase,
  Calendar,
  Heart,
  MapPin,
  MessageCircle,
  Plus,
  User,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { SERVICE_CATEGORIES } from "./serviceCategories";

export type SmartSearchSuggestionKind =
  | "page"
  | "action"
  | "category"
  | "status"
  | "shortcut";

export type SmartSearchSuggestion = {
  id: string;
  kind: SmartSearchSuggestionKind;
  title: string;
  subtitle?: string;
  to: string;
  keywords: string[];
  icon: LucideIcon;
  /** Role priority: if set, boosts result for this role */
  roleLimit?: "client" | "freelancer";
};

function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function tokenize(q: string) {
  return norm(q)
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
}

export function scoreItem(
  query: string,
  item: SmartSearchSuggestion,
  userRole?: "client" | "freelancer",
): number {
  const q = norm(query);
  if (!q) return 0;
  const tokens = tokenize(query);
  let score = 0;

  // Type-based base weights
  const kindWeights: Record<SmartSearchSuggestionKind, number> = {
    action: 15,
    status: 12,
    category: 10,
    shortcut: 8,
    page: 5,
  };
  const baseWeight = kindWeights[item.kind] || 0;

  const hay = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();

  // Role match boost
  if (userRole && item.roleLimit && item.roleLimit === userRole) {
    score += 5;
  }

  // Keyword match
  for (const kw of item.keywords) {
    if (q === kw) score += baseWeight + 20; // Exact keyword match
    else if (q.includes(kw)) score += baseWeight + 10;
    else if (tokens.some((t) => t.length >= 2 && kw.includes(t))) score += 5;
  }

  // Text match
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (hay.startsWith(t)) score += 8;
    else if (hay.includes(t)) score += 4;
    if (item.keywords.some((k) => k.includes(t) || t.includes(k))) score += 2;
  }

  return score;
}

export const COMMON_SUGGESTIONS: SmartSearchSuggestion[] = [
  {
    id: "inbox",
    kind: "page",
    title: "Messages",
    subtitle: "Inbox and chats",
    to: "/messages",
    keywords: ["message", "messages", "inbox", "chat", "dm", "conversation", "unread"],
    icon: MessageCircle,
  },
  {
    id: "notifications",
    kind: "action",
    title: "Open Notifications",
    subtitle: "View your alerts",
    to: "/notifications",
    keywords: ["notifications", "alerts", "bell", "what happened"],
    icon: Bell,
  },
];

const CATEGORY_SUGGESTIONS: SmartSearchSuggestion[] = SERVICE_CATEGORIES.map(
  (cat) => ({
    id: `cat-${cat.id}`,
    kind: "category",
    title: `${cat.label} help`,
    subtitle: `Find ${cat.label.toLowerCase()} helpers or post requests`,
    to: `/client/helpers?category=${cat.id}`,
    keywords: [cat.id, cat.label.toLowerCase(), ...cat.label.toLowerCase().split(" ")],
    icon: MapPin,
  }),
);

export const CLIENT_PAGE_SUGGESTIONS: SmartSearchSuggestion[] = [
  ...COMMON_SUGGESTIONS,
  ...CATEGORY_SUGGESTIONS,
  {
    id: "find-helpers",
    kind: "shortcut",
    title: "Find helpers",
    subtitle: "Browse caregivers and helpers near you",
    to: "/client/helpers",
    keywords: ["helper", "helpers", "nanny", "nannies", "find", "hire", "search"],
    icon: MapPin,
    roleLimit: "client",
  },
  {
    id: "post-request",
    kind: "action",
    title: "Post a request",
    subtitle: "Describe what you need — I need a helper",
    to: "/client/create",
    keywords: ["post", "request", "create", "need", "job"],
    icon: Plus,
    roleLimit: "client",
  },
  {
    id: "jobs-live-client",
    kind: "status",
    title: "Active jobs",
    subtitle: "Work currently in progress",
    to: buildJobsUrl("client", "jobs"),
    keywords: ["live", "active", "ongoing", "current", "helping now"],
    icon: Briefcase,
    roleLimit: "client",
  },
  {
    id: "liked",
    kind: "page",
    title: "Liked",
    subtitle: "Saved profiles",
    to: "/liked",
    keywords: ["liked", "saved", "favorite", "heart"],
    icon: Heart,
  },
  {
    id: "calendar",
    kind: "page",
    title: "Calendar",
    subtitle: "Schedule",
    to: "/calendar",
    keywords: ["calendar", "schedule", "dates"],
    icon: Calendar,
  },
];

export const FREELANCER_PAGE_SUGGESTIONS: SmartSearchSuggestion[] = [
  ...COMMON_SUGGESTIONS,
  {
    id: "post-availability",
    kind: "action",
    title: "Post Availability",
    subtitle: "Let clients find you now",
    to: "/availability/post-now",
    keywords: ["post", "available", "now", "availability", "work"],
    icon: UsersRound,
    roleLimit: "freelancer",
  },
  {
    id: "incoming-requests",
    kind: "status",
    title: "New requests",
    subtitle: "Jobs from the community",
    to: buildJobsUrl("freelancer", "requests"),
    keywords: ["incoming", "requests", "leads", "new"],
    icon: Bell,
    roleLimit: "freelancer",
  },
  {
    id: "jobs-live-freelancer",
    kind: "status",
    title: "My active jobs",
    subtitle: "Current working assignments",
    to: buildJobsUrl("freelancer", "jobs"),
    keywords: ["live", "active", "ongoing", "work", "helping now"],
    icon: Briefcase,
    roleLimit: "freelancer",
  },
  {
    id: "profile-freelancer",
    kind: "page",
    title: "Profile & settings",
    subtitle: "Edit your freelancer profile",
    to: "/freelancer/profile",
    keywords: ["profile", "account", "settings", "edit", "me"],
    icon: User,
    roleLimit: "freelancer",
  },
];

export function suggestionsForRole(
  role: "client" | "freelancer" | null | undefined,
): SmartSearchSuggestion[] {
  return role === "freelancer"
    ? FREELANCER_PAGE_SUGGESTIONS
    : CLIENT_PAGE_SUGGESTIONS;
}

export function filterPageSuggestions(
  query: string,
  role: "client" | "freelancer" | null | undefined,
): SmartSearchSuggestion[] {
  const list = suggestionsForRole(role);
  const q = norm(query);
  if (!q) return [];
  const scored = list
    .map((item) => ({ item, score: scoreItem(query, item, role || undefined) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.item);
}
