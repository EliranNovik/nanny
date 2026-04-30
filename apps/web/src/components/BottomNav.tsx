import { useState, useEffect, useRef, type CSSProperties } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDiscoverHomeScrollHeader } from "@/context/DiscoverHomeScrollHeaderContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
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
  ChevronLeft,
  LogOut,
  Pencil,
  Search,
  Plus,
  X,
  ClipboardList,
  UsersRound,
  Radio,
  AlertCircle,
  Rss,
  MapPin,
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
import { DiscoverHomeModeSegmentedControl } from "@/components/discover/DiscoverHomeModeSegmentedControl";
import {
  readDiscoverHomeIntent,
  subscribeDiscoverHomeIntent,
  writeDiscoverHomeIntent,
} from "@/lib/discoverHomeIntent";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { LocationPickerSheet } from "@/components/LocationPickerSheet";

/** Bottom tabs: active = solid fill, inactive = outline stroke (Lucide paths support both). */
function bottomNavTabIconClass(isActive: boolean) {
  return cn(
    "transition-all duration-300 h-7 w-7 sm:h-8 sm:w-8",
    isActive
      ? "fill-current stroke-none text-zinc-950 dark:text-white"
      : "fill-none stroke-[2] text-zinc-950/65 dark:text-white/65 group-hover:text-zinc-950 dark:group-hover:text-white",
  );
}

/** App menu — job tab counts: dark frosted glass (light) / light frosted glass (dark). */
const appMenuJobsCountBadgeClassName = cn(
  "shrink-0 min-w-[1.75rem] justify-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums",
  "border-white/20 bg-black/50 text-white shadow-sm backdrop-blur-md ring-1 ring-inset ring-white/10",
  "dark:border-white/35 dark:bg-white/35 dark:text-zinc-950 dark:shadow-md dark:backdrop-blur-md dark:ring-white/25",
);

