import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Activity,
  BadgeCheck,
  Ban,
  ChevronDown,
  Briefcase,
  Clock,
  FileText,
  HelpingHand,
  Image,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Newspaper,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { initialsGradient } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { getAdminData } from "@/lib/adminDataCache";
import { getProfilePostMediaItems } from "@/lib/profilePostMedia";
import { publicProfileMediaPublicUrl, publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { storageImageUrl } from "@/lib/imageTransform";
import { globalProfilePostFeedPath, isolatedOfferPostPath } from "@/lib/profilePostShare";
import { getServiceCategoryImage, serviceCategoryLabel } from "@/lib/serviceCategories";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

type BanLength = "2d" | "1w" | "1m" | "forever";

type ActiveBan = {
  user_id: string;
  reason: string;
  duration: string;
  expires_at: string | null;
  created_at: string;
};

type MemberProfile = {
  id: string;
  role: string | null;
  is_admin?: boolean | null;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
  is_verified?: boolean | null;
  kyc_status?: string | null;
  is_available_for_jobs?: boolean | null;
  whatsapp_number_e164?: string | null;
  telegram_username?: string | null;
  legal_terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  age_18_confirmed_at?: string | null;
  average_rating?: number | null;
  total_ratings?: number | null;
  bio?: string | null;
  categories?: string[] | null;
  languages?: string[] | null;
  address?: string | null;
  service_radius?: number | null;
  app_locale?: string | null;
  kyc_legal_name?: string | null;
  kyc_verified_at?: string | null;
  share_whatsapp?: boolean | null;
  share_telegram?: boolean | null;
};

type AccountRecord = {
  email: string | null;
  emailConfirmedAt: string | null;
  phone: string | null;
  lastSignInAt: string | null;
  providers: string[];
};

type HelperRecord = {
  languages: string[] | null;
  live_categories: string[] | null;
  available_now: boolean | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
};

type ProfileMedia = {
  id: string;
  media_type: "image" | "video";
  storage_path: string;
  sort_order: number;
  created_at: string;
};

type MemberPost = {
  id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  created_at: string;
  custom_category: string | null;
  post_type_id?: string | null;
  post_metadata?: unknown;
  post_types?: { name?: string | null; emoji?: string | null } | { name?: string | null; emoji?: string | null }[] | null;
};

type CommunityPost = {
  id: string;
  title: string | null;
  body: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  images: Array<{ id: string; post_id: string; image_url: string; sort_order: number }>;
};

type PostDeleteTarget = { kind: "profile" | "community"; postId: string };

type MediaDeleteTarget =
  | { kind: "avatar" }
  | { kind: "gallery"; mediaId: string }
  | { kind: "post"; postId: string; storagePath: string }
  | { kind: "board"; imageId: string };

type MemberReview = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer:
    | { full_name: string | null; photo_url: string | null }
    | Array<{ full_name: string | null; photo_url: string | null }>
    | null;
};

type MatchTally = { active: number; completed: number; cancelled: number };

type Dossier = {
  profile: MemberProfile;
  completedAsClient: number;
  completedAsFreelancer: number;
  postCounts?: {
    request_help: number;
    offer_service: number;
    community: number;
    event: number;
  };
  jobMatches?: {
    client: MatchTally;
    helper: MatchTally;
  };
  messages?: { sent: number; received: number };
  moderation?: {
    flaggedChats: number;
    flaggedMessages: number;
    flaggedBios: number;
    flaggedReviews: number;
    flaggedPosts: number;
    blockedPosts: number;
  };
  ban: ActiveBan | null;
  online?: boolean;
  lastActiveAt?: string | null;
  media: ProfileMedia[];
  posts: MemberPost[];
  communityPosts: CommunityPost[];
  account: AccountRecord | null;
  helper: HelperRecord | null;
  askedCategories: string[];
  reviews: MemberReview[];
};

type Rubric = "overview" | "dossier" | "media" | "posts" | "activity" | "message";

const RUBRICS: Array<{ id: Rubric; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "dossier", label: "Dossier", icon: UserRound },
  { id: "media", label: "Media", icon: Image },
  { id: "posts", label: "Posts", icon: Newspaper },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "message", label: "Message", icon: MessageSquare },
];

const BAN_LENGTHS: Array<[BanLength, string]> = [
  ["2d", "2 days"],
  ["1w", "1 week"],
  ["1m", "1 month"],
  ["forever", "Forever"],
];

const TEMPLATES: Array<{ id: string; group: string; label: string; hint: string; body: string }> = [
  {
    id: "welcome",
    group: "Onboarding",
    label: "Welcome",
    hint: "First hello after they join",
    body: "Hi, this is Tebnu. Welcome aboard. Finish your profile so members can find you, and reply here if you need a hand.",
  },
  {
    id: "profile",
    group: "Onboarding",
    label: "Finish profile",
    hint: "Photo, city, and what they offer",
    body: "Hi, this is Tebnu. Your profile is still thin. Add a photo, your city, and what you can help with so people can trust you.",
  },
  {
    id: "photo",
    group: "Onboarding",
    label: "Add a photo",
    hint: "Ask for a real profile picture",
    body: "Hi, this is Tebnu. Profiles with a clear photo get more replies. Add one when you can, and keep it a picture of you.",
  },
  {
    id: "verify",
    group: "Onboarding",
    label: "Verify identity",
    hint: "Point them at the identity check",
    body: "Hi, this is Tebnu. Verifying your identity adds the badge members look for. Open your profile and start the check when you have a moment.",
  },
  {
    id: "available",
    group: "Onboarding",
    label: "Turn on availability",
    hint: "They are not open for jobs",
    body: "Hi, this is Tebnu. You are not marked available, so nearby requests will not reach you. Turn availability on from your profile when you want work.",
  },
  {
    id: "thanks",
    group: "Care",
    label: "Thanks",
    hint: "They helped and it showed",
    body: "Hi, this is Tebnu. Thanks for helping out. Members noticed, and it keeps the community working.",
  },
  {
    id: "reply",
    group: "Care",
    label: "Please reply",
    hint: "A conversation is waiting",
    body: "Hi, this is Tebnu. Someone is waiting on a reply from you. Open your messages when you can so the request does not stall.",
  },
  {
    id: "followup",
    group: "Care",
    label: "After a job",
    hint: "Check the work went well",
    body: "Hi, this is Tebnu. How did the last job go? If something was off, reply here and we will look at it.",
  },
  {
    id: "language",
    group: "Moderation",
    label: "Language warning",
    hint: "Profanity or a rough chat",
    body: "Hi, this is Tebnu. A recent chat used language we do not allow. Keep it respectful. Another report can lead to a ban.",
  },
  {
    id: "harassment",
    group: "Moderation",
    label: "Harassment warning",
    hint: "Insults or pressure on someone",
    body: "Hi, this is Tebnu. A member reported harassment in your chats. Stop the insults and the pressure. Repeat it and the account will be banned.",
  },
  {
    id: "spam",
    group: "Moderation",
    label: "Spam warning",
    hint: "Repeated or unwanted posts",
    body: "Hi, this is Tebnu. Recent posts or messages looked like spam. Send one clear request, not copies. More of the same can get the account banned.",
  },
  {
    id: "scam",
    group: "Moderation",
    label: "Scam warning",
    hint: "Money, links, or a fake offer",
    body: "Hi, this is Tebnu. A recent message looked like a scam. Do not ask members for money, codes, or off-app payments. We will ban the account if it happens again.",
  },
  {
    id: "review",
    group: "Moderation",
    label: "Under review",
    hint: "We are looking at the account",
    body: "Hi, this is Tebnu. We are reviewing recent activity on your account. You can reply here if something looks wrong.",
  },
  {
    id: "final",
    group: "Moderation",
    label: "Final warning",
    hint: "One more strike and a ban",
    body: "Hi, this is Tebnu. This is a final warning. The next report for the same behaviour will ban the account.",
  },
  {
    id: "restricted",
    group: "Moderation",
    label: "Account restricted",
    hint: "Tell them a ban is in place",
    body: "Hi, this is Tebnu. This account is restricted and cannot use Tebnu until the ban ends. Reply here if you think we have the wrong person.",
  },
  {
    id: "custom",
    group: "Other",
    label: "Write your own",
    hint: "Start from a blank note",
    body: "",
  },
];

