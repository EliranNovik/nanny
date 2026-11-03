import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PageFrame } from "@/components/page-frame";
import { AuthorPostsSidePanel } from "@/components/community/AuthorPostsSidePanel";
import {
  ProfilePostsFeed,
  type FeedPost,
} from "@/components/profile/ProfilePostsFeed";
import { useAuth } from "@/context/AuthContext";
import { useTabletViewport } from "@/hooks/useIsTabletViewport";
import { parseProfilePostShareId } from "@/lib/profilePostShare";
import { parseJobRequestShareId } from "@/lib/jobRequestShare";
import type { ViewerLocation } from "@/lib/globalFeedPostUi";

type IsolatedKind = "offer" | "request";

export default function IsolatedFeedPostPage({ kind }: { kind: IsolatedKind }) {
  const { id: rawId } = useParams<{ id: string }>();
  const { profile } = useAuth();
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
    <PageFrame variant="fullBleed" frameName="isolated-feed-post">
      <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-white dark:bg-[#101214]">
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-1.5 pb-28 pt-4 md:px-4">
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
