import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { useScheduleChanges } from "@/hooks/useScheduleChanges";
import {
  badgeCountForJobsTab,
  useJobsTabCounts,
} from "@/hooks/useJobsTabCounts";
import {
  HeartHandshake,
  HelpingHand,
  Home,
  MessageCircle,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Pencil,
  Search,
  Plus,
  X,
  ClipboardList,
  Zap,
  UsersRound,
  Radio,
  PenSquare,
  AlertCircle,
  Rss,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsModal } from "@/components/NotificationsModal";
import { LiveTimer } from "@/components/LiveTimer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserSearch } from "./UserSearch";
import { MobileSmartSearchOverlay } from "./MobileSmartSearchOverlay";
import {
  FREELANCER_JOBS_TABS,
  CLIENT_JOBS_TABS,
} from "@/components/jobs/jobsTabConfig";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { CommunityPostsCategoryNativeSelect } from "@/components/community/CommunityPostsCategoryNativeSelect";
import { ALL_HELP_CATEGORY_ID } from "@/lib/serviceCategories";
import { useReportIssue } from "@/context/ReportIssueContext";
import {
  BottomNavHomeIcon,
} from "@/components/nav/BottomNavTabGlyphs";
import { supabase } from "@/lib/supabase";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import { DiscoverHomeMobileHeaderRight } from "@/components/discover/DiscoverHomeMobileHeaderRight";
import { DiscoverHomeModeSegmentedControl } from "@/components/discover/DiscoverHomeModeSegmentedControl";
import {
  readDiscoverHomeIntent,
  subscribeDiscoverHomeIntent,
  writeDiscoverHomeIntent,
} from "@/lib/discoverHomeIntent";
import { subscribeMatchSearchChromeVisible } from "@/lib/matchSearchHeaderState";
import { subscribeDiscoverHomeOverlay } from "@/lib/discoverHomeOverlayState";
import { subscribeCommunityFeedOverlay } from "@/lib/communityFeedOverlayState";
import {
  signedInAppHeaderBgClass,
  signedInHeaderIconBtnClass,
  signedInHeaderLocationBtnClass,
} from "@/lib/discoverHomeHeaderChrome";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { LocationPickerSheet } from "@/components/LocationPickerSheet";

/** Bottom tabs: active = solid fill, inactive = outline stroke (Lucide paths support both). */
function bottomNavTabIconClass(isActive: boolean) {
  return cn(
    "bottom-nav-mobile-tab-glyph h-9 w-9 shrink-0 md:h-8 md:w-8",
    isActive && "bottom-nav-mobile-tab-glyph-active",
    isActive
      ? "fill-current stroke-none md:text-zinc-950 dark:md:text-white"
      : "fill-none stroke-[2.75] md:text-zinc-950/85 dark:md:text-white md:group-hover:text-zinc-950 dark:md:group-hover:text-white",
  );
}

/** Home + feed tabs: always use the filled active icon style. */
const bottomNavHomeFeedIconClass = cn(
  "bottom-nav-mobile-tab-glyph bottom-nav-mobile-tab-glyph-active relative z-[1] h-9 w-9 shrink-0",
  "fill-current stroke-none text-zinc-950 dark:text-white md:text-zinc-950 dark:md:text-white",
);

/** Floating frosted pill — mobile only; desktop keeps full-width bar. */
const mobileNavPortalClass =
  "fixed bottom-[var(--app-nav-bottom-inset,max(0.5rem,env(safe-area-inset-bottom,0px)))] left-0 right-0 z-[125] pointer-events-none overflow-visible px-4 md:hidden";

const mobileNavShellClass = cn(
  "bottom-nav-mobile-shell pointer-events-auto mx-auto",
  "md:max-w-md md:rounded-2xl",
);

const mobileNavItemsRowClass = cn(
  "bottom-nav-mobile-items-row flex w-full items-center justify-evenly gap-0 overflow-visible px-0 py-0",
  "md:mx-0 md:w-full md:max-w-none md:justify-between md:px-6 md:py-2 md:pb-2 lg:px-8 xl:px-12",
);

const mobileNavGlowLayer = (
  <div className="bottom-nav-mobile-glow" aria-hidden />
);

const mobileNavReadableLayer = (
  <div className="bottom-nav-mobile-readable-layer" aria-hidden />
);

const mobileTabTouchClass =
  "relative flex h-14 w-14 shrink-0 items-center justify-center md:h-[48px] md:w-[48px]";

const mobileTabLinkClass =
  "group relative flex min-w-0 flex-1 flex-col items-center justify-center px-0 py-0 transition-colors duration-150";

const mobileTabActiveGlassClass =
  "bottom-nav-tab-active-glass pointer-events-none absolute md:hidden";

const plusButtonClassName = cn(
  mobileTabTouchClass,
  "bottom-nav-plus-button text-zinc-950 transition-opacity hover:opacity-80 active:scale-95 dark:text-white",
  "outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/30",
);

function MobileTabItem({
  active,
  label,
  children,
  iconClassName,
  showActiveBadge = true,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
  iconClassName?: string;
  showActiveBadge?: boolean;
}) {
  return (
    <>
      {active && showActiveBadge ? (
        <span className={mobileTabActiveGlassClass} aria-hidden />
      ) : null}
      <div className="bottom-nav-mobile-tab-inner relative z-[2] flex w-full flex-col items-center justify-center px-0 py-0 transition-[padding] md:py-0">
        <div
          className={cn(
            "bottom-nav-mobile-icon-slot relative flex h-11 w-full shrink-0 items-center justify-center overflow-visible md:h-8",
            iconClassName,
          )}
        >
          {children}
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </>
  );
}

/** App menu — job tab counts: dark frosted glass (light) / light frosted glass (dark). */
const appMenuJobsCountBadgeClassName = cn(
  "shrink-0 min-w-[1.75rem] justify-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums",
  "border-white/20 bg-black/50 text-white shadow-sm backdrop-blur-md ring-1 ring-inset ring-white/10",
  "dark:border-white/35 dark:bg-white/35 dark:text-zinc-950 dark:shadow-md dark:backdrop-blur-md dark:ring-white/25",
);

