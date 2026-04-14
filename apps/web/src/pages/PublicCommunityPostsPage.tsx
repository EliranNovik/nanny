import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  CommunityPostCard,
  type CommunityFeedPost,
  type CommunityPostImage,
  type CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";
import { PublicPostsCategoryStepper } from "@/components/community/PublicPostsCategoryStepper";
import {
  ALL_HELP_CATEGORY_ID,
  isAllHelpCategory,
  isServiceCategoryId,
  serviceCategoryLabel,
  type DiscoverHomeCategoryId,
} from "@/lib/serviceCategories";
import { openCommunityContact } from "@/lib/communityContact";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Mobile snap: directly under fixed category bar (~3.5rem header + ~3.25rem tabs) + small gap */
const MOBILE_SNAP_TOP_LOGGED_IN =
  "top-[calc(env(safe-area-inset-top,0px)+7.25rem)]";
/** Guest: app header + back/title block (approx) */
const MOBILE_SNAP_TOP_GUEST =
  "top-[calc(env(safe-area-inset-top,0px)+3.5rem+5.75rem)]";
/**
 * Clears fixed BottomNav row: py-2 top (0.5rem) + tallest tap target (52px FAB) +
 * pb max(0.5rem, safe-area). Do not add safe-area twice — it is already in max(...).
 */
const MOBILE_SNAP_BOTTOM =
  "bottom-[calc(3.75rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]";

export default function PublicCommunityPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const isAllHelp = isAllHelpCategory(categoryFilter);
  const validCategory =
    isAllHelp
      ? null
      : categoryFilter && isServiceCategoryId(categoryFilter)
        ? categoryFilter
        : null;

  const activeCategoryId: DiscoverHomeCategoryId = useMemo(() => {
    if (!categoryFilter) return ALL_HELP_CATEGORY_ID;
    if (isAllHelpCategory(categoryFilter)) return ALL_HELP_CATEGORY_ID;
    if (isServiceCategoryId(categoryFilter)) return categoryFilter;
    return ALL_HELP_CATEGORY_ID;
  }, [categoryFilter]);

  const selectCategory = useCallback((id: DiscoverHomeCategoryId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === ALL_HELP_CATEGORY_ID) {
          next.delete("category");
        } else {
          next.set("category", id);
        }
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

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

  const categoryTitle =
    activeCategoryId === ALL_HELP_CATEGORY_ID
      ? "All help"
      : serviceCategoryLabel(activeCategoryId);

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
    if (isAllHelp) return `${base}?category=${encodeURIComponent("all_help")}`;
    const q = validCategory ? `?category=${encodeURIComponent(validCategory)}` : "";
    return `${base}${q}`;
  }, [validCategory, isAllHelp]);

  const toggleFavorite = async (postId: string): Promise<boolean> => {
    if (!user?.id) {
      navigate(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
      return false;
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
      return true;
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
      return false;
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
    <div
      className={cn(
        "min-h-screen gradient-mesh pb-6 md:pb-8",
        posts.length > 0 && "max-md:overflow-hidden max-md:pb-0"
      )}
      {...(posts.length > 0 ? { "data-public-snap-feed-mobile": "" } : {})}
    >
      <div
        className={cn(
          "app-desktop-shell space-y-6",
          user
            ? "pt-[calc(0.5rem+5.25rem+0.75rem)] md:pt-[calc(0.5rem+5.5rem+0.75rem)]"
            : "pt-4 md:pt-6",
          /* Mobile snap feed is position:fixed — in-flow pt would only add an empty band (reads as white under tabs) */
          posts.length > 0 && "max-md:!pt-0"
        )}
      >
        {/* Fixed category stepper under header (Jobs-style) */}
        {user && (
          <div
            className={cn(
              "fixed inset-x-0 z-[45] pointer-events-none",
              "top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
              "border-b border-border/30 bg-background/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md",
              "supports-[backdrop-filter]:bg-background/85 dark:border-border/40 dark:bg-background/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
            )}
          >
            <div className="app-desktop-shell pointer-events-auto">
              <div className="mx-auto w-full px-0 py-2">
                <PublicPostsCategoryStepper activeId={activeCategoryId} onSelect={selectCategory} />
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-1 md:max-w-4xl xl:mx-0 xl:max-w-none">
          {!user && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 -ml-2 rounded-full"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
                  else navigate("/");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          )}

          <div
            className={cn(
              posts.length > 0 && user && "max-md:hidden",
              posts.length > 0 && !user && "max-md:pb-1"
            )}
          >
            <h1 className="text-[26px] font-black tracking-tight text-slate-900 dark:text-white md:text-[30px]">
              {`${categoryTitle} — available now`}
            </h1>
            <p className="mt-1 max-w-xl text-[15px] font-medium text-muted-foreground max-md:line-clamp-2 md:line-clamp-none">
              {activeCategoryId === ALL_HELP_CATEGORY_ID
                ? "Time-limited availability — tap to message. Posts disappear when time is up."
                : `Short-lived availability in ${categoryTitle}. Sign in to chat.`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="mx-auto w-full max-w-3xl border-dashed md:max-w-4xl">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {validCategory
                  ? "No offers in this category yet."
                  : "No posts yet—check back soon."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop & tablet: stacked list */}
            <div className="mx-auto hidden w-full max-w-3xl flex-col gap-5 px-1 md:max-w-4xl md:flex">
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
                  plain
                  cardClassName="h-full overflow-hidden rounded-2xl border-0 max-md:border max-md:border-neutral-200 bg-white/95 shadow-sm ring-0 md:bg-transparent md:shadow-none dark:bg-card dark:shadow-md dark:max-md:border-neutral-700 dark:md:bg-transparent dark:md:shadow-none"
                  iconOnlyActions
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

            {/* Mobile: one post per viewport, snap-scroll centered between chrome */}
            <div
              className={cn(
                "fixed inset-x-0 z-[20] overflow-y-auto overscroll-y-contain md:hidden",
                "snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                user ? MOBILE_SNAP_TOP_LOGGED_IN : MOBILE_SNAP_TOP_GUEST,
                MOBILE_SNAP_BOTTOM
              )}
              aria-label="Availability posts"
            >
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="box-border flex min-h-full w-full snap-center snap-always flex-col justify-center px-3 py-2"
                >
                  <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto [-webkit-overflow-scrolling:touch]">
                    <CommunityPostCard
                      post={post}
                      user={user}
                      profile={profile}
                      loginRedirect={loginRedirect}
                      favoritedIds={favoritedIds}
                      onToggleFavorite={toggleFavorite}
                      hiringPostId={hiringPostId}
                      pendingHirePostIds={pendingHirePostIds}
                      onHireFromPost={handleHireFromPost}
                      plain
                      cardClassName="h-full overflow-hidden rounded-2xl border-0 max-md:border max-md:border-neutral-200 bg-white/95 shadow-sm ring-0 md:bg-transparent md:shadow-none dark:bg-card dark:shadow-md dark:max-md:border-neutral-700 dark:md:bg-transparent dark:md:shadow-none"
                      iconOnlyActions
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
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
