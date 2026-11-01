import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
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
import { cn } from "@/lib/utils";

type IsolatedKind = "offer" | "request";

export default function IsolatedFeedPostPage({ kind }: { kind: IsolatedKind }) {
  const { id: rawId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(profile?.role === "freelancer" ? "/freelancer/home" : "/client/home");
  };

  const handleFocusedPostResolved = useCallback((post: FeedPost | null) => {
    setFocusedPost(post);
  }, []);

  return (
    <PageFrame variant="fullBleed" frameName="isolated-feed-post">
      <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-white dark:bg-[#101214]">
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "pointer-events-none sticky top-0 z-30 -mb-[66px] h-[66px]",
              "bg-gradient-to-b from-white via-white/95 to-white/0",
              "dark:from-[#101214] dark:via-[#101214]/95 dark:to-[#101214]/0",
              isTablet && "backdrop-blur-xl",
            )}
          >
            <div className="pointer-events-auto flex h-[60px] items-end justify-between px-4 pb-1.5 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
              <button
                type="button"
                onClick={goBack}
                className={cn(
                  "inline-flex h-[46px] w-[46px] items-center justify-center rounded-full",
                  "border border-black/10 bg-white/80 text-zinc-800 shadow-sm transition-transform hover:scale-105",
                  "dark:border-white/20 dark:bg-zinc-900/80 dark:text-zinc-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70",
                )}
                aria-label={t("common.back", { defaultValue: "Back" })}
              >
                <ArrowLeft className="h-7 w-7 rtl-flip-icon" strokeWidth={2.35} />
              </button>
              <span className="h-[46px] w-[46px]" aria-hidden />
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-[66px]">
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
