import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio } from "lucide-react";
import { LiveTimer } from "@/components/LiveTimer";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import {
  freelancerLiveCountdownTarget,
  isFreelancerInActive24hLiveWindow,
} from "@/lib/freelancerLiveWindow";
import { cn } from "@/lib/utils";
import { DiscoverMobileStripPill } from "@/components/discover/DiscoverMobileStripPill";
import {
  stripFabPillClusterClass,
  stripLiveTimerClass,
} from "@/components/discover/discoverBottomStripShared";

type FreelancerLiveRow = {
  live_until: string | null;
  available_now: boolean | null;
};

type Props = {
  onGoLive?: () => void;
  onMoreClick?: () => void;
  moreMenuTotal?: number;
  moreMenuOpen?: boolean;
};

/**
 * Mobile “Help others”: combined icon pill on the right edge.
 */
export function ExploreHelpOthersLiveStrip({
  onGoLive,
  onMoreClick,
  moreMenuTotal = 0,
  moreMenuOpen = false,
}: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { guardKycAction } = useKycGate();
  const viewerId = profile?.id ?? user?.id ?? null;

  const [fp, setFp] = useState<FreelancerLiveRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!viewerId) {
      setFp(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("live_until, available_now")
      .eq("user_id", viewerId)
      .maybeSingle();
    if (error) {
      console.warn("[ExploreHelpOthersLiveStrip] freelancer_profiles:", error);
      setFp(null);
    } else {
      const row = {
        live_until: data?.live_until ?? null,
        available_now: data?.available_now ?? null,
      };
      setFp(row);
      const untilMs = row.live_until ? new Date(row.live_until).getTime() : NaN;
      if (row.live_until && !Number.isNaN(untilMs) && untilMs <= Date.now()) {
        void supabase
          .from("freelancer_profiles")
          .update({ live_until: null, live_categories: [] })
          .eq("user_id", viewerId);
      }
    }
    setLoading(false);
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [load]);

  const isLive = isFreelancerInActive24hLiveWindow(fp);
  const timerCountdownIso = useMemo(
    () => freelancerLiveCountdownTarget(fp),
    [fp?.live_until],
  );

  const handleGoLive = useCallback(() => {
    if (onGoLive) {
      onGoLive();
      return;
    }
    trackEvent("explore_help_others_go_live_strip", {});
    guardKycAction("go_live", () => navigate("/availability/post-now"));
  }, [guardKycAction, navigate, onGoLive]);

  if (!viewerId) return null;

  if (loading && !fp) {
    return (
      <div className={cn(stripFabPillClusterClass, "pointer-events-none")} aria-hidden>
        <div className="h-16 w-[8.5rem] animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-800/80" />
      </div>
    );
  }

  const timerSlot =
    isLive && timerCountdownIso ? (
      <div className={stripLiveTimerClass} aria-label="Live timer">
        <LiveTimer
          countdownTo={timerCountdownIso}
          render={({ time }) => <span>{time}</span>}
        />
      </div>
    ) : null;

  if (isLive) {
    return (
      <DiscoverMobileStripPill
        mainIcon={
          <span className="relative flex h-5 w-5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-5 w-5 rounded-full bg-emerald-500 shadow-sm ring-2 ring-white dark:ring-zinc-900" />
          </span>
        }
        mainLabel="You're live — visible to people nearby"
        mainDisabled
        mainAccentClass="text-emerald-700 dark:text-emerald-300"
        middleSlot={timerSlot}
        onMoreClick={onMoreClick}
        moreMenuTotal={moreMenuTotal}
        moreMenuOpen={moreMenuOpen}
      />
    );
  }

  return (
    <DiscoverMobileStripPill
      mainIcon={<Radio className="h-7 w-7" strokeWidth={2.5} aria-hidden />}
      mainLabel="Go live — be seen by others"
      onMainClick={handleGoLive}
      mainAccentClass={cn(
        "text-emerald-700 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        "dark:text-emerald-300 dark:focus-visible:ring-0",
      )}
      onMoreClick={onMoreClick}
      moreMenuTotal={moreMenuTotal}
      moreMenuOpen={moreMenuOpen}
    />
  );
}