const plusMenuPanelClassName = cn(
  "bottom-nav-plus-menu-panel pointer-events-auto fixed bottom-[var(--app-plus-menu-bottom,calc(5.25rem+max(0.5rem,env(safe-area-inset-bottom,0px))))] left-1/2 z-[150] -translate-x-1/2",
  "w-[min(18.5rem,calc(100vw-2rem))] rounded-[1.375rem] outline-none",
  "shadow-[0_18px_44px_hsl(0_0%_0%_/0.16)] dark:shadow-[0_22px_52px_hsl(0_0%_0%_/0.52)]",
  "animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-200",
  "md:bottom-[68px] md:w-[17rem]",
);

const plusMenuItemsClassName = "relative z-[2] flex flex-col gap-0.5 p-1.5";

const plusMenuItemClassName = cn(
  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
  "text-[15px] font-medium leading-snug tracking-tight text-zinc-800",
  "transition-[background,transform,color] duration-150",
  "hover:bg-zinc-900/[0.05] active:scale-[0.985] active:bg-zinc-900/[0.08]",
  "dark:text-zinc-100 dark:hover:bg-white/[0.07] dark:active:bg-white/[0.1]",
  "md:px-3.5 md:py-2.5 md:text-[14px]",
);

const plusMenuIconWrapClassName = cn(
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
  "bg-zinc-900/[0.06] shadow-[inset_0_1px_0_hsl(0_0%_100%_/0.35)]",
  "dark:bg-white/[0.1] dark:shadow-[inset_0_1px_0_hsl(0_0%_100%_/0.08)]",
);

const plusMenuIconClassName = "h-[1.125rem] w-[1.125rem] text-zinc-600 dark:text-zinc-300";

