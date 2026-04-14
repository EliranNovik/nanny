import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  discoverSheetDialogContentClassName,
  discoverSheetInnerCardClassName,
  DiscoverSheetTopHandle,
} from "@/lib/discoverSheetDialog";
import {
  CommunityPostCard,
  type CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";
import { DiscoverStoriesRingAvatar } from "@/components/discover/DiscoverStoriesRingAvatar";
import { SwipeDecisionLayer } from "@/components/discover/SwipeDecisionLayer";
import { cn } from "@/lib/utils";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";

type PostViewerProfile = {
  role: "client" | "freelancer" | "admin";
} | null;

function postCategoryLabel(post: CommunityPostWithMeta): string {
  if (isServiceCategoryId(post.category)) {
    return serviceCategoryLabel(post.category);
  }
  const raw = (post.category || "").trim();
  if (raw) return raw;
  return "Available";
}

type Props = {
  posts: CommunityPostWithMeta[];
  user: User | null;
  profile: PostViewerProfile;
  loginRedirect: string;
  favoritedIds: Set<string>;
  onToggleFavorite: (postId: string) => void | Promise<boolean>;
  hiringPostId: string | null;
  pendingHirePostIds: Set<string>;
  onHireFromPost: (postId: string) => void | Promise<boolean>;
  onOpenChat: (post: CommunityPostWithMeta) => void;
  /** Renders at end of row (e.g. See more) — same scroll row as story items */
  trailingSlot?: ReactNode;
};

export function AvailabilityStoriesStrip({
  posts,
  user,
  profile,
  loginRedirect,
  favoritedIds,
  onToggleFavorite,
  hiringPostId,
  pendingHirePostIds,
  onHireFromPost,
  onOpenChat,
  trailingSlot,
}: Props) {
  const [stackIndex, setStackIndex] = useState<number | null>(null);

  const openPost = stackIndex != null && posts[stackIndex] ? posts[stackIndex] : null;

  useEffect(() => {
    if (stackIndex !== null && stackIndex >= posts.length) {
      setStackIndex(null);
    }
  }, [posts, stackIndex]);

  function openAtPost(post: CommunityPostWithMeta) {
    const i = posts.findIndex((p) => p.id === post.id);
    setStackIndex(i >= 0 ? i : 0);
  }

  function advanceOrClose() {
    setStackIndex((i) => {
      if (i === null) return null;
      if (i >= posts.length - 1) return null;
      return i + 1;
    });
  }

  const canSwipeHire =
    Boolean(user && profile && openPost) &&
    (profile!.role === "client" || profile!.role === "freelancer") &&
    openPost!.author_role === "freelancer";

  const canSendHireInterest =
    Boolean(openPost) && canSwipeHire && !pendingHirePostIds.has(openPost!.id);

  const swipeBusy = Boolean(openPost && hiringPostId === openPost.id);

  async function onSwipeHire() {
    if (!openPost) return;
    const ok = await Promise.resolve(onHireFromPost(openPost.id));
    if (ok) advanceOrClose();
  }

  const sheetBody = openPost ? (
    <div className={discoverSheetInnerCardClassName}>
      <DiscoverSheetTopHandle />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SwipeDecisionLayer
          variant="availability"
          disabled={swipeBusy}
          leftStamp={canSendHireInterest ? "HIRE" : "NEXT"}
          rightStamp="PASS"
          onSwipeLeft={advanceOrClose}
          onSwipeRight={canSendHireInterest ? onSwipeHire : advanceOrClose}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <CommunityPostCard
              post={openPost}
              user={user}
              profile={profile}
              loginRedirect={loginRedirect}
              favoritedIds={favoritedIds}
              onToggleFavorite={onToggleFavorite}
              hiringPostId={hiringPostId}
              pendingHirePostIds={pendingHirePostIds}
              onHireFromPost={onHireFromPost}
              onOpenChat={() => onOpenChat(openPost)}
              plain
              iconOnlyActions
              availabilitySheetComfort
            />
          </div>
        </SwipeDecisionLayer>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        className={cn(
          "-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory [touch-action:pan-x_pan-y] overscroll-x-contain"
        )}
        role="list"
        aria-label="Availability posts"
      >
        {posts.map((post) => {
          const label = postCategoryLabel(post);
          return (
            <button
              key={post.id}
              type="button"
              role="listitem"
              onClick={() => openAtPost(post)}
              className={cn(
                "group flex w-[5.5rem] shrink-0 snap-start flex-col items-center gap-2 rounded-xl pb-0.5 text-center outline-none",
                "transition-transform active:scale-[0.97]",
                "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <DiscoverStoriesRingAvatar
                variant="hire"
                className="transition-transform duration-300 group-hover:scale-[1.03]"
              >
                <Avatar className="h-full w-full border-0 shadow-none ring-0">
                  <AvatarImage
                    src={post.author_photo_url ?? undefined}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-xl font-bold text-orange-800 dark:from-orange-950 dark:to-amber-950 dark:text-orange-200">
                    {(post.author_full_name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DiscoverStoriesRingAvatar>
              <span
                className="max-w-full truncate px-0.5 text-xs font-semibold leading-tight text-foreground"
                title={label}
              >
                {label}
              </span>
            </button>
          );
        })}
        {trailingSlot}
      </div>

      <Dialog open={stackIndex !== null} onOpenChange={(o) => !o && setStackIndex(null)}>
        <DialogContent className={discoverSheetDialogContentClassName}>
          <DialogTitle className="sr-only">
            {openPost
              ? `Availability: ${openPost.title || postCategoryLabel(openPost)}`
              : "Availability post"}
          </DialogTitle>
          {sheetBody}
        </DialogContent>
      </Dialog>
    </>
  );
}
