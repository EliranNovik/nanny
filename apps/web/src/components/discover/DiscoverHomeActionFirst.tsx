import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  CalendarDays,
  ChevronRight,
  Clock,
  Plus,
  Radio,
  Search,
  Users,
  UsersRound,
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
import type { DiscoverHomeCategoryFilter, DiscoverHomeListingSort } from "@/lib/discoverHomeCategoryFilter";
import { isOtherHelpSubcategoryId, EMPTY_LISTING_FILTERS } from "@/lib/discoverHomeCategoryFilter";
import type { DiscoverHomeListingFilters } from "@/lib/discoverHomeCategoryFilter";
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
import type { ViewerLocation } from "@/lib/globalFeedPostUi";
import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import { LiveTimer } from "@/components/LiveTimer";
import { ExplorePendingResponses } from "@/components/discover/ExplorePendingResponses";
import { DiscoverHomePostedHelpRequests } from "@/components/discover/DiscoverHomePostedHelpRequests";
import { DiscoverHomeMyLiveHelpJobs } from "@/components/discover/DiscoverHomeMyLiveHelpJobs";
import { UserSearch } from "@/components/UserSearch";
import { DiscoverHomeOffersForYou } from "@/components/discover/DiscoverHomeOffersForYou";
import { DiscoverHomeCategoryFilterRow } from "@/components/discover/DiscoverHomeCategoryFilterRow";
import { HomeListingSortButton } from "@/components/discover/HomeListingSortButton";
import {
  categoryIllustrationSrc,
  helpCategoryIdFromServiceDetails,
} from "@/lib/discoverCategoryTileIcons";

type HomeMode = "hire" | "work";

type Props = {
  homeMode: HomeMode;
  workPrimaryPath: string;
  createRequestPath: string;
};

/** Same stack + padding for both hire/work heroes; flex-1 + shared min-heights keeps both modes aligned in the desktop grid row. */
const heroInnerClassName =
  "relative flex min-h-[10rem] flex-1 flex-col sm:min-h-[11rem] md:min-h-[268px]";

const heroStackClassName =
  "relative z-10 flex min-h-0 flex-1 flex-col justify-end px-5 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-5 md:w-[min(62%,38rem)] md:px-10 md:pb-[6.5rem] md:pt-9";

const heroTopBlockClassName = "flex max-w-2xl flex-col gap-3.5 md:gap-4";

const heroTitleBlockClassName = "max-w-[min(100%,28rem)] space-y-2.5 pr-1 sm:max-w-[34rem] md:space-y-3";

const heroHeadlineClassName =
  "text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.025em] text-white text-balance sm:text-[2.35rem] md:text-[3rem] lg:text-[3.35rem]";

const heroSubClassName =
  "max-w-[28rem] text-[14px] font-normal leading-relaxed text-white/75 sm:text-[15px] md:text-[16px]";

/** Soft multi-stop fade so the photo melts into the solid color panel. */
function heroColorFadeStyle(
  tone: "hire" | "work",
  rtl: boolean,
): CSSProperties {
  const solid = tone === "hire" ? "rgb(194 65 12)" : "rgb(6 95 70)"; // orange-700 / emerald-800
  const dir = rtl ? "to left" : "to right";
  return {
    background: `linear-gradient(${dir},
      ${solid} 0%,
      ${solid} 36%,
      rgba(${tone === "hire" ? "194 65 12" : "6 95 70"} / 0.92) 48%,
      rgba(${tone === "hire" ? "194 65 12" : "6 95 70"} / 0.62) 60%,
      rgba(${tone === "hire" ? "194 65 12" : "6 95 70"} / 0.28) 74%,
      rgba(${tone === "hire" ? "194 65 12" : "6 95 70"} / 0.08) 86%,
      transparent 100%)`,
  };
}

