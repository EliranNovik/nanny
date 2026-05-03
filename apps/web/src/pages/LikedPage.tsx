import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import {
  BadgeCheck,
  CheckCircle2,
  Hourglass,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  ExternalLink,
  Trash2,
  UserRound,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { INTERACTIVE_CARD_HOVER } from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useMobileShellScrollCollapse } from "@/hooks/useMobileShellScrollCollapse";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { StarRating } from "@/components/StarRating";
import { type AvailabilityPayload } from "@/lib/availabilityPosts";

type ProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  role: string | null;
  is_verified?: boolean | null;
  average_rating?: number | null;
  total_ratings?: number | null;
  whatsapp_number?: string | null;
  telegram_username?: string | null;
};

type PostRow = {
  id: string;
  author_id: string;
  category: string;
  title: string;
  body: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  status: string;
  availability_payload: AvailabilityPayload | null;
};

type PostWithExtras = PostRow & {
  author?: ProfileRow | null;
  coverImage: string | null;
};

type LikedProfilePost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  created_at: string;
  author?: ProfileRow | null;
};

/** Same grey card shell as public profile history rows. */
const profileCardShellClass = cn(
  "group overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-sm dark:border-white/5 dark:bg-zinc-900",
  INTERACTIVE_CARD_HOVER,
);

/** Newest interest per post for this user (from `community_post_hire_interests`, ordered by created_at desc). */
type HireInterestState =
  | { status: "pending" }
  | { status: "confirmed"; job_request_id: string }
  | { status: "declined" };

function mapProfileRowFromDb(p: Record<string, unknown>): ProfileRow {
  return {
    id: p.id as string,
    full_name: (p.full_name as string | null) ?? null,
    photo_url: (p.photo_url as string | null) ?? null,
    role: (p.role as string | null) ?? null,
    is_verified: (p.is_verified as boolean | null) ?? undefined,
    average_rating: (p.average_rating as number | null) ?? null,
    total_ratings: (p.total_ratings as number | null) ?? null,
    whatsapp_number: (p.whatsapp_number_e164 as string | null) ?? null,
    telegram_username: (p.telegram_username as string | null) ?? null,
  };
}

export default function LikedPage() {
  useMobileShellScrollCollapse(true);
  return <SavedContent dataLikedPage />;
}

