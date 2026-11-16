import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  ChevronDown,
  FileText,
  Image,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Newspaper,
  Shield,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { adminCityLabel } from "@/lib/adminCityLabel";
import { getProfilePostMediaItems } from "@/lib/profilePostMedia";
import { publicProfileMediaPublicUrl, publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { serviceCategoryLabel } from "@/lib/serviceCategories";
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

type Dossier = {
  profile: MemberProfile;
  completedAsClient: number;
  completedAsFreelancer: number;
  ban: ActiveBan | null;
  media: ProfileMedia[];
  posts: MemberPost[];
  communityPosts: CommunityPost[];
  account: AccountRecord | null;
  helper: HelperRecord | null;
  askedCategories: string[];
  reviews: MemberReview[];
};

type Rubric = "overview" | "dossier" | "media" | "posts" | "message";

const RUBRICS: Array<{ id: Rubric; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "dossier", label: "Dossier", icon: UserRound },
  { id: "media", label: "Media", icon: Image },
  { id: "posts", label: "Posts", icon: Newspaper },
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

function banUntilLabel(ban: ActiveBan) {
  if (!ban.expires_at || ban.duration === "forever") return "Forever";
  return format(new Date(ban.expires_at), "d MMM yyyy, HH:mm");
}

function when(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return format(date, "d MMM yyyy");
}

export default function AdminMemberPage() {
  const { userId = "" } = useParams();
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
  const [rubric, setRubric] = useState<Rubric>("overview");
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setRubric("overview");
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

  function openRubric(next: Rubric) {
    setRubric(next);
    setTemplatesOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }

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
        <Link
          to="/admin/users"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Users registry
        </Link>

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
            <section className="overflow-visible rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
              <div
                className={cn(
                  "relative h-32 overflow-hidden rounded-t-3xl",
                  profile.role === "freelancer"
                    ? "bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-800"
                    : "bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700",
                )}
              >
                <img
                  src={BRAND_LOGO_SRC}
                  alt=""
                  className="pointer-events-none absolute end-8 top-1/2 h-16 w-auto -translate-y-1/2 drop-shadow-md"
                />
              </div>
              <div className="px-5 pb-6 sm:px-8">
                <div className="-mt-16 flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div
                    className={cn(
                      "relative h-32 w-32 shrink-0 overflow-hidden rounded-3xl ring-4 ring-white dark:ring-zinc-900",
                      profile.role === "freelancer"
                        ? "bg-gradient-to-br from-emerald-400 to-teal-700"
                        : "bg-gradient-to-br from-orange-400 to-orange-600",
                    )}
                  >
                    <img
                      src={BRAND_LOGO_SRC}
                      alt=""
                      className="absolute inset-0 m-auto h-14 w-auto"
                    />
                    {profile.photo_url ? (
                      <img src={profile.photo_url} alt="" className="relative z-10 h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="min-w-0 text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">{name}</h1>
                      {profile.is_verified ? (
                        <BadgeCheck className="h-6 w-6 fill-sky-500 text-white" aria-label="Verified" />
                      ) : null}
                      {ban ? (
                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                          Banned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
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
                  </div>
                  <div ref={actionsRef} className="relative shrink-0 sm:mb-1">
                    <button
                      type="button"
                      aria-expanded={actionsOpen}
                      aria-haspopup="menu"
                      onClick={() => setActionsOpen((open) => !open)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
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
                </div>
                {ban ? (
                  <p className="mt-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    Banned until {banUntilLabel(ban)}. {ban.reason}
                  </p>
                ) : null}
              </div>
            </section>

            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Member sections">
                {RUBRICS.map((item) => {
                  const Icon = item.icon;
                  const selected = rubric === item.id;
                  const count =
                    item.id === "media"
                      ? (profile.photo_url ? 1 : 0) + gallery.length + postMedia.length + boardImages.length
                      : item.id === "posts"
                        ? feedPosts.length + boardPosts.length
                        : null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openRubric(item.id)}
                      aria-current={selected ? "page" : undefined}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold",
                        selected
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count !== null ? (
                        <span className={cn("text-xs tabular-nums", selected ? "text-white/70 dark:text-zinc-500" : "text-zinc-400")}>
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
            </nav>

            <div className="min-w-0 space-y-5">
            {rubric === "overview" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Done as client" value={String(dossier.completedAsClient)} />
              <Stat label="Done as helper" value={String(dossier.completedAsFreelancer)} />
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
                onClick={() => setReviewsOpen(true)}
              />
              <Stat
                label="KYC"
                value={profile.kyc_status ? profile.kyc_status.replace(/_/g, " ") : "None"}
              />
            </div>
            ) : null}

            {rubric === "dossier" ? (
                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-6">
                  <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Account</h2>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Account type" value={accountTypeLabel(profile.role, isAdmin)} />
                    <Field label="Email" value={dossier.account?.email || "—"} />
                    <Field label="Email confirmed" value={when(dossier.account?.emailConfirmedAt)} />
                    <Field label="Sign-in" value={providerLabel(dossier.account?.providers ?? [])} />
                    <Field label="Last sign-in" value={when(dossier.account?.lastSignInAt)} />
                    <Field label="Phone on login" value={dossier.account?.phone || "—"} />
                    <Field label="Phone on profile" value={profile.phone || "—"} />
                    <Field label="Language" value={localeLabel(profile.app_locale)} />
                    <Field label="Legal name" value={profile.kyc_legal_name || "—"} />
                    <Field label="Identity checked" value={when(profile.kyc_verified_at)} />
                    <Field label="Area" value={areaLabel(profile.address, profile.service_radius)} />
                    <Field label="Member id" value={profile.id} mono />
                  </dl>
                  <h3 className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Get help</h3>
                  <p className="mt-1 text-xs text-zinc-500">Categories they use when they need someone.</p>
                  <CategoryList ids={getHelpCategories(profile, dossier.askedCategories ?? [])} />
                  <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Help others</h3>
                  <p className="mt-1 text-xs text-zinc-500">Categories they offer as a helper.</p>
                  <CategoryList ids={helpOthersCategories(profile, dossier.helper)} />
                  <h3 className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Contact</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="WhatsApp" value={profile.whatsapp_number_e164 || "—"} />
                    <Field label="WhatsApp shared" value={profile.share_whatsapp ? "Yes" : "No"} />
                    <Field label="Telegram" value={profile.telegram_username ? `@${profile.telegram_username.replace(/^@/, "")}` : "—"} />
                    <Field label="Telegram shared" value={profile.share_telegram ? "Yes" : "No"} />
                    <Field label="Available for jobs" value={profile.is_available_for_jobs ? "Yes" : "No"} />
                    <Field label="Live now" value={dossier.helper?.available_now ? "Yes" : "No"} />
                    <Field label="Rate" value={rateLabel(dossier.helper)} />
                    <Field label="Terms accepted" value={when(profile.legal_terms_accepted_at)} />
                    <Field label="Privacy accepted" value={when(profile.privacy_accepted_at)} />
                    <Field label="Age confirmed" value={when(profile.age_18_confirmed_at)} />
                  </dl>
                  {profile.bio ? (
                    <p className="mt-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{profile.bio}</p>
                  ) : null}
                  {uniqueIds([...(profile.languages ?? []), ...(dossier.helper?.languages ?? [])]).length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {uniqueIds([...(profile.languages ?? []), ...(dossier.helper?.languages ?? [])]).map((item) => (
                        <Chip key={`l-${item}`}>{item}</Chip>
                      ))}
                    </div>
                  ) : null}
                </section>
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
              <PostsRubric feedPosts={feedPosts} boardPosts={boardPosts} />
            ) : null}

            {rubric === "message" ? (
                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-6">
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
    tiles.push({ id: "avatar", label: "Profile photo", kind: "image", src: photoUrl, target: { kind: "avatar" } });
  }
  for (const item of gallery) {
    tiles.push({
      id: item.id,
      label: "Gallery",
      kind: item.media_type,
      src: item.media_type === "video"
        ? publicProfileMediaPublicUrl(item.storage_path)
        : publicProfileMediaUrl(item.storage_path, { width: 720, quality: 80 }),
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
        : publicProfileMediaUrl(item.storage_path, { width: 720, quality: 80 }),
      target: { kind: "post", postId: item.postId, storagePath: item.storage_path },
    });
  }
  for (const item of boardImages) {
    tiles.push({
      id: item.id,
      label: "From a post",
      kind: "image",
      src: item.url,
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
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-6">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Media</h2>
      {tiles.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No photos or videos on this profile.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <figure key={tile.id} className="relative overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              {tile.kind === "video" ? (
                <video src={tile.src} controls className="aspect-square w-full object-cover" />
              ) : (
                <img src={tile.src} alt="" className="aspect-square w-full object-cover" />
              )}
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

function postTypeLabel(post: MemberPost) {
  const type = Array.isArray(post.post_types) ? post.post_types[0] : post.post_types;
  return type?.name || post.custom_category || "Post";
}

function PostsRubric({ feedPosts, boardPosts }: { feedPosts: MemberPost[]; boardPosts: CommunityPost[] }) {
  const empty = feedPosts.length === 0 && boardPosts.length === 0;
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-6">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Posts</h2>
      {empty ? (
        <p className="mt-4 text-sm text-zinc-500">This member has not posted yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {feedPosts.map((post) => {
            const media = getProfilePostMediaItems(post)[0];
            const thumb = media
              ? media.media_type === "video"
                ? publicProfileMediaPublicUrl(media.storage_path)
                : publicProfileMediaUrl(media.storage_path, { width: 720, quality: 80 })
              : null;
            return (
              <li key={post.id}>
                <Link
                  to={`/posts/${post.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl ring-1 ring-zinc-100 transition hover:bg-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-800/60"
                >
                  {thumb && media?.media_type === "video" ? (
                    <video src={thumb} className="aspect-[4/3] w-full bg-zinc-100 object-cover" />
                  ) : thumb ? (
                    <img src={thumb} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                      <FileText className="h-8 w-8" />
                    </span>
                  )}
                  <span className="min-w-0 p-3">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      {postTypeLabel(post)} · {format(new Date(post.created_at), "d MMM yyyy")}
                    </span>
                    <span className="mt-1 line-clamp-3 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {post.caption?.trim() || "No caption"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {boardPosts.map((post) => {
            const image = post.images?.[0]?.image_url;
            return (
              <li key={post.id} className="flex h-full flex-col overflow-hidden rounded-2xl ring-1 ring-zinc-100 dark:ring-zinc-800">
                {image ? (
                  <img src={image} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <span className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                    <FileText className="h-8 w-8" />
                  </span>
                )}
                <span className="min-w-0 p-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    {post.category || "Availability"} · {post.status || "active"} · {format(new Date(post.created_at), "d MMM yyyy")}
                  </span>
                  <span className="mt-1 line-clamp-3 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {post.title?.trim() || post.body?.trim() || "Untitled"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
    return <p className="mt-3 text-sm font-semibold text-zinc-400">None chosen</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ids.map((id) => (
        <Chip key={id}>{serviceCategoryLabel(id)}</Chip>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl bg-white px-4 py-4 text-left shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800",
        onClick && "transition hover:ring-zinc-400",
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-black capitalize tracking-tight text-zinc-950 dark:text-zinc-50">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </Tag>
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
