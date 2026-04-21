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
import {
  useCommunityPosts,
  usePostFavorites,
  usePendingHireInterests,
} from "@/hooks/data/useCommunityPosts";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/data/keys";

/** Mobile snap: directly under fixed header + horizontal category chips */
const MOBILE_SNAP_TOP_LOGGED_IN =
  "top-[calc(env(safe-area-inset-top,0px)+8.25rem)]";
/** Guest: app header + back/title block (approx) */
const MOBILE_SNAP_TOP_GUEST =
  "top-[calc(env(safe-area-inset-top,0px)+3.5rem+5.75rem)]";
const MOBILE_SNAP_BOTTOM =
  "bottom-[calc(3.75rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]";

export default function PublicCommunityPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const focusPostId = searchParams.get("post");
  const isAllHelp = isAllHelpCategory(categoryFilter);
  const validCategory = isAllHelp
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

  const selectCategory = useCallback(
    (id: DiscoverHomeCategoryId) => {
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
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // --- Server state via React Query ---
  const { data: posts = [], isLoading: loading } = useCommunityPosts(validCategory);

  /** Deep link (e.g. Discover “Helpers available now”): scroll to the matching card once loaded */
  useEffect(() => {
    if (!focusPostId || loading) return;
    if (!posts.some((p) => p.id === focusPostId)) return;
    const timer = window.setTimeout(() => {
      const nodes = document.querySelectorAll<HTMLElement>(
        `[data-public-feed-anchor="${CSS.escape(focusPostId)}"]`,
      );
      const target =
        [...nodes].find((n) => n.offsetParent !== null) ?? nodes[0] ?? null;
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [focusPostId, loading, posts]);

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);

  const { data: favoritedIdsSet = new Set<string>() } = usePostFavorites(user?.id, postIds);
  const [localFavChanges, setLocalFavChanges] = useState<Map<string, boolean>>(() => new Map());

  const { data: pendingHireIdsSet = new Set<string>() } = usePendingHireInterests(
    user?.id,
    profile?.role,
    postIds,
  );
  const [localHireAdded, setLocalHireAdded] = useState<Set<string>>(() => new Set());

  // Merge server state with optimistic local overrides
  const favoritedIds = useMemo(() => {
    const merged = new Set(favoritedIdsSet);
    localFavChanges.forEach((isFav, id) => {
      if (isFav) merged.add(id);
      else merged.delete(id);
    });
    return merged;
  }, [favoritedIdsSet, localFavChanges]);

  const pendingHirePostIds = useMemo(() => {
    const merged = new Set(pendingHireIdsSet);
    localHireAdded.forEach((id) => merged.add(id));
    return merged;
  }, [pendingHireIdsSet, localHireAdded]);

  const [hiringPostId, setHiringPostId] = useState<string | null>(null);

  const categoryTitle =
    activeCategoryId === ALL_HELP_CATEGORY_ID
      ? "All help"
      : serviceCategoryLabel(activeCategoryId);

  const loginRedirect = useMemo(() => {
    const base = "/public/posts";
    if (isAllHelp) return `${base}?category=${encodeURIComponent("all_help")}`;
    const q = validCategory
      ? `?category=${encodeURIComponent(validCategory)}`
      : "";
    return `${base}${q}`;
  }, [validCategory, isAllHelp]);

  const toggleFavorite = async (postId: string): Promise<boolean> => {
    if (!user?.id) {
      navigate(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
      return false;
    }
    const wasFav = favoritedIds.has(postId);
    // Optimistic update
    setLocalFavChanges((prev) => {
      const next = new Map(prev);
      next.set(postId, !wasFav);
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
        const { error } = await supabase
          .from("community_post_favorites")
          .insert({ user_id: user.id, post_id: postId });
        if (error) throw error;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.postFavorites(user.id, postIds) });
      return true;
    } catch (e) {
      // Rollback
      setLocalFavChanges((prev) => {
        const next = new Map(prev);
        next.set(postId, wasFav);
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
      await apiPost<{ interest_id: string; already_pending?: boolean }>(
        "/api/jobs/from-community-post",
        { community_post_id: postId },
      );
      setLocalHireAdded((prev) => new Set([...prev, postId]));
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
        "min-h-screen bg-background pb-6 md:pb-8",
        // Desktop/tablet: light grey canvas with white cards (more pro / SaaS).
        "md:bg-slate-50/80 dark:md:bg-background",
        posts.length > 0 && "max-md:overflow-hidden max-md:pb-0",
      )}
      {...(posts.length > 0 ? { "data-public-snap-feed-mobile": "" } : {})}
    >
      <div
        className={cn(
          "app-desktop-shell space-y-6",
          user
            ? "pt-[calc(0.5rem+5.25rem+0.75rem)] md:pt-[calc(0.5rem+5.5rem+0.75rem)]"
            : "pt-4 md:pt-6",
          posts.length > 0 && "max-md:!pt-0",
        )}
      >
        {/* Fixed category stepper under header (Jobs-style) */}
        {user && (
          <div
            className={cn(
              "fixed inset-x-0 z-[45] pointer-events-none",
              "top-[calc(env(safe-area-inset-top,0px)+3.5rem)]",
              // Keep layout/position only — no extra "bar" surface behind the pill.
              "bg-transparent",
            )}
          >
            <div className="app-desktop-shell pointer-events-auto">
              <div className="mx-auto w-full px-0 py-1">
                <PublicPostsCategoryStepper
                  activeId={activeCategoryId}
                  onSelect={selectCategory}
                />
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
                  if (
                    typeof window !== "undefined" &&
                    window.history.length > 1
                  )
                    navigate(-1);
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
              posts.length > 0 && !user && "max-md:pb-1",
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
                <div
                  key={post.id}
                  data-public-feed-anchor={post.id}
                  className="w-full"
                >
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
                      cardClassName="h-full overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-sm ring-0 dark:border-white/5 dark:bg-zinc-900"
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
              ))}
            </div>

            {/* Mobile: one post per viewport, snap-scroll centered between chrome */}
            <div
              className={cn(
                "fixed inset-x-0 z-[20] overflow-y-auto overscroll-y-contain md:hidden",
                "snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                user ? MOBILE_SNAP_TOP_LOGGED_IN : MOBILE_SNAP_TOP_GUEST,
                MOBILE_SNAP_BOTTOM,
              )}
              aria-label="Availability posts"
            >
              {posts.map((post) => (
                <div
                  key={post.id}
                  id={`community-post-${post.id}`}
                  data-public-feed-anchor={post.id}
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
                          cardClassName="h-full overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-sm ring-0 dark:border-white/5 dark:bg-zinc-900"
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
