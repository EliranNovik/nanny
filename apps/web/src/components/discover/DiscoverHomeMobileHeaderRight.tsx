import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MoreVertical, Radio, Zap } from "lucide-react";
import { LiveTimer } from "@/components/LiveTimer";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { useDiscoverOpenHelpRequests } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { trackEvent } from "@/lib/analytics";
import { matchesCommunityRequestsIncoming } from "@/lib/communityRequestsNotificationFilter";
import {
  freelancerLiveCountdownTarget,
  isFreelancerInActive24hLiveWindow,
} from "@/lib/freelancerLiveWindow";
import { requestDiscoverHomeQuickMoreOpen } from "@/lib/discoverHomeQuickMoreBridge";
import { recordFirstMeaningfulAction } from "@/lib/sessionConversionAnalytics";
import { writeDiscoverHomeIntent, type DiscoverHomeIntent } from "@/lib/discoverHomeIntent";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Props = {
  mode: DiscoverHomeIntent;
  createRequestPath: string;
  workPrimaryPath: string;
};

const primaryIconBtnClass = cn(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-[0.97]",
  "outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60",
);

const moreBtnClass = cn(
  "discover-header-location-glass relative flex h-10 w-10 shrink-0 items-center justify-center text-slate-900 transition-all active:scale-95 dark:text-white",
  "outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60",
);

export function DiscoverHomeMobileHeaderRight({
  mode,
  createRequestPath,
  workPrimaryPath,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { guardKycAction } = useKycGate();
  const isHire = mode === "hire";
  const viewerId = profile?.id ?? user?.id ?? null;

  const { data: liveAvatarsPayload } = useDiscoverLiveAvatars(user?.id);
  const categoryAvatars = liveAvatarsPayload?.byCategory ?? {};
  const { data: frData } = useFreelancerRequests(user?.id);
  const fetchOpenHelpPool = !isHire && !!user?.id && profile?.role !== "freelancer";
  const { data: openHelpRows = [] } = useDiscoverOpenHelpRequests(
    fetchOpenHelpPool,
    user?.id,
  );

  const [freelancerLiveMeta, setFreelancerLiveMeta] = useState<{
    live_until: string | null;
  }>({ live_until: null });

  const loadFreelancerLiveMeta = useCallback(async () => {
    if (!viewerId || isHire) return;
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("live_until")
      .eq("user_id", viewerId)
      .maybeSingle();
    if (error) {
      setFreelancerLiveMeta({ live_until: null });
      return;
    }
    setFreelancerLiveMeta({ live_until: data?.live_until ?? null });
  }, [viewerId, isHire]);

  useEffect(() => {
    void loadFreelancerLiveMeta();
  }, [loadFreelancerLiveMeta]);

  useEffect(() => {
    if (isHire) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadFreelancerLiveMeta();
    };
    window.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [isHire, loadFreelancerLiveMeta]);

  const isLive =
    !isHire &&
    isFreelancerInActive24hLiveWindow({ live_until: freelancerLiveMeta.live_until });
  const liveUntil = freelancerLiveCountdownTarget(freelancerLiveMeta);

  const hireLiveHelperCount = useMemo(() => {
    let n = 0;
    for (const cat of DISCOVER_HOME_CATEGORIES) {
      if (cat.id === ALL_HELP_CATEGORY_ID) continue;
      if (!isServiceCategoryId(cat.id)) continue;
      const avs = categoryAvatars[cat.id];
      if (Array.isArray(avs)) n += avs.length;
    }
    return n;
  }, [categoryAvatars]);

  const workLivePostCount = useMemo(() => {
    if (!user?.id) return 0;
    if (profile?.role === "freelancer") {
      return (frData?.inboundNotifications ?? []).filter((n) =>
        matchesCommunityRequestsIncoming(n, { excludeClientId: user.id }),
      ).length;
    }
    return openHelpRows.length;
  }, [frData, openHelpRows, profile?.role, user?.id]);

  const myRequestsCount = (frData?.myOpenRequests ?? []).length;
  const pendingWorkRequestsCount = (frData?.inboundNotifications ?? []).filter((n) =>
    Boolean(n.isConfirmed),
  ).length;

  const moreMenuTotal = isHire
    ? hireLiveHelperCount + myRequestsCount
    : isLive
      ? pendingWorkRequestsCount
      : workLivePostCount + pendingWorkRequestsCount;

  const onPostRequest = () => {
    trackEvent("discover_actions_post_request", { mode, source: "header" });
    writeDiscoverHomeIntent("hire");
    guardKycAction("start_request", () => {
      navigate(createRequestPath);
      recordFirstMeaningfulAction("home_primary_create_request");
    });
  };

  const onGoLive = () => {
    trackEvent("discover_actions_go_live", { mode, source: "header" });
    writeDiscoverHomeIntent("work");
    guardKycAction("go_live", () => {
      navigate(workPrimaryPath);
      recordFirstMeaningfulAction("home_primary_work");
    });
  };

  return (
    <div className="pointer-events-auto flex items-center gap-1">
      {isHire ? (
        <button
          type="button"
          onClick={onPostRequest}
          className={cn(
            primaryIconBtnClass,
            "bg-indigo-600 text-white shadow-md shadow-indigo-900/20 hover:bg-indigo-500",
          )}
          aria-label={t("nav.startRequest")}
        >
          <Zap className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      ) : isLive ? (
        <div
          className={cn(
            primaryIconBtnClass,
            "pointer-events-none bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
          )}
          aria-label={t("nav.goLive")}
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          {liveUntil ? (
            <span className="sr-only">
              <LiveTimer countdownTo={liveUntil} render={({ time }) => <span>{time}</span>} />
            </span>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={onGoLive}
          className={cn(
            primaryIconBtnClass,
            "bg-emerald-600 text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-500",
          )}
          aria-label={t("nav.goLive")}
        >
          <Radio className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      )}

      <button
        type="button"
        onClick={requestDiscoverHomeQuickMoreOpen}
        className={moreBtnClass}
        aria-label="More discover actions"
      >
        <MoreVertical className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        {moreMenuTotal > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-black leading-none shadow-sm"
          >
            {moreMenuTotal > 99 ? "99+" : moreMenuTotal}
          </Badge>
        ) : null}
      </button>
    </div>
  );
}
