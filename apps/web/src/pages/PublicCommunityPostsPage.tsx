import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import {
  CommunityPostCard,
  type CommunityFeedPost,
  type CommunityPostImage,
  type CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { openCommunityContact } from "@/lib/communityContact";
import { apiPost } from "@/lib/api";

export default function PublicCommunityPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const validCategory =
    categoryFilter && isServiceCategoryId(categoryFilter) ? categoryFilter : null;

  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [posts, setPosts] = useState<CommunityPostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(() => new Set());
  const [hiringPostId, setHiringPostId] = useState<string | null>(null);
  /** Posts where this client already tapped Hire now and is still pending freelancer confirm */
  const [pendingHirePostIds, setPendingHirePostIds] = useState<Set<string>>(() => new Set());

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
      const list = (rows || []) as CommunityFeedPost[];
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

      const imagesByPost = new Map<string, CommunityPostImage[]>();
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

  const focusPostId = searchParams.get("post");
  useEffect(() => {
    if (!focusPostId || loading) return;
    const t = window.setTimeout(() => {
      document.getElementById(`community-post-${focusPostId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    return () => clearTimeout(t);
  }, [focusPostId, loading, postIdsKey]);

  useEffect(() => {
    if (!user?.id || profile?.role !== "client") {
      setPendingHirePostIds(new Set());
      return;
    }
    if (posts.length === 0) {
      setPendingHirePostIds(new Set());
      return;
    }
    const ids = posts.map((p) => p.id);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("community_post_hire_interests")
        .select("community_post_id")
        .eq("client_id", user.id)
        .eq("status", "pending")
        .in("community_post_id", ids);
      if (cancelled) return;
      if (error) {
        console.error("[PublicCommunityPostsPage] pending hire interests", error);
        return;
      }
      setPendingHirePostIds(
        new Set((data || []).map((r) => r.community_post_id as string))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role, postIdsKey]);

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

  const handleHireFromPost = async (postId: string) => {
    setHiringPostId(postId);
    try {
      await apiPost<{ interest_id: string; already_pending?: boolean }>("/api/jobs/from-community-post", {
        community_post_id: postId,
      });
      setPendingHirePostIds((prev) => {
        const next = new Set(prev);
        next.add(postId);
        return next;
      });
      addToast({
        title: "Interest sent",
        description:
          "The helper will see you on their availability post. They can confirm to start a live job and chat.",
        variant: "success",
      });
    } catch (e) {
      addToast({
        title: "Could not start hire",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setHiringPostId(null);
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
                {categoryTitle ? `${categoryTitle} — available now` : "Available now"}
              </h1>
              <p className="mt-1 max-w-xl text-[15px] font-medium text-muted-foreground">
                {categoryTitle
                  ? `Short-lived availability in ${categoryTitle}. Sign in to chat.`
                  : "Time-limited availability — tap to message. Posts disappear when time is up."}
              </p>
            </div>
            {user ? (
              <Button type="button" className="gap-2 rounded-full" asChild>
                <Link to="/availability">
                  <Plus className="h-4 w-4" />
                  Set availability
                </Link>
              </Button>
            ) : (
              <Button type="button" className="gap-2 rounded-full" asChild>
                <Link to={`/login?redirect=${encodeURIComponent("/availability")}`}>
                  <Plus className="h-4 w-4" />
                  Set availability
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
                  <Link to="/availability">Set availability</Link>
                </Button>
              ) : (
                <Button type="button" asChild>
                  <Link to={`/login?redirect=${encodeURIComponent("/availability")}`}>
                    Sign in to post
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5 px-1 md:max-w-4xl lg:grid-cols-2">
            {posts.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                user={user}
                profile={profile}
                loginRedirect={loginRedirect}
                favoritedIds={favoritedIds}
                onToggleFavorite={toggleFavorite}
                hiringPostId={hiringPostId}
                pendingHirePostIds={pendingHirePostIds}
                onHireFromPost={handleHireFromPost}
                onOpenChat={() => {
                  if (!user || !profile) return;
                  void openCommunityContact({
                    supabase,
                    user,
                    myRole: profile.role,
                    targetUserId: post.author_id,
                    targetRole: post.author_role,
                    navigate,
                    addToast,
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
