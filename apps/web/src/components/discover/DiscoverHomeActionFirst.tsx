import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/data/keys";
import {
  ChevronRight,
  ClipboardList,
  Clock,
  Compass,
  Plus,
  Radio,
  Search,
  Send,
  UsersRound,
  Wifi,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import {
  mobileBottomSheetSlideAnimationClass,
  mobileTallBottomSheetDialogClass,
  mobileSheetSafePaddingBottom,
} from "@/lib/mobileModalLayout";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useKycGate } from "@/context/KycGateContext";
import { trackEvent } from "@/lib/analytics";
import {
  freelancerLiveCountdownTarget,
  isFreelancerInActive24hLiveWindow,
} from "@/lib/freelancerLiveWindow";
import { supabase } from "@/lib/supabase";
import {
  navigateToHelpersBrowse,
  navigateToWorkBrowseRequests,
} from "@/lib/discoverBrowseNavigate";
import { DiscoverHomeRealtimeStrip } from "@/components/discover/DiscoverHomeRealtimeStrip";
import type { DiscoverHomeCategoryFilter } from "@/lib/discoverHomeCategoryFilter";
import {
  DISCOVER_STROKE,
  discoverIcon,
} from "@/components/discover/discoverHomeIcons";
import { DISCOVER_PRIMARY_HERO_IMAGES } from "@/components/discover/discoverHomeHeroImages";
import { recordFirstMeaningfulAction } from "@/lib/sessionConversionAnalytics";
import { matchesCommunityRequestsIncoming } from "@/lib/communityRequestsNotificationFilter";
import { useDiscoverLiveAvatars } from "@/hooks/data/useDiscoverFeed";
import { useFreelancerRequests } from "@/hooks/data/useFreelancerRequests";
import { useDiscoverOpenHelpRequests } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { registerDiscoverHomeQuickMoreOpener } from "@/lib/discoverHomeQuickMoreBridge";
import { useDiscoverHomeOverlayLock } from "@/hooks/useDiscoverHomeOverlayLock";
import { writeDiscoverHomeIntent } from "@/lib/discoverHomeIntent";
import {
  ALL_HELP_CATEGORY_ID,
  DISCOVER_HOME_CATEGORIES,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import type { ViewerLocation } from "@/lib/globalFeedPostUi";
import { communityFeedScrollState } from "@/lib/communityFeedNav";
import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import { LiveTimer } from "@/components/LiveTimer";
import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";
import { DiscoverHomePostedHelpRequests } from "@/components/discover/DiscoverHomePostedHelpRequests";
import { DiscoverHomeMyOpenRequests } from "@/components/discover/DiscoverHomeMyOpenRequests";
import { DiscoverHomeMyLiveHelpJobs } from "@/components/discover/DiscoverHomeMyLiveHelpJobs";

type HomeMode = "hire" | "work";

const DISCOVER_HIRE_COMMUNITY_POST_TYPES = ["offer_service"] as const;
const DISCOVER_WORK_COMMUNITY_POST_TYPES = ["request_help", "event"] as const;

type Props = {
  homeMode: HomeMode;
  explorePath: string;
  workPrimaryPath: string;
  createRequestPath: string;
};

/** Same stack + padding for both hire/work heroes; flex-1 + shared min-heights keeps both modes aligned in the desktop grid row. */
const heroInnerClassName =
  "relative flex min-h-[10rem] flex-1 flex-col sm:min-h-[11rem] md:min-h-[22rem] lg:min-h-[23rem]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-start px-5 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-5 md:px-7 md:pb-28 md:pt-6";

const heroTopBlockClassName = "flex max-w-xl flex-col gap-3 md:gap-3.5";

const heroTitleBlockClassName = "max-w-[17rem] space-y-1.5 pr-1 sm:max-w-[19rem]";


export function DiscoverHomeActionFirst({
  homeMode,
  explorePath,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { guardKycAction } = useKycGate();
  const isHire = homeMode === "hire";
  const isRtl = i18n.dir() === "rtl";
  const discoverCommunityPostTypes = isHire
    ? [...DISCOVER_HIRE_COMMUNITY_POST_TYPES]
    : [...DISCOVER_WORK_COMMUNITY_POST_TYPES];
  const openCommunityFeedPost = useCallback(
    (postId: string) => {
      navigate(GLOBAL_POSTS_PATH, { state: communityFeedScrollState(postId) });
    },
    [navigate],
  );
  const { data: liveAvatarsPayload } = useDiscoverLiveAvatars(user?.id);
  const categoryAvatars = liveAvatarsPayload?.byCategory ?? {};
  const { data: frData } = useFreelancerRequests(user?.id);
  const [myRequestsOpen, setMyRequestsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] =
    useState<DiscoverHomeCategoryFilter>("all");

  const [pendingWorkRequestsOpen, setPendingWorkRequestsOpen] = useState(false);
  const [quickMoreOpen, setQuickMoreOpen] = useState(false);
  const [quickMoreSheetExpanded, setQuickMoreSheetExpanded] = useState(true);
  const fetchOpenHelpPool =
    !isHire && !!user?.id && profile?.role !== "freelancer";
  const { data: openHelpRows = [] } = useDiscoverOpenHelpRequests(
    fetchOpenHelpPool,
    user?.id,
  );
  /** Prefer auth user id if profile row is still hydrating (common on `/client/home`). */
  const viewerId = profile?.id ?? user?.id ?? null;
  const viewerLocation = useMemo<ViewerLocation | null>(() => {
    if (!profile) return null;
    return {
      city: profile.city ?? null,
      lat: profile.location_lat ?? null,
      lng: profile.location_lng ?? null,
    };
  }, [profile]);
  const discoverPostsFeedProps = {
    limit: 5 as const,
    appearance: "discover" as const,
    discoverSidePanel: "favorites" as const,
    filterPostTypeIds: discoverCommunityPostTypes,
    sidePanelPostTypeIds: discoverCommunityPostTypes,
    onSidePanelPostOpen: openCommunityFeedPost,
    plainCards: true,
    globalFeedLayout: true,
    viewerLocation,
  };
  const [freelancerLiveMeta, setFreelancerLiveMeta] = useState<{
    live_until: string | null;
    available_now: boolean | null;
  }>({ live_until: null, available_now: null });

  const loadFreelancerLiveMeta = useCallback(async () => {
    if (!viewerId || isHire) return;
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("live_until, available_now")
      .eq("user_id", viewerId)
      .maybeSingle();
    if (error) {
      console.warn("[DiscoverHomeActionFirst] live_until:", error);
      setFreelancerLiveMeta({ live_until: null, available_now: null });
      return;
    }
    setFreelancerLiveMeta({
      live_until: data?.live_until ?? null,
      available_now: data?.available_now ?? null,
    });
  }, [viewerId, isHire]);

  useEffect(() => {
    void loadFreelancerLiveMeta();
  }, [loadFreelancerLiveMeta]);

  useEffect(() => {
    registerDiscoverHomeQuickMoreOpener(() => setQuickMoreOpen(true));
    return () => registerDiscoverHomeQuickMoreOpener(null);
  }, []);

  useEffect(() => {
    if (quickMoreOpen) setQuickMoreSheetExpanded(true);
  }, [quickMoreOpen]);

  useDiscoverHomeOverlayLock(
    quickMoreOpen || myRequestsOpen || pendingWorkRequestsOpen,
  );

  /** Clients + freelancers both persist 24h go-live on `freelancer_profiles` — refetch when returning to the tab. */
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

  /** Helpers list / Discover helpers use the strict 24h go-live window — match dock + hero FAB. */
  const isInActive24hGoLiveWindow =
    !isHire &&
    isFreelancerInActive24hLiveWindow({ live_until: freelancerLiveMeta.live_until });

  /**
   * Hero stat — viewer's own "Live help" count, matching the Explore page exactly.
   * Shares the same `queryKeys.exploreLiveHelp(userId, mode)` cache key as
   * `ExploreLiveHelpNow` and `DiscoverHomeMyLiveHelpJobs`, returning the same
   * `{ jobs, profileMap }` shape so we never clobber the shared cache. `select`
   * derives the count we need without re-fetching.
   *  - Hire: jobs where the viewer is the client and a helper is currently engaged.
   *  - Work: jobs where the viewer is the selected helper and is currently helping.
   */
  const { data: heroLiveHelpData } = useQuery<
    { jobs: Array<{ id: string }>; profileMap: Record<string, unknown> },
    Error,
    number
  >({
    queryKey: queryKeys.exploreLiveHelp(user?.id, homeMode),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return { jobs: [], profileMap: {} };
      const base = supabase
        .from("job_requests")
        .select(
          "id, created_at, service_type, location_city, location_lat, location_lng, client_id, selected_freelancer_id, status",
        );
      const filtered = isHire
        ? base.eq("client_id", user.id)
        : base.eq("selected_freelancer_id", user.id);
      const { data, error } = await filtered
        .in("status", ["locked", "active"])
        .not("selected_freelancer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) {
        console.warn("[DiscoverHomeActionFirst] live help count", error);
        return { jobs: [], profileMap: {} };
      }
      return {
        jobs: (data ?? []) as Array<{ id: string }>,
        profileMap: {},
      };
    },
    select: (raw) =>
      Array.isArray((raw as { jobs?: unknown[] })?.jobs)
        ? (raw as { jobs: unknown[] }).jobs.length
        : 0,
  });
  const myLiveHelpCount = heroLiveHelpData ?? 0;

  /** Total live helper slots across Discover home categories (same pool as the strip). */
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

  /** Live requests: freelancer inbox count or client open-help RPC rows (same rules as the strip). */
  const workLivePostCount = useMemo(() => {
    if (!user?.id) return 0;
    if (profile?.role === "freelancer") {
      return (frData?.inboundNotifications ?? []).filter((n) =>
        matchesCommunityRequestsIncoming(n, {
          excludeClientId: user.id,
        }),
      ).length;
    }
    return openHelpRows.length;
  }, [frData, openHelpRows, profile?.role, user?.id]);



  const myRequestsCount = useMemo(() => {
    return (frData?.myOpenRequests ?? []).length;
  }, [frData]);

  const pendingWorkRequestsCount = useMemo(() => {
    return (frData?.inboundNotifications ?? []).filter((n) =>
      Boolean(n.isConfirmed),
    ).length;
  }, [frData]);

  /**
   * Mobile: the More-actions sheet is the only quick-action surface; the
   * standalone "Find requests" FAB is gone — the action lives inside this sheet
   * (opened from the 3-dot button on the "You're live" strip).
   */
  function renderQuickActionDockMobile() {
    const badgeRow =
      "ml-auto flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-[15px] font-black tabular-nums text-white bg-red-500 shadow-md";

    const quickMoreBody = (
      <div className={cn("flex flex-col gap-1 bg-background p-2", mobileSheetSafePaddingBottom)}>
            {isHire ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    trackEvent("discover_actions_post_request", {
                      mode: homeMode,
                      source: "quick_more",
                    });
                    writeDiscoverHomeIntent("hire");
                    guardKycAction("start_request", () => {
                      navigate(createRequestPath);
                      recordFirstMeaningfulAction("home_primary_create_request");
                    });
                  }}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                    <Zap className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold text-foreground">
                      {t("nav.startRequest")}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      Get help from people near you
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    trackEvent("discover_actions_browse_helpers", { mode: homeMode });
                    navigateToHelpersBrowse(navigate);
                  }}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                    <Search className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold text-foreground">Find helpers</span>
                    <span className="text-[13px] text-muted-foreground">Browse who’s available</span>
                  </span>
                  {hireLiveHelperCount > 0 ? (
                    <span className={badgeRow}>
                      {hireLiveHelperCount > 99 ? "99+" : hireLiveHelperCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    setMyRequestsOpen(true);
                  }}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                    <ClipboardList className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold text-foreground">My requests</span>
                    <span className="text-[13px] text-muted-foreground">Your open requests</span>
                  </span>
                  {myRequestsCount > 0 ? (
                    <span className={badgeRow}>{myRequestsCount > 9 ? "9+" : myRequestsCount}</span>
                  ) : null}
                </button>
              </>
            ) : (
              <>
                {isInActive24hGoLiveWindow ? (
                  <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      <span className="relative flex h-5 w-5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex h-5 w-5 rounded-full bg-emerald-500" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-extrabold text-foreground">
                        You&apos;re live
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        Visible to people nearby
                        {freelancerLiveCountdownTarget(freelancerLiveMeta) ? (
                          <>
                            {" · "}
                            <LiveTimer
                              countdownTo={freelancerLiveCountdownTarget(freelancerLiveMeta)!}
                              render={({ time }) => <span>{time}</span>}
                            />
                          </>
                        ) : null}
                      </span>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                    onClick={() => {
                      setQuickMoreOpen(false);
                      trackEvent("discover_actions_go_live", {
                        mode: homeMode,
                        source: "quick_more",
                      });
                      writeDiscoverHomeIntent("work");
                      guardKycAction("go_live", () => {
                        navigate(workPrimaryPath);
                        recordFirstMeaningfulAction("home_primary_work");
                      });
                    }}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      <Radio className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-extrabold text-foreground">
                        {t("nav.goLive")}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        Be seen by people near you
                      </span>
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    trackEvent("discover_actions_browse_requests", { mode: homeMode });
                    navigateToWorkBrowseRequests(navigate, profile);
                  }}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    <UsersRound className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold text-foreground">Find requests</span>
                    <span className="text-[13px] text-muted-foreground">Live requests near you</span>
                  </span>
                  {workLivePostCount > 0 ? (
                    <span className={badgeRow}>
                      {workLivePostCount > 99 ? "99+" : workLivePostCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted"
                  onClick={() => {
                    setQuickMoreOpen(false);
                    setPendingWorkRequestsOpen(true);
                  }}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Clock className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold text-foreground">Pending</span>
                    <span className="text-[13px] text-muted-foreground">Responses to confirm</span>
                  </span>
                  {pendingWorkRequestsCount > 0 ? (
                    <span className={badgeRow}>
                      {pendingWorkRequestsCount > 9 ? "9+" : pendingWorkRequestsCount}
                    </span>
                  ) : null}
                </button>
              </>
            )}
          </div>
    );

    const quickMoreSheet = quickMoreOpen ? (
      <MobileSnapBottomSheet
        expanded={quickMoreSheetExpanded}
        onExpandedChange={(next) => {
          setQuickMoreSheetExpanded(next);
          if (!next) setQuickMoreOpen(false);
        }}
        onDismiss={() => setQuickMoreOpen(false)}
        hidePeek
        heightMode="content"
        maxHeight="min(85dvh, 640px)"
        ariaLabel={t("discover.moreActions", { defaultValue: "More discover actions" })}
        className="z-[140]"
      >
        <p className="sr-only">More actions</p>
        {quickMoreBody}
      </MobileSnapBottomSheet>
    ) : null;

    // The "Find requests" entry lives exclusively inside the More-actions sheet on
    // mobile; the standalone floating FAB is intentionally removed (avoids a
    // duplicate CTA next to the "You're live" strip).
    return <>{quickMoreSheet}</>;
  }

  /** Desktop hero: three round icon badges + captions (no modal). */
  function renderDesktopWorkLiveBadge() {
    if (isHire) return null;
    if (!isInActive24hGoLiveWindow) return null;
    const liveUntil = freelancerLiveCountdownTarget(freelancerLiveMeta);
    return (
      <div className="pointer-events-none absolute right-6 top-6 z-[21] hidden md:block">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
          </span>
          <span>Live</span>
          {liveUntil ? (
            <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-black tabular-nums tracking-wide">
              <LiveTimer
                countdownTo={liveUntil}
                render={({ time }) => <span>{time}</span>}
              />
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  /**
   * Desktop-only key-stat pills overlaid on the right side of the hero image.
   * Clicking a stat deep-links to the matching Explore tab.
   *  - Hire (Get help now): My requests + Live help
   *  - Work (Help others): Pending + Live help
   */
  function renderHeroStats() {
    type HeroStat = {
      label: string;
      value: number;
      accent: string;
      tab: string;
    };
    const stats: HeroStat[] = isHire
      ? [
          {
            label: t("discoverHome.actions.myRequests"),
            value: myRequestsCount,
            accent: "bg-indigo-500/85",
            tab: "my_requests",
          },
          {
            label: t("discoverHome.actions.liveHelp"),
            value: myLiveHelpCount,
            accent: "bg-emerald-500/85",
            tab: "live_help",
          },
        ]
      : [
          {
            label: t("discoverHome.actions.pending"),
            value: pendingWorkRequestsCount,
            accent: "bg-amber-500/85",
            tab: "pending",
          },
          {
            label: t("discoverHome.actions.liveHelp"),
            value: myLiveHelpCount,
            accent: "bg-emerald-500/85",
            tab: "live_help",
          },
        ];

    return (
      <div
        className={cn(
          "pointer-events-auto absolute top-6 z-[20] hidden items-start gap-7 md:flex",
          isRtl ? "left-7" : "right-7",
        )}
      >
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              trackEvent("discover_hero_stat_click", {
                mode: homeMode,
                tab: s.tab,
              });
              navigate(`${explorePath}?mode=${homeMode}&tab=${s.tab}`);
            }}
            aria-label={`${s.label}: ${s.value}. Open in Explore`}
            className={cn(
              "group flex cursor-pointer flex-col items-center rounded-xl bg-black/15 px-3 py-1.5 text-center text-white backdrop-blur-sm transition-transform duration-150",
              "hover:-translate-y-0.5 active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn("block h-2 w-2 rounded-full", s.accent)}
                aria-hidden
              />
              <span
                className="text-[32px] font-black leading-none tabular-nums text-white transition-colors group-hover:text-white"
                style={{ textShadow: "0 2px 14px rgba(0,0,0,0.55)" }}
              >
                {s.value > 999 ? "999+" : s.value}
              </span>
            </span>
            <span
              className="mt-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-white/95 transition-colors group-hover:text-white"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.55)" }}
            >
              {s.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  function renderDesktopHeroQuickActions() {
    const buttonBase =
      "flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[14px] font-black tracking-tight shadow-lg transition-all active:scale-[0.98]";
    const neutral =
      "bg-white/90 text-zinc-950 backdrop-blur-md hover:bg-white";
    const blue =
      "bg-gradient-to-r from-slate-900 via-blue-950 to-slate-950 text-white shadow-blue-950/25 hover:from-slate-950 hover:via-blue-950 hover:to-black";

    const sharePost = () => {
      if (!user) {
        openGuestAuthPrompt({ variant: "create" });
        return;
      }
      guardKycAction("share_post", () => {
        navigate(`${GLOBAL_POSTS_PATH}?compose=1`);
      });
    };

    if (isHire) {
      return (
        <div className="pointer-events-auto absolute inset-x-7 bottom-5 z-[22] hidden grid-cols-4 gap-2 md:grid">
          <button
            type="button"
            onClick={() => {
              trackEvent("discover_hero_quick_find_helpers", { mode: "hire" });
              navigate("/client/helpers");
            }}
            className={cn(buttonBase, neutral)}
          >
            <Search className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            {t("discoverHome.actions.findHelpers")}
          </button>
          <button
            type="button"
            onClick={() => setMyRequestsOpen(true)}
            className={cn(buttonBase, neutral)}
          >
            <ClipboardList className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            {t("discoverHome.actions.myRequests")}
          </button>
          <button
            type="button"
            onClick={() => {
              trackEvent("discover_hero_quick_post_request", { mode: "hire" });
              guardKycAction("start_request", () => navigate(createRequestPath));
            }}
            className={cn(
              buttonBase,
              "bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white shadow-orange-950/25 hover:from-orange-600 hover:to-red-600",
            )}
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            {t("discoverHome.actions.postRequest")}
          </button>
          <button type="button" onClick={sharePost} className={cn(buttonBase, blue)}>
            <Send className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            {t("discoverHome.actions.sharePost")}
          </button>
        </div>
      );
    }

    return (
      <div className="pointer-events-auto absolute inset-x-7 bottom-5 z-[22] hidden grid-cols-4 gap-2 md:grid">
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_hero_quick_explore", { mode: "work" });
            navigate("/community/feed");
          }}
          className={cn(buttonBase, neutral)}
        >
          <Compass className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          {t("discoverHome.actions.explore")}
        </button>
        <button
          type="button"
          onClick={() => setPendingWorkRequestsOpen(true)}
          className={cn(buttonBase, neutral)}
        >
          <Clock className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          {t("discoverHome.actions.pending")}
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_hero_quick_go_live", { mode: "work" });
            guardKycAction("go_live", () => navigate(workPrimaryPath));
          }}
          className={cn(
            buttonBase,
            "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white shadow-emerald-950/25 hover:from-emerald-600 hover:to-teal-600",
          )}
        >
          <Radio className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          {isInActive24hGoLiveWindow
            ? t("discoverHome.actions.live")
            : t("discoverHome.actions.goLive")}
        </button>
        <button type="button" onClick={sharePost} className={cn(buttonBase, blue)}>
          <Send className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          {t("discoverHome.actions.sharePost")}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-3 md:gap-5",
      )}
    >
      {renderQuickActionDockMobile()}
      <div className="flex flex-1 md:hidden flex-col gap-0">
        <div className="shrink-0 pt-0 px-0">
          <DiscoverHomeRealtimeStrip
            variant={homeMode}
            explorePath={explorePath}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
          />
        </div>

        <div className="shrink-0 mt-3 flex flex-col px-0 pb-6">
          {isHire ? (
            <div className="flex flex-col">
              <div className="w-full px-4 pt-2 pb-2">
                <DiscoverHomeMyOpenRequests explorePath={explorePath} />
              </div>
              <div className="w-full px-4 pt-4 pb-2">
                <DiscoverHomeMyLiveHelpJobs
                  mode="hire"
                  exploreLiveHelpPath={`${explorePath}?mode=hire&tab=live_help`}
                  createRequestPath={createRequestPath}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
            </div>
          )}
        </div>

        <DiscoverHomePostedHelpRequests
          enabled={!isHire}
          categoryFilter={categoryFilter}
          className="w-full px-4 pt-2 pb-2"
        />

        {!isHire ? (
          <div className="w-full px-4 pt-4 pb-2">
            <DiscoverHomeMyLiveHelpJobs
              mode="work"
              exploreLiveHelpPath={`${explorePath}?mode=work&tab=live_help`}
            />
          </div>
        ) : null}

        <section className="mt-6 px-0 md:px-4 pb-24">
          <h2 className="mb-4 px-4 text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("discover.ourCommunityLive")}
          </h2>
          <ProfilePostsFeed {...discoverPostsFeedProps} />
          <div className="mt-6 flex justify-center px-4 pb-8">
            <button
              type="button"
              onClick={() => navigate("/community/feed")}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-6 py-3 text-[14px] font-black text-slate-700 transition-all active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-white/5 shadow-sm"
            >
              Show all posts
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      </div>

      {/* ===== DESKTOP ONLY LAYOUT ===== */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden gap-5">
        <div className="flex w-full shrink-0 flex-col gap-4 md:gap-5 lg:gap-6">
          <div className={cn("flex min-h-0 min-w-0 flex-col gap-4 md:h-full", !isHire && "hidden")}>
            <section
              className={cn(
                "relative mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none group md:min-h-0",
                "ring-1 ring-white/10 ring-inset transition-all duration-500",
              )}
            >
              {renderHeroStats()}
              {renderDesktopHeroQuickActions()}
              <div className={cn(heroInnerClassName, "min-h-0 md:h-full")}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.hire}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_18%] transition-transform duration-700 group-hover:scale-105"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[5]" />

                <div className={heroStackClassName}>
                  <div
                    className={cn(
                      heroTopBlockClassName,
                      isRtl && "ml-auto items-end text-right",
                    )}
                  >
                    <div className="min-w-0">
                      {/* Desktop hero actions moved into the bottom Actions menu */}

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md sm:px-3 sm:py-1.5">
                          <Zap
                            className={cn(discoverIcon.sm, "shrink-0")}
                            strokeWidth={DISCOVER_STROKE}
                            aria-hidden
                          />
                          {t("discoverHome.heroHire.badge")}
                        </div>
                      </div>
                      <div className={cn(heroTitleBlockClassName, "mt-2 pr-0")}>
                        <h2
                          className="text-[2.25rem] font-black leading-[1.1] tracking-tight text-white sm:text-[2.75rem]"
                          style={{
                            textShadow: "0 4px 30px rgba(0,0,0,0.5)",
                          }}
                        >
                          {t("discoverHome.heroHire.title")}
                        </h2>
                        <p
                          className="whitespace-pre-line text-[0.875rem] font-normal leading-snug text-white/95 sm:text-[15px]"
                          style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
                        >
                          {t("discoverHome.heroHire.sub")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
          
          <section
            className={cn(
              "relative mx-auto flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-[28px] text-left md:mx-0 md:max-w-none group md:h-full md:min-h-0",
              "ring-1 ring-white/10 ring-inset transition-all duration-500",
              isHire && "hidden"
            )}
          >
              {renderDesktopWorkLiveBadge()}
              {renderHeroStats()}
              {renderDesktopHeroQuickActions()}
              <div className={cn(heroInnerClassName, "min-h-0 md:h-full")}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.work}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_18%] transition-transform duration-700 group-hover:scale-105"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[5]" />

                <div className={heroStackClassName}>
                  <div
                    className={cn(
                      heroTopBlockClassName,
                      isRtl && "ml-auto items-end text-right",
                    )}
                  >
                    <div className="min-w-0">
                      {/* Desktop hero actions moved into the bottom Actions menu */}

                      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md sm:px-3 sm:py-1.5">
                        <Wifi
                          className={cn(discoverIcon.sm, "shrink-0")}
                          strokeWidth={DISCOVER_STROKE}
                          aria-hidden
                        />
                        {t("discoverHome.heroWork.badge")}
                      </div>
                      <div className={cn(heroTitleBlockClassName, "mt-2 pr-0")}>
                        <h2
                          className="text-[2.25rem] font-black leading-[1.1] tracking-tight text-white sm:text-[2.75rem]"
                          style={{
                            textShadow: "0 4px 30px rgba(0,0,0,0.5)",
                          }}
                        >
                          {t("discoverHome.heroWork.title")}
                        </h2>
                        <p
                          className="text-[0.875rem] font-normal leading-snug text-white/95 sm:text-[15px]"
                          style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
                        >
                          {t("discoverHome.heroWork.sub")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
        </div>

        <div className="min-h-0 w-full overflow-hidden pt-2 flex flex-col gap-2">
          <div className={cn(!isHire && "hidden")}>
            <DiscoverHomeRealtimeStrip
              variant="hire"
              explorePath={explorePath}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              onOpenMyRequests={user?.id ? () => setMyRequestsOpen(true) : undefined}
              hideDesktopQuickActions
            />
          </div>
          <div className={cn(isHire && "hidden")}>
            <DiscoverHomeRealtimeStrip
              variant="work"
              explorePath={explorePath}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              onOpenPending={user?.id ? () => setPendingWorkRequestsOpen(true) : undefined}
              hideDesktopQuickActions
            />
          </div>

          <DiscoverHomeMyOpenRequests
            className={cn("min-w-0 px-0.5 pt-1", !isHire && "hidden")}
            explorePath={explorePath}
          />
          <DiscoverHomeMyLiveHelpJobs
            mode="hire"
            exploreLiveHelpPath={`${explorePath}?mode=hire&tab=live_help`}
            createRequestPath={createRequestPath}
            className={cn("min-w-0 px-0.5 pt-3", !isHire && "hidden")}
          />
        </div>

        <DiscoverHomePostedHelpRequests
          enabled
          categoryFilter={categoryFilter}
          className={cn("px-1 pt-2 pb-1", isHire && "hidden")}
        />
        <DiscoverHomeMyLiveHelpJobs
          mode="work"
          exploreLiveHelpPath={`${explorePath}?mode=work&tab=live_help`}
          className={cn("min-w-0 px-0.5 pt-3", isHire && "hidden")}
        />

        <section className="mt-6 pb-0">
          <h2 className="mb-4 text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("discover.ourCommunityLive")}
          </h2>
          <ProfilePostsFeed {...discoverPostsFeedProps} />
        </section>
      </div>

      {/* My Requests Modal */}
      <Dialog open={myRequestsOpen} onOpenChange={setMyRequestsOpen}>
        <DialogContent
          aria-describedby={undefined}
          className={cn(
          "flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl",
          mobileTallBottomSheetDialogClass,
          mobileBottomSheetSlideAnimationClass,
          "md:max-h-[min(90vh,48rem)] md:max-w-4xl md:rounded-2xl"
        )}>
          <DialogHeader className="shrink-0 border-b border-border/30 bg-background/95 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black tracking-tight">Your requests</DialogTitle>
              <DialogClose className="rounded-full p-2 text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-6 w-6" strokeWidth={2.5} />
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-4">
            <ExploreMyPostedRequests variant="modal" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Work Requests Modal */}
      <Dialog open={pendingWorkRequestsOpen} onOpenChange={setPendingWorkRequestsOpen}>
        <DialogContent
          aria-describedby={undefined}
          className={cn(
          "flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl",
          mobileTallBottomSheetDialogClass,
          mobileBottomSheetSlideAnimationClass,
          "md:max-h-[min(90vh,48rem)] md:max-w-4xl md:rounded-2xl"
        )}>
          <DialogHeader className="shrink-0 border-b border-border/30 bg-background/95 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black tracking-tight">Pending responses</DialogTitle>
              <DialogClose className="rounded-full p-2 text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-6 w-6" strokeWidth={2.5} />
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-4">
            <ExplorePendingResponses variant="modal" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
