import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Loader2,
  MapPin,
  Sparkles,
  UserRound,
  LayoutGrid,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";

type ProfileRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  city: string | null;
  role: string | null;
};

type PostRow = {
  id: string;
  author_id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  status: string;
};

type PostWithExtras = PostRow & {
  author?: ProfileRow | null;
  coverImage: string | null;
};

export default function LikedPage() {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get("tab") === "posts" ? "posts" : "profiles";

  const setTab = (v: string) => {
    if (v === "posts") setSearchParams({ tab: "posts" });
    else setSearchParams({});
  };

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [posts, setPosts] = useState<PostWithExtras[]>([]);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setProfiles([]);
      setPosts([]);
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
          .select("id, full_name, photo_url, city, role")
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
      } else {
        const { data: postRows, error: postErr } = await supabase
          .from("community_posts")
          .select("id, author_id, category, title, body, created_at, status")
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
            .select("id, full_name, photo_url, city, role")
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
            author: authorMap.get(p.author_id) ?? null,
            coverImage: firstImage.get(p.id) ?? null,
          }))
        );
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

  const profileCount = profiles.length;
  const postCount = posts.length;

  const tabBarClass =
    "inline-flex h-12 w-full items-center justify-center gap-1 rounded-2xl border border-rose-200/50 bg-gradient-to-r from-rose-50/90 via-orange-50/80 to-amber-50/70 p-1 shadow-inner dark:border-rose-900/40 dark:from-rose-950/40 dark:via-orange-950/30 dark:to-amber-950/25 md:h-11";

  const triggerClass =
    "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all data-[state=active]:bg-white/90 data-[state=active]:text-rose-600 data-[state=active]:shadow-md dark:data-[state=active]:bg-zinc-900/90 dark:data-[state=active]:text-rose-400";

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
    <div className="min-h-screen gradient-mesh pb-32 md:pb-24">
      <div className="app-desktop-shell px-1 pt-6 md:pt-8">
        <header className="relative mx-auto mb-8 max-w-2xl overflow-hidden rounded-3xl border border-rose-200/40 bg-gradient-to-br from-rose-500/[0.08] via-orange-500/[0.06] to-amber-400/[0.07] px-5 py-6 shadow-[0_20px_50px_-20px_rgba(244,63,94,0.35)] dark:border-rose-900/30 dark:from-rose-950/50 dark:via-orange-950/30 dark:to-amber-950/20 md:px-8 md:py-7">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-500/10" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl dark:bg-amber-500/10" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/25">
              <Heart className="h-6 w-6 fill-current" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Saved for you
              </h1>
              <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Profiles and community posts you have hearted—one place to come back to.
              </p>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="mx-auto max-w-2xl">
          <TabsList className={tabBarClass}>
            <TabsTrigger value="profiles" className={triggerClass}>
              <UserRound className="h-4 w-4 shrink-0 opacity-80" />
              Profiles
              {profileCount > 0 && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-black text-rose-600 dark:text-rose-400">
                  {profileCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="posts" className={triggerClass}>
              <LayoutGrid className="h-4 w-4 shrink-0 opacity-80" />
              Posts
              {postCount > 0 && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-black text-rose-600 dark:text-rose-400">
                  {postCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
              </div>
            ) : profiles.length === 0 ? (
              <Card className="border-dashed border-rose-200/60 bg-card/60 dark:border-rose-900/40">
                <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                  <Sparkles className="h-10 w-10 text-rose-400/80" />
                  <p className="text-base font-semibold text-foreground">No saved profiles yet</p>
                  {emptyHint}
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {profiles.map((p) => (
                  <li key={p.id}>
                    <Card
                      className={cn(
                        "overflow-hidden border-rose-200/40 bg-card/80 shadow-sm transition-all duration-300",
                        "hover:-translate-y-0.5 hover:border-rose-300/50 hover:shadow-md dark:border-white/10 dark:hover:border-rose-900/50"
                      )}
                    >
                      <CardContent className="flex items-center gap-3 p-4">
                        <Link
                          to={`/profile/${p.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <Avatar className="h-14 w-14 shrink-0 border-2 border-white shadow-md dark:border-zinc-800">
                            <AvatarImage src={p.photo_url ?? undefined} alt="" />
                            <AvatarFallback className="bg-gradient-to-br from-rose-100 to-orange-100 text-base font-bold text-rose-700 dark:from-rose-950 dark:to-orange-950 dark:text-rose-300">
                              {(p.full_name || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate font-bold text-foreground">{p.full_name || "Member"}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {p.city && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {p.city}
                                </span>
                              )}
                              {p.role && (
                                <Badge variant="secondary" className="text-[10px] font-bold capitalize">
                                  {p.role}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                        <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600" asChild>
                            <Link to={`/profile/${p.id}`} aria-label="Open profile">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            disabled={busyProfileId === p.id}
                            aria-label="Remove from saved"
                            onClick={() => void removeProfileFavorite(p.id)}
                          >
                            {busyProfileId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="posts" className="mt-6 focus-visible:outline-none">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
              </div>
            ) : posts.length === 0 ? (
              <Card className="border-dashed border-rose-200/60 bg-card/60 dark:border-rose-900/40">
                <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                  <Heart className="h-10 w-10 text-rose-400/80" />
                  <p className="text-base font-semibold text-foreground">No saved posts yet</p>
                  {emptyHint}
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col gap-4">
                {posts.map((post) => {
                  const cat = isServiceCategoryId(post.category)
                    ? serviceCategoryLabel(post.category)
                    : post.category;
                  return (
                    <li key={post.id}>
                      <Card
                        className={cn(
                          "overflow-hidden border-rose-200/40 bg-card/80 shadow-sm transition-all duration-300",
                          "hover:-translate-y-0.5 hover:border-rose-300/50 hover:shadow-md dark:border-white/10"
                        )}
                      >
                        {post.coverImage && (
                          <div className="relative aspect-[21/9] max-h-40 w-full bg-muted">
                            <img
                              src={post.coverImage}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          </div>
                        )}
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <Avatar className="h-10 w-10 border border-border/60">
                                <AvatarImage src={post.author?.photo_url ?? undefined} />
                                <AvatarFallback className="bg-rose-500/15 text-xs font-bold text-rose-700">
                                  {(post.author?.full_name || "?").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold">{post.author?.full_name || "Member"}</p>
                                <Badge variant="secondary" className="mt-0.5 text-[10px] font-bold">
                                  {cat}
                                </Badge>
                              </div>
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
                          <h2 className="text-lg font-black leading-snug text-foreground">{post.title}</h2>
                          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.body}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button variant="outline" size="sm" className="rounded-full border-rose-200/60 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40" asChild>
                              <Link to="/public/posts">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                Community feed
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
