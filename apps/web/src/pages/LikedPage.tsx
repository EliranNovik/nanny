import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BadgeCheck,
  CheckCircle2,
  Heart,
  Hourglass,
  Loader2,
  MapPin,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { StarRating } from "@/components/StarRating";
import { type AvailabilityPayload } from "@/lib/availabilityPosts";

type ProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  role: string | null;
  is_verified?: boolean | null;
  average_rating?: number | null;
  total_ratings?: number | null;
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

type LikedListItem =
  | { kind: "profile"; favoritedAt: string; profile: ProfileRow }
  | { kind: "post"; favoritedAt: string; post: PostWithExtras };

/** Newest interest per post for this user (from `community_post_hire_interests`, ordered by created_at desc). */
type HireInterestState =
  | { status: "pending" }
  | { status: "confirmed"; job_request_id: string }
  | { status: "declined" };

export default function LikedPage() {
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [posts, setPosts] = useState<PostWithExtras[]>([]);
  const [profileFavoritedAt, setProfileFavoritedAt] = useState<Record<string, string>>({});
  const [postFavoritedAt, setPostFavoritedAt] = useState<Record<string, string>>({});
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [hireInterestByPostId, setHireInterestByPostId] = useState<
    Record<string, HireInterestState>
  >({});
  const [conversationIdByJobId, setConversationIdByJobId] = useState<Record<string, string>>(
    {}
  );

  const load = useCallback(async () => {
    if (!user?.id) {
      setProfiles([]);
      setPosts([]);
      setProfileFavoritedAt({});
      setPostFavoritedAt({});
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

      const postAt: Record<string, string> = {};
      for (const r of postFavRes.data ?? []) {
        postAt[r.post_id as string] = r.created_at as string;
      }
      setPostFavoritedAt(postAt);

      const profileAt: Record<string, string> = {};
      for (const r of profFavRes.data ?? []) {
        profileAt[r.favorite_user_id as string] = r.created_at as string;
      }
      setProfileFavoritedAt(profileAt);

      if (favUserIds.length === 0) {
        setProfiles([]);
      } else {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, city, average_rating, total_ratings")
          .in("id", favUserIds);
        if (pe) throw pe;
        const byId = new Map((profs ?? []).map((p) => [p.id as string, p as ProfileRow]));
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
      setProfileFavoritedAt({});
      setPostFavoritedAt({});
      setHireInterestByPostId({});
      setConversationIdByJobId({});
    } finally {
      setLoading(false);
    }
  }, [user?.id, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const mixedItems = useMemo((): LikedListItem[] => {
    const items: LikedListItem[] = [
      ...profiles.map((p) => ({
        kind: "profile" as const,
        favoritedAt: profileFavoritedAt[p.id] ?? "",
        profile: p,
      })),
      ...posts.map((p) => ({
        kind: "post" as const,
        favoritedAt: postFavoritedAt[p.id] ?? "",
        post: p,
      })),
    ];
    items.sort((a, b) => Date.parse(b.favoritedAt) - Date.parse(a.favoritedAt));
    return items;
  }, [profiles, posts, profileFavoritedAt, postFavoritedAt]);

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

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <div className="app-desktop-shell px-1 pt-4 md:pt-6">
        <div className="mx-auto mb-4 max-w-2xl px-2 md:mb-6 md:px-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground md:text-2xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                  <Heart className="h-4.5 w-4.5 fill-current" aria-hidden />
                </span>
                Saved
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your liked profiles and community offers.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-2xl px-2 md:px-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            </div>
          ) : mixedItems.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-black/15 bg-transparent dark:border-white/15">
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <Sparkles className="h-10 w-10 text-rose-400/80" />
                <p className="text-base font-semibold text-foreground">Nothing saved yet</p>
                {emptyHint}
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {mixedItems.map((item) =>
                item.kind === "profile" ? (
                  <li key={`p-${item.profile.id}`}>
                    <Card
                      className={cn(
                        "overflow-hidden rounded-2xl border border-black/10 bg-transparent transition-all duration-200 dark:border-white/10",
                        "hover:border-black/15 dark:hover:border-white/15"
                      )}
                    >
                      <Link
                        to={`/profile/${item.profile.id}`}
                        className="relative block aspect-[4/3] w-full overflow-hidden border-b border-black/10 bg-gradient-to-br from-rose-100 to-orange-100 dark:border-white/10 dark:from-rose-950 dark:to-orange-950"
                      >
                        {item.profile.photo_url ? (
                          <img
                            src={item.profile.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-rose-700 dark:text-rose-300">
                            {(item.profile.full_name || "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </Link>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h2 className="truncate text-[15px] font-black leading-snug text-foreground">
                              {item.profile.full_name || "Member"}
                            </h2>
                            {item.profile.city && (
                              <p className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {item.profile.city}
                              </p>
                            )}
                            <div className="mt-2">
                              <StarRating
                                rating={Number(item.profile.average_rating) || 0}
                                totalRatings={item.profile.total_ratings ?? 0}
                                size="sm"
                                emptyStarClassName="text-muted-foreground/30"
                                starClassName="text-amber-500 dark:text-amber-400"
                                numberClassName="text-foreground"
                                countClassName="text-muted-foreground"
                              />
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                              asChild
                            >
                              <Link to={`/profile/${item.profile.id}`} aria-label="Open profile">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              disabled={busyProfileId === item.profile.id}
                              aria-label="Remove from saved"
                              onClick={() => void removeProfileFavorite(item.profile.id)}
                            >
                              {busyProfileId === item.profile.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ) : (
                  <li key={`post-${item.post.id}`}>
                    {(() => {
                      const post = item.post;
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
                        <Card
                          className={cn(
                            "overflow-hidden rounded-2xl border border-black/10 bg-transparent transition-all duration-200 dark:border-white/10",
                            "hover:border-black/15 dark:hover:border-white/15"
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
                                      <Button size="sm" className="rounded-full gap-1.5" asChild>
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
                      );
                    })()}
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
