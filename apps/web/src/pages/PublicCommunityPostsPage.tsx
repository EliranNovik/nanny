import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Loader2, MapPin, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { openCommunityContact } from "@/lib/communityContact";
import { StarRating } from "@/components/StarRating";

type FeedRow = {
  id: string;
  author_id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  author_full_name: string | null;
  author_photo_url: string | null;
  author_city: string | null;
  author_role: string | null;
  /** From job_reviews aggregate for the author (profile), not the post */
  author_average_rating?: number | string | null;
  author_total_ratings?: number | string | null;
};

type PostImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

type PostWithMeta = FeedRow & {
  images: PostImage[];
};

export default function PublicCommunityPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const validCategory =
    categoryFilter && isServiceCategoryId(categoryFilter) ? categoryFilter : null;

  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(() => new Set());

  const postIdsKey = useMemo(
    () =>
      posts
        .map((p) => p.id)
        .sort()
        .join(","),
    [posts]
  );

  const homeHref = profile
    ? profile.role === "freelancer"
      ? "/freelancer/home"
      : "/client/home"
    : "/";

  const categoryTitle = validCategory
    ? serviceCategoryLabel(validCategory)
    : null;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase.rpc("get_community_feed_public", {
        p_category: validCategory ?? null,
      });

      if (error) throw error;
      const list = (rows || []) as FeedRow[];
      if (list.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = list.map((p) => p.id);
      const { data: imgs, error: imgErr } = await supabase
        .from("community_post_images")
        .select("id, post_id, image_url, sort_order")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true });

      if (imgErr) throw imgErr;

      const imagesByPost = new Map<string, PostImage[]>();
      for (const img of imgs || []) {
        const pid = img.post_id as string;
        if (!imagesByPost.has(pid)) imagesByPost.set(pid, []);
        imagesByPost.get(pid)!.push({
          id: img.id as string,
          image_url: img.image_url as string,
          sort_order: Number(img.sort_order) || 0,
        });
      }

      setPosts(
        list.map((p) => ({
          ...p,
          images: imagesByPost.get(p.id) ?? [],
        }))
      );
    } catch (e) {
      console.error("[PublicCommunityPostsPage]", e);
      addToast({
        title: "Could not load posts",
        description: e instanceof Error ? e.message : "Try again later.",
        variant: "error",
      });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, validCategory]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!user?.id || posts.length === 0) {
      setFavoritedIds(new Set());
      return;
    }
    const ids = posts.map((p) => p.id);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("community_post_favorites")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", ids);
      if (cancelled) return;
      if (error) {
        console.error("[PublicCommunityPostsPage] favorites", error);
        return;
      }
      setFavoritedIds(new Set((data || []).map((r) => r.post_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, postIdsKey]);

  const loginRedirect = useMemo(() => {
    const base = "/public/posts";
    const q = validCategory ? `?category=${encodeURIComponent(validCategory)}` : "";
    return `${base}${q}`;
  }, [validCategory]);

  const toggleFavorite = async (postId: string) => {
    if (!user?.id) {
      navigate(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
      return;
    }
    const wasFav = favoritedIds.has(postId);
    setFavoritedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (wasFav) next.delete(postId);
      else next.add(postId);
      return next;
    });
    try {
      if (wasFav) {
        const { error } = await supabase
          .from("community_post_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("community_post_favorites").insert({
          user_id: user.id,
          post_id: postId,
        });
        if (error) throw error;
      }
    } catch (e) {
      setFavoritedIds((prev: Set<string>) => {
        const next = new Set(prev);
        if (wasFav) next.add(postId);
        else next.delete(postId);
        return next;
      });
      addToast({
        title: "Could not update favorites",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    }
  };

  return (
    <div className="min-h-screen gradient-mesh pb-16 md:pb-24">
      <div className="app-desktop-shell space-y-6 pt-4 md:pt-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-1 md:max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full" asChild>
              <Link to={homeHref}>
                <ArrowLeft className="h-4 w-4" />
                {profile ? "Home" : "Back"}
              </Link>
            </Button>
            {validCategory && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => {
                  setSearchParams({});
                }}
              >
                All categories
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-black tracking-tight text-slate-900 dark:text-white md:text-[30px]">
                {categoryTitle ? `${categoryTitle} offers` : "Service offers"}
              </h1>
              <p className="mt-1 max-w-xl text-[15px] font-medium text-muted-foreground">
                {categoryTitle
                  ? `People offering help in ${categoryTitle}. Sign in to contact them.`
                  : "Browse what helpers are offering. Sign in to start a conversation."}
              </p>
            </div>
            {user ? (
              <Button type="button" className="gap-2 rounded-full" asChild>
                <Link to="/posts">
                  <Plus className="h-4 w-4" />
                  Post your offer
                </Link>
              </Button>
            ) : (
              <Button type="button" className="gap-2 rounded-full" asChild>
                <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>
                  <Plus className="h-4 w-4" />
                  Post your offer
                </Link>
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="mx-auto w-full max-w-3xl border-dashed md:max-w-4xl">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {validCategory
                  ? "No offers in this category yet."
                  : "No posts yet—check back soon."}
              </p>
              {user ? (
                <Button type="button" asChild>
                  <Link to="/posts">Create a post</Link>
                </Button>
              ) : (
                <Button type="button" asChild>
                  <Link to={`/login?redirect=${encodeURIComponent("/posts")}`}>
                    Sign in to post
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5 px-1 md:max-w-4xl lg:grid-cols-2">
            {posts.map((post) => {
              const cat = isServiceCategoryId(post.category)
                ? serviceCategoryLabel(post.category)
                : post.category;
              const isMine = user?.id === post.author_id;
              return (
                <Card
                  key={post.id}
                  className="overflow-hidden border border-slate-200/70 shadow-sm dark:border-white/10"
                >
                  <CardContent className="p-0">
                    {post.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-0.5 bg-muted/30">
                        {post.images.slice(0, 4).map((im) => (
                          <div
                            key={im.id}
                            className={cn(
                              "relative aspect-[4/3] bg-muted",
                              post.images.length === 1 && "col-span-2 aspect-[16/9]"
                            )}
                          >
                            <img
                              src={im.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-11 w-11 shrink-0 border border-border/60">
                          <AvatarImage src={post.author_photo_url ?? undefined} />
                          <AvatarFallback className="bg-orange-500/15 text-sm font-bold text-orange-700">
                            {(post.author_full_name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-foreground">
                            {post.author_full_name || "Member"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {post.author_city && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {post.author_city}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {cat}
                            </Badge>
                          </div>
                          {(() => {
                            const total = Number(post.author_total_ratings ?? 0);
                            const avg = Number(post.author_average_rating ?? 0);
                            if (total > 0) {
                              return (
                                <StarRating
                                  rating={avg}
                                  totalRatings={total}
                                  size="sm"
                                  className="mt-1.5"
                                  starClassName="text-amber-500 dark:text-amber-400"
                                  numberClassName="text-amber-950 dark:text-amber-100"
                                />
                              );
                            }
                            return (
                              <p className="mt-1.5 text-[11px] text-muted-foreground">No reviews yet</p>
                            );
                          })()}
                        </div>
                        {!isMine && (
                          <div className="shrink-0 pt-0.5">
                            {user ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-9 w-9 rounded-full text-muted-foreground hover:text-red-500",
                                  favoritedIds.has(post.id) && "text-red-500 hover:text-red-600"
                                )}
                                onClick={() => void toggleFavorite(post.id)}
                                aria-pressed={favoritedIds.has(post.id)}
                                aria-label={
                                  favoritedIds.has(post.id)
                                    ? "Remove from favorites"
                                    : "Add to favorites"
                                }
                              >
                                <Heart
                                  className={cn(
                                    "h-5 w-5",
                                    favoritedIds.has(post.id) && "fill-current"
                                  )}
                                  aria-hidden
                                />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-red-500"
                                asChild
                                aria-label="Sign in to save favorites"
                              >
                                <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>
                                  <Heart className="h-5 w-5" aria-hidden />
                                </Link>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <h2 className="text-lg font-black leading-snug text-slate-900 dark:text-white">
                        {post.title}
                      </h2>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {post.body}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {new Date(post.created_at).toLocaleString()}
                      </p>
                      {!isMine && user && profile && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 rounded-xl"
                          onClick={() =>
                            void openCommunityContact({
                              supabase,
                              user,
                              myRole: profile.role,
                              targetUserId: post.author_id,
                              targetRole: post.author_role,
                              navigate,
                              addToast,
                            })
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                          Contact
                        </Button>
                      )}
                      {!isMine && !user && (
                        <Button type="button" variant="outline" size="sm" className="w-full rounded-xl" asChild>
                          <Link to={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>
                            Sign in to contact
                          </Link>
                        </Button>
                      )}
                      {isMine && user && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          asChild
                        >
                          <Link to={`/profile/${post.author_id}`}>View your public profile</Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
