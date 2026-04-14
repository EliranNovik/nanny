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
import { cn } from "@/lib/utils";
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

/** Same grey card shell as public profile history rows. */
const profileCardShellClass =
  "group border-none shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)] rounded-[24px] overflow-hidden bg-card/80 transition-all";

/** Newest interest per post for this user (from `community_post_hire_interests`, ordered by created_at desc). */
type HireInterestState =
  | { status: "pending" }
  | { status: "confirmed"; job_request_id: string }
  | { status: "declined" };

function mapProfileRowFromDb(
  p: Record<string, unknown>
): ProfileRow {
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
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [posts, setPosts] = useState<PostWithExtras[]>([]);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [openingChatProfileId, setOpeningChatProfileId] = useState<string | null>(null);
  /** Tapping the card (outside links/buttons) reveals "Remove from saved". */
  const [profileCardMenuId, setProfileCardMenuId] = useState<string | null>(null);
  const [hireInterestByPostId, setHireInterestByPostId] = useState<
    Record<string, HireInterestState>
  >({});
  const [conversationIdByJobId, setConversationIdByJobId] = useState<Record<string, string>>(
    {}
  );
  const [savedTab, setSavedTab] = useState<"posts" | "profiles">("profiles");

  const load = useCallback(async () => {
    if (!user?.id) {
      setProfiles([]);
      setPosts([]);
      setHireInterestByPostId({});
      setConversationIdByJobId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profFavRes, postFavRes] = await Promise.all([
        supabase
          .from("profile_favorites")
          .select("favorite_user_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("community_post_favorites")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (profFavRes.error) throw profFavRes.error;
      if (postFavRes.error) throw postFavRes.error;

      const favUserIds = (profFavRes.data ?? []).map(
        (r) => r.favorite_user_id as string
      );
      const favPostIds = (postFavRes.data ?? []).map((r) => r.post_id as string);

      if (favUserIds.length === 0) {
        setProfiles([]);
      } else {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select(
            "id, full_name, photo_url, role, average_rating, total_ratings, whatsapp_number_e164, telegram_username"
          )
          .in("id", favUserIds);
        if (pe) throw pe;
        const byId = new Map(
          (profs ?? []).map((p) => [
            p.id as string,
            mapProfileRowFromDb(p as Record<string, unknown>),
          ])
        );
        const ordered: ProfileRow[] = [];
        for (const id of favUserIds) {
          const p = byId.get(id);
          if (p) ordered.push(p);
        }
        setProfiles(ordered);
      }

      if (favPostIds.length === 0) {
        setPosts([]);
        setHireInterestByPostId({});
        setConversationIdByJobId({});
      } else {
        const { data: postRows, error: postErr } = await supabase
          .from("community_posts")
          .select(
            "id, author_id, category, title, body, note, created_at, expires_at, status, availability_payload"
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
          }))
        );

        const hireMap: Record<string, HireInterestState> = {};
        const { data: interestRows, error: interestErr } = await supabase
          .from("community_post_hire_interests")
          .select("community_post_id, status, job_request_id, created_at")
          .eq("client_id", user.id)
          .in("community_post_id", postIds)
          .order("created_at", { ascending: false });

        if (interestErr) {
          console.warn("[LikedPage] hire interests", interestErr);
        } else {
          for (const row of interestRows ?? []) {
            const pid = row.community_post_id as string;
            if (hireMap[pid]) continue;
            const st = row.status as string;
            if (st === "pending") hireMap[pid] = { status: "pending" };
            else if (st === "confirmed" && row.job_request_id) {
              hireMap[pid] = {
                status: "confirmed",
                job_request_id: row.job_request_id as string,
              };
            } else if (st === "declined") hireMap[pid] = { status: "declined" };
          }
        }
        setHireInterestByPostId(hireMap);

        const confirmedJobIds = Object.values(hireMap)
          .filter((h): h is Extract<HireInterestState, { status: "confirmed" }> => h.status === "confirmed")
          .map((h) => h.job_request_id);
        if (confirmedJobIds.length > 0) {
          const { data: convos, error: convErr } = await supabase
            .from("conversations")
            .select("id, job_id")
            .in("job_id", confirmedJobIds);
          if (convErr) {
            console.warn("[LikedPage] conversations", convErr);
            setConversationIdByJobId({});
          } else {
            const cMap: Record<string, string> = {};
            for (const c of convos ?? []) {
              if (c.job_id && c.id) cMap[c.job_id as string] = c.id as string;
            }
            setConversationIdByJobId(cMap);
          }
        } else {
          setConversationIdByJobId({});
        }
      }
    } catch (e) {
      console.error("[LikedPage]", e);
      addToast({
        title: "Could not load saved items",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
      setProfiles([]);
      setPosts([]);
      setHireInterestByPostId({});
      setConversationIdByJobId({});
    } finally {
      setLoading(false);
    }
  }, [user?.id, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** After load: if the user only has saved posts (no profiles), show Posts so the list is not hidden. */
  useEffect(() => {
    if (loading) return;
    if (profiles.length === 0 && posts.length > 0) {
      setSavedTab("posts");
    }
  }, [loading, profiles.length, posts.length]);

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
      const { error } = await supabase
        .from("community_post_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", postId);
      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      addToast({ title: "Removed from saved posts", variant: "success" });
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
        description: "Sign in and wait for your profile to load, then try again.",
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
        description: "You can only message someone in the opposite role (client ↔ helper).",
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
      <Link to="/public/posts" className="font-semibold text-primary underline-offset-4 hover:underline">
        community offers
      </Link>{" "}
      to save things here.
    </p>
  );

  /** Show pinned tabs while loading (immediate) or when there is anything saved; hide only after load if empty. */
  const showSavedTabs =
    loading || profiles.length > 0 || posts.length > 0;

  return (
    <div className="relative min-h-screen gradient-mesh pb-6 md:pb-8">
      {showSavedTabs && (
        <div
          className={cn(
            "fixed inset-x-0 z-[45] pointer-events-none",
            "top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
            "border-b border-border/30 bg-background/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md",
            "supports-[backdrop-filter]:bg-background/85 dark:border-border/40 dark:bg-background/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
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
                    "relative mx-auto grid min-h-[62px] w-full max-w-[22rem] grid-cols-2 gap-0.5 overflow-hidden rounded-full p-1 sm:max-w-[24rem] sm:min-h-[70px]",
                    "border border-white/20 shadow-2xl backdrop-blur-md",
                    "transition-shadow duration-300",
                    savedTab === "posts" ? "shadow-rose-900/30" : "shadow-rose-900/28"
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-r from-rose-500 to-red-600",
                      "transition-opacity duration-300 ease-out",
                      savedTab === "posts" ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-r from-rose-600 via-red-600 to-rose-900",
                      "transition-opacity duration-300 ease-out",
                      savedTab === "profiles" ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-1 bottom-1 left-1 z-[5] rounded-full",
                      "w-[calc((100%-0.625rem)/2)] will-change-transform",
                      "bg-white/20 shadow-inner backdrop-blur-sm ring-1 ring-white/35",
                      "transition-[transform] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                      savedTab === "posts"
                        ? "translate-x-0"
                        : "translate-x-[calc(100%+0.125rem)]"
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
                          : `Posts, ${posts.length} saved`
                    }
                    onClick={() => setSavedTab("posts")}
                    className={cn(
                      "relative z-10 flex h-full min-h-[54px] min-w-0 items-center justify-center rounded-full px-2 py-2.5 sm:min-h-[62px] sm:px-3",
                      "transition-[color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      savedTab === "posts"
                        ? "gap-1.5 text-white sm:gap-2"
                        : "gap-1.5 text-white/65 hover:text-white/85 sm:gap-2"
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-6 w-6 shrink-0 text-white transition-transform duration-300 sm:h-7 sm:w-7",
                        savedTab === "posts" && "scale-105 drop-shadow-sm"
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {savedTab === "posts" && (
                      <>
                        <span className="max-w-[min(100%,7rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-base">
                          Posts
                        </span>
                        <span className="shrink-0 tabular-nums text-xs font-black text-white/95 sm:text-sm">
                          ({loading ? "…" : posts.length})
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
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "active:scale-[0.98] motion-reduce:transition-none",
                      savedTab === "profiles"
                        ? "gap-1.5 text-white sm:gap-2"
                        : "gap-1.5 text-white/65 hover:text-white/85 sm:gap-2"
                    )}
                  >
                    <UserRound
                      className={cn(
                        "h-6 w-6 shrink-0 text-white transition-transform duration-300 sm:h-7 sm:w-7",
                        savedTab === "profiles" && "scale-105 drop-shadow-sm"
                      )}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    {savedTab === "profiles" && (
                      <>
                        <span className="max-w-[min(100%,7rem)] truncate text-sm font-bold leading-tight tracking-tight sm:text-base">
                          Profiles
                        </span>
                        <span className="shrink-0 tabular-nums text-xs font-black text-white/95 sm:text-sm">
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

      <div
        className={cn(
          "app-desktop-shell px-1",
          showSavedTabs
            ? "pt-[calc(0.5rem+4.5rem+0.5rem+1px+0.75rem)]"
            : "pt-4 md:pt-6"
        )}
      >
        <h1 className="sr-only">Saved</h1>
        <div
          className={cn(
            "mx-auto max-w-2xl px-2 md:px-0",
            !showSavedTabs && "mt-6"
          )}
        >
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            </div>
          ) : profiles.length === 0 && posts.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-black/15 bg-transparent dark:border-white/15">
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <Sparkles className="h-10 w-10 text-rose-400/80" />
                <p className="text-base font-semibold text-foreground">Nothing saved yet</p>
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
                {posts.length === 0 ? (
                  <Card className="rounded-2xl border border-dashed border-border/60 bg-transparent">
                    <CardContent className="py-12 text-center">
                      <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-semibold text-foreground">No saved posts</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Heart a community offer on the public board to see it here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {posts.map((post) => {
                      const hire = hireInterestByPostId[post.id];
                      const expired =
                        post.expires_at && !Number.isNaN(Date.parse(post.expires_at))
                          ? Date.parse(post.expires_at) <= Date.now()
                          : false;
                      const blurb =
                        (post.note && post.note.trim()) || (post.body && post.body.trim()) || "";
                      const chatId =
                        hire?.status === "confirmed"
                          ? conversationIdByJobId[hire.job_request_id]
                          : undefined;
                      return (
                        <li key={post.id}>
                          <Card
                            className={cn(
                              profileCardShellClass,
                              "border border-transparent hover:border-border/40"
                            )}
                          >
                            <CardContent className="p-3 md:p-4">
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7 border border-border/60">
                                          <AvatarImage src={post.author?.photo_url ?? undefined} />
                                          <AvatarFallback className="bg-rose-500/15 text-[10px] font-black text-rose-700">
                                            {(post.author?.full_name || "?").charAt(0).toUpperCase()}
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
                                      onClick={() => void removePostFavorite(post.id)}
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
                                          Waiting for confirmation — the helper hasn’t accepted your hire
                                          request yet.
                                        </p>
                                      </div>
                                    )}
                                    {hire?.status === "confirmed" && (
                                      <div className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                                        <p className="text-[12px] font-semibold leading-snug text-emerald-950 dark:text-emerald-100">
                                          Helper confirmed — your booking is live. You can chat and manage
                                          it from Jobs.
                                        </p>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                      {hire?.status === "confirmed" && chatId && (
                                        <Button size="sm" className="gap-1.5 rounded-full" asChild>
                                          <Link to={`/chat/${chatId}`}>
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            Open chat
                                          </Link>
                                        </Button>
                                      )}
                                      {hire?.status === "confirmed" && profile?.role === "client" && (
                                        <Button variant="outline" size="sm" className="rounded-full" asChild>
                                          <Link to="/client/jobs">View jobs</Link>
                                        </Button>
                                      )}
                                      <Button variant="outline" size="sm" className="rounded-full" asChild>
                                        <Link to={`/public/posts?post=${post.id}`}>
                                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                          {hire?.status === "pending"
                                            ? "View post"
                                            : hire?.status === "confirmed"
                                              ? "View on board"
                                              : "Available now"}
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
                {profiles.length === 0 ? (
                  <Card className="rounded-2xl border border-dashed border-border/60 bg-transparent">
                    <CardContent className="py-12 text-center">
                      <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-semibold text-foreground">No saved profiles</p>
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
                                t.closest("a, button, [data-skip-profile-card-toggle]")
                              ) {
                                return;
                              }
                              setProfileCardMenuId((prev) =>
                                prev === p.id ? null : p.id
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
                                    {(p.full_name || "?").slice(0, 2).toUpperCase()}
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
                                      onClick={() => void openDirectChatWithProfile(p)}
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-muted/80 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:text-white md:h-11 md:w-11"
                                    >
                                      {openingChatProfileId === p.id ? (
                                        <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin text-black dark:text-white md:h-5 md:w-5" />
                                      ) : (
                                        <MessageSquare className="h-[1.125rem] w-[1.125rem] text-black dark:text-white md:h-5 md:w-5" strokeWidth={2} />
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
                                            "_blank"
                                          )
                                        }
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-muted/80 active:scale-95 dark:text-white md:h-11 md:w-11"
                                      >
                                        <WhatsAppIcon size={18} className="text-black dark:text-white md:hidden" aria-hidden />
                                        <WhatsAppIcon size={22} className="hidden text-black dark:text-white md:block" aria-hidden />
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
                                            "_blank"
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
                                  onClick={() => void removeProfileFavorite(p.id)}
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
