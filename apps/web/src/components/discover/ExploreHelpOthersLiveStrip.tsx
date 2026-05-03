import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, PlayCircle, Radio } from "lucide-react";
import { LiveTimer } from "@/components/LiveTimer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import {
  isFreelancerInActive24hLiveWindow,
  isFreelancerLiveWindowActive,
} from "@/lib/freelancerLiveWindow";
import { cn } from "@/lib/utils";

const LIVE_SESSION_MS = 24 * 60 * 60 * 1000;

/** Flush with mobile BottomNav: pt-0.5 + row 2.75rem + pb max(0.5rem, safe). */
const stripBottomFlushClass =
  "bottom-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]";

const stripGoLiveFabClass = cn(
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-xl transition-transform active:scale-[0.96]",
  "motion-safe:animate-dock-primary-breathe bg-emerald-600 shadow-emerald-950/35",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "dark:focus-visible:ring-emerald-200/40 dark:focus-visible:ring-offset-zinc-950",
);

const stripMoreBtnClass = cn(
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-600 shadow-none transition-colors active:scale-[0.96]",
  "hover:bg-zinc-100/90 dark:text-zinc-300 dark:hover:bg-white/10",
  "focus-visible:outline-none focus-visible:ring-0",
);

const stripMoreBadgeClass =
  "absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-0.5 text-[10px] font-black tabular-nums leading-none text-white bg-red-500 shadow-sm";

type FreelancerLiveRow = {
  live_until: string | null;
  available_now: boolean | null;
  updated_at: string | null;
};

type Props = {
  /** Discover home: intent + analytics; Explore uses default navigation. */
  onGoLive?: () => void;
  /** Discover: opens quick actions sheet (icon only). */
  onMoreClick?: () => void;
  moreMenuTotal?: number;
  moreMenuOpen?: boolean;
};

/**
 * Mobile “Help others” (Discover home work mode + Explore work mode): fixed strip above BottomNav.
 */
export function ExploreHelpOthersLiveStrip({
  onGoLive,
  onMoreClick,
  moreMenuTotal = 0,
  moreMenuOpen = false,
}: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
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
      .select("live_until, available_now, updated_at")
      .eq("user_id", viewerId)
      .maybeSingle();
    if (error) {
      console.warn("[ExploreHelpOthersLiveStrip] freelancer_profiles:", error);
      setFp(null);
    } else {
      setFp({
        live_until: data?.live_until ?? null,
        available_now: data?.available_now ?? null,
        updated_at: data?.updated_at ?? null,
      });
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

  const isLive = isFreelancerLiveWindowActive(fp);
  const in24h = isFreelancerInActive24hLiveWindow(fp);

  const timerAnchorIso = useMemo(() => {
    if (!isLive) return null;
    if (in24h && fp?.live_until) {
      const until = new Date(fp.live_until).getTime();
      if (Number.isNaN(until)) return fp.updated_at;
      return new Date(until - LIVE_SESSION_MS).toISOString();
    }
    if (fp?.updated_at) return fp.updated_at;
    return null;
  }, [isLive, in24h, fp?.live_until, fp?.updated_at]);

  const handleGoLive = useCallback(() => {
    if (onGoLive) {
      onGoLive();
      return;
    }
    trackEvent("explore_help_others_go_live_strip", {});
    navigate("/availability/post-now");
  }, [navigate, onGoLive]);

  const stripMoreButton =
    onMoreClick != null ? (
      <button
        type="button"
        onClick={onMoreClick}
        className={stripMoreBtnClass}
        aria-label="More discover actions"
        aria-expanded={moreMenuOpen}
      >
        <MoreVertical className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        {moreMenuTotal > 0 ? (
          <span className={stripMoreBadgeClass} aria-hidden>
            {moreMenuTotal > 99 ? "99+" : moreMenuTotal}
          </span>
        ) : null}
      </button>
    ) : null;

  if (!viewerId) return null;

  if (loading && !fp) {
    return (
      <div
        className={cn(
          "md:hidden pointer-events-none fixed inset-x-0 z-[125]",
          stripBottomFlushClass,
          "px-3",
        )}
        aria-hidden
      >
        <div className="mx-auto h-12 max-w-lg animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "md:hidden pointer-events-auto fixed inset-x-0 z-[125]",
        stripBottomFlushClass,
        "px-3",
      )}
    >
      <div className="mx-auto max-w-lg">
        {isLive ? (
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-3 py-2.5 pl-3.5 shadow-md",
              "border-emerald-200/90 bg-white text-emerald-950",
              "dark:border-emerald-400/20 dark:bg-emerald-950/55 dark:text-emerald-50 dark:shadow-lg dark:backdrop-blur-xl",
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 dark:bg-emerald-400/10">
                <span className="relative flex h-3.5 w-3.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-sm ring-2 ring-white dark:ring-emerald-950/80" />
                </span>
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-black tracking-tight leading-tight">
                  You&apos;re live
                </p>
                <p className="truncate text-[14px] font-semibold leading-snug text-emerald-800/90 dark:text-emerald-200/85">
                  Visible to people nearby
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {timerAnchorIso ? (
                <div className="rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[14px] font-bold tabular-nums text-emerald-900 shadow-sm ring-1 ring-emerald-600/15 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-400/15">
                  <LiveTimer
                    createdAt={timerAnchorIso}
                    render={({ time }) => <span>{time}</span>}
                  />
                </div>
              ) : null}
              {stripMoreButton}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-3 py-2.5 pl-3.5 shadow-md",
              "border-zinc-200 bg-white text-zinc-900",
              "dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-50 dark:shadow-lg",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                <Radio className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-black tracking-tight leading-tight">
                  Go live
                </p>
                <p className="truncate text-[14px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400">
                  Be seen by others
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleGoLive}
                className={stripGoLiveFabClass}
                aria-label="Go live"
              >
                <PlayCircle className="h-7 w-7" strokeWidth={2.5} aria-hidden />
              </button>
              {stripMoreButton}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
