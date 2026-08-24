import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { PageFrame } from "@/components/page-frame";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import { useAuth } from "@/context/AuthContext";
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

  const title =
    kind === "offer" ? t("discover.offersForYou") : t("discover.openRequests");

  return (
    <PageFrame variant="fullBleed" frameName="isolated-feed-post">
      <div className="app-desktop-shell mx-auto w-full max-w-2xl px-0 pb-8 max-md:pb-0 md:px-0">
        <div className="hidden items-center gap-2 px-4 pb-2 pt-3 md:flex md:px-0 md:pt-4">
          <button
            type="button"
            onClick={goBack}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full",
              "text-zinc-800 transition-colors hover:bg-zinc-100",
              "dark:text-zinc-100 dark:hover:bg-zinc-800",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70",
            )}
            aria-label={t("common.back", { defaultValue: "Back" })}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip-icon" strokeWidth={2.4} />
          </button>
          <h1 className="min-w-0 truncate text-[18px] font-black tracking-tight text-zinc-900 dark:text-white">
            {title}
          </h1>
        </div>

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
        />
      </div>
    </PageFrame>
  );
}