export function SavedContent({ dataLikedPage }: { dataLikedPage?: boolean }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [posts, setPosts] = useState<PostWithExtras[]>([]);
  const [likedProfilePosts, setLikedProfilePosts] = useState<LikedProfilePost[]>([]);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [openingChatProfileId, setOpeningChatProfileId] = useState<
    string | null
  >(null);
  /** Tapping the card (outside links/buttons) reveals "Remove from saved". */
  const [profileCardMenuId, setProfileCardMenuId] = useState<string | null>(
    null,
  );
  const [hireInterestByPostId, setHireInterestByPostId] = useState<
    Record<string, HireInterestState>
  >({});
  const [conversationIdByJobId, setConversationIdByJobId] = useState<
    Record<string, string>
  >({});
  const [savedTab, setSavedTab] = useState<"posts" | "profiles">(
    dataLikedPage ? "posts" : "profiles",
  );

  function formatSupabaseError(e: unknown): string {
    if (!e) return "Unknown error";
    if (e instanceof Error) return e.message;
    if (typeof e === "object") {
      const anyE = e as any;
      const msg = anyE?.message ? String(anyE.message) : undefined;
      const code = anyE?.code ? String(anyE.code) : undefined;
      const details = anyE?.details ? String(anyE.details) : undefined;
      const hint = anyE?.hint ? String(anyE.hint) : undefined;
      return [msg, code && `code=${code}`, details && `details=${details}`, hint && `hint=${hint}`]
        .filter(Boolean)
        .join(" | ");
    }
    return String(e);
  }

  async function withTimeout<T>(p: PromiseLike<T>, label: string, ms = 3000): Promise<T> {
    let t: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(`[LikedPage] TIMEOUT after ${ms}ms: ${label}`)), ms);
    });
    try {
      // Supabase builders are PromiseLike (thenable), not real Promises.
      return await Promise.race([Promise.resolve(p), timeout]);
    } finally {
      if (t) clearTimeout(t);
    }
  }

  const load = useCallback(async () => {
    if (!user?.id) {
      setProfiles([]);
      setPosts([]);
      setLikedProfilePosts([]);
      setHireInterestByPostId({});
      setConversationIdByJobId({});
      setLoading(false);
      setLoadError(null);
      setProfilesError(null);
      setPostsError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setProfilesError(null);
    setPostsError(null);
    try {
      console.log("[LikedPage] load start", { dataLikedPage: Boolean(dataLikedPage), userId: user.id });
      const runProfiles = async () => {
        setLoadingProfiles(true);
        setProfilesError(null);
        try {
          const profFavRes = await withTimeout(
            supabase
              .from("profile_favorites")
              .select("favorite_user_id, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
            "profile_favorites select",
            8000,
          );
          if (profFavRes.error) throw profFavRes.error;
          const favUserIds = (profFavRes.data ?? []).map((r: any) => r.favorite_user_id as string);
          if (favUserIds.length === 0) {
            setProfiles([]);
            return;
          }
          const { data: profs, error: pe } = await withTimeout(
            supabase
              .from("profiles")
              .select(
                "id, full_name, photo_url, role, average_rating, total_ratings, whatsapp_number_e164, telegram_username",
              )
              .in("id", favUserIds),
            "profiles select (favorites)",
            8000,
          );
          if (pe) throw pe;
          const byId = new Map(
            (profs ?? []).map((p) => [
              (p as any).id as string,
              mapProfileRowFromDb(p as Record<string, unknown>),
            ]),
          );
          const ordered: ProfileRow[] = [];
          for (const id of favUserIds) {
            const p = byId.get(id);
            if (p) ordered.push(p);
          }
          setProfiles(ordered);
        } catch (e) {
          console.error("[LikedPage] profiles load", e);
          setProfiles([]);
          setProfilesError(formatSupabaseError(e));
        } finally {
          setLoadingProfiles(false);
        }
      };

      const runPosts = async () => {
        setLoadingPosts(true);
        setPostsError(null);
        try {
          if (dataLikedPage) {
            const postFavRes = await withTimeout(
              supabase
                .from("profile_post_likes")
                .select("post_id, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false }),
              "profile_post_likes select (by user_id)",
              8000,
            );
            if (postFavRes.error) throw postFavRes.error;
            const favPostIds = (postFavRes.data ?? []).map((r: any) => r.post_id as string);
            console.log("[LikedPage] liked post ids", favPostIds.length);
            if (favPostIds.length === 0) {
              setLikedProfilePosts([]);
              setPosts([]);
              return;
            }

            const { data: postRows, error: postErr } = await withTimeout(
              supabase
                .from("profile_posts")
                .select("id, author_id, caption, media_type, storage_path, created_at")
                .in("id", favPostIds),
              "profile_posts select (by id in favPostIds)",
              8000,
            );
            if (postErr) throw postErr;

            const list = (postRows ?? []) as LikedProfilePost[];
            console.log("[LikedPage] liked profile_posts loaded", list.length);
            const order = new Map(favPostIds.map((id: string, i: number) => [id, i]));
            list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

            const authorIds = [...new Set(list.map((p) => p.author_id))];
            if (authorIds.length > 0) {
              const { data: ad, error: ae } = await withTimeout(
                supabase
                  .from("profiles")
                  .select("id, full_name, photo_url, city, role, is_verified")
                  .in("id", authorIds),
                "profiles select (liked posts authors)",
                8000,
              );
              if (ae) throw ae;
              const authorMap = new Map(((ad ?? []) as ProfileRow[]).map((a) => [a.id, a]));
              setLikedProfilePosts(
                list.map((p) => ({ ...p, author: authorMap.get(p.author_id) ?? null })),
              );
            } else {
              setLikedProfilePosts(list.map((p) => ({ ...p, author: null })));
            }

            setPosts([]);
            setHireInterestByPostId({});
            setConversationIdByJobId({});
            return;
          }

          // Old saved community posts mode (kept for /liked route).
          const postFavRes = await withTimeout(
            supabase
              .from("community_post_favorites")
              .select("post_id, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
            "community_post_favorites select (by user_id)",
            8000,
          );
          if (postFavRes.error) throw postFavRes.error;
          const favPostIds = (postFavRes.data ?? []).map((r: any) => r.post_id as string);
          if (favPostIds.length === 0) {
            setPosts([]);
            setLikedProfilePosts([]);
            setHireInterestByPostId({});
            setConversationIdByJobId({});
            return;
          }

          const { data: postRows, error: postErr } = await supabase
            .from("community_posts")
            .select(
              "id, author_id, category, title, body, note, created_at, expires_at, status, availability_payload",
            )
            .in("id", favPostIds);
          if (postErr) throw postErr;

          const list = (postRows ?? []) as PostRow[];
          const order = new Map(favPostIds.map((id, i) => [id, i]));
          list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

          const authorIds = [...new Set(list.map((p) => p.author_id))];
          const postIds = list.map((p) => p.id);

          let authorsData: ProfileRow[] = [];
          if (authorIds.length > 0) {
            const { data: ad, error: ae } = await supabase
              .from("profiles")
              .select("id, full_name, photo_url, city, role, is_verified")
              .in("id", authorIds);
            if (ae) throw ae;
            authorsData = (ad ?? []) as ProfileRow[];
          }

          let imageRows: { post_id: string; image_url: string }[] = [];
          if (postIds.length > 0) {
            const { data: idata, error: ie } = await supabase
              .from("community_post_images")
              .select("post_id, image_url, sort_order")
              .in("post_id", postIds)
              .order("sort_order", { ascending: true });
            if (ie) throw ie;
            imageRows = (idata ?? []) as { post_id: string; image_url: string }[];
          }

          const authorMap = new Map(authorsData.map((a) => [a.id, a]));
          const firstImage = new Map<string, string>();
          for (const row of imageRows) {
            if (!firstImage.has(row.post_id)) firstImage.set(row.post_id, row.image_url);
          }

          setPosts(
            list.map((p) => ({
              ...p,
              availability_payload: (p.availability_payload as AvailabilityPayload) ?? null,
              author: authorMap.get(p.author_id) ?? null,
              coverImage: firstImage.get(p.id) ?? null,
            })),
          );
          setLikedProfilePosts([]);
        } catch (e) {
          console.error("[LikedPage] posts load", e);
          setPosts([]);
          setLikedProfilePosts([]);
          setHireInterestByPostId({});
          setConversationIdByJobId({});
          setPostsError(formatSupabaseError(e));
        } finally {
          setLoadingPosts(false);
        }
      };

      await Promise.all([runProfiles(), runPosts()]);
    } catch (e) {
      console.error("[LikedPage]", e);
      setLoadError(formatSupabaseError(e));
      addToast({
        title: "Could not load saved items",
        description: formatSupabaseError(e),
        variant: "error",
      });
      setProfiles([]);
      setPosts([]);
      setLikedProfilePosts([]);
      setHireInterestByPostId({});
      setConversationIdByJobId({});
    } finally {
      setLoading(false);
      console.log("[LikedPage] load end");
    }
  }, [user?.id, addToast, dataLikedPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const effectivePostCount = dataLikedPage ? likedProfilePosts.length : posts.length;

  /** After load: if the user only has saved posts (no profiles), show Posts so the list is not hidden. */
  useEffect(() => {
    if (loading) return;
    if (profiles.length === 0 && effectivePostCount > 0) {
      setSavedTab("posts");
    }
  }, [loading, profiles.length, effectivePostCount, dataLikedPage]);

  const removeProfileFavorite = async (favoriteUserId: string) => {
    if (!user?.id) return;
    setBusyProfileId(favoriteUserId);
    try {
      const { error } = await supabase
        .from("profile_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("favorite_user_id", favoriteUserId);
      if (error) throw error;
      setProfiles((prev) => prev.filter((p) => p.id !== favoriteUserId));
      setProfileCardMenuId((id) => (id === favoriteUserId ? null : id));
      addToast({ title: "Removed from saved profiles", variant: "success" });
    } catch (e) {
      addToast({
        title: "Could not remove",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyProfileId(null);
    }
  };

  const removePostFavorite = async (postId: string) => {
    if (!user?.id) return;
    setBusyPostId(postId);
    try {
      const { error } = dataLikedPage
        ? await supabase
          .from("profile_post_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId)
        : await supabase
          .from("community_post_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId);
      if (error) throw error;
      if (dataLikedPage) {
        setLikedProfilePosts((prev) => prev.filter((p) => p.id !== postId));
        addToast({ title: "Removed from liked posts", variant: "success" });
      } else {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        addToast({ title: "Removed from saved posts", variant: "success" });
      }
    } catch (e) {
      addToast({
        title: "Could not remove",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyPostId(null);
    }
  };

  const openDirectChatWithProfile = async (p: ProfileRow) => {
    if (!user?.id || !profile?.role) {
      addToast({
        title: "Please wait",
        description:
          "Sign in and wait for your profile to load, then try again.",
        variant: "default",
      });
      return;
    }
    if (p.id === user.id) return;

    const myRole = profile.role;
    const theirRole = p.role;

    if (myRole !== "client" && myRole !== "freelancer") {
      addToast({
        title: "Messaging unavailable",
        description: "Your account cannot start a chat from here.",
        variant: "error",
      });
      return;
    }
    if (!theirRole || (theirRole !== "client" && theirRole !== "freelancer")) {
      addToast({
        title: "Messaging unavailable",
        description: "You can only message clients or helpers.",
        variant: "error",
      });
      return;
    }
    if (myRole === theirRole) {
      addToast({
        title: "Messaging unavailable",
        description:
          "You can only message someone in the opposite role (client ↔ helper).",
        variant: "default",
      });
      return;
    }

    const clientId = myRole === "client" ? user.id : p.id;
    const freelancerId = myRole === "freelancer" ? user.id : p.id;

    setOpeningChatProfileId(p.id);
    try {
      const { data: existing, error: findErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", clientId)
        .eq("freelancer_id", freelancerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;

      if (existing?.id) {
        navigate(`/messages?conversation=${existing.id}`);
        return;
      }

      const { data: created, error: insErr } = await supabase
        .from("conversations")
        .insert({
          job_id: null,
          client_id: clientId,
          freelancer_id: freelancerId,
        })
        .select("id")
        .single();

      if (insErr) throw insErr;

      navigate(`/messages?conversation=${created.id}`);
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Please try again.";
      addToast({
        title: "Could not open chat",
        description: msg,
        variant: "error",
      });
    } finally {
      setOpeningChatProfileId(null);
    }
  };

  const emptyHint = (
    <p className="text-center text-sm text-muted-foreground">
      Tap the heart on{" "}
      <Link
        to={profile?.role === "freelancer" ? "/jobs" : "/client/helpers"}
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        {profile?.role === "freelancer" ? "Jobs" : "Find helpers"}
      </Link>{" "}
      or{" "}
      <Link
        to="/public/posts"
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        community offers
      </Link>{" "}
      to save things here.
    </p>
  );

  /** On the in-app Saved page (client/freelancer), tabs should scroll away (not fixed). */
  const showSavedTabs = !dataLikedPage && (loading || profiles.length > 0 || effectivePostCount > 0);

  return (
    <div
      className="relative min-h-screen bg-background pb-6 md:pb-8"
      data-liked-page={dataLikedPage ? "" : undefined}
    >
      {showSavedTabs && (
        <div
          className={cn(
            "fixed inset-x-0 z-[45] pointer-events-none",
            /** Mobile: move away together with the collapsing shell header. */
            "max-md:top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
            "max-md:translate-y-[calc(var(--mobile-shell-collapse-progress,0)*-5rem)] max-md:will-change-transform",
            "md:top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
            "border-b border-border/30 bg-background/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md",
            "supports-[backdrop-filter]:bg-background/85 dark:border-border/40 dark:bg-background/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]",
          )}
        >
          <div className="app-desktop-shell pointer-events-auto">
            <div className="mx-auto flex max-w-2xl justify-center px-2 py-2 md:px-0">
              <div
                role="tablist"
                aria-label="Saved content type"
                className="flex w-full justify-center"
              >
                <div
                  className={cn(
                    "relative mx-auto grid min-h-[56px] w-full max-w-[22rem] grid-cols-2 gap-1 overflow-hidden rounded-full p-1.5 sm:max-w-[24rem] sm:min-h-[64px]",
                    "bg-slate-100/80 border border-slate-200/60 shadow-inner",
                    "dark:bg-zinc-900/50 dark:border-zinc-800/60 leading-none",
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 z-[5] rounded-[9999px]",
                      "w-[calc((100%-1rem)/2)] will-change-transform",
                      "bg-white shadow-sm ring-1 ring-slate-900/5",
                      "dark:bg-zinc-800 dark:ring-white/10 dark:shadow-none",
                      "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                      savedTab === "posts"
                        ? "translate-x-0"
                        : "translate-x-[calc(100%+0.25rem)]",
                    )}
                  />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={savedTab === "posts"}
                    aria-label={
                      savedTab === "posts"
                        ? undefined
                        : loading
                          ? "Posts"
                          : dataLikedPage
                            ? `Posts, ${likedProfilePosts.length} liked`
                            : `Posts, ${posts.length} saved`
                    }
                    onClick={() => setSavedTab("posts")}
                    className={cn(
                      "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-2 py-2.5 sm:min-h-[62px] sm:px-3",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      savedTab === "posts"
                        ? "gap-2.5 text-slate-900 dark:text-white sm:gap-3"
                        : "gap-2.5 text-slate-500 hover:text-slate-700 sm:gap-3 dark:text-zinc-400 dark:hover:text-zinc-200",
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                        savedTab === "posts"
                          ? "text-rose-500 dark:text-rose-500"
                          : "text-slate-400 dark:text-zinc-500",
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {savedTab === "posts" && (
                      <>
                        <span className="max-w-[min(100%,7rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                          Posts
                        </span>
                        <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                          ({loading ? "…" : dataLikedPage ? likedProfilePosts.length : posts.length})
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={savedTab === "profiles"}
                    aria-label={
                      savedTab === "profiles"
                        ? undefined
                        : loading
                          ? "Profiles"
                          : `Profiles, ${profiles.length} saved`
                    }
                    onClick={() => setSavedTab("profiles")}
                    className={cn(
                      "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-2 py-2.5 sm:min-h-[62px] sm:px-3",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      savedTab === "profiles"
                        ? "gap-2.5 text-slate-900 dark:text-white sm:gap-3"
                        : "gap-2.5 text-slate-500 hover:text-slate-700 sm:gap-3 dark:text-zinc-400 dark:hover:text-zinc-200",
                    )}
                  >
                    <UserRound
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                        savedTab === "profiles"
                          ? "text-rose-500 dark:text-rose-500"
                          : "text-slate-400 dark:text-zinc-500",
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {savedTab === "profiles" && (
                      <>
                        <span className="max-w-[min(100%,7rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                          Profiles
                        </span>
                        <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                          ({loading ? "…" : profiles.length})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={cn("app-desktop-shell px-1", showSavedTabs ? "pt-0" : "pt-4 md:pt-6")}>
        <h1 className="sr-only">Saved</h1>
        <div
          className={cn(
            "mx-auto max-w-2xl px-2 md:px-0",
            !showSavedTabs && "mt-6",
          )}
        >
          {dataLikedPage && (loading || profiles.length > 0 || effectivePostCount > 0) ? (
            <div className="mx-auto flex max-w-2xl justify-center px-2 py-2 md:px-0">
              <div
                role="tablist"
                aria-label="Saved content type"
                className="flex w-full justify-center"
              >
                <div
                  className={cn(
                    "relative mx-auto grid min-h-[56px] w-full max-w-[22rem] grid-cols-2 gap-1 overflow-hidden rounded-full p-1.5 sm:max-w-[24rem] sm:min-h-[64px]",
                    "bg-slate-100/80 border border-slate-200/60 shadow-inner",
                    "dark:bg-zinc-900/50 dark:border-zinc-800/60 leading-none",
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 z-[5] rounded-[9999px]",
                      "w-[calc((100%-1rem)/2)] will-change-transform",
                      "bg-white shadow-sm ring-1 ring-slate-900/5",
                      "dark:bg-zinc-800 dark:ring-white/10 dark:shadow-none",
                      "transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                      savedTab === "posts"
                        ? "translate-x-0"
                        : "translate-x-[calc(100%+0.25rem)]",
                    )}
                  />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={savedTab === "posts"}
                    onClick={() => setSavedTab("posts")}
                    className={cn(
                      "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-2 py-2.5 sm:min-h-[62px] sm:px-3",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      savedTab === "posts"
                        ? "gap-2.5 text-slate-900 dark:text-white sm:gap-3"
                        : "gap-2.5 text-slate-500 hover:text-slate-700 sm:gap-3 dark:text-zinc-400 dark:hover:text-zinc-200",
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                        savedTab === "posts"
                          ? "text-rose-500 dark:text-rose-500"
                          : "text-slate-400 dark:text-zinc-500",
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {savedTab === "posts" && (
                      <>
                        <span className="max-w-[min(100%,7rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                          Posts
                        </span>
                        <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                          ({loading ? "…" : likedProfilePosts.length})
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={savedTab === "profiles"}
                    onClick={() => setSavedTab("profiles")}
                    className={cn(
                      "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-2 py-2.5 sm:min-h-[62px] sm:px-3",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      savedTab === "profiles"
                        ? "gap-2.5 text-slate-900 dark:text-white sm:gap-3"
                        : "gap-2.5 text-slate-500 hover:text-slate-700 sm:gap-3 dark:text-zinc-400 dark:hover:text-zinc-200",
                    )}
                  >
                    <UserRound
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors duration-300 sm:h-6 sm:w-6",
                        savedTab === "profiles"
                          ? "text-rose-500 dark:text-rose-500"
                          : "text-slate-400 dark:text-zinc-500",
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {savedTab === "profiles" && (
                      <>
                        <span className="max-w-[min(100%,7rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-[15px]">
                          Profiles
                        </span>
                        <span className="shrink-0 tabular-nums text-xs font-bold text-slate-500/80 dark:text-zinc-400/80 sm:text-sm">
                          ({loading ? "…" : profiles.length})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {loadError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {loadError}
            </div>
          ) : null}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            </div>
          ) : profiles.length === 0 && effectivePostCount === 0 ? (
            <Card className="rounded-2xl border border-dashed border-black/15 bg-transparent dark:border-white/15">
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <Sparkles className="h-10 w-10 text-rose-400/80" />
                <p className="text-base font-semibold text-foreground">
                  Nothing saved yet
                </p>
                {emptyHint}
              </CardContent>
            </Card>
          ) : (
            <Tabs
              value={savedTab}
              onValueChange={(v) => setSavedTab(v as "posts" | "profiles")}
              className="w-full"
            >
              <TabsContent value="posts" className="mt-0 outline-none">
                {postsError ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {postsError}
                  </div>
                ) : null}
                {loadingPosts ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : dataLikedPage ? (
                  <ProfilePostsFeed filterLikedByUserId={user?.id ?? undefined} />
                ) : posts.length === 0 ? (
                  <Card className="rounded-2xl border border-dashed border-border/60 bg-transparent">
                    <CardContent className="py-12 text-center">
                      <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-semibold text-foreground">
                        No saved posts
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Heart a community offer on the public board to see it
                        here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {posts.map((post) => {
                      const hire = hireInterestByPostId[post.id];
                      const expired =
                        post.expires_at &&
                        !Number.isNaN(Date.parse(post.expires_at))
                          ? Date.parse(post.expires_at) <= Date.now()
                          : false;
                      const blurb =
                        (post.note && post.note.trim()) ||
                        (post.body && post.body.trim()) ||
                        "";
                      const chatId =
                        hire?.status === "confirmed"
                          ? conversationIdByJobId[hire.job_request_id]
                          : undefined;
                      return (
                        <li key={post.id}>
                          <Card
                            className={cn(
                              profileCardShellClass,
                              "border border-transparent hover:border-border/40",
                            )}
                          >
                            <CardContent className="p-3 md:p-4">
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7 border border-border/60">
                                          <AvatarImage
                                            src={
                                              post.author?.photo_url ??
                                              undefined
                                            }
                                          />
                                          <AvatarFallback className="bg-rose-500/15 text-[10px] font-black text-rose-700">
                                            {(post.author?.full_name || "?")
                                              .charAt(0)
                                              .toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <p className="flex min-w-0 items-center gap-0.5 truncate text-xs font-bold text-foreground">
                                          <span className="truncate">
                                            {post.author?.full_name || "Member"}
                                          </span>
                                          {post.author?.is_verified && (
                                            <BadgeCheck
                                              className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-white dark:fill-sky-400"
                                              aria-label="Verified"
                                            />
                                          )}
                                        </p>
                                        {expired && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] font-bold text-amber-800 dark:text-amber-300"
                                          >
                                            Expired
                                          </Badge>
                                        )}
                                      </div>
                                      <h2 className="mt-1 truncate text-[15px] font-black leading-snug text-foreground">
                                        {post.title}
                                      </h2>
                                    </div>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                      disabled={busyPostId === post.id}
                                      aria-label="Remove from saved"
                                      onClick={() =>
                                        void removePostFavorite(post.id)
                                      }
                                    >
                                      {busyPostId === post.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>

                                  {blurb && (
                                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                      {blurb}
                                    </p>
                                  )}
                                  {post.coverImage && (
                                    <div className="mt-2">
                                      <div className="w-full max-w-[160px] overflow-hidden rounded-xl border border-black/10 bg-transparent dark:border-white/10">
                                        <img
                                          src={post.coverImage}
                                          alt=""
                                          className="aspect-[4/3] w-full object-cover"
                                          loading="lazy"
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {post.expires_at && (
                                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                                      <ExpiryCountdown
                                        expiresAtIso={post.expires_at}
                                        className="text-[11px] text-muted-foreground"
                                      />
                                    </p>
                                  )}

                                  <div className="mt-3 space-y-2">
                                    {hire?.status === "pending" && (
                                      <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                                        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                                        <p className="text-[12px] font-semibold leading-snug text-amber-950 dark:text-amber-100">
                                          Waiting for confirmation — the helper
                                          hasn’t accepted your hire request yet.
                                        </p>
                                      </div>
                                    )}
                                    {hire?.status === "confirmed" && (
                                      <div className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                                        <p className="text-[12px] font-semibold leading-snug text-emerald-950 dark:text-emerald-100">
                                          Helper confirmed — your booking is
                                          live. You can chat and manage it from
                                          Jobs.
                                        </p>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                      {hire?.status === "confirmed" &&
                                        chatId && (
                                          <Button
                                            size="sm"
                                            className="gap-1.5 rounded-full"
                                            asChild
                                          >
                                            <Link to={`/chat/${chatId}`}>
                                              <MessageSquare className="h-3.5 w-3.5" />
                                              Open chat
                                            </Link>
                                          </Button>
                                        )}
                                      {hire?.status === "confirmed" &&
                                        profile?.role === "client" && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full"
                                            asChild
                                          >
                                            <Link to="/client/jobs">
                                              View jobs
                                            </Link>
                                          </Button>
                                        )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        asChild
                                      >
                                        <Link
                                          to={`/public/posts?post=${post.id}`}
                                        >
                                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                          {hire?.status === "pending"
                                            ? "View post"
                                            : hire?.status === "confirmed"
                                              ? "View on board"
                                              : "Live now"}
                                        </Link>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="profiles" className="mt-0 outline-none">
                {profilesError ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {profilesError}
                  </div>
                ) : null}
                {loadingProfiles ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : profiles.length === 0 ? (
                  <Card className="rounded-2xl border border-dashed border-border/60 bg-transparent">
                    <CardContent className="py-12 text-center">
                      <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-semibold text-foreground">
                        No saved profiles
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Save helpers from Find helpers or their public profile.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {profiles.map((p) => (
                      <li key={p.id}>
                        <Card className={cn(profileCardShellClass, "relative")}>
                          <CardContent
                            className="cursor-default p-4 md:p-5"
                            onClick={(e) => {
                              const t = e.target as HTMLElement;
                              if (
                                t.closest(
                                  "a, button, [data-skip-profile-card-toggle]",
                                )
                              ) {
                                return;
                              }
                              setProfileCardMenuId((prev) =>
                                prev === p.id ? null : p.id,
                              );
                            }}
                          >
                            <div className="relative">
                              <div className="flex gap-4">
                                <Link
                                  to={`/profile/${p.id}`}
                                  className="relative z-10 shrink-0 self-start rounded-full overflow-hidden"
                                >
                                  {p.photo_url ? (
                                    <img
                                      src={p.photo_url}
                                      alt=""
                                      className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-muted to-primary/10 text-base font-black text-primary/70 md:h-24 md:w-24 md:text-lg">
                                      {(p.full_name || "?")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                </Link>
                                <div className="min-w-0 flex-1 pt-0.5">
                                  <Link
                                    to={`/profile/${p.id}`}
                                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 rounded-sm"
                                  >
                                    <h2 className="truncate text-[15px] font-black leading-snug text-slate-900 dark:text-white md:text-[18px] md:leading-snug">
                                      {p.full_name || "Member"}
                                    </h2>
                                  </Link>
                                  <div
                                    className="mt-1.5 flex items-center justify-between gap-2"
                                    data-skip-profile-card-toggle
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <StarRating
                                        rating={Number(p.average_rating) || 0}
                                        totalRatings={p.total_ratings ?? 0}
                                        size="sm"
                                        emptyStarClassName="text-muted-foreground/30"
                                        starClassName="text-amber-500 dark:text-amber-400"
                                        numberClassName="text-foreground md:text-sm"
                                        countClassName="text-muted-foreground md:text-sm"
                                      />
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                                      <button
                                        type="button"
                                        title="Messages"
                                        aria-label="Open messages"
                                        disabled={openingChatProfileId === p.id}
                                        onClick={() =>
                                          void openDirectChatWithProfile(p)
                                        }
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-muted/80 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:text-white md:h-11 md:w-11"
                                      >
                                        {openingChatProfileId === p.id ? (
                                          <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin text-black dark:text-white md:h-5 md:w-5" />
                                        ) : (
                                          <MessageSquare
                                            className="h-[1.125rem] w-[1.125rem] text-black dark:text-white md:h-5 md:w-5"
                                            strokeWidth={2}
                                          />
                                        )}
                                      </button>
                                      {p.whatsapp_number && (
                                        <button
                                          type="button"
                                          title="WhatsApp"
                                          aria-label="WhatsApp"
                                          onClick={() =>
                                            window.open(
                                              `https://wa.me/${p.whatsapp_number}`,
                                              "_blank",
                                            )
                                          }
                                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-muted/80 active:scale-95 dark:text-white md:h-11 md:w-11"
                                        >
                                          <WhatsAppIcon
                                            size={18}
                                            className="text-black dark:text-white md:hidden"
                                            aria-hidden
                                          />
                                          <WhatsAppIcon
                                            size={22}
                                            className="hidden text-black dark:text-white md:block"
                                            aria-hidden
                                          />
                                        </button>
                                      )}
                                      {p.telegram_username && (
                                        <button
                                          type="button"
                                          title="Telegram"
                                          aria-label="Telegram"
                                          onClick={() =>
                                            window.open(
                                              `https://t.me/${p.telegram_username}`,
                                              "_blank",
                                            )
                                          }
                                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-muted/80 active:scale-95 dark:text-white md:h-11 md:w-11"
                                        >
                                          <Send className="h-[1.125rem] w-[1.125rem] translate-x-[-0.5px] translate-y-[0.5px] text-black dark:text-white md:h-5 md:w-5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {profileCardMenuId === p.id && (
                              <div
                                className="mt-1 border-t border-border/50 pt-3"
                                data-skip-profile-card-toggle
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-9 w-full justify-center gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={busyProfileId === p.id}
                                  onClick={() =>
                                    void removeProfileFavorite(p.id)
                                  }
                                >
                                  {busyProfileId === p.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  Remove from saved
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
