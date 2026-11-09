import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useParams } from "react-router-dom";
import { PageFrame } from "@/components/page-frame";
import { AuthorPostsSidePanel } from "@/components/community/AuthorPostsSidePanel";
import { GuestCommunityFeedAside } from "@/components/GuestCommunityFeedAside";
import {
  ProfilePostsFeed,
  type FeedPost,
} from "@/components/profile/ProfilePostsFeed";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";
import { parseProfilePostShareId } from "@/lib/profilePostShare";
import { parseJobRequestShareId } from "@/lib/jobRequestShare";
import type { ViewerLocation } from "@/lib/globalFeedPostUi";

type IsolatedKind = "offer" | "request";

export default function IsolatedFeedPostPage({ kind }: { kind: IsolatedKind }) {
  const { id: rawId } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { isTablet } = useTabletViewport();
  const [focusedPost, setFocusedPost] = useState<FeedPost | null>(null);

  const postId = kind === "offer" ? parseProfilePostShareId(rawId) : null;
  const requestId = kind === "request" ? parseJobRequestShareId(rawId) : null;

  const viewerLocation = useMemo<ViewerLocation | null>(() => {
    if (!profile) return null;
    return {
      city: profile.city ?? null,
      lat: profile.location_lat ?? null,
      lng: profile.location_lng ?? null,
    };
  }, [profile]);

  const handleFocusedPostResolved = useCallback((post: FeedPost | null) => {
    setFocusedPost(post);
  }, []);

  return (
    <PageFrame
      variant="fullBleed"
      frameName="isolated-feed-post"
      data-guest-post-detail={!user ? "" : undefined}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        !user && "bg-white dark:bg-[#101214]",
      )}
    >
      <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-white dark:bg-[#101214]">
        {!user ? (
          <GuestCommunityFeedAside
            expanded
            flushTop
            onFindHelp={() => openGuestAuthPrompt({ variant: "create" })}
            onOfferHelp={() => openGuestAuthPrompt({ variant: "engage" })}
          />
        ) : null}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className={user ? "mx-auto w-full max-w-3xl px-1.5 pb-28 pt-4 md:px-4" : "w-full px-4 pb-10 pt-4 md:px-8"}>
            <ProfilePostsFeed
              appearance="discover"
              plainCards
              globalFeedLayout
              isolateFocusedPost
              focusPostId={postId}
              focusRequestId={requestId}
              filterPostTypeIds={kind === "offer" ? ["offer_service"] : ["request_help"]}
              externalFavoritesSidePanel
              viewerLocation={viewerLocation}
              onFocusedPostResolved={handleFocusedPostResolved}
              detailStackLayout
            />
          </div>
        </main>

        {isTablet && focusedPost ? (
          <AuthorPostsSidePanel post={focusedPost} />
        ) : null}
      </div>
    </PageFrame>
  );
}