export function BottomNav() {
  const { profile, loading, user, signOut } = useAuth();
  const { guardKycAction } = useKycGate();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobsSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { activityInboxCount, unreadMessages } = useUnreadCounts();
  const { scheduleChanges } = useScheduleChanges();
  const jobsTabCounts = useJobsTabCounts(user);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [desktopAppMenuOpen, setDesktopAppMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopDiscoverSearchOpen, setDesktopDiscoverSearchOpen] =
    useState(false);
  const [appMenuHelpOthersOpen, setAppMenuHelpOthersOpen] = useState(false);
  const [appMenuNeedHelpOpen, setAppMenuNeedHelpOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuPanelRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const { openReportModal } = useReportIssue();
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const activeLocation = useActiveLocation();
  const previousPathnameRef = useRef(location.pathname);
  const viewerId = profile?.id ?? null;
  const [freelancerLiveUntil, setFreelancerLiveUntil] = useState<string | null>(
    null,
  );
  const profilePath =
    profile?.role === "freelancer"
      ? "/freelancer/profile"
      : profile?.role === "client"
        ? "/client/profile"
        : "/dashboard";

  const pathnameNorm = location.pathname.replace(/\/$/, "") || "/";
  const isDiscoverHome =
    pathnameNorm === "/client/home" || pathnameNorm === "/freelancer/home";
  const isCommunityFeedPage = pathnameNorm === "/community/feed";
  const publicProfileRouteMatch = pathnameNorm.match(/^\/profile\/([^/]+)$/);
  const viewedPublicProfileUserId = publicProfileRouteMatch?.[1] ?? null;
  const isOwnPublicProfilePage =
    !!viewerId && viewedPublicProfileUserId === viewerId;
  /** Location chip shell — Discover home only. */
  const showDiscoverShellHeader = isDiscoverHome;
  /** Global community feed: back + location on the left. */
  const showCommunityFeedHeaderLeft = isCommunityFeedPage && !!user;
  const [discoverHomeMode, setDiscoverHomeMode] = useState<
    "hire" | "work"
  >(() => readDiscoverHomeIntent("hire"));
  /** Discover home: location + CTAs stay fixed — no scroll-hide chrome. */
  const discoverHomeFixedChrome = isDiscoverHome;

  const [matchSearchChromeVisible, setMatchSearchChromeVisibleState] =
    useState(true);
  const [discoverHomeOverlayOpen, setDiscoverHomeOverlayOpen] = useState(false);
  const [communityFeedOverlayOpen, setCommunityFeedOverlayOpen] = useState(false);
  const receiveRequestsOn = profile?.is_available_for_jobs === true;
  const showFreelancerJobNav =
    profile?.role === "freelancer" ||
    (profile?.role === "client" && receiveRequestsOn);
  const isProfileHub =
    pathnameNorm === "/client/profile" ||
    pathnameNorm === "/freelancer/profile";
  const isProfileSubpage = /^\/(client|freelancer)\/profile\/.+/.test(
    pathnameNorm,
  );
  const profileBackTarget = isProfileHub
    ? pathnameNorm.startsWith("/freelancer")
      ? "/freelancer/home"
      : "/client/home"
    : isProfileSubpage
      ? pathnameNorm.startsWith("/freelancer")
        ? "/freelancer/profile"
        : "/client/profile"
      : null;
  const showProfileBack = profileBackTarget !== null;
  const isHelpersFindPage = pathnameNorm === "/client/helpers";
  const isFreelancerJobsMatch = pathnameNorm === "/freelancer/jobs/match";
  /** Find helpers / job match: mobile header on search screen only (cards view hides it). */
  const isMatchSearchRoute = isHelpersFindPage || isFreelancerJobsMatch;
  /** Create job + post availability: own hero — hide floating mobile header row */
  const hideMobileAppHeaderChrome =
    pathnameNorm === "/client/create" ||
    pathnameNorm === "/availability/post-now" ||
    (isMatchSearchRoute && !matchSearchChromeVisible);
  /** Own availability, legacy /posts, and public board — category + back live in header */
  const isCommunityPostsFilterPage =
    pathnameNorm === "/availability" ||
    pathnameNorm === "/availability/post-now" ||
    pathnameNorm === "/posts" ||
    pathnameNorm === "/public/posts";
  /** Public board uses on-page category tabs — hide header dropdown */
  const isPublicPostsPage = pathnameNorm === "/public/posts";
  /** Availability + post-now: no category pill in header (category is chosen on-page). */
  const isAvailabilityHeaderPage =
    pathnameNorm === "/availability" ||
    pathnameNorm === "/availability/post-now";
  const showCommunityHeaderCategoryDropdown =
    isCommunityPostsFilterPage &&
    !isPublicPostsPage &&
    !isAvailabilityHeaderPage;
  const communityCategoryParam = jobsSearchParams.get("category");
  const communityHomeFallback =
    profile?.role === "freelancer"
      ? "/freelancer/home"
      : profile?.role === "client"
        ? "/client/home"
        : "/";
  const handleCommunityBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(communityHomeFallback);
    }
  };

  const headerBackHomeFallback =
    profile?.role === "freelancer"
      ? "/freelancer/home"
      : profile?.role === "client"
        ? "/client/home"
        : "/";

  /** Back on profile routes uses explicit targets; community uses history + fallback; elsewhere history or home. */
  const handleHeaderBack = () => {
    if (showProfileBack && profileBackTarget) {
      navigate(profileBackTarget);
      return;
    }
    if (isCommunityPostsFilterPage) {
      handleCommunityBack();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(headerBackHomeFallback);
  };

  useEffect(() => {
    if (previousPathnameRef.current !== location.pathname) {
      setPlusMenuOpen(false);
      previousPathnameRef.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    return subscribeDiscoverHomeIntent(setDiscoverHomeMode);
  }, []);

  useEffect(() => {
    if (isDiscoverHome) {
      setDiscoverHomeMode(readDiscoverHomeIntent(profile?.role === "freelancer" ? "work" : "hire"));
    } else {
      setDesktopDiscoverSearchOpen(false);
    }
  }, [isDiscoverHome, profile?.role]);

  useEffect(() => {
    if (!isMatchSearchRoute) {
      setMatchSearchChromeVisibleState(true);
      return;
    }
    return subscribeMatchSearchChromeVisible(setMatchSearchChromeVisibleState);
  }, [isMatchSearchRoute]);

  useEffect(() => {
    return subscribeDiscoverHomeOverlay(setDiscoverHomeOverlayOpen);
  }, []);

  useEffect(() => {
    return subscribeCommunityFeedOverlay(setCommunityFeedOverlayOpen);
  }, []);

  const hideMobileBottomNav =
    (isDiscoverHome &&
      (discoverHomeOverlayOpen ||
        mobileSearchOpen ||
        locationPickerOpen)) ||
    (isCommunityFeedPage && communityFeedOverlayOpen);

  useEffect(() => {
    if (!plusMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (plusButtonRef.current?.contains(target)) return;
      if (plusMenuRef.current?.contains(target)) return;
      if (plusMenuPanelRef.current?.contains(target)) return;
      setPlusMenuOpen(false);
    }
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [plusMenuOpen]);

  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .select("live_until")
        .eq("user_id", viewerId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[BottomNav] live_until:", error);
        setFreelancerLiveUntil(null);
        return;
      }
      setFreelancerLiveUntil(data?.live_until ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  const isLiveNow =
    profile?.role === "freelancer" &&
    isFreelancerInActive24hLiveWindow({ live_until: freelancerLiveUntil });



  function renderDiscoverHomeLocationChip(
    variant: "mobile" | "desktop",
    options?: { besideBack?: boolean },
  ) {
    const { displayCity, displayCountry, gpsLoading } = activeLocation;
    const primary = displayCity ?? (gpsLoading ? "Detecting…" : "Add location");
    return (
      <>
        <button
          type="button"
          onClick={() => setLocationPickerOpen(true)}
          className={cn(
            signedInHeaderLocationBtnClass,
            variant === "mobile"
              ? cn(
                  options?.besideBack
                    ? "max-w-[min(10.5rem,calc(100vw-8.5rem))]"
                    : "max-w-[min(10.5rem,calc(100vw-9.5rem))]",
                )
              : cn(
                  options?.besideBack
                    ? "max-w-[min(13rem,calc(100vw-14rem))]"
                    : "max-w-[min(16rem,28vw)]",
                ),
          )}
          aria-label={displayCity ? `Current location: ${displayCity}. Tap to change.` : "Set your location"}
        >
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-slate-900 dark:text-white sm:text-base">
            {primary}
            {displayCountry ? `, ${displayCountry}` : null}
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400"
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        <LocationPickerSheet
          open={locationPickerOpen}
          onOpenChange={setLocationPickerOpen}
          location={activeLocation}
        />
      </>
    );
  }

  useEffect(() => {
    if (previousPathnameRef.current !== location.pathname) {
      if (mobileSearchOpen) setMobileSearchOpen(false);
      setDesktopDiscoverSearchOpen(false);
    }
    previousPathnameRef.current = location.pathname;
  }, [location.pathname, mobileSearchOpen]);

  // Nothing on landing, marketing pages, chat, or messages
  const path = location.pathname;
  if (
    path === "/" ||
    path === "/about" ||
    path === "/contact" ||
    path === "/login" ||
    path === "/onboarding" ||
    path.startsWith("/onboarding/") ||
    path.startsWith("/chat/") ||
    path.startsWith("/messages")
  ) {
    return null;
  }

  /** Bell: same pipeline as News & Activity modal + schedule ping counts (not in modal). */
  const notificationBadgeCount = scheduleChanges + activityInboxCount;

  const searchHelpersPath =
    profile?.role === "client" ? "/client/helpers" : "/public/posts";
  const appMenuUserLabel =
    profile?.full_name?.trim() || user?.email?.trim() || "Signed in";

  const DesktopAppMenuModal = user ? (
    <Dialog open={desktopAppMenuOpen} onOpenChange={setDesktopAppMenuOpen}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-xl md:border md:border-border/40",
          "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
          /** Desktop: compact panel under header, aligned with hamburger (top-right) */
          "left-auto right-4 top-16 w-[min(22rem,calc(100vw-2rem))] max-w-sm translate-x-0 translate-y-0",
          "md:max-h-[min(88vh,32rem)]",
          /** Mobile: full-screen sheet */
          "max-md:inset-0 max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-full max-md:max-w-none",
          "max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:shadow-none",
          "max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100",
        )}
      >
        <DialogTitle className="sr-only">App menu</DialogTitle>
        <div
          className={cn(
            "shrink-0 border-b border-border/30 bg-background px-4 pb-3",
            "pt-4 max-md:pt-[max(0.75rem,var(--app-safe-top,env(safe-area-inset-top,0px)))]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
              <p className="text-lg font-semibold tracking-tight text-foreground md:text-[15px]">
                Quick navigation
              </p>
              <Button
                type="button"
                className={cn(
                  "shrink-0 gap-1.5 rounded-xl border-0 px-3 py-1.5 text-sm font-semibold text-white shadow-md",
                  "bg-gradient-to-r from-orange-500 to-red-600",
                  "hover:from-orange-600 hover:to-red-700 active:scale-[0.98]",
                  "focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "md:gap-2 md:py-2 md:text-sm",
                )}
                onClick={() => {
                  openReportModal();
                  setDesktopAppMenuOpen(false);
                }}
              >
                <AlertCircle
                  className="h-4 w-4 shrink-0 text-white md:h-4 md:w-4"
                  aria-hidden
                />
                Report
              </Button>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground md:h-9 md:w-9",
                  "transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                aria-label="Close menu"
              >
                <X
                  className="h-6 w-6 md:h-5 md:w-5"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>
            </DialogClose>
          </div>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-2")}>
          <div className="flex flex-col">
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3.5 text-left text-base font-medium text-foreground transition-colors hover:bg-muted/40 active:bg-muted/55 md:py-3 md:text-sm"
              onClick={() => {
                navigate(searchHelpersPath);
                setDesktopAppMenuOpen(false);
              }}
            >
              <Search
                className="h-6 w-6 shrink-0 text-orange-600 dark:text-orange-400 md:h-5 md:w-5"
                strokeWidth={2}
                aria-hidden
              />
              <span>Search for helpers</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3.5 text-left text-base font-medium text-foreground transition-colors hover:bg-muted/40 active:bg-muted/55 md:py-3 md:text-sm"
              onClick={() => {
                guardKycAction("go_live", () => {
                  navigate("/availability/post-now");
                  setDesktopAppMenuOpen(false);
                });
              }}
            >
              <UsersRound
                className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400 md:h-5 md:w-5"
                strokeWidth={2}
                aria-hidden
              />
              <span>Post live availability</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3.5 text-left text-base font-medium text-foreground transition-colors hover:bg-muted/40 active:bg-muted/55 md:py-3 md:text-sm"
              onClick={() => {
                guardKycAction("start_request", () => {
                  navigate("/client/create");
                  setDesktopAppMenuOpen(false);
                });
              }}
            >
              <ClipboardList
                className="h-6 w-6 shrink-0 text-orange-600 dark:text-orange-400 md:h-5 md:w-5"
                strokeWidth={2}
                aria-hidden
              />
              <span>Post a request for help</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3.5 text-left text-base font-medium text-foreground transition-colors hover:bg-muted/40 active:bg-muted/55 md:py-3 md:text-sm"
              onClick={() => {
                navigate(
                  `/public/posts?category=${encodeURIComponent(ALL_HELP_CATEGORY_ID)}`,
                );
                setDesktopAppMenuOpen(false);
              }}
            >
              <Radio
                className="h-6 w-6 shrink-0 text-orange-600 dark:text-orange-400 md:h-5 md:w-5"
                strokeWidth={2}
                aria-hidden
              />
              <span>Check out live posts</span>
            </button>
          </div>

          <p className="mb-1 mt-3 border-t border-border/30 pt-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground md:text-[11px]">
            Live activities
          </p>
          <div className="flex flex-col">
            {showFreelancerJobNav && (
              <div className="flex flex-col border-b border-border/30 pb-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/55 md:py-3"
                  aria-expanded={appMenuHelpOthersOpen}
                  onClick={() => setAppMenuHelpOthersOpen((v) => !v)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <HelpingHand
                      className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400 md:h-5 md:w-5"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="text-base font-medium text-foreground md:text-sm">
                      Help others
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 md:h-4 md:w-4",
                      appMenuHelpOthersOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {appMenuHelpOthersOpen ? (
                  <div className="flex flex-col border-t border-border/25 pl-2">
                    {FREELANCER_JOBS_TABS.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={`f-${tab.id}`}
                          type="button"
                          className="flex w-full items-center justify-between gap-2 py-3 pl-6 pr-1 text-left text-base font-normal text-foreground transition-colors hover:bg-muted/35 md:py-2.5 md:text-sm"
                          onClick={() => {
                            navigate(buildJobsUrl("freelancer", tab.id));
                            setDesktopAppMenuOpen(false);
                          }}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Icon
                              className="h-5 w-5 shrink-0 text-muted-foreground md:h-[1.125rem] md:w-[1.125rem]"
                              aria-hidden
                            />
                            <span className="truncate">{tab.label}</span>
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              appMenuJobsCountBadgeClassName,
                              "text-sm md:text-xs",
                            )}
                          >
                            {badgeCountForJobsTab(
                              tab.id,
                              "freelancer",
                              jobsTabCounts,
                            )}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-col pt-1">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/55 md:py-3"
                aria-expanded={appMenuNeedHelpOpen}
                onClick={() => setAppMenuNeedHelpOpen((v) => !v)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <HeartHandshake
                    className="h-6 w-6 shrink-0 text-orange-600 dark:text-orange-400 md:h-5 md:w-5"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-base font-medium text-foreground md:text-sm">
                    I need help
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 md:h-4 md:w-4",
                    appMenuNeedHelpOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {appMenuNeedHelpOpen ? (
                <div className="flex flex-col border-t border-border/25 pl-2">
                  {CLIENT_JOBS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={`c-${tab.id}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 py-3 pl-6 pr-1 text-left text-base font-normal text-foreground transition-colors hover:bg-muted/35 md:py-2.5 md:text-sm"
                        onClick={() => {
                          navigate(buildJobsUrl("client", tab.id));
                          setDesktopAppMenuOpen(false);
                        }}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Icon
                            className="h-5 w-5 shrink-0 text-muted-foreground md:h-[1.125rem] md:w-[1.125rem]"
                            aria-hidden
                          />
                          <span className="truncate">{tab.label}</span>
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            appMenuJobsCountBadgeClassName,
                            "text-sm md:text-xs",
                          )}
                        >
                          {badgeCountForJobsTab(
                            tab.id,
                            "client",
                            jobsTabCounts,
                          )}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-t border-border/30 bg-background px-4 pt-3",
            "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
          )}
        >
          <button
            type="button"
            onClick={() => {
              navigate(profilePath);
              setDesktopAppMenuOpen(false);
            }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition-colors hover:bg-muted/40 active:bg-muted/55"
            aria-label="Open profile"
          >
            <Avatar className="h-11 w-11 shrink-0 border border-black/5 shadow-sm dark:border-white/10 md:h-10 md:w-10">
              <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
              <AvatarFallback className="text-sm font-bold bg-slate-100 dark:bg-zinc-800 md:text-xs">
                {(profile?.full_name ?? user?.email ?? "U")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate text-base font-semibold text-foreground md:text-sm">
              {appMenuUserLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={async () => {
              console.log("[BottomNav] Desktop Log out clicked");
              await signOut();
              setDesktopAppMenuOpen(false);
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-destructive transition-colors",
              "hover:bg-destructive/10 active:bg-destructive/15",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label="Log out"
          >
            <LogOut
              className="h-6 w-6 shrink-0 md:h-5 md:w-5"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-base font-semibold md:text-sm">Log out</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  const OwnPublicProfileHeaderMenu = (
    <button
      type="button"
      onClick={() => navigate(profilePath)}
      className={signedInHeaderIconBtnClass}
      aria-label={t("common.profile")}
    >
      <Menu className="h-7 w-7" strokeWidth={2} aria-hidden />
    </button>
  );

  /** Desktop only: top bar — back (profile hub/subpages) or account, search, notifications */
  const DesktopHeader = (
    <header
      data-desktop-header-strip=""
      className={cn(
        "hidden md:block fixed inset-x-0 top-0 z-50 border-0 shadow-none backdrop-blur-none transition-colors duration-300",
        signedInAppHeaderBgClass,
      )}
    >
      {/*
       * Full-viewport grid: 220px sidebar column + content spanning to the right edge.
       * Inner [auto | 1fr | auto] pins left controls beside the side panel and
       * language/bell to the viewport end (not the feed column before favorites).
       */}
      <div className="grid h-16 w-full grid-cols-[220px_minmax(0,1fr)] items-center">
        <div aria-hidden="true" />
        <div className="grid h-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pe-3 sm:pe-5 lg:pe-6">
          <div className="flex min-w-0 items-center gap-1 ps-3">
            {showDiscoverShellHeader ? (
              renderDiscoverHomeLocationChip("desktop")
            ) : showCommunityFeedHeaderLeft ? (
              <>
                <button
                  type="button"
                  onClick={handleHeaderBack}
                  className={signedInHeaderIconBtnClass}
                  aria-label={t("common.back")}
                >
                  <HeaderBackChevron />
                </button>
                {renderDiscoverHomeLocationChip("desktop", { besideBack: true })}
              </>
            ) : (
              <button
                type="button"
                onClick={handleHeaderBack}
                className={signedInHeaderIconBtnClass}
                aria-label={t("common.back")}
              >
                <HeaderBackChevron />
              </button>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-center px-2 md:px-4">
          {isDiscoverHome && desktopDiscoverSearchOpen ? (
            <div className="flex w-full min-w-0 items-center gap-2 md:gap-2.5">
              <div className="min-w-0 flex-1 md:max-w-xs lg:max-w-sm">
                <UserSearch
                  autoFocus
                  onResultSelect={() => setDesktopDiscoverSearchOpen(false)}
                />
              </div>
              <button
                type="button"
                onClick={() => setDesktopDiscoverSearchOpen(false)}
                className={signedInHeaderIconBtnClass}
                aria-label={t("common.closeSearch")}
              >
                <X className="h-7 w-7" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          ) : isDiscoverHome ? (
            <div className="flex w-full min-w-0 items-center justify-center gap-2 md:gap-2.5">
              <DiscoverHomeModeSegmentedControl
                mode={discoverHomeMode}
                onModeChange={(m) => {
                  void writeDiscoverHomeIntent(m);
                }}
                variant="header"
              />
              <button
                type="button"
                onClick={() => setDesktopDiscoverSearchOpen(true)}
                className={signedInHeaderIconBtnClass}
                aria-label={t("common.openSearch")}
              >
                <Search className="h-7 w-7" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex w-full min-w-0 items-center justify-center gap-2 md:gap-3">
              {showCommunityHeaderCategoryDropdown && (
                <div className="hidden min-w-0 shrink-0 md:block md:w-[min(8.75rem,22vw)] lg:w-36">
                  <CommunityPostsCategoryNativeSelect
                    variant="header"
                    basePath={location.pathname}
                    categoryParam={communityCategoryParam}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 md:max-w-xs lg:max-w-sm">
                <UserSearch />
              </div>
            </div>
          )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-0.5">
            <LanguageSwitcher />
            {isOwnPublicProfilePage ? (
              OwnPublicProfileHeaderMenu
            ) : (
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className={cn("relative", signedInHeaderIconBtnClass)}
                aria-label={t("common.notifications")}
              >
                <Bell className="h-7 w-7" />
                {notificationBadgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute end-0.5 top-0.5 z-10 flex h-6 min-w-6 items-center justify-center border-[3px] border-white px-1 text-[11px] font-black leading-none shadow-sm dark:border-zinc-900 md:end-0 md:top-0 md:h-7 md:min-w-7 md:px-1.5 md:text-xs"
                  >
                    {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                  </Badge>
                )}
              </button>
            )}
            {/*
             * Profile avatar lives in the DesktopSidePanel ("Profile" nav row) on
             * desktop, so the header no longer renders a duplicate avatar button.
             */}
          </div>
        </div>
      </div>
    </header>
  );

  const MobileSignedInHeader = !hideMobileAppHeaderChrome ? (
    <header
      data-mobile-header-strip
      className={cn(
        "md:hidden fixed inset-x-0 top-0 z-[60] border-0 backdrop-blur-none",
        signedInAppHeaderBgClass,
      )}
      style={{
        paddingTop: "var(--app-safe-top, env(safe-area-inset-top, 0px))",
      }}
    >
      <div className="flex h-16 min-h-16 items-center gap-1 px-2 sm:px-3">
        <div className="flex min-w-0 shrink-0 items-center gap-0.5">
          {showDiscoverShellHeader ? (
            <>
              {renderDiscoverHomeLocationChip("mobile")}
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className={signedInHeaderIconBtnClass}
                aria-label={t("common.openSearch", { defaultValue: "Search" })}
              >
                <Search className="h-7 w-7" strokeWidth={2.25} aria-hidden />
              </button>
            </>
          ) : showCommunityFeedHeaderLeft ? (
            <>
              <button
                type="button"
                onClick={handleHeaderBack}
                className={signedInHeaderIconBtnClass}
                aria-label="Back"
              >
                <HeaderBackChevron />
              </button>
              {renderDiscoverHomeLocationChip("mobile", { besideBack: true })}
            </>
          ) : (
            <button
              type="button"
              onClick={handleHeaderBack}
              className={signedInHeaderIconBtnClass}
              aria-label="Back"
            >
              <HeaderBackChevron />
            </button>
          )}
        </div>

        {!discoverHomeFixedChrome &&
        showCommunityHeaderCategoryDropdown &&
        !mobileSearchOpen ? (
          <div className="flex min-w-0 flex-1 justify-center px-0.5">
            <div className="w-full max-w-[min(10.5rem,calc(100vw-8rem))]">
              <CommunityPostsCategoryNativeSelect
                variant="header"
                basePath={location.pathname}
                categoryParam={communityCategoryParam}
              />
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          {discoverHomeFixedChrome ? (
            <DiscoverHomeMobileHeaderRight />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMobileSearchOpen((v) => !v)}
                className={signedInHeaderIconBtnClass}
                aria-label={mobileSearchOpen ? "Close search" : "Search helpers"}
                aria-expanded={mobileSearchOpen}
              >
                {mobileSearchOpen ? (
                  <X className="h-7 w-7" strokeWidth={2} />
                ) : (
                  <Search className="h-7 w-7" strokeWidth={2} />
                )}
              </button>
              {!mobileSearchOpen ? (
                isOwnPublicProfilePage ? (
                  OwnPublicProfileHeaderMenu
                ) : (
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(true)}
                    className={cn("relative", signedInHeaderIconBtnClass)}
                    aria-label="Notifications"
                  >
                    <Bell className="h-7 w-7" strokeWidth={2} />
                    {notificationBadgeCount > 0 ? (
                      <Badge
                        variant="destructive"
                        className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center border-2 border-white px-0.5 text-[10px] font-black leading-none shadow-sm dark:border-zinc-900"
                      >
                        {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                      </Badge>
                    ) : null}
                  </button>
                )
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  ) : null;

  const ProfileMenuModal = (
    <Dialog open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
      <DialogContent className="max-w-xs gap-3 rounded-2xl border-0 p-4 shadow-xl outline-none ring-0 focus:outline-none focus-visible:ring-0 left-4 right-4 top-14 w-[calc(100%-2rem)] max-w-sm translate-x-0 translate-y-0 bg-white dark:bg-zinc-800 dark:text-zinc-50 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2">
        <DialogTitle className="sr-only">Account menu</DialogTitle>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="justify-start gap-2 w-full"
            onClick={() => {
              navigate("/");
              setProfileMenuOpen(false);
            }}
          >
            <Home className="w-4 h-4" />
            Home
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-2 w-full"
            onClick={() => {
              navigate(profilePath);
              setProfileMenuOpen(false);
            }}
          >
            <Pencil className="w-4 h-4" />
            Edit profile
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-2 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={async () => {
              console.log("[BottomNav] Mobile Log out clicked");
              await signOut();
              setProfileMenuOpen(false);
            }}
          >
            <LogOut className="w-4 h-4" />
            Log out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (location.pathname === "/login") {
    return (
      <>
        {DesktopHeader}
        {MobileSignedInHeader}
        {ProfileMenuModal}
        {DesktopAppMenuModal}
        <NotificationsModal
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        />
      </>
    );
  }

  // Show loading state only if actively loading AND no user yet
  // If we have a user but profile fetch failed, still show nav on known pages
  if (loading && !user) {
    return null;
  }

  // If no user at all, don't show nav (except onboarding)
  if (!user && location.pathname !== "/onboarding") {
    return null;
  }

  // If we have user but no profile, show nav only on specific pages
  if (user && !profile && location.pathname !== "/onboarding") {
    // Allow nav on freelancer/client pages even without profile
    const allowedPaths = [
      "/freelancer/home",
      "/freelancer/explore",
      "/freelancer/jobs/match",
      "/freelancer/dashboard",
      "/freelancer/profile",
      "/freelancer/notifications",
      "/freelancer/active-jobs",
      "/client/home",
      "/client/explore",
      "/client/helpers/match",
      "/client/profile",
      "/client/create",
      "/client/jobs",
      "/client/active-jobs",
      "/posts",
      "/availability",
      "/freelancer/availability",
      "/public/posts",
      "/community/feed",
      "/liked",
      "/dashboard",
      "/recent-activity",
      "/messages",
      "/calendar",
    ];
    if (!allowedPaths.some((path) => location.pathname.startsWith(path))) {
      return null;
    }
  }

  // On onboarding page, show basic navigation
  if (location.pathname === "/onboarding" && !profile) {
    return (
      <>
        {DesktopHeader}
        {MobileSignedInHeader}
        {ProfileMenuModal}
        {DesktopAppMenuModal}
        {!hideMobileBottomNav &&
          createPortal(
          <nav className={mobileNavPortalClass}>
            <div className={cn(mobileNavShellClass, "md:max-w-xs")}>
              {mobileNavGlowLayer}
              {mobileNavReadableLayer}
              <div className={mobileNavItemsRowClass}>
                <div className={mobileTabLinkClass}>
                  <MobileTabItem active label={t("common.home")}>
                    <BottomNavHomeIcon className="h-7 w-7 text-zinc-950 dark:text-white" />
                  </MobileTabItem>
                </div>
              </div>
            </div>
          </nav>,
          document.body,
        )}
        <NotificationsModal
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        />
      </>
    );
  }

  // User navigation (Client & Freelancer)
  if (
    (profile && !profile.is_admin) ||
    (!profile &&
      (location.pathname.startsWith("/client") ||
        location.pathname.startsWith("/freelancer")))
  ) {
    const isFreelancer = profile?.role === "freelancer";

    const profileTabPath = isFreelancer
      ? "/freelancer/profile"
      : "/client/profile";
    const publicProfilePath = viewerId ? `/profile/${viewerId}` : profileTabPath;
    const homePath = isFreelancer ? "/freelancer/home" : "/client/home";

    /**
     * Explore tab routes to the Community feed (the legacy Explore page is now
     * reachable from the Profile hub).
     */
    const explorePath = "/community/feed";
    const isExploreActive =
      location.pathname.startsWith("/community") ||
      location.pathname.startsWith("/public/posts");

    return (
      <>
        {!isHelpersFindPage ? DesktopHeader : null}
        {MobileSignedInHeader}
        {!hideMobileBottomNav &&
          createPortal(
          <nav className={mobileNavPortalClass}>
          <div className={mobileNavShellClass}>
            {mobileNavGlowLayer}
            {mobileNavReadableLayer}
            <div className={mobileNavItemsRowClass}>
              {/* Home */}
              {(() => {
                const isActive = location.pathname.startsWith(homePath);
                return (
                  <Link
                    to={homePath}
                    className={cn(
                      mobileTabLinkClass,
                      isActive
                        ? "text-zinc-950 dark:text-white"
                        : "text-zinc-950/85 hover:text-zinc-950 dark:text-white dark:hover:text-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <MobileTabItem active={isActive} label={t("common.home")}>
                      <BottomNavHomeIcon className={bottomNavHomeFeedIconClass} />
                    </MobileTabItem>
                  </Link>
                );
              })()}

              {/* Explore (moved into old Liked slot) */}
              <Link
                to={explorePath}
                className={cn(
                  mobileTabLinkClass,
                  isExploreActive
                    ? "text-zinc-950 dark:text-white"
                    : "text-zinc-950/85 hover:text-zinc-950 dark:text-white dark:hover:text-white",
                )}
                aria-current={isExploreActive ? "page" : undefined}
                aria-label="Explore live feed"
              >
                <MobileTabItem active={isExploreActive} label={t("common.feed")}>
                  <Rss className={bottomNavHomeFeedIconClass} strokeWidth={0} aria-hidden />
                </MobileTabItem>
              </Link>

              <div className="bottom-nav-plus-spacer w-11 shrink-0 md:hidden" aria-hidden />

              {/* Messages */}
              {(() => {
                const isActive = location.pathname.startsWith("/messages");
                const inboxBadgeCount = unreadMessages;
                const showMessageBadge = inboxBadgeCount > 0;
                return (
                  <Link
                    to="/messages"
                    className={cn(
                      mobileTabLinkClass,
                      isActive
                        ? "text-zinc-950 dark:text-white"
                        : "text-zinc-950/85 hover:text-zinc-950 dark:text-white dark:hover:text-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <MobileTabItem active={isActive} label={t("common.messages")}>
                      <div className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
                        <MessageCircle
                          className={cn(bottomNavTabIconClass(isActive), "relative z-[1]")}
                          strokeWidth={2.75}
                        />
                        {showMessageBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-red-600 px-0.5 text-[10px] font-black leading-none shadow-none ring-0 md:h-5.5 md:min-w-[22px] md:px-1 md:text-[11px]"
                          >
                            {inboxBadgeCount > 9 ? "9+" : inboxBadgeCount}
                          </Badge>
                        )}
                      </div>
                    </MobileTabItem>
                  </Link>
                );
              })()}

              {/* Profile: mobile + desktop avatar → own public profile */}
              {(() => {
                const isActive = location.pathname === publicProfilePath;
                return (
                  <>
                    <Link
                      to={publicProfilePath}
                      className={cn(
                        "md:hidden",
                        mobileTabLinkClass,
                        isActive
                          ? "text-zinc-950 dark:text-white"
                          : "text-zinc-950/85 hover:text-zinc-950 dark:text-white dark:hover:text-white",
                      )}
                      aria-label="View your public profile"
                    >
                      <MobileTabItem active={isActive} label={t("common.profile")}>
                        <Avatar className="relative z-[1] h-10 w-10 border-0 ring-0 md:h-8 md:w-8">
                          <AvatarImage
                            src={profile?.photo_url ?? undefined}
                            alt=""
                          />
                          <AvatarFallback className="text-[9px] font-bold bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white sm:text-[10px]">
                            {(profile?.full_name ?? user?.email ?? "U")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </MobileTabItem>
                    </Link>

                    <Link
                      to={publicProfilePath}
                      className={cn(
                        "group hidden md:flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative",
                        isActive
                          ? "text-zinc-950 dark:text-white"
                          : "text-zinc-950/65 hover:text-zinc-950 dark:text-white/70 dark:hover:text-white",
                      )}
                      aria-label="View your public profile"
                    >
                      <div className="relative flex h-[48px] w-[48px] shrink-0 items-center justify-center">
                        <Avatar
                          className={cn(
                            "h-9 w-9 border transition-[box-shadow,ring-color] duration-300",
                            isActive
                              ? "border-transparent ring-2 ring-zinc-950 dark:ring-white"
                              : "border-zinc-900/15 dark:border-white/20",
                          )}
                        >
                          <AvatarImage
                            src={profile?.photo_url ?? undefined}
                            alt=""
                          />
                          <AvatarFallback className="text-[10px] font-bold bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white">
                            {(profile?.full_name ?? user?.email ?? "U")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </Link>
                  </>
                );
              })()}
            </div>

            <div ref={plusMenuRef} className="bottom-nav-plus-anchor md:hidden">
              <button
                ref={plusButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlusMenuOpen((v) => !v);
                }}
                className={plusButtonClassName}
                aria-expanded={plusMenuOpen}
                aria-label="Open quick actions"
              >
                <Plus
                  className="bottom-nav-plus-glyph h-9 w-9 shrink-0"
                  strokeWidth={2.75}
                  aria-hidden
                />
                <span className="sr-only">{t("common.create")}</span>
              </button>
            </div>

            {plusMenuOpen
              ? createPortal(
                  <div
                    ref={plusMenuPanelRef}
                    role="menu"
                    className={plusMenuPanelClassName}
                  >
                    <div className="bottom-nav-plus-menu-glow" aria-hidden />
                    <div className="bottom-nav-plus-menu-readable" aria-hidden />
                    <div className={plusMenuItemsClassName}>
                      {profile?.role === "client" && (
                        <button
                          type="button"
                          role="menuitem"
                          className={plusMenuItemClassName}
                          onClick={() => {
                            setPlusMenuOpen(false);
                            navigate("/client/helpers");
                          }}
                        >
                          <span className={plusMenuIconWrapClassName}>
                            <UsersRound className={plusMenuIconClassName} strokeWidth={2.25} aria-hidden />
                          </span>
                          <span>Find helpers</span>
                        </button>
                      )}
                      {profile?.role === "freelancer" && (
                        <button
                          type="button"
                          role="menuitem"
                          className={plusMenuItemClassName}
                          onClick={() => {
                            setPlusMenuOpen(false);
                            navigate("/freelancer/jobs/match");
                          }}
                        >
                          <span className={plusMenuIconWrapClassName}>
                            <Rss className={plusMenuIconClassName} strokeWidth={2.25} aria-hidden />
                          </span>
                          <span>Find requests</span>
                        </button>
                      )}
                      {profile?.role === "client" && (
                        <button
                          type="button"
                          role="menuitem"
                          className={plusMenuItemClassName}
                          onClick={() => {
                            setPlusMenuOpen(false);
                            guardKycAction("start_request", () =>
                              navigate("/client/create"),
                            );
                          }}
                        >
                          <span className={plusMenuIconWrapClassName}>
                            <Zap className={plusMenuIconClassName} strokeWidth={2.5} aria-hidden />
                          </span>
                          <span>Start request</span>
                        </button>
                      )}
                      {profile?.role === "freelancer" && (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={isLiveNow}
                          className={cn(
                            plusMenuItemClassName,
                            isLiveNow &&
                              "cursor-not-allowed opacity-55 hover:bg-transparent dark:hover:bg-transparent active:scale-100",
                          )}
                          onClick={() => {
                            if (isLiveNow) return;
                            setPlusMenuOpen(false);
                            guardKycAction("go_live", () =>
                              navigate("/availability/post-now"),
                            );
                          }}
                        >
                          <span className={plusMenuIconWrapClassName}>
                            <UsersRound className={plusMenuIconClassName} strokeWidth={2.25} aria-hidden />
                          </span>
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span>Go live</span>
                            {isLiveNow && freelancerLiveUntil ? (
                              <span className="shrink-0 rounded-full bg-emerald-500/14 px-2.5 py-1 text-[11px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-400/16 dark:text-emerald-300">
                                <LiveTimer countdownTo={freelancerLiveUntil} />
                              </span>
                            ) : null}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className={plusMenuItemClassName}
                        onClick={() => {
                          setPlusMenuOpen(false);
                          guardKycAction("share_post", () =>
                            navigate("/community/feed?compose=1"),
                          );
                        }}
                      >
                        <span className={plusMenuIconWrapClassName}>
                          <PenSquare className={plusMenuIconClassName} strokeWidth={2.25} aria-hidden />
                        </span>
                        <span>Share a post</span>
                      </button>
                    </div>
                  </div>,
                  document.body,
                )
              : null}

            {/* Safe area padding (desktop bar only; mobile uses nav pb) */}
            <div className="hidden h-[env(safe-area-inset-bottom,0px)] w-full md:block" />
          </div>
        </nav>,
          document.body,
        )}
        {ProfileMenuModal}
        {DesktopAppMenuModal}
        <MobileSmartSearchOverlay
          open={mobileSearchOpen}
          onClose={() => setMobileSearchOpen(false)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
        <NotificationsModal
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        />
      </>
    );
  }

  // Default fallback - show basic nav if user exists
  if (user) {
    return (
      <>
        {DesktopHeader}
        {MobileSignedInHeader}
        {!hideMobileBottomNav &&
          createPortal(
          <nav className={mobileNavPortalClass}>
            <div className={cn(mobileNavShellClass, "md:max-w-xs")}>
              {mobileNavGlowLayer}
              {mobileNavReadableLayer}
              <div className={mobileNavItemsRowClass}>
                <div className={cn(mobileTabTouchClass, "rounded-2xl bg-slate-100/80 text-slate-400 dark:bg-zinc-800/80 dark:text-zinc-500 animate-pulse")}>
                  <Home className="h-7 w-7" />
                </div>
              </div>
            </div>
          </nav>,
          document.body,
        )}
        {ProfileMenuModal}
        {DesktopAppMenuModal}
        <MobileSmartSearchOverlay
          open={mobileSearchOpen}
          onClose={() => setMobileSearchOpen(false)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
        <NotificationsModal
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        />
      </>
    );
  }

  return null;
}