export function BottomNav() {
  const { profile, loading, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobsSearchParams] = useSearchParams();
  const { activityInboxCount, unreadMessages } = useUnreadCounts();
  const { scheduleChanges } = useScheduleChanges();
  const jobsTabCounts = useJobsTabCounts(user);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [desktopAppMenuOpen, setDesktopAppMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopDiscoverSearchOpen, setDesktopDiscoverSearchOpen] =
    useState(false);
  const mobileSearchClusterRef = useRef<HTMLDivElement>(null);
  const [appMenuHelpOthersOpen, setAppMenuHelpOthersOpen] = useState(false);
  const [appMenuNeedHelpOpen, setAppMenuNeedHelpOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
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
  const { collapseProgress: discoverHeaderCollapseProgress } =
    useDiscoverHomeScrollHeader();
  const isDiscoverHome =
    pathnameNorm === "/client/home" || pathnameNorm === "/freelancer/home";
  const [discoverHomeMode, setDiscoverHomeMode] = useState<
    "hire" | "work"
  >(() => readDiscoverHomeIntent("hire"));
  const isLikedPage = pathnameNorm === "/liked";
  const isShellScrollCollapseRoute = isDiscoverHome || isLikedPage;
  const shellCollapseChromeP = isShellScrollCollapseRoute
    ? discoverHeaderCollapseProgress
    : 0;
  const [headerVisible, setHeaderVisible] = useState(true);
  const scrollYRef = useRef(0);
  const headerVisibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const prev = scrollYRef.current;
      const dy = currentScrollY - prev;
      scrollYRef.current = currentScrollY;

      // Small delay + hysteresis to avoid flicker/stuck states
      // when the user scrolls up/down quickly.
      const MIN_DELTA = 10;
      const HIDE_AFTER_MS = 120;
      const SHOW_AFTER_MS = 80;

      // Always show near the top.
      if (currentScrollY <= 100) {
        if (headerVisibilityTimerRef.current) {
          clearTimeout(headerVisibilityTimerRef.current);
          headerVisibilityTimerRef.current = null;
        }
        setHeaderVisible(true);
        return;
      }

      if (Math.abs(dy) < MIN_DELTA) return;

      const nextVisible = dy < 0;
      if (headerVisibilityTimerRef.current) {
        clearTimeout(headerVisibilityTimerRef.current);
      }
      headerVisibilityTimerRef.current = setTimeout(() => {
        setHeaderVisible(nextVisible);
        headerVisibilityTimerRef.current = null;
      }, nextVisible ? SHOW_AFTER_MS : HIDE_AFTER_MS);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (headerVisibilityTimerRef.current) {
        clearTimeout(headerVisibilityTimerRef.current);
        headerVisibilityTimerRef.current = null;
      }
    };
  }, []);

  /** Scroll-linked — no CSS transition; transform/opacity follow collapse progress. */
  const shellScrollMobileChromeOverlayStyle: CSSProperties | undefined =
    isShellScrollCollapseRoute && shellCollapseChromeP > 0
      ? {
        transform: `translateY(calc(-1 * ${shellCollapseChromeP * 130}%))`,
        opacity: Math.max(0, 1 - shellCollapseChromeP),
        transition: "none",
      }
      : undefined;

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
  /** Find helpers: hide app header strips (mobile + desktop) — page is full-bleed */
  const isHelpersFindPage = pathnameNorm === "/client/helpers";
  /** Find jobs match: full-bleed search chrome — hide floating mobile header row */
  const isFreelancerJobsMatch = pathnameNorm === "/freelancer/jobs/match";
  /** Create job + post availability: own hero — hide floating mobile header row */
  const hideMobileAppHeaderChrome =
    pathnameNorm === "/client/create" ||
    pathnameNorm === "/availability/post-now" ||
    isHelpersFindPage ||
    isFreelancerJobsMatch;
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
    function onDocPointerDown(e: PointerEvent) {
      if (!plusMenuOpen) return;
      const el = plusMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setPlusMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
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



  function renderDiscoverHomeLocationChip(variant: "mobile" | "desktop") {
    const { displayCity, displayCountry, gpsLoading } = activeLocation;
    const primary = displayCity ?? (gpsLoading ? "Detecting…" : "Add location");
    return (
      <>
        <button
          type="button"
          onClick={() => setLocationPickerOpen(true)}
          className={cn(
            variant === "mobile"
              ? "pointer-events-auto flex min-h-11 max-w-[min(13.5rem,calc(100vw-7rem))] items-center gap-1 rounded-xl py-1 pl-1 pr-1.5 text-left text-slate-900 transition-all hover:opacity-90 active:scale-[0.98] dark:text-white"
              : "flex max-w-[min(16rem,28vw)] min-h-9 items-center gap-1.5 rounded-xl py-1 pl-1 pr-2 text-left text-slate-900 transition hover:opacity-90 dark:text-white",
          )}
          aria-label={displayCity ? `Current location: ${displayCity}. Tap to change.` : "Set your location"}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center relative">
            <MapPin
              className="h-[1.05rem] w-[1.05rem] text-slate-900 dark:text-white"
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] leading-tight sm:text-sm">
            <span className="font-bold text-slate-900 dark:text-white">{primary}</span>
            {displayCountry && (
              <span className="font-normal text-slate-600 dark:text-slate-400">, {displayCountry}</span>
            )}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400"
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
            "pt-4 max-md:pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
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
                navigate("/availability/post-now");
                setDesktopAppMenuOpen(false);
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
                navigate("/client/create");
                setDesktopAppMenuOpen(false);
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
            onClick={() => {
              void signOut();
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

  /** Desktop only: top bar — back (profile hub/subpages) or account, search, notifications */
  const DesktopHeader = (
    <header
      data-desktop-header-strip=""
      className="hidden md:block fixed top-0 left-0 right-0 z-50 border-none bg-background shadow-none backdrop-blur-none transition-colors duration-300 dark:bg-background"
    >
      <div className="app-desktop-shell grid grid-cols-3 items-center gap-3 py-2.5">
        <div className="flex min-w-0 justify-start items-center gap-1.5">
          {isDiscoverHome ? (
            renderDiscoverHomeLocationChip("desktop")
          ) : (
            <button
              type="button"
              onClick={handleHeaderBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-600 transition hover:opacity-80 dark:text-slate-300 dark:hover:opacity-90"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>

        <div className="flex min-w-0 max-w-full justify-center justify-self-center px-2 md:max-w-xl md:px-4 lg:max-w-2xl">
          {isDiscoverHome && desktopDiscoverSearchOpen ? (
            <div className="flex w-full min-w-0 items-center gap-2 md:gap-2.5">
              <div className="min-w-0 flex-1 md:max-w-md lg:max-w-xl">
                <UserSearch
                  autoFocus
                  onResultSelect={() => setDesktopDiscoverSearchOpen(false)}
                />
              </div>
              <button
                type="button"
                onClick={() => setDesktopDiscoverSearchOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close search"
              >
                <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Open search"
              >
                <Search className="h-5 w-5" strokeWidth={2.25} aria-hidden />
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
              <div className="min-w-0 flex-1 md:max-w-md lg:max-w-xl">
                <UserSearch />
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 min-w-0">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-xl p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 md:p-2.5"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 md:h-6 md:w-6" />
            {notificationBadgeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute right-0.5 top-0.5 z-10 flex h-6 min-w-6 items-center justify-center border-[3px] border-white px-1 text-[11px] font-black leading-none shadow-sm dark:border-zinc-900 md:right-0 md:top-0 md:h-7 md:min-w-7 md:px-1.5 md:text-xs"
              >
                {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
              </Badge>
            )}
          </button>
          {user && (
            <button
              type="button"
              onClick={() => setProfileMenuOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center group"
              aria-label="Open profile"
            >
              <Avatar className="h-9 w-9 border border-black/5 dark:border-white/10 shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
                <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
                <AvatarFallback className="text-[10px] font-bold bg-slate-100 dark:bg-zinc-800">
                  {(profile?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          )}
        </div>
      </div>
    </header>
  );

  /** Mobile: fixed top background strip behind back / search / bell. */
  const mobileScrollHeaderLayer = (
    <div
      data-mobile-header-strip=""
      className={cn(
        "md:hidden pointer-events-none fixed inset-x-0 top-0 z-[58] transition-[transform,opacity,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "border-none bg-background shadow-none backdrop-blur-none dark:bg-background",
        !headerVisible && !isShellScrollCollapseRoute && "-translate-y-full opacity-0",
        !isShellScrollCollapseRoute &&
        "motion-reduce:transition-none",
      )}
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "0.5rem",
        ...shellScrollMobileChromeOverlayStyle,
      }}
      aria-hidden
    >
      <div className="h-11 w-full" />
    </div>
  );

  /** Mobile only: floating row — community pages: back | centered category | search + bell; else search + bell (top-right). */
  const MobileFloatingActions = (
    <div
      className={cn(
        "md:hidden fixed z-[60] pointer-events-none transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        mobileSearchOpen || showCommunityHeaderCategoryDropdown
          ? "left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))]"
          : "right-[max(0.75rem,env(safe-area-inset-right))]",
        !headerVisible && !isShellScrollCollapseRoute && "-translate-y-full opacity-0",
        !isShellScrollCollapseRoute &&
        "motion-reduce:transition-none",
      )}
      style={{
        top: "max(0.75rem, env(safe-area-inset-top))",
        ...shellScrollMobileChromeOverlayStyle,
      }}
    >
      <div
        ref={mobileSearchClusterRef}
        className={cn(
          "pointer-events-auto flex flex-row flex-nowrap items-center gap-1.5",
          mobileSearchOpen || showCommunityHeaderCategoryDropdown
            ? !mobileSearchOpen && showCommunityHeaderCategoryDropdown
              ? "ml-14 min-w-0 flex-1"
              : "w-full"
            : "max-w-[calc(100vw-1rem)] justify-end",
          mobileSearchOpen && !isCommunityPostsFilterPage && "justify-end",
          isPublicPostsPage && !mobileSearchOpen && "justify-end",
        )}
      >
        {showCommunityHeaderCategoryDropdown && !mobileSearchOpen && (
          <div className="flex min-w-0 flex-1 justify-center px-0.5">
            <div className="w-full max-w-[min(10.5rem,calc(100vw-8rem))]">
              <CommunityPostsCategoryNativeSelect
                variant="header"
                basePath={location.pathname}
                categoryParam={communityCategoryParam}
              />
            </div>
          </div>
        )}
        <div
          className={cn(
            "relative shrink-0",
            (!isCommunityPostsFilterPage || isPublicPostsPage) &&
            !mobileSearchOpen &&
            "ml-auto",
          )}
        >
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="p-2 text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300"
            aria-label={mobileSearchOpen ? "Close search" : "Search helpers"}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? (
              <X className="h-6 w-6" strokeWidth={2} />
            ) : (
              <Search className="h-6 w-6" strokeWidth={2} />
            )}
          </button>
        </div>
        {!mobileSearchOpen && (
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative shrink-0 p-2 text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" strokeWidth={2} />
            {notificationBadgeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 z-10 flex h-6 min-w-6 items-center justify-center border-[3px] border-white px-1 text-[11px] font-black leading-none shadow-sm dark:border-zinc-900"
              >
                {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
              </Badge>
            )}
          </button>
        )}

      </div>
    </div>
  );

  /** Mobile: back top-left on every page (plain icon on the strip, no pill). */
  const mobileUniversalBackBtnClass =
    "pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300";

  const MobileLeftHeaderCluster = (
    <div
      className={cn(
        "md:hidden fixed z-[70] pointer-events-none flex flex-row items-center gap-1 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        !headerVisible && !isShellScrollCollapseRoute && "-translate-y-full opacity-0",
        !isShellScrollCollapseRoute &&
        "motion-reduce:transition-none",
      )}
      style={{
        top: "max(0.75rem, env(safe-area-inset-top))",
        left: "max(0.75rem, env(safe-area-inset-left))",
        ...shellScrollMobileChromeOverlayStyle,
      }}
    >
      {isDiscoverHome ? (
        renderDiscoverHomeLocationChip("mobile")
      ) : (
        <button
          type="button"
          onClick={handleHeaderBack}
          className={mobileUniversalBackBtnClass}
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
      )}
    </div>
  );

  const ProfileMenuModal = (
    <Dialog open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
      <DialogContent className="max-w-xs p-4 gap-3 rounded-xl left-4 right-4 top-14 translate-x-0 translate-y-0 w-[calc(100%-2rem)] max-w-sm data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2">
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
            onClick={() => {
              signOut();
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
        {MobileLeftHeaderCluster}
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
        {!hideMobileAppHeaderChrome && mobileScrollHeaderLayer}
        {!hideMobileAppHeaderChrome && MobileLeftHeaderCluster}
        {!hideMobileAppHeaderChrome && MobileFloatingActions}
        {ProfileMenuModal}
        {DesktopAppMenuModal}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none px-0 pb-0 md:px-0 md:pb-0">
          <div
            className={cn(
              // Desktop: keep it pinned to the viewport bottom (no floating gap).
              "bottom-nav-mobile-shell mx-auto w-full max-w-none overflow-visible rounded-none pointer-events-auto md:mb-0 md:max-w-xs md:rounded-2xl",
            )}
          >
            <div className="flex items-center justify-center px-6 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom,0px)]">
              <div
                className="flex shrink-0 flex-col items-center justify-center"
                title="Getting Started"
              >
                <BottomNavHomeIcon
                  active
                  className="text-zinc-950 dark:text-white"
                />
              </div>
            </div>
          </div>
        </nav>
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
    const homePath = isFreelancer ? "/freelancer/home" : "/client/home";

    const explorePath = isFreelancer
      ? "/freelancer/explore"
      : "/client/explore";
    const isExploreActive = location.pathname.startsWith(explorePath);

    return (
      <>
        {!isHelpersFindPage && !isFreelancerJobsMatch ? DesktopHeader : null}
        {!hideMobileAppHeaderChrome && mobileScrollHeaderLayer}
        {!hideMobileAppHeaderChrome && MobileLeftHeaderCluster}
        {!hideMobileAppHeaderChrome && MobileFloatingActions}
        <nav
          className={cn(
            "fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none overflow-visible px-0 pb-0 md:px-0 md:pb-0",
            // Discover home browse dock uses z-[140]; lift nav (+ quick menu) above it while open.
            plusMenuOpen ? "z-[160]" : "z-[120]",
          )}
        >
          <div
            className={cn(
              // Desktop: keep it pinned to the viewport bottom (no floating gap).
              "bottom-nav-mobile-shell mx-auto w-full max-w-none overflow-visible rounded-none pointer-events-auto md:mb-0 md:max-w-md md:rounded-2xl",
            )}
          >
            <div
              className={cn(
                "mx-0 flex w-full max-w-none items-center justify-evenly overflow-visible px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 md:justify-between md:px-6 md:py-2 md:pb-2 lg:px-8 xl:px-12",
              )}
            >
              {/* Home */}
              {(() => {
                const isActive = location.pathname.startsWith(homePath);
                return (
                  <Link
                    to={homePath}
                    className={cn(
                      "group flex flex-col items-center justify-center p-1 transition-all relative",
                      isActive
                        ? "text-zinc-950 dark:text-white"
                        : "text-zinc-950/65 hover:text-zinc-950 dark:text-white/70 dark:hover:text-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center sm:h-[48px] sm:w-[48px]">
                      <BottomNavHomeIcon active={isActive} className={bottomNavTabIconClass(isActive)} />
                    </div>
                  </Link>
                );
              })()}

              {/* Explore (moved into old Liked slot) */}
              <Link
                to={explorePath}
                className={cn(
                  "group flex flex-col items-center justify-center p-1 transition-all relative",
                  isExploreActive
                    ? "text-zinc-950 dark:text-white"
                    : "text-zinc-950/65 hover:text-zinc-950 dark:text-white/70 dark:hover:text-white",
                )}
                aria-current={isExploreActive ? "page" : undefined}
                aria-label="Explore live feed"
              >
                <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center sm:h-[48px] sm:w-[48px]">
                  <Rss
                    className={bottomNavTabIconClass(isExploreActive)}
                    aria-hidden
                  />
                </div>
              </Link>

              {/* Center — + dropdown */}
              <div ref={plusMenuRef} className="relative z-20 flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen((v) => !v)}
                  className={cn(
                    "group flex flex-col items-center justify-center p-1 transition-all relative",
                    "outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/30 rounded-xl",
                    plusMenuOpen
                      ? "text-zinc-950 dark:text-white"
                      : "text-zinc-950/70 hover:text-zinc-950 dark:text-white/75 dark:hover:text-white",
                  )}
                  aria-expanded={plusMenuOpen}
                  aria-label="Open quick actions"
                >
                  <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center sm:h-[48px] sm:w-[48px]">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full",
                        isDiscoverHome
                          ? discoverHomeMode === "work"
                            ? "bg-emerald-800 text-white ring-1 ring-inset ring-white/25"
                            : "bg-[#7B61FF] text-white ring-1 ring-inset ring-white/25"
                          : "bg-orange-600 text-white ring-1 ring-inset ring-white/20",
                        "transition-[transform,filter] duration-200 ease-out",
                        "group-hover:brightness-110 group-active:scale-[0.98]",
                        plusMenuOpen && "brightness-110",
                      )}
                    >
                      <Plus className="h-6 w-6" strokeWidth={2.75} aria-hidden />
                    </div>
                  </div>
                </button>

                {plusMenuOpen ? (
                  <div
                    role="menu"
                    className={cn(
                      "absolute bottom-[68px] left-1/2 -translate-x-1/2",
                      "w-[18rem] overflow-hidden rounded-3xl border shadow-2xl",
                      "border-white/15 bg-black/55 text-white backdrop-blur-2xl ring-1 ring-inset ring-white/10",
                      "dark:border-white/20 dark:bg-zinc-950/55 dark:ring-white/10",
                    )}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] font-bold hover:bg-white/10 active:bg-white/15"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        navigate("/client/create");
                      }}
                    >
                      <ClipboardList className="h-6 w-6 shrink-0 text-white/90" aria-hidden />
                      <span>Start request</span>
                    </button>
                    <div className="h-px w-full bg-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isLiveNow}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] font-bold",
                        isLiveNow
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-white/10 active:bg-white/15",
                      )}
                      onClick={() => {
                        if (isLiveNow) return;
                        setPlusMenuOpen(false);
                        navigate("/availability/post-now");
                      }}
                    >
                      <UsersRound className="h-6 w-6 shrink-0 text-white/90" aria-hidden />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span>Go live</span>
                        {isLiveNow && freelancerLiveUntil ? (
                          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[12px] font-bold tabular-nums">
                            <LiveTimer createdAt={freelancerLiveUntil} />
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="h-px w-full bg-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] font-bold hover:bg-white/10 active:bg-white/15 relative"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        navigate("/community/feed");
                      }}
                    >
                      <Radio className="h-6 w-6 shrink-0 text-white/90" aria-hidden />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span>Community posts</span>
                        <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/20">
                          New
                        </span>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Messages */}
              {(() => {
                const isActive = location.pathname.startsWith("/messages");
                const inboxBadgeCount = unreadMessages;
                const showMessageBadge = inboxBadgeCount > 0;
                return (
                  <Link
                    to="/messages"
                    className={cn(
                      "group flex flex-col items-center justify-center p-1 transition-all relative",
                      isActive
                        ? "text-zinc-950 dark:text-white"
                        : "text-zinc-950/65 hover:text-zinc-950 dark:text-white/70 dark:hover:text-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center sm:h-[48px] sm:w-[48px]">
                      <MessageCircle className={bottomNavTabIconClass(isActive)} />
                    </div>

                    {showMessageBadge && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-0.5 top-0.5 z-10 flex h-6 min-w-6 items-center justify-center border-[3px] border-white px-1 text-[11px] font-black leading-none shadow-sm dark:border-zinc-900 sm:top-1 sm:right-1 sm:h-7 sm:min-w-7 sm:px-1.5 sm:text-xs"
                      >
                        {inboxBadgeCount > 9 ? "9+" : inboxBadgeCount}
                      </Badge>
                    )}
                  </Link>
                );
              })()}

              {/* Profile: mobile = avatar opens menu; desktop = user icon link */}
              {(() => {
                const isActive = location.pathname.startsWith(profileTabPath);
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen(true)}
                      className={cn(
                        "md:hidden flex flex-col items-center justify-center p-1 transition-all relative",
                        isActive
                          ? "text-zinc-950 dark:text-white"
                          : "text-zinc-950/65 hover:text-zinc-950 dark:text-white/70 dark:hover:text-white",
                      )}
                      aria-label="Open profile menu"
                    >
                      <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-visible sm:h-[48px] sm:w-[48px]">
                        <Avatar className="h-7 w-7 border-0 ring-0 sm:h-8 sm:w-8">
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
                      </div>
                    </button>

                    <Link
                      to={profileTabPath}
                      className={cn(
                        "group hidden md:flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative",
                        isActive
                          ? "text-zinc-950 dark:text-white"
                          : "text-zinc-950/65 hover:text-zinc-950 dark:text-white/70 dark:hover:text-white",
                      )}
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
            {/* Safe area padding (desktop bar only; mobile uses nav pb) */}
            <div className="hidden h-[env(safe-area-inset-bottom,0px)] w-full md:block" />
          </div>
        </nav>
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
        {!hideMobileAppHeaderChrome && mobileScrollHeaderLayer}
        {!hideMobileAppHeaderChrome && MobileLeftHeaderCluster}
        {!hideMobileAppHeaderChrome && MobileFloatingActions}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none px-0 pb-0 md:px-0 md:pb-0">
          <div className="bottom-nav-mobile-shell mx-auto w-full max-w-none overflow-visible rounded-none pointer-events-auto md:mb-0 md:max-w-xs md:rounded-2xl">
            <div className="flex items-center justify-center px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-6 md:pb-[env(safe-area-inset-bottom,0px)]">
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 flex-shrink-0 animate-pulse">
                <Home className="w-7 h-7" />
              </div>
            </div>
          </div>
        </nav>
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