export function DiscoverHomeActionFirst({
  homeMode,
  workPrimaryPath,
  createRequestPath,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const urlCategory = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("category");
    if (!raw || !isServiceCategoryId(raw)) return null;
    const sub = params.get("sub");
    return {
      category: raw as DiscoverHomeCategoryFilter,
      sub: raw === "other_help" && isOtherHelpSubcategoryId(sub) ? sub : null,
    };
  }, [location.search]);
  const [pickedCategory, setPickedCategory] = useState<{
    search: string;
    category: DiscoverHomeCategoryFilter;
    sub: string | null;
  } | null>(null);
  const categoryFilter =
    pickedCategory && pickedCategory.search === location.search
      ? pickedCategory.category
      : (urlCategory?.category ?? "all");
  const otherSubFilter =
    pickedCategory && pickedCategory.search === location.search
      ? pickedCategory.sub
      : (urlCategory?.sub ?? null);
  const [listingSort, setListingSort] = useState<DiscoverHomeListingSort>("newest");
  const [listingFilters, setListingFilters] = useState<DiscoverHomeListingFilters>(EMPTY_LISTING_FILTERS);
  const { user, profile } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { guardKycAction } = useKycGate();
  const isHire = homeMode === "hire";
  const showFullDiscoverLists = profile?.is_admin === true;
  const isRtl = i18n.dir() === "rtl";
  const { data: liveAvatarsPayload } = useDiscoverLiveAvatars(user?.id);
  const categoryAvatars = liveAvatarsPayload?.byCategory ?? {};
  const { data: frData } = useFreelancerRequests(user?.id);
  const [myOfferCategoryIds, setMyOfferCategoryIds] = useState<string[]>([]);

  const pendingSubRef = useRef<string | null | undefined>(undefined);

  const selectCategoryAndScroll = useCallback((id: DiscoverHomeCategoryFilter) => {
    const sub =
      id === "other_help"
        ? pendingSubRef.current !== undefined
          ? pendingSubRef.current
          : null
        : null;
    pendingSubRef.current = undefined;
    setPickedCategory({
      search: window.location.search,
      category: id,
      sub,
    });
    window.requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-discover-results]"),
      ).find((el) => el.offsetParent !== null);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const setOtherSubFilter = useCallback((sub: string | null) => {
    pendingSubRef.current = sub;
    setPickedCategory((prev) => ({
      search: window.location.search,
      category:
        prev && prev.search === window.location.search ? prev.category : "other_help",
      sub,
    }));
  }, []);

  useEffect(() => {
    if (!urlCategory) return;
    const scroll = window.setTimeout(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-discover-results]"),
      ).find((el) => el.offsetParent !== null);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(scroll);
  }, [urlCategory]);

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

  useDiscoverHomeOverlayLock(quickMoreOpen || pendingWorkRequestsOpen);

  useEffect(() => {
    if (!user?.id) {
      setMyOfferCategoryIds([]);
      return;
    }
    void supabase
      .from("profile_posts")
      .select("id, custom_category, post_metadata")
      .eq("author_id", user.id)
      .eq("post_type_id", "offer_service")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (error) return;
        const ids: string[] = [];
        for (const row of data ?? []) {
          const meta =
            row.post_metadata && typeof row.post_metadata === "object"
              ? (row.post_metadata as Record<string, unknown>)
              : null;
          const fromMeta =
            (typeof meta?.category === "string" && meta.category) ||
            (typeof meta?.service_type === "string" && meta.service_type) ||
            null;
          const custom =
            (typeof row.custom_category === "string" && row.custom_category.trim()) ||
            (typeof meta?.custom_category === "string" &&
              meta.custom_category.trim()) ||
            null;
          const id = (fromMeta || custom || "other_help").toLowerCase();
          if (!ids.includes(id)) ids.push(id);
          if (ids.length >= 3) break;
        }
        setMyOfferCategoryIds(ids);
      });
  }, [user?.id]);

  const myRequestThumbIds = useMemo(() => {
    const ids: string[] = [];
    for (const job of frData?.myOpenRequests ?? []) {
      const sub = helpCategoryIdFromServiceDetails(
        (job as { service_details?: Record<string, unknown> | null }).service_details,
      );
      const id = (
        sub ||
        (typeof job.service_type === "string" ? job.service_type : null) ||
        "other_help"
      ).toLowerCase();
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= 3) break;
    }
    return ids;
  }, [frData?.myOpenRequests]);

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

  const myRequestsAcceptedCount = useMemo(() => {
    return (frData?.myOpenRequests ?? []).reduce((sum, job) => {
      const n =
        typeof (job as { acceptedCount?: number }).acceptedCount === "number"
          ? (job as { acceptedCount: number }).acceptedCount
          : 0;
      return sum + n;
    }, 0);
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
      "ml-auto flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-[15px] font-black tabular-nums text-white bg-orange-500 shadow-md";

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
                    navigate("/my-requests");
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

  /** Get help mobile: Post request (orange +) and Find helpers (grey people). */
  function renderMobileHireActionButtons() {
    return (
      <div className="flex gap-2 px-2.5 pt-1.5 pb-1">
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_actions_post_request", {
              mode: homeMode,
              source: "mobile_hire_cta",
            });
            if (!user) {
              openGuestAuthPrompt({ variant: "create" });
              return;
            }
            writeDiscoverHomeIntent("hire");
            guardKycAction("start_request", () => {
              navigate(createRequestPath);
              recordFirstMeaningfulAction("home_primary_create_request");
            });
          }}
          className={cn(
            "flex h-12 flex-1 items-center justify-center rounded-xl",
            "bg-white text-orange-700 shadow-sm",
            "transition-colors hover:bg-orange-50 active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-600",
          )}
          aria-label={t("discover.postRequest")}
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          <span className="ms-2 text-sm font-semibold">Request help</span>
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_actions_browse_helpers", {
              mode: homeMode,
              source: "mobile_hire_cta",
            });
            navigateToHelpersBrowse(navigate);
          }}
          className={cn(
            "flex h-12 flex-1 items-center justify-center rounded-xl border border-zinc-200/80",
            "bg-white text-zinc-900 shadow-sm",
            "transition-colors hover:bg-zinc-50 active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          )}
          aria-label={t("nav.findHelpers")}
        >
          <Users className="h-5 w-5" strokeWidth={2} aria-hidden />
          <span className="ms-2 text-sm font-semibold">Find helpers</span>
        </button>
      </div>
    );
  }

  /** Help others mobile: Go live and Post offer. */
  function renderMobileWorkActionButtons() {
    return (
      <div className="flex gap-2 px-2.5 pt-1.5 pb-1">
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_actions_go_live", {
              mode: homeMode,
              source: "mobile_work_cta",
            });
            if (!user) {
              openGuestAuthPrompt({ variant: "create" });
              return;
            }
            writeDiscoverHomeIntent("work");
            guardKycAction("go_live", () => {
              navigate(workPrimaryPath);
              recordFirstMeaningfulAction("home_primary_work");
            });
          }}
          className={cn(
            "flex h-12 flex-1 items-center justify-center rounded-xl",
            "bg-white text-emerald-800 shadow-sm",
            "transition-colors hover:bg-emerald-50 active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700",
          )}
          aria-label={
            isInActive24hGoLiveWindow
              ? t("discoverHome.actions.live")
              : t("nav.goLive")
          }
        >
          <Radio className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          <span className="ms-2 text-sm font-semibold">Go live</span>
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_actions_post_offer", {
              mode: homeMode,
              source: "mobile_work_cta",
            });
            if (!user) {
              openGuestAuthPrompt({ variant: "create" });
              return;
            }
            guardKycAction("share_post", () => {
              navigate(`${GLOBAL_POSTS_PATH}?compose=1&postType=offer_service`);
            });
          }}
          className={cn(
            "flex h-12 flex-1 items-center justify-center rounded-xl border border-zinc-200/80",
            "bg-white text-zinc-900 shadow-sm",
            "transition-colors hover:bg-zinc-50 active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          )}
          aria-label="Post offer"
        >
          <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
          <span className="ms-2 text-sm font-semibold">Post offer</span>
        </button>
      </div>
    );
  }

  /** Desktop hero: three round icon badges + captions (no modal). */
  function renderDesktopWorkLiveBadge() {
    if (isHire) return null;
    if (!isInActive24hGoLiveWindow) return null;
    const liveUntil = freelancerLiveCountdownTarget(freelancerLiveMeta);
    return (
      <div className="pointer-events-none absolute right-6 top-6 z-[21] hidden md:block">
        <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/35 px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-white backdrop-blur-sm">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative block h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span>Live</span>
          {liveUntil ? (
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
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

  function renderDesktopHeroQuickActions() {
    const buttonBase =
      "flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[13.5px] font-semibold tracking-tight transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
    const primary =
      "border-transparent bg-white text-zinc-900 shadow-sm hover:bg-zinc-50";
    const secondary =
      "border-zinc-200/80 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50";
    if (isHire) {
      return (
        <div className="pointer-events-auto absolute bottom-5 start-6 z-[22] hidden w-[min(420px,46%)] grid-cols-2 gap-2.5 md:grid">
          <button
            type="button"
            onClick={() => {
              trackEvent("discover_hero_quick_post_request", { mode: "hire" });
              guardKycAction("start_request", () => navigate(createRequestPath));
            }}
            className={cn(buttonBase, primary, "text-orange-700")}
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} />
            {t("discoverHome.actions.postRequest")}
          </button>
          <button
            type="button"
            onClick={() => {
              trackEvent("discover_hero_quick_find_helpers", { mode: "hire" });
              navigate("/client/helpers");
            }}
            className={cn(buttonBase, secondary)}
          >
            <Search className="h-5 w-5 shrink-0" strokeWidth={2.25} />
            {t("discoverHome.actions.findHelpers")}
          </button>
        </div>
      );
    }

    return (
      <div className="pointer-events-auto absolute bottom-5 start-6 z-[22] hidden w-[min(420px,46%)] grid-cols-2 gap-2.5 md:grid">
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_hero_quick_go_live", { mode: "work" });
            guardKycAction("go_live", () => navigate(workPrimaryPath));
          }}
          className={cn(buttonBase, primary, "text-emerald-800")}
        >
          <Radio className="h-5 w-5 shrink-0" strokeWidth={2.25} />
          {isInActive24hGoLiveWindow
            ? t("discoverHome.actions.live")
            : t("discoverHome.actions.goLive")}
        </button>
        <button
          type="button"
          onClick={() => {
            trackEvent("discover_hero_quick_post_offer", { mode: "work" });
            guardKycAction("share_post", () =>
              navigate(`${GLOBAL_POSTS_PATH}?compose=1&postType=offer_service`),
            );
          }}
          className={cn(buttonBase, secondary)}
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} />
          Post offer
        </button>
      </div>
    );
  }

  function renderSummaryThumbStack(categoryIds: string[], emptyTone: "orange" | "emerald") {
    const ids = categoryIds.length > 0 ? categoryIds.slice(0, 3) : ["other_help"];
    return (
      <span className="relative flex h-9 w-[3.75rem] shrink-0 items-center" aria-hidden>
        {ids.map((id, index) => (
          <span
            key={`${id}-${index}`}
            className={cn(
              "absolute top-0 h-9 w-9 overflow-hidden rounded-lg ring-2 ring-white shadow-sm dark:ring-zinc-900",
              emptyTone === "orange" ? "bg-orange-100" : "bg-emerald-100",
            )}
            style={{
              left: `${index * 12}px`,
              zIndex: ids.length - index,
            }}
          >
            <img
              src={categoryIllustrationSrc(id)}
              alt=""
              className="h-full w-full object-cover object-center"
              loading="lazy"
              decoding="async"
            />
          </span>
        ))}
      </span>
    );
  }

  function renderMyContentSummaryCard(
    kind: "requests" | "offers",
    opts?: { showTitleInside?: boolean },
  ) {
    const isRequests = kind === "requests";
    const showTitleInside = opts?.showTitleInside ?? true;
    const acceptedBadge =
      isRequests && myRequestsAcceptedCount > 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
          )}
          aria-label={`${myRequestsAcceptedCount} accepted`}
        >
          <Users className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
          {myRequestsAcceptedCount}
        </span>
      ) : null;
    return (
      <button
        type="button"
        onClick={() =>
          navigate(isRequests ? "/my-requests" : "/my-offers")
        }
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 pe-3 text-left shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow-md",
          "dark:border-white/10 dark:bg-[#1d1f21]/95 dark:shadow-none",
          showTitleInside && "md:h-11 md:rounded-xl md:p-1 md:pe-3",
        )}
      >
        {renderSummaryThumbStack(
          isRequests ? myRequestThumbIds : myOfferCategoryIds,
          isRequests ? "orange" : "emerald",
        )}
        {showTitleInside ? (
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold tracking-tight text-foreground">
              {isRequests ? "My requests" : "My offers"}
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {acceptedBadge}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl-flip-icon" />
      </button>
    );
  }

  /** Desktop hero overlay: My requests / My offers, bottom-aligned with action buttons. */
  function renderHeroMyContentSummary() {
    return (
      <div
        className={cn(
          "pointer-events-auto absolute z-[24] hidden w-[min(18.5rem,38%)] flex-col justify-end gap-2 md:flex",
          "bottom-5 end-6",
        )}
      >
        <DiscoverHomeMyLiveHelpJobs mode={isHire ? "hire" : "work"} variant="hero" />
        {isHire
          ? renderMyContentSummaryCard("requests")
          : renderMyContentSummaryCard("offers")}
      </div>
    );
  }

  /** Mobile: section below hero — title on page background, box underneath. */
  function renderMobileMyContentSummary() {
    const kind = isHire ? "requests" : "offers";
    const title = isHire ? "My requests" : "My offers";
    const titleClass = isHire
      ? "text-orange-700 dark:text-orange-400"
      : "text-emerald-700 dark:text-emerald-400";
    return (
      <div className="px-4 pt-4">
        <h2
          className={cn(
            "mb-2.5 text-[22px] font-black tracking-tight",
            titleClass,
          )}
        >
          {title}
        </h2>
        {renderMyContentSummaryCard(kind, { showTitleInside: false })}
      </div>
    );
  }

  function renderExplorePromoBanner() {
    const promotesEvents = isHire;
    return (
      <button
        type="button"
        onClick={() => navigate(GLOBAL_POSTS_PATH)}
        className={cn(
          "group relative mt-4 flex min-h-[132px] w-full items-center overflow-hidden rounded-[24px] px-5 py-5 text-left text-white shadow-[0_10px_30px_rgba(15,23,42,0.16)] transition-transform hover:-translate-y-0.5 active:scale-[0.99] md:mr-auto md:max-w-[860px]",
          promotesEvents ? "bg-violet-700" : "bg-teal-800",
        )}
      >
        <img
          src={
            promotesEvents
              ? "/images/tebnu-events-banner.jpg"
              : "/images/tebnu-community-banner.jpg"
          }
          alt=""
          className="absolute inset-y-0 right-0 h-full w-[52%] object-cover object-center transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <span className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-transparent" />
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-[68%]",
            promotesEvents
              ? "bg-gradient-to-r from-violet-800 via-violet-700/95 to-violet-700/10"
              : "bg-gradient-to-r from-teal-900 via-teal-800/95 to-teal-800/10",
          )}
        />
        <span className="relative z-10 min-w-0 max-w-[58%] flex-1">
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
            {promotesEvents ? (
              <CalendarDays className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            ) : (
              <UsersRound className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            )}
          </span>
          <span className="block text-lg font-black leading-tight">
            {promotesEvents ? "Events happening near you" : "Discover your community"}
          </span>
          <span className="mt-1 block text-sm font-semibold text-white/85">
            {promotesEvents
              ? "Meet people and join something new"
              : "See stories and posts from people nearby"}
          </span>
        </span>
        <ChevronRight className="absolute bottom-4 right-4 z-10 h-6 w-6 transition-transform group-hover:translate-x-1 rtl-flip-icon" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-3 md:gap-5",
      )}
    >
      {renderQuickActionDockMobile()}
      <div className={cn("flex flex-1 md:hidden flex-col gap-0", "pb-24")}>
        <section className="relative mx-1.5 mt-1 h-[260px] overflow-hidden rounded-2xl bg-zinc-900 shadow-sm ring-1 ring-black/5">
          <img
            src={
              isHire
                ? DISCOVER_PRIMARY_HERO_IMAGES.hire
                : DISCOVER_PRIMARY_HERO_IMAGES.work
            }
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            decoding="async"
            {...{ fetchpriority: "high" }}
          />
          <div className="absolute inset-0 z-[5] bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-3 z-10 flex flex-col gap-2.5">
            <div className="px-4">
              <h1 className="max-w-[15.5rem] text-[1.55rem] font-semibold leading-[1.15] tracking-[-0.02em] text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
                {isHire
                  ? "A little help, nearby"
                  : "Someone nearby needs your help"}
              </h1>
            </div>
            {isHire
              ? renderMobileHireActionButtons()
              : renderMobileWorkActionButtons()}
          </div>
        </section>
        {renderMobileMyContentSummary()}

        {isHire ? (
          <div className="flex flex-col px-0 pb-6">
            <div className="w-full px-4 pt-4 pb-1">
              <DiscoverHomeMyLiveHelpJobs mode="hire" />
            </div>
            <DiscoverHomeCategoryFilterRow
              variant="hire"
              layout="pills"
              selected={categoryFilter}
              onSelect={selectCategoryAndScroll}
              otherSubFilter={otherSubFilter}
              onOtherSubFilterChange={setOtherSubFilter}
              className="px-4 pt-3 pb-3"
            />
            <div data-discover-results="" className="w-full scroll-mt-24 px-4 pt-1 pb-2">
              <DiscoverHomeOffersForYou
                categoryFilter={categoryFilter}
                otherSubFilter={otherSubFilter}
                viewerLocation={viewerLocation}
                listingSort={listingSort}
                onListingSortChange={setListingSort}
                listingFilters={listingFilters}
                onListingFiltersChange={setListingFilters}
              />
              {renderExplorePromoBanner()}
            </div>
          </div>
        ) : (
          <>
            <div className="w-full px-4 pt-3 pb-1">
              <DiscoverHomeMyLiveHelpJobs mode="work" />
            </div>
            <DiscoverHomeCategoryFilterRow
              variant="work"
              selected={categoryFilter}
              onSelect={selectCategoryAndScroll}
              otherSubFilter={otherSubFilter}
              onOtherSubFilterChange={setOtherSubFilter}
              className="px-4 pt-3 pb-5"
            />
            <div data-discover-results="" className="scroll-mt-24">
              <DiscoverHomePostedHelpRequests
                enabled
                categoryFilter={categoryFilter}
                otherSubFilter={otherSubFilter}
                viewerLocation={viewerLocation}
                listingSort={listingSort}
                onListingSortChange={setListingSort}
                listingFilters={listingFilters}
                onListingFiltersChange={setListingFilters}
                className="w-full px-4 pt-3 pb-2"
              />
            </div>
            <div className="px-4">{renderExplorePromoBanner()}</div>
          </>
        )}
      </div>

      {/* ===== DESKTOP ONLY LAYOUT ===== */}
      <div
        className={cn(
          "hidden md:flex flex-col gap-5",
          showFullDiscoverLists
            ? "overflow-visible"
            : "min-h-0 flex-1 overflow-hidden",
        )}
      >
        <div className="flex w-full shrink-0 flex-col gap-4 md:gap-5 lg:gap-6">
          <div className={cn("flex min-h-0 min-w-0 flex-col gap-4 md:h-full", !isHire && "hidden")}>
            <section
              className={cn(
                "relative mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-2xl text-left shadow-sm ring-1 ring-black/5 md:mx-0 md:max-w-none group md:min-h-0",
                "bg-orange-700 transition-all duration-500",
              )}
            >
              {renderDesktopHeroQuickActions()}
              <div className={cn(heroInnerClassName, "min-h-0 md:h-full")}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.hire}
                  alt=""
                  className="pointer-events-none absolute inset-y-0 end-0 h-full w-[58%] object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div
                  className="absolute inset-y-0 start-0 z-[5] w-[70%]"
                  style={heroColorFadeStyle("hire", isRtl)}
                />

                <div className={heroStackClassName}>
                  <div
                    className={cn(
                      heroTopBlockClassName,
                      isRtl && "ml-auto items-end text-right",
                    )}
                  >
                    <div className="min-w-0">
                      <div className={cn(heroTitleBlockClassName, "pr-0")}>
                        <h2 className={heroHeadlineClassName}>
                          A little help, nearby
                        </h2>
                        <p className={heroSubClassName}>
                          {t("discoverHome.heroHire.sub")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {renderHeroMyContentSummary()}
              </div>
            </section>
          </div>
          
          <section
            className={cn(
              "relative mx-auto flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-2xl text-left shadow-sm ring-1 ring-black/5 md:mx-0 md:max-w-none group md:h-full md:min-h-0",
              "bg-emerald-800 transition-all duration-500",
              isHire && "hidden"
            )}
          >
              {renderDesktopWorkLiveBadge()}
              {renderDesktopHeroQuickActions()}
              <div className={cn(heroInnerClassName, "min-h-0 md:h-full")}>
                <img
                  src={DISCOVER_PRIMARY_HERO_IMAGES.work}
                  alt=""
                  className="pointer-events-none absolute inset-y-0 end-0 h-full w-[58%] object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                  decoding="async"
                  {...{ fetchpriority: "high" }}
                />
                <div
                  className="absolute inset-y-0 start-0 z-[5] w-[70%]"
                  style={heroColorFadeStyle("work", isRtl)}
                />

                <div className={heroStackClassName}>
                  <div
                    className={cn(
                      heroTopBlockClassName,
                      isRtl && "ml-auto items-end text-right",
                    )}
                  >
                    <div className="min-w-0">
                      <div className={cn(heroTitleBlockClassName, "pr-0")}>
                        <h2 className={heroHeadlineClassName}>
                          Someone nearby needs your help
                        </h2>
                        <p className={heroSubClassName}>
                          {t("discoverHome.heroWork.sub")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {renderHeroMyContentSummary()}
              </div>
            </section>
        </div>

        <div
          className={cn(
            "flex w-full flex-col gap-2 pt-2",
            showFullDiscoverLists ? "overflow-visible" : "min-h-0 overflow-hidden",
          )}
        >
          <div className={cn("min-w-0 px-0.5 pt-3", !isHire && "hidden")}>
            <DiscoverHomeCategoryFilterRow
              variant="hire"
              layout="pills"
              selected={categoryFilter}
              onSelect={selectCategoryAndScroll}
              otherSubFilter={otherSubFilter}
              onOtherSubFilterChange={setOtherSubFilter}
              className="pb-3"
              afterMore={
                <UserSearch
                  size="lg"
                  placeholder="Search offers, events, or people…"
                  className="relative z-[30] mx-0 w-full max-w-none"
                  endSlot={
                    <HomeListingSortButton
                      value={listingSort}
                      onChange={setListingSort}
                      filters={listingFilters}
                      onFiltersChange={setListingFilters}
                      tone="orange"
                    />
                  }
                />
              }
            />
            <div data-discover-results="" className="scroll-mt-24">
              <DiscoverHomeOffersForYou
                categoryFilter={categoryFilter}
                otherSubFilter={otherSubFilter}
                viewerLocation={viewerLocation}
                listingSort={listingSort}
                onListingSortChange={setListingSort}
                listingFilters={listingFilters}
                onListingFiltersChange={setListingFilters}
                showSortButton={false}
              />
            </div>
            {renderExplorePromoBanner()}
          </div>
        </div>

        <div className={cn("min-w-0 px-0.5 pt-2", isHire && "hidden")}>
          <DiscoverHomeCategoryFilterRow
            variant="work"
            selected={categoryFilter}
            onSelect={selectCategoryAndScroll}
            otherSubFilter={otherSubFilter}
            onOtherSubFilterChange={setOtherSubFilter}
            className="pb-3"
          />
        </div>
        <div data-discover-results="" className={cn("scroll-mt-24", isHire && "hidden")}>
          <DiscoverHomePostedHelpRequests
            enabled
            categoryFilter={categoryFilter}
            otherSubFilter={otherSubFilter}
            viewerLocation={viewerLocation}
            listingSort={listingSort}
            onListingSortChange={setListingSort}
            listingFilters={listingFilters}
            onListingFiltersChange={setListingFilters}
            className="px-1 pt-2 pb-1"
          />
        </div>
        {!isHire ? <div className="px-1">{renderExplorePromoBanner()}</div> : null}
      </div>

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