const TEMPLATE_GROUPS = ["Onboarding", "Care", "Moderation", "Other"];

type DirectoryUser = {
  id: string;
  full_name: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  photo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  login_phone?: string | null;
  whatsapp_number_e164?: string | null;
};

function memberInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function memberDigits(value: string) {
  return value.replace(/\D/g, "");
}

function memberMatchesQuery(user: DirectoryUser, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const fields = [user.full_name, user.email, user.id, user.phone, user.login_phone, user.whatsapp_number_e164];
  if (fields.some((value) => (value || "").toLowerCase().includes(q))) return true;
  const qDigits = memberDigits(q);
  if (qDigits.length < 3) return false;
  return [user.phone, user.login_phone, user.whatsapp_number_e164].some((value) =>
    memberDigits(value || "").includes(qDigits),
  );
}

function banUntilLabel(ban: ActiveBan) {
  if (!ban.expires_at || ban.duration === "forever") return "Forever";
  return format(new Date(ban.expires_at), "d MMM yyyy, HH:mm");
}

function lastActiveLabel(value: string | null | undefined) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;
  return `Active ${format(date, "d MMM yyyy")}`;
}

function when(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return format(date, "d MMM yyyy");
}

export default function AdminMemberPage() {
  const { userId = "", rubric: rubricParam } = useParams();
  const rubric: Rubric = RUBRICS.some((item) => item.id === rubricParam) ? (rubricParam as Rubric) : "overview";
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banOpen, setBanOpen] = useState(false);
  const [banLength, setBanLength] = useState<BanLength>("2d");
  const [banReason, setBanReason] = useState("");
  const [banSaving, setBanSaving] = useState(false);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState(TEMPLATES[0].body);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState<"delete" | "disconnect" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoDeleteOpen, setPhotoDeleteOpen] = useState(false);
  const [photoDeleting, setPhotoDeleting] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const [memberQuery, setMemberQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminData<{ users: DirectoryUser[] }>("dashboard", "/api/admin/dashboard")
      .then((data) => {
        if (!cancelled) setDirectory(data.users ?? []);
      })
      .catch(() => {});
    supabase
      .from("user_bans")
      .select("user_id, expires_at")
      .is("lifted_at", null)
      .then(({ data }) => {
        if (cancelled) return;
        const ids = new Set<string>();
        for (const row of data ?? []) {
          const expiresAt = row.expires_at as string | null;
          if (!expiresAt || new Date(expiresAt).getTime() > Date.now()) ids.add(row.user_id as string);
        }
        setBannedIds(ids);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const close = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [searchOpen]);

  const memberMatches = memberQuery.trim()
    ? directory.filter((person) => person.id !== userId && memberMatchesQuery(person, memberQuery)).slice(0, 8)
    : [];

  useEffect(() => {
    if (!templatesOpen && !actionsOpen) return;
    const close = (event: PointerEvent) => {
      if (!templatesRef.current?.contains(event.target as Node)) setTemplatesOpen(false);
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTemplatesOpen(false);
        setActionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [templatesOpen, actionsOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiGet<Dossier>(`/api/admin/users/${userId}`)
      .then((data) => {
        if (!cancelled) setDossier(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this member.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profile = dossier?.profile;
  const name = profile?.full_name?.trim() || "Anonymous";
  const isAdmin = Boolean(profile?.is_admin);
  const ban = dossier?.ban ?? null;
  const gallery = dossier?.media ?? [];
  const feedPosts = dossier?.posts ?? [];
  const boardPosts = dossier?.communityPosts ?? [];
  const postMedia = feedPosts.flatMap((post) =>
    getProfilePostMediaItems(post).map((item) => ({
      id: `${post.id}-${item.storage_path}`,
      postId: post.id,
      storage_path: item.storage_path,
      media_type: item.media_type,
    })),
  );
  const boardImages = boardPosts.flatMap((post) =>
    (post.images ?? [])
      .filter((image) => image.id)
      .map((image) => ({ id: image.id, url: image.image_url })),
  );

  async function deleteMedia(target: MediaDeleteTarget) {
    try {
      await apiPost(`/api/admin/users/${userId}/media`, target);
    } catch (err: unknown) {
      addToast({
        title: "Could not delete that photo",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
      throw err;
    }
    setDossier((current) => {
      if (!current) return current;
      if (target.kind === "avatar") {
        return { ...current, profile: { ...current.profile, photo_url: null } };
      }
      if (target.kind === "gallery") {
        return { ...current, media: current.media.filter((item) => item.id !== target.mediaId) };
      }
      if (target.kind === "post") {
        return {
          ...current,
          posts: current.posts.map((post) =>
            post.id === target.postId ? stripPostMedia(post, target.storagePath) : post,
          ),
        };
      }
      return {
        ...current,
        communityPosts: current.communityPosts.map((post) => ({
          ...post,
          images: (post.images ?? []).filter((image) => image.id !== target.imageId),
        })),
      };
    });
    addToast({ title: "Photo removed", variant: "success" });
  }

  async function deletePost(target: PostDeleteTarget) {
    try {
      await apiPost(`/api/admin/users/${userId}/posts`, target);
    } catch (err: unknown) {
      addToast({
        title: "Could not delete that post",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
      throw err;
    }
    setDossier((current) => {
      if (!current) return current;
      if (target.kind === "community") {
        return {
          ...current,
          communityPosts: current.communityPosts.filter((post) => post.id !== target.postId),
        };
      }
      const removed = current.posts.find((post) => post.id === target.postId);
      const typeId = removed?.post_type_id;
      const counts = current.postCounts;
      const nextCounts =
        counts && typeId && typeId in counts
          ? { ...counts, [typeId]: Math.max(0, counts[typeId as keyof typeof counts] - 1) }
          : counts;
      return {
        ...current,
        posts: current.posts.filter((post) => post.id !== target.postId),
        postCounts: nextCounts,
      };
    });
    addToast({ title: "Post removed", variant: "success" });
  }

  async function removeProfilePhoto() {
    if (photoDeleting) return;
    setPhotoDeleting(true);
    try {
      await deleteMedia({ kind: "avatar" });
      setPhotoDeleteOpen(false);
    } catch {
      // deleteMedia already reports the error.
    } finally {
      setPhotoDeleting(false);
    }
  }

  useEffect(() => {
    setTemplatesOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [rubric]);

  async function applyBan() {
    if (!profile || banSaving) return;
    const reason = banReason.trim();
    if (reason.length < 3) {
      addToast({ title: "Add a reason", variant: "error" });
      return;
    }
    setBanSaving(true);
    const { error: rpcError } = await supabase.rpc("admin_ban_user", {
      p_user_id: profile.id,
      p_duration: banLength,
      p_reason: reason,
    });
    setBanSaving(false);
    if (rpcError) {
      addToast({
        title: "Could not ban this member",
        description: /admin_ban_user|schema cache|does not exist/i.test(rpcError.message)
          ? "Run db/sql/165_user_bans.sql in the Supabase SQL editor, then try again."
          : rpcError.message,
        variant: "error",
      });
      return;
    }
    const expiresAt =
      banLength === "forever"
        ? null
        : new Date(
            Date.now() +
              (banLength === "2d" ? 2 : banLength === "1w" ? 7 : 30) * 24 * 60 * 60 * 1000,
          ).toISOString();
    setDossier((current) =>
      current
        ? {
            ...current,
            ban: {
              user_id: profile.id,
              reason,
              duration: banLength,
              expires_at: expiresAt,
              created_at: new Date().toISOString(),
            },
          }
        : current,
    );
    addToast({ title: banLength === "forever" ? "Banned forever" : "Banned", variant: "success" });
    setBanOpen(false);
    setBanReason("");
  }

  async function liftBan() {
    if (!profile || banSaving) return;
    setBanSaving(true);
    const { error: rpcError } = await supabase.rpc("admin_lift_ban", { p_user_id: profile.id });
    setBanSaving(false);
    if (rpcError) {
      addToast({ title: "Could not lift the ban", description: rpcError.message, variant: "error" });
      return;
    }
    setDossier((current) => (current ? { ...current, ban: null } : current));
    addToast({ title: "Ban lifted", variant: "success" });
    setBanOpen(false);
  }

  async function sendMessage() {
    if (!profile || sending) return;
    const body = message.trim();
    if (body.length < 2) return;
    setSending(true);
    try {
      await apiPost(`/api/admin/users/${profile.id}/message`, { body });
      addToast({ title: "Message sent", description: "It landed in their chat.", variant: "success" });
    } catch (err) {
      addToast({
        title: "Could not send",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  async function runAction(action: "delete" | "disconnect") {
    if (!profile || acting) return;
    setActing(action);
    try {
      await apiPost(`/api/admin/users/${profile.id}/action`, { action });
      addToast({
        title: action === "delete" ? "Account deleted" : "Profile disconnected",
        variant: "success",
      });
      navigate("/admin/users");
    } catch (err) {
      addToast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
      setActing(null);
      setConfirmDelete(false);
    }
  }

  return (
    <div ref={scrollRef} className="admin-page min-h-screen overflow-y-auto overscroll-contain bg-zinc-100 pb-16 dark:bg-zinc-950 md:h-[calc(100dvh-4rem)] md:min-h-0">
      <div className="w-full px-4 py-6 md:px-8 xl:px-10">
        <div className="mb-5">
          <div ref={searchRef} className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={memberQuery}
              placeholder="Search by name, email, id, phone, or WhatsApp"
              onChange={(event) => {
                setMemberQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {searchOpen && memberQuery.trim() ? (
              <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10">
                {memberMatches.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-zinc-500">No members match.</p>
                ) : (
                  memberMatches.map((person) => {
                    const personName = person.full_name?.trim() || "Anonymous";
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setMemberQuery("");
                          setSearchOpen(false);
                          navigate(`/admin/members/${person.id}`);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <span
                          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
                          style={{ backgroundImage: initialsGradient(person.id) }}
                        >
                          {person.photo_url ? (
                            <img src={person.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                              {personName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{personName}</span>
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {accountTypeLabel(person.role ?? null, Boolean(person.is_admin))}
                            </span>
                            {bannedIds.has(person.id) ? (
                              <Ban className="h-3.5 w-3.5 shrink-0 text-red-600" aria-label="Banned" />
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-zinc-500">
                            {person.email || person.phone || person.whatsapp_number_e164 || person.id}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : error || !profile ? (
          <div className="rounded-3xl bg-white px-6 py-16 text-center text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {error || "Member not found."}
          </div>
        ) : (
          <div className="space-y-5">
            <section className="relative overflow-visible rounded-3xl bg-white shadow-sm dark:bg-zinc-900">
              <div
                className="relative h-44 overflow-hidden rounded-t-3xl"
                style={{ backgroundImage: initialsGradient(profile.id) }}
              >
                <div className="absolute start-6 top-6 z-10 flex flex-col items-start gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm",
                      dossier.online ? "bg-emerald-500 text-white" : "bg-white/90 text-zinc-700",
                    )}
                    title={
                      dossier.online
                        ? "Logged in and in the app"
                        : dossier.lastActiveAt
                          ? format(new Date(dossier.lastActiveAt), "d MMM yyyy, HH:mm")
                          : undefined
                    }
                  >
                    {dossier.online ? (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    {dossier.online ? "Online" : lastActiveLabel(dossier.lastActiveAt)}
                  </span>
                  {ban ? (
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
                      Banned
                    </span>
                  ) : null}
                </div>
                <span className="pointer-events-none absolute end-6 top-7 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10">
                  <img src={BRAND_LOGO_SRC} alt="" className="h-16 w-16 object-contain" />
                </span>
              </div>
              <div
                className="absolute left-1/2 top-44 z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl ring-4 ring-white dark:ring-zinc-900"
                style={{ backgroundImage: initialsGradient(profile.id) }}
              >
                {profile.photo_url ? (
                  <>
                    <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoDeleteOpen(true)}
                      className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-red-600"
                      aria-label="Delete profile photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-5xl font-black tracking-tight text-white">
                    {memberInitials(name)}
                  </span>
                )}
              </div>
              <div ref={actionsRef} className="absolute end-6 top-[13rem] z-20 -translate-y-1/2">
                <button
                  type="button"
                  aria-expanded={actionsOpen}
                  aria-haspopup="menu"
                  onClick={() => setActionsOpen((open) => !open)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-orange-500 transition hover:bg-orange-500/10"
                >
                  Actions
                  <ChevronDown className={cn("h-4 w-4 transition", actionsOpen && "rotate-180")} />
                </button>
                {actionsOpen ? (
                  <div
                    role="menu"
                    className="absolute end-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
                  >
                    <Link
                      to={`/profile/${profile.id}`}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => setActionsOpen(false)}
                    >
                      <Star className="h-4 w-4" />
                      Public profile
                    </Link>
                    {isAdmin ? (
                      <p className="px-3 py-2 text-xs text-zinc-500">Admins stay out of ban and delete.</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionsOpen(false);
                            setBanOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <Ban className="h-4 w-4" />
                          {ban ? "Manage ban" : "Ban"}
                        </button>
                        {ban ? (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={banSaving}
                            onClick={() => {
                              setActionsOpen(false);
                              void liftBan();
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Lift ban
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={acting !== null}
                          onClick={() => {
                            setActionsOpen(false);
                            void runAction("disconnect");
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                        >
                          {acting === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                          Disconnect profile
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={acting !== null}
                          onClick={() => {
                            setActionsOpen(false);
                            setConfirmDelete(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete account
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="px-5 pb-5 pt-28 sm:px-8">
                <h1 className="truncate px-4 text-center text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                  {name}
                  {profile.is_verified ? (
                    <BadgeCheck className="ms-2 inline h-7 w-7 align-[-0.15em] fill-sky-500 text-white" aria-label="Verified" />
                  ) : null}
                </h1>
                <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-200">
                    {isAdmin ? <Shield className="h-3.5 w-3.5" /> : null}
                    {accountTypeLabel(profile.role, isAdmin)}
                  </span>
                  {profile.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {adminCityLabel(profile.city)}
                    </span>
                  ) : null}
                  <span>Member since {when(profile.created_at)}</span>
                </p>
                {ban ? (
                  <p className="mt-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    Banned until {banUntilLabel(ban)}. {ban.reason}
                  </p>
                ) : null}
              </div>
            </section>

            <div className="min-w-0 space-y-5">
            {rubric === "overview" ? (
            <div className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Done as client"
                value={String(dossier.completedAsClient)}
                icon={Briefcase}
                tone="orange"
                onClick={() => navigate(`/admin/members/${profile.id}/jobs/client`)}
              />
              <Stat
                label="Done as helper"
                value={String(dossier.completedAsFreelancer)}
                icon={HelpingHand}
                tone="sky"
                onClick={() => navigate(`/admin/members/${profile.id}/jobs/helper`)}
              />
              <Stat
                label="Rating"
                value={
                  typeof profile.average_rating === "number" && profile.average_rating > 0
                    ? profile.average_rating.toFixed(1)
                    : "—"
                }
                hint={
                  (dossier.reviews?.length ?? profile.total_ratings)
                    ? `${dossier.reviews?.length || profile.total_ratings} review${(dossier.reviews?.length || profile.total_ratings) === 1 ? "" : "s"}`
                    : "No reviews"
                }
                icon={Star}
                tone="amber"
                onClick={() => setReviewsOpen(true)}
              />
              <Stat
                label="KYC"
                value={profile.kyc_status ? profile.kyc_status.replace(/_/g, " ") : "None"}
                icon={ShieldCheck}
                tone="emerald"
              />
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <CountBoard
                title="Posts"
                hint="How many of each post type this member published."
                rows={[
                  { label: "Request help", value: dossier.postCounts?.request_help ?? 0, bar: "bg-orange-500" },
                  { label: "Offer service", value: dossier.postCounts?.offer_service ?? 0, bar: "bg-emerald-500" },
                  { label: "Community", value: dossier.postCounts?.community ?? 0, bar: "bg-blue-500" },
                  { label: "Event", value: dossier.postCounts?.event ?? 0, bar: "bg-violet-500" },
                ]}
              />
              <CountBoard
                title="Job matches"
                hint="Jobs they posted or were chosen for."
                rows={[
                  { label: "Active as client", value: dossier.jobMatches?.client.active ?? 0, bar: "bg-sky-500" },
                  { label: "Completed as client", value: dossier.jobMatches?.client.completed ?? 0, bar: "bg-emerald-500" },
                  { label: "Cancelled as client", value: dossier.jobMatches?.client.cancelled ?? 0, bar: "bg-zinc-400" },
                  { label: "Active as helper", value: dossier.jobMatches?.helper.active ?? 0, bar: "bg-sky-500" },
                  { label: "Completed as helper", value: dossier.jobMatches?.helper.completed ?? 0, bar: "bg-emerald-500" },
                  { label: "Cancelled as helper", value: dossier.jobMatches?.helper.cancelled ?? 0, bar: "bg-zinc-400" },
                ]}
              />
              <CountBoard
                title="Messages"
                hint="Chat messages this member sent and received."
                rows={[
                  { label: "Sent", value: dossier.messages?.sent ?? 0, bar: "bg-orange-500" },
                  { label: "Received", value: dossier.messages?.received ?? 0, bar: "bg-sky-500" },
                ]}
              />
              <CountBoard
                title="Moderation"
                hint="What the quality manager caught, and any admin ban."
                rows={[
                  { label: "Flagged in chat", value: dossier.moderation?.flaggedChats ?? 0, bar: "bg-amber-500" },
                  { label: "Flagged messages", value: dossier.moderation?.flaggedMessages ?? 0, bar: "bg-orange-500" },
                  { label: "Flagged bio", value: dossier.moderation?.flaggedBios ?? 0, bar: "bg-fuchsia-500" },
                  { label: "Flagged reviews", value: dossier.moderation?.flaggedReviews ?? 0, bar: "bg-rose-500" },
                  { label: "Flagged posts", value: dossier.moderation?.flaggedPosts ?? 0, bar: "bg-violet-500" },
                  { label: "Blocked posts", value: dossier.moderation?.blockedPosts ?? 0, bar: "bg-red-600" },
                ]}
                total={
                  (dossier.moderation?.flaggedChats ?? 0) +
                  (dossier.moderation?.flaggedBios ?? 0) +
                  (dossier.moderation?.flaggedReviews ?? 0) +
                  (dossier.moderation?.flaggedPosts ?? 0) +
                  (dossier.moderation?.blockedPosts ?? 0)
                }
                note={banNote(dossier.ban)}
                action={{ to: `/admin/members/${profile.id}/flags`, label: "Open table" }}
              />
            </div>
            </div>
            ) : null}

            {rubric === "dossier" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <DossierBox title="Account" className="lg:col-span-2">
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Account type" value={accountTypeLabel(profile.role, isAdmin)} />
                    <Field label="Email" value={dossier.account?.email || "—"} />
                    <Field label="Email confirmed" value={when(dossier.account?.emailConfirmedAt)} />
                    <Field label="Sign-in" value={providerLabel(dossier.account?.providers ?? [])} />
                    <Field label="Last sign-in" value={when(dossier.account?.lastSignInAt)} />
                    <Field label="Language" value={localeLabel(profile.app_locale)} />
                    <Field label="Phone on login" value={dossier.account?.phone || "—"} />
                    <Field label="Phone on profile" value={profile.phone || "—"} />
                    <Field label="Area" value={areaLabel(profile.address, profile.service_radius)} />
                    <Field label="Legal name" value={profile.kyc_legal_name || "—"} />
                    <Field label="Identity checked" value={when(profile.kyc_verified_at)} />
                    <Field label="Member id" value={profile.id} mono />
                  </dl>
                </DossierBox>
                <DossierBox title="Get help" hint="Categories they use when they need someone.">
                  <CategoryList ids={getHelpCategories(profile, dossier.askedCategories ?? [])} />
                </DossierBox>
                <DossierBox title="Help others" hint="Categories they offer as a helper.">
                  <CategoryList ids={helpOthersCategories(profile, dossier.helper)} />
                </DossierBox>
                <DossierBox title="Contact">
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="WhatsApp" value={profile.whatsapp_number_e164 || "—"} />
                    <Field label="WhatsApp shared" value={profile.share_whatsapp ? "Yes" : "No"} />
                    <Field label="Telegram" value={profile.telegram_username ? `@${profile.telegram_username.replace(/^@/, "")}` : "—"} />
                    <Field label="Telegram shared" value={profile.share_telegram ? "Yes" : "No"} />
                    <Field label="Available for jobs" value={profile.is_available_for_jobs ? "Yes" : "No"} />
                    <Field label="Live now" value={dossier.helper?.available_now ? "Yes" : "No"} />
                    <Field label="Rate" value={rateLabel(dossier.helper)} />
                  </dl>
                </DossierBox>
                <DossierBox title="Agreements">
                  <dl className="grid gap-x-6 gap-y-4">
                    <Field label="Terms accepted" value={when(profile.legal_terms_accepted_at)} />
                    <Field label="Privacy accepted" value={when(profile.privacy_accepted_at)} />
                    <Field label="Age confirmed" value={when(profile.age_18_confirmed_at)} />
                  </dl>
                </DossierBox>
                <DossierBox title="About" className="lg:col-span-2">
                  {profile.bio ? (
                    <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{profile.bio}</p>
                  ) : (
                    <p className="text-sm font-semibold text-zinc-400">No bio yet.</p>
                  )}
                  {uniqueIds([...(profile.languages ?? []), ...(dossier.helper?.languages ?? [])]).length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {uniqueIds([...(profile.languages ?? []), ...(dossier.helper?.languages ?? [])]).map((item) => (
                        <Chip key={`l-${item}`}>{item}</Chip>
                      ))}
                    </div>
                  ) : null}
                </DossierBox>
              </div>
            ) : null}

            {rubric === "media" ? (
              <MediaRubric
                photoUrl={profile.photo_url}
                gallery={gallery}
                postMedia={postMedia}
                boardImages={boardImages}
                onDelete={deleteMedia}
              />
            ) : null}

            {rubric === "posts" ? (
              <PostsRubric feedPosts={feedPosts} boardPosts={boardPosts} onDelete={deletePost} />
            ) : null}

            {rubric === "activity" ? <ActivityRubric userId={profile.id} /> : null}

            {rubric === "message" ? (
                <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-zinc-400" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Message</h2>
                  </div>
                  <div ref={templatesRef} className="relative mt-4">
                    <button
                      type="button"
                      aria-expanded={templatesOpen}
                      aria-haspopup="listbox"
                      onClick={() => setTemplatesOpen((open) => !open)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                          Template
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {TEMPLATES.find((template) => template.id === templateId)?.label}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-zinc-400 transition", templatesOpen && "rotate-180")}
                      />
                    </button>
                    {templatesOpen ? (
                      <div
                        role="listbox"
                        className="absolute bottom-full z-30 mb-2 max-h-80 w-full overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
                      >
                        {TEMPLATE_GROUPS.map((group) => (
                          <div key={group} className="py-1">
                            <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                              {group}
                            </p>
                            {TEMPLATES.filter((template) => template.group === group).map((template) => {
                              const selected = template.id === templateId;
                              return (
                                <button
                                  key={template.id}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => {
                                    setTemplateId(template.id);
                                    setMessage(template.body);
                                    setTemplatesOpen(false);
                                  }}
                                  className={cn(
                                    "flex w-full flex-col rounded-xl px-3 py-2 text-left",
                                    selected
                                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                      : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
                                  )}
                                >
                                  <span className="text-sm font-bold">{template.label}</span>
                                  <span className={cn("text-xs", selected ? "text-white/70 dark:text-zinc-500" : "text-zinc-500")}>
                                    {template.hint}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
                    rows={5}
                    placeholder="Write the note, or pick a template above."
                    className="mt-4 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{message.trim().length}/2000</span>
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={sending || message.trim().length < 2}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Send in chat
                    </button>
                  </div>
                </section>
            ) : null}
            </div>
          </div>
        )}
      </div>

      <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-3xl">
          <DialogTitle>Reviews</DialogTitle>
          <DialogDescription>
            {dossier?.reviews?.length
              ? `${dossier.reviews.length} review${dossier.reviews.length === 1 ? "" : "s"} for ${name}`
              : `No reviews for ${name} yet.`}
          </DialogDescription>
          <ul className="space-y-3">
            {(dossier?.reviews ?? []).map((review) => {
              const reviewer = Array.isArray(review.reviewer) ? review.reviewer[0] : review.reviewer;
              return (
                <li key={review.id} className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {reviewer?.full_name?.trim() || "Member"}
                    </p>
                    <p className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {review.rating}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{when(review.created_at)}</p>
                  {review.review_text?.trim() ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.review_text.trim()}</p>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-400">No written review.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog
        open={banOpen}
        onOpenChange={(open) => {
          if (!open && !banSaving) setBanOpen(open);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Ban a member</DialogTitle>
          <DialogDescription>
            The account stays. They cannot sign in, and other members cannot see, find, or message them.
          </DialogDescription>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</p>
          {ban ? (
            <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              Already banned ({banUntilLabel(ban)}). {ban.reason}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {BAN_LENGTHS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBanLength(id)}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm font-bold",
                  banLength === id
                    ? id === "forever"
                      ? "bg-red-600 text-white"
                      : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
            Why
            <textarea
              value={banReason}
              onChange={(event) => setBanReason(event.target.value.slice(0, 500))}
              rows={3}
              placeholder="What should they see when they try to sign in?"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            {ban ? (
              <button
                type="button"
                onClick={() => void liftBan()}
                disabled={banSaving}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Lift ban
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void applyBan()}
              disabled={banSaving || banReason.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {banSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {banLength === "forever" ? "Ban forever" : `Ban for ${BAN_LENGTHS.find(([id]) => id === banLength)?.[1]}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={photoDeleteOpen} onOpenChange={(open) => !photoDeleting && setPhotoDeleteOpen(open)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Delete this profile photo</DialogTitle>
          <DialogDescription>
            It comes off the profile for everyone. The initials stay in its place.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPhotoDeleteOpen(false)}
              disabled={photoDeleting}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void removeProfilePhoto()}
              disabled={photoDeleting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {photoDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(open) => !acting && setConfirmDelete(open)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Delete this account</DialogTitle>
          <DialogDescription>
            This removes the login and the profile. It cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={acting === "delete"}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Keep account
            </button>
            <button
              type="button"
              onClick={() => void runAction("delete")}
              disabled={acting === "delete"}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {acting === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete account
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fullMediaPreview(src: string) {
  const objectUrl = src.includes("/storage/v1/render/image/")
    ? src.replace("/storage/v1/render/image/", "/storage/v1/object/").split("?")[0]
    : src;
  if (!objectUrl.includes("/storage/v1/object/public/")) return src;
  return storageImageUrl(objectUrl, { width: 960, quality: 82, resize: "contain" });
}

function MediaRubric({
  photoUrl,
  gallery,
  postMedia,
  boardImages,
  onDelete,
}: {
  photoUrl: string | null;
  gallery: ProfileMedia[];
  postMedia: Array<{ id: string; postId: string; storage_path: string; media_type: "image" | "video" }>;
  boardImages: Array<{ id: string; url: string }>;
  onDelete: (target: MediaDeleteTarget) => Promise<void>;
}) {
  const [pending, setPending] = useState<MediaTile | null>(null);
  const [busy, setBusy] = useState(false);
  const tiles: MediaTile[] = [];
  if (photoUrl) {
    tiles.push({ id: "avatar", label: "Profile photo", kind: "image", src: fullMediaPreview(photoUrl), target: { kind: "avatar" } });
  }
  for (const item of gallery) {
    tiles.push({
      id: item.id,
      label: "Gallery",
      kind: item.media_type,
      src: item.media_type === "video"
        ? publicProfileMediaPublicUrl(item.storage_path)
        : fullMediaPreview(publicProfileMediaUrl(item.storage_path, { width: 960, quality: 82, resize: "contain" })),
      target: { kind: "gallery", mediaId: item.id },
    });
  }
  for (const item of postMedia) {
    tiles.push({
      id: item.id,
      label: "From a post",
      kind: item.media_type,
      src: item.media_type === "video"
        ? publicProfileMediaPublicUrl(item.storage_path)
        : fullMediaPreview(publicProfileMediaUrl(item.storage_path, { width: 960, quality: 82, resize: "contain" })),
      target: { kind: "post", postId: item.postId, storagePath: item.storage_path },
    });
  }
  for (const item of boardImages) {
    tiles.push({
      id: item.id,
      label: "From a post",
      kind: "image",
      src: fullMediaPreview(item.url),
      target: { kind: "board", imageId: item.id },
    });
  }

  async function confirmDelete() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await onDelete(pending.target);
      setPending(null);
    } catch {
      // The page already shows the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Media</h2>
        <p className="text-2xl font-black tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">{tiles.length}</p>
      </div>
      {tiles.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No photos or videos on this profile.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <figure key={tile.id} className="relative min-w-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800">
                {tile.kind === "video" ? (
                  <video src={tile.src} controls className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <img src={tile.src} alt="" className="absolute inset-0 h-full w-full object-contain" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setPending(tile)}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-red-600"
                aria-label={`Delete ${tile.label.toLowerCase()}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <figcaption className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                {tile.label}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <Dialog open={pending != null} onOpenChange={(open) => !busy && !open && setPending(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Delete this {pending?.kind === "video" ? "video" : "photo"}</DialogTitle>
          <DialogDescription>
            It comes off the profile for everyone. The post text stays if this file was attached to a post.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type MediaTile = {
  id: string;
  label: string;
  kind: "image" | "video";
  src: string;
  target: MediaDeleteTarget;
};

function stripPostMedia(post: MemberPost, storagePath: string): MemberPost {
  const meta =
    post.post_metadata && typeof post.post_metadata === "object" && !Array.isArray(post.post_metadata)
      ? { ...(post.post_metadata as Record<string, unknown>) }
      : {};
  const extras = Array.isArray(meta.media_items) ? meta.media_items : [];
  const kept: Array<{ storage_path: string; media_type: "image" | "video" }> = [];
  const seen = new Set<string>();
  const push = (path: unknown, mediaType: unknown) => {
    if (typeof path !== "string" || !path || path === storagePath) return;
    if ((mediaType !== "image" && mediaType !== "video") || seen.has(path)) return;
    seen.add(path);
    kept.push({ storage_path: path, media_type: mediaType });
  };
  push(post.storage_path, post.media_type);
  for (const raw of extras) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    push(row.storage_path, row.media_type);
  }
  const primary = kept[0] ?? null;
  if (kept.length > 1) meta.media_items = kept.slice(1);
  else delete meta.media_items;
  return {
    ...post,
    media_type: primary?.media_type ?? null,
    storage_path: primary?.storage_path ?? null,
    post_metadata: meta,
  };
}

type ActivityDay = {
  date: string;
  posts: number;
  media: number;
  messages: number;
  jobs: number;
  reviews: number;
  notes: string[];
  total: number;
};

function activityDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "d MMM yyyy");
}

function activityDayShort(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "d MMM");
}

function lastThirtyDays(days: ActivityDay[]) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const series: ActivityDay[] = [];
  const today = new Date();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
    const key = date.toISOString().slice(0, 10);
    series.push(
      byDate.get(key) ?? {
        date: key,
        posts: 0,
        media: 0,
        messages: 0,
        jobs: 0,
        reviews: 0,
        notes: [],
        total: 0,
      },
    );
  }
  return series;
}

function peakNote(day: ActivityDay) {
  const lines: string[] = [];
  if (day.posts) lines.push(`${day.posts} post${day.posts === 1 ? "" : "s"}`);
  if (day.media) lines.push(`${day.media} media`);
  if (day.messages) lines.push(`${day.messages} message${day.messages === 1 ? "" : "s"}`);
  if (day.jobs) lines.push(`${day.jobs} job${day.jobs === 1 ? "" : "s"}`);
  if (day.reviews) lines.push(`${day.reviews} review${day.reviews === 1 ? "" : "s"}`);
  for (const note of day.notes) lines.push(note);
  return lines;
}

function ActivityChart({ days }: { days: ActivityDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = lastThirtyDays(days);
  const max = Math.max(1, ...series.map((day) => day.total));
  const mid = Math.round(max / 2);
  const width = 600;
  const height = 160;
  const plotTop = 28;
  const plotBottom = 16;
  const plotHeight = height - plotTop - plotBottom;
  const xAt = (index: number) => (series.length <= 1 ? 0 : (index / (series.length - 1)) * width);
  const yAt = (total: number) => plotTop + (1 - total / max) * plotHeight;
  const points = series.map((day, index) => ({ x: xAt(index), y: yAt(day.total) }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,${yAt(0)} ${line} ${width},${yAt(0)}`;
  const xTicks = series
    .map((day, index) => ({ day, index }))
    .filter(({ day, index }) => day.total > 0 || index % 7 === 0 || index === series.length - 1);
  const yTicks = mid > 0 && mid < max ? [max, mid, 0] : [max, 0];

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Last 30 days</p>
      <div className="mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
        <div className="relative h-40">
          {yTicks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-zinc-500"
              style={{ top: `${(yAt(tick) / height) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
        <div className="min-w-0">
          <div className="relative h-40">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label="Activity over the last 30 days"
            >
              {yTicks.map((tick) => (
                <line
                  key={tick}
                  x1="0"
                  x2={width}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <polygon points={area} className="fill-orange-500/15" />
              <polyline
                points={line}
                fill="none"
                className="stroke-orange-500"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {series.map((day, index) => {
              if (day.total === 0) return null;
              const left = (xAt(index) / width) * 100;
              const top = (yAt(day.total) / height) * 100;
              const open = hover === index;
              const note = peakNote(day);
              return (
                <span key={day.date}>
                  <button
                    type="button"
                    className={cn(
                      "absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500 ring-4 ring-white transition hover:scale-125 dark:ring-zinc-900",
                      open && "scale-125",
                    )}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    aria-label={`${activityDayLabel(day.date)}: ${note.join(", ")}`}
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover((current) => (current === index ? null : current))}
                    onFocus={() => setHover(index)}
                    onBlur={() => setHover((current) => (current === index ? null : current))}
                  />
                  {open ? (
                    <span
                      className={cn(
                        "pointer-events-none absolute z-20 w-max max-w-[14rem] rounded-2xl bg-zinc-950 px-3 py-2 text-left text-white shadow-lg",
                        left < 18 ? "translate-x-0" : left > 82 ? "-translate-x-full" : "-translate-x-1/2",
                        top < 42 ? "translate-y-3" : "-translate-y-[calc(100%+0.75rem)]",
                      )}
                      style={{ left: `${left}%`, top: `${top}%` }}
                    >
                      <span className="block text-[11px] font-bold">{activityDayLabel(day.date)}</span>
                      <span className="mt-1 block text-[11px] font-medium leading-5 text-zinc-300">
                        {note.join(" · ")}
                      </span>
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <div className="relative mt-2 h-4">
            {xTicks.map(({ day, index }) => {
              const atStart = index === 0;
              const atEnd = index === series.length - 1;
              return (
                <span
                  key={day.date}
                  className={cn(
                    "absolute top-0 whitespace-nowrap text-[11px] font-semibold",
                    day.total > 0 ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400",
                    atStart ? "left-0" : atEnd ? "right-0" : "-translate-x-1/2",
                  )}
                  style={atStart || atEnd ? undefined : { left: `${(xAt(index) / width) * 100}%` }}
                >
                  {activityDayShort(day.date)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_TYPES = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "media", label: "Media" },
  { id: "messages", label: "Messages" },
  { id: "jobs", label: "Jobs" },
  { id: "reviews", label: "Reviews" },
  { id: "notes", label: "Notes" },
] as const;

type ActivityType = (typeof ACTIVITY_TYPES)[number]["id"];

function ActivityRubric({ userId }: { userId: string }) {
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiGet<{ days: ActivityDay[] }>(`/api/admin/users/${userId}/activity`)
      .then((data) => {
        if (!cancelled) setDays(data.days ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load activity.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const total = days.reduce((sum, day) => sum + day.total, 0);
  const filtered = days.filter((day) => {
    if (from && day.date < from) return false;
    if (to && day.date > to) return false;
    if (activityType === "notes") return day.notes.length > 0;
    if (activityType === "all") return true;
    return day[activityType] > 0;
  });

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">Activity</h2>
        <p className="text-2xl font-black tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">{total}</p>
      </div>
      <div className="mt-3 rounded-3xl bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-zinc-600">{error}</p>
      ) : days.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <>
          <ActivityChart days={days} />
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 block rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 block rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map((item) => {
                const selected = activityType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivityType(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-bold transition",
                      selected
                        ? "bg-orange-500 text-white"
                        : "text-zinc-600 hover:bg-orange-500/10 hover:text-orange-600 dark:text-zinc-300",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No activity matches these filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Posts</th>
                    <th className="py-2 pr-3">Media</th>
                    <th className="py-2 pr-3">Messages</th>
                    <th className="py-2 pr-3">Jobs</th>
                    <th className="py-2 pr-3">Reviews</th>
                    <th className="py-2 pr-3">Notes</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((day) => (
                    <tr key={day.date}>
                      <td className="whitespace-nowrap py-2.5 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {activityDayLabel(day.date)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300">{day.posts}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300">{day.media}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300">{day.messages}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300">{day.jobs}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-300">{day.reviews}</td>
                      <td className="py-2.5 pr-3 text-zinc-600 dark:text-zinc-300">{day.notes.join(", ") || "—"}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{day.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </div>
    </section>
  );
}

function offerRequestCategoryImage(post: MemberPost) {
  if (post.post_type_id !== "offer_service" && post.post_type_id !== "request_help") return null;
  const meta =
    post.post_metadata && typeof post.post_metadata === "object" && !Array.isArray(post.post_metadata)
      ? (post.post_metadata as Record<string, unknown>)
      : null;
  const raw = post.post_type_id === "offer_service" ? meta?.service ?? meta?.category : meta?.category;
  const id = typeof raw === "string" && raw.trim() ? raw.trim() : post.custom_category;
  return getServiceCategoryImage(id);
}

function postTypeLabel(post: MemberPost) {
  const type = Array.isArray(post.post_types) ? post.post_types[0] : post.post_types;
  return type?.name || post.custom_category || "Post";
}

function PostsRubric({
  feedPosts,
  boardPosts,
  onDelete,
}: {
  feedPosts: MemberPost[];
  boardPosts: CommunityPost[];
  onDelete: (target: PostDeleteTarget) => Promise<void>;
}) {
  const [pending, setPending] = useState<PostDeleteTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const empty = feedPosts.length === 0 && boardPosts.length === 0;
  const postCount = feedPosts.length + boardPosts.length;

  async function confirmDelete() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await onDelete(pending);
      setPending(null);
    } catch {
      // The page already shows the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Posts</h2>
        <p className="text-2xl font-black tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">{postCount}</p>
      </div>
      {empty ? (
        <p className="mt-4 text-sm text-zinc-500">This member has not posted yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {feedPosts.map((post) => {
            const media = getProfilePostMediaItems(post)[0];
            const thumb = media
              ? media.media_type === "video"
                ? publicProfileMediaPublicUrl(media.storage_path)
                : fullMediaPreview(publicProfileMediaUrl(media.storage_path, { width: 960, quality: 82, resize: "contain" }))
              : offerRequestCategoryImage(post);
            return (
              <li key={post.id} className="relative min-w-0">
                <Link
                  to={isolatedOfferPostPath(post.id)}
                  className="flex h-full flex-col overflow-hidden rounded-2xl transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800">
                    {media && thumb && media.media_type === "video" ? (
                      <video src={thumb} className="absolute inset-0 h-full w-full object-contain" />
                    ) : thumb ? (
                      <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-zinc-400">
                        <FileText className="h-8 w-8" />
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 p-3">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      {postTypeLabel(post)} · {format(new Date(post.created_at), "d MMM yyyy")}
                    </span>
                    <span className="mt-1 line-clamp-3 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {post.caption?.trim() || "No caption"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPending({ kind: "profile", postId: post.id })}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-red-600"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
          {boardPosts.map((post) => {
            const image = post.images?.[0]?.image_url;
            return (
              <li key={post.id} className="relative min-w-0">
                <Link
                  to={globalProfilePostFeedPath(post.id)}
                  className="flex h-full flex-col overflow-hidden rounded-2xl transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800">
                    {image ? (
                      <img src={fullMediaPreview(image)} alt="" className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-zinc-400">
                        <FileText className="h-8 w-8" />
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 p-3">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      {post.category || "Availability"} · {post.status || "active"} · {format(new Date(post.created_at), "d MMM yyyy")}
                    </span>
                    <span className="mt-1 line-clamp-3 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {post.title?.trim() || post.body?.trim() || "Untitled"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPending({ kind: "community", postId: post.id })}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-red-600"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={pending != null} onOpenChange={(open) => !busy && !open && setPending(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Delete this post</DialogTitle>
          <DialogDescription>
            It comes off Tebnu for everyone. The member gets a message in support chat that the team removed it because it is not appropriate.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function accountTypeLabel(role: string | null, isAdmin: boolean) {
  if (isAdmin) return "Admin";
  if (role === "freelancer") return "Helper";
  if (role === "client") return "Client";
  return "Member";
}

function providerLabel(providers: string[]) {
  if (providers.length === 0) return "—";
  return providers
    .map((provider) => {
      const label = provider.replace(/_/g, " ");
      return label.charAt(0).toUpperCase() + label.slice(1);
    })
    .join(", ");
}

function localeLabel(locale: string | null | undefined) {
  if (locale === "he") return "Hebrew";
  if (locale === "ru") return "Russian";
  if (locale === "fr") return "French";
  if (locale === "en") return "English";
  return locale || "—";
}

function areaLabel(address: string | null | undefined, radius: number | null | undefined) {
  const place = address?.trim();
  if (!place && radius == null) return "—";
  if (place && radius != null) return `${place} · ${radius} km`;
  return place || `${radius} km`;
}

function rateLabel(helper: HelperRecord | null | undefined) {
  if (!helper || (helper.hourly_rate_min == null && helper.hourly_rate_max == null)) return "—";
  if (helper.hourly_rate_min != null && helper.hourly_rate_max != null) {
    return `${helper.hourly_rate_min}–${helper.hourly_rate_max}`;
  }
  return String(helper.hourly_rate_min ?? helper.hourly_rate_max);
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
}

function getHelpCategories(profile: MemberProfile, asked: string[]) {
  const saved = profile.role === "client" ? profile.categories ?? [] : [];
  return uniqueIds([...saved, ...asked]);
}

function helpOthersCategories(profile: MemberProfile, helper: HelperRecord | null | undefined) {
  const saved = profile.role === "freelancer" ? profile.categories ?? [] : [];
  return uniqueIds([...saved, ...(helper?.live_categories ?? [])]);
}

function CategoryList({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return <p className="text-sm font-semibold text-zinc-400">None chosen</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <Chip key={id}>{serviceCategoryLabel(id)}</Chip>
      ))}
    </div>
  );
}

function banNote(ban: ActiveBan | null) {
  if (!ban) return "Not banned by an admin.";
  const length =
    ban.duration === "2d"
      ? "2 days"
      : ban.duration === "1w"
        ? "1 week"
        : ban.duration === "1m"
          ? "1 month"
          : "forever";
  return `Banned for ${length}, until ${banUntilLabel(ban)}. ${ban.reason}`;
}

function CountBoard({
  title,
  hint,
  rows,
  note,
  total,
  action,
}: {
  title: string;
  hint: string;
  rows: Array<{ label: string; value: number; bar: string }>;
  note?: string;
  total?: number;
  action?: { to: string; label: string };
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const shown = total ?? rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <section>
      <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
      <div className="mt-3 rounded-3xl bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
      <p className="text-right text-3xl font-black tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">{shown}</p>
      <ul className="mt-4 space-y-3.5">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">{row.label}</span>
              <span className="font-bold tabular-nums text-zinc-500">{row.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={cn("h-full rounded-full", row.bar)}
                style={{ width: row.value === 0 ? "0%" : `${Math.max(6, (row.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-4 text-sm font-semibold leading-6 text-zinc-700 dark:text-zinc-200">{note}</p> : null}
      {action ? (
        <Link
          to={action.to}
          className="mt-5 inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold text-orange-500 transition hover:bg-orange-500/10"
        >
          {action.label}
        </Link>
      ) : null}
      </div>
    </section>
  );
}

const STAT_TONES = {
  orange: "text-orange-500",
  sky: "text-sky-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
} as const;

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Star;
  tone: keyof typeof STAT_TONES;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-3xl bg-white px-5 py-5 text-left shadow-sm dark:bg-zinc-900",
        onClick && "transition hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <Icon className={cn("h-12 w-12 shrink-0", STAT_TONES[tone])} strokeWidth={1.6} />
      <span className="min-w-0">
        <span className="block text-lg font-black tracking-tight text-zinc-600 dark:text-zinc-300">{label}</span>
        <span className="mt-0.5 block truncate text-3xl font-black capitalize tracking-tight text-zinc-950 dark:text-zinc-50">{value}</span>
        {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
      </span>
    </Tag>
  );
}

function DossierBox({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(className)}>
      <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-zinc-500">{hint}</p> : null}
      <div className="mt-3 rounded-3xl bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">{label}</dt>
      <dd className={cn("mt-1 break-all text-sm font-semibold text-zinc-900 dark:text-zinc-100", mono && "font-mono text-xs font-medium text-zinc-500")}>
        {value}
      </dd>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </span>
  );
}
