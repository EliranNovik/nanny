import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useScheduleChanges } from "@/hooks/useScheduleChanges";
import { Home, Heart, MessageCircle, User, Bell, ChevronDown, ChevronLeft, LogOut, Pencil, Search, X, Menu, MapPin, Plus, ClipboardList, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsModal } from "@/components/NotificationsModal";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserSearch } from "./UserSearch";
import { MobileSmartSearchOverlay } from "./MobileSmartSearchOverlay";
import { JobsTabBar } from "@/components/jobs/JobsTabBar";
import { FREELANCER_JOBS_TABS, CLIENT_JOBS_TABS } from "@/components/jobs/jobsTabConfig";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { Separator } from "@/components/ui/separator";
import { CommunityPostsCategoryNativeSelect } from "@/components/community/CommunityPostsCategoryNativeSelect";

export function BottomNav() {
  const { profile, loading, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobsSearchParams] = useSearchParams();
  const { activityInboxCount, unreadMessages } = useUnreadCounts();
  const { scheduleChanges } = useScheduleChanges();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [desktopAppMenuOpen, setDesktopAppMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchClusterRef = useRef<HTMLDivElement>(null);
  const fabMenuRef = useRef<HTMLDivElement>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const previousPathnameRef = useRef(location.pathname);
  const profilePath = profile?.role === "freelancer" ? "/freelancer/profile" : profile?.role === "client" ? "/client/profile" : "/dashboard";

  const pathnameNorm = location.pathname.replace(/\/$/, "") || "/";
  /** `/profile/:userId` ships its own fixed back button — hide nav duplicate */
  const isPublicUserProfilePage = /^\/profile\/[^/]+$/.test(pathnameNorm);
  const receiveRequestsOn = profile?.is_available_for_jobs === true;
  const showFreelancerJobNav =
    profile?.role === "freelancer" || (profile?.role === "client" && receiveRequestsOn);
  const isProfileHub =
    pathnameNorm === "/client/profile" || pathnameNorm === "/freelancer/profile";
  const isProfileSubpage = /^\/(client|freelancer)\/profile\/.+/.test(pathnameNorm);
  const profileBackTarget =
    isProfileHub
      ? pathnameNorm.startsWith("/freelancer")
        ? "/freelancer/home"
        : "/client/home"
      : isProfileSubpage
        ? pathnameNorm.startsWith("/freelancer")
          ? "/freelancer/profile"
          : "/client/profile"
        : null;
  const showProfileBack = profileBackTarget !== null;
  const isJobsPage = pathnameNorm === "/jobs";
  /** Own availability, legacy /posts, and public board — category + back live in header */
  const isCommunityPostsFilterPage =
    pathnameNorm === "/availability" ||
    pathnameNorm === "/posts" ||
    pathnameNorm === "/public/posts";
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
    if (previousPathnameRef.current !== location.pathname && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
    if (previousPathnameRef.current !== location.pathname && fabMenuOpen) {
      setFabMenuOpen(false);
    }
    previousPathnameRef.current = location.pathname;
  }, [location.pathname, mobileSearchOpen, fabMenuOpen]);

  useEffect(() => {
    if (!fabMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (fabMenuRef.current && !fabMenuRef.current.contains(e.target as Node)) {
        setFabMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [fabMenuOpen]);

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

  const DesktopAppMenuModal = user ? (
    <Dialog open={desktopAppMenuOpen} onOpenChange={setDesktopAppMenuOpen}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden rounded-xl left-4 right-auto top-16 translate-x-0 translate-y-0 w-[min(22rem,calc(100vw-2rem))] data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2">
        <DialogTitle className="sr-only">App menu</DialogTitle>
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Quick navigation</p>
          <p className="text-xs text-muted-foreground mt-0.5">Find helpers, jobs tabs, and your public profile</p>
        </div>
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-2">
          <Button
            variant="ghost"
            className="justify-start gap-2 w-full h-auto py-2.5"
            onClick={() => {
              navigate("/client/helpers");
              setDesktopAppMenuOpen(false);
            }}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            Find helpers
          </Button>
          <Separator className="my-2" />
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Jobs</p>
          <div className="flex flex-col gap-2">
            {showFreelancerJobNav && (
              <>
                <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-orange-600/90 dark:text-orange-400/90">
                  Helping others
                </p>
                <div className="flex flex-col gap-0.5">
                  {FREELANCER_JOBS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Button
                        key={`f-${tab.id}`}
                        variant="ghost"
                        className="justify-start gap-2 w-full h-auto py-2.5 font-normal"
                        onClick={() => {
                          navigate(buildJobsUrl("freelancer", tab.id));
                          setDesktopAppMenuOpen(false);
                        }}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              My Helpers
            </p>
            <div className="flex flex-col gap-0.5">
              {CLIENT_JOBS_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={`c-${tab.id}`}
                    variant="ghost"
                    className="justify-start gap-2 w-full h-auto py-2.5 font-normal"
                    onClick={() => {
                      navigate(buildJobsUrl("client", tab.id));
                      setDesktopAppMenuOpen(false);
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <Separator className="my-2" />
          <Button
            variant="ghost"
            className="justify-start gap-2 w-full h-auto py-2.5"
            onClick={() => {
              navigate(`/profile/${user.id}`);
              setDesktopAppMenuOpen(false);
            }}
          >
            <User className="w-4 h-4 shrink-0" />
            My public profile
          </Button>
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
          <button
            type="button"
            onClick={handleHeaderBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-600 transition hover:opacity-80 dark:text-slate-300 dark:hover:opacity-90"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
          {user && (
            <button
              type="button"
              onClick={() => setDesktopAppMenuOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-black/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
              aria-label="Open app menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setProfileMenuOpen(true)}
            className="flex items-center gap-3 min-w-0 group"
            aria-label="Open profile menu"
          >
            <Avatar className="h-9 w-9 flex-shrink-0 border border-black/5 dark:border-white/10 shadow-sm transition-transform group-active:scale-95">
              <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
              <AvatarFallback className="text-[10px] font-bold bg-slate-100 dark:bg-zinc-800">
                {(profile?.full_name ?? user?.email ?? "User").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[14px] font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                {profile?.full_name?.split(' ')[0] ?? "User"}
                <ChevronDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
              </span>
            </div>
          </button>
        </div>

        <div className="flex min-w-0 max-w-full justify-center justify-self-center px-2 md:max-w-xl md:px-4 lg:max-w-2xl">
          <div className="flex w-full min-w-0 items-center justify-center gap-2 md:gap-3">
            {isCommunityPostsFilterPage && (
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
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 min-w-0">
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
        </div>
      </div>
    </header>
  );

  /** Mobile: fixed top background strip behind back / search / bell. */
  const mobileScrollHeaderLayer = (
    <div
      data-mobile-header-strip=""
      className={cn(
        "md:hidden pointer-events-none fixed inset-x-0 top-0 z-[58] translate-y-0 opacity-100",
        "border-none bg-background shadow-none backdrop-blur-none transition-colors duration-300 dark:bg-background"
      )}
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "0.5rem",
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
        "md:hidden fixed z-[60] pointer-events-none",
        mobileSearchOpen || isCommunityPostsFilterPage
          ? "left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))]"
          : "right-[max(0.75rem,env(safe-area-inset-right))]"
      )}
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div
        ref={mobileSearchClusterRef}
        className={cn(
          "pointer-events-auto flex flex-row flex-nowrap items-center gap-1.5",
          mobileSearchOpen || isCommunityPostsFilterPage
            ? !mobileSearchOpen && isCommunityPostsFilterPage
              ? "ml-14 min-w-0 flex-1"
              : "w-full"
            : "max-w-[calc(100vw-1rem)] justify-end",
          mobileSearchOpen && !isCommunityPostsFilterPage && "justify-end"
        )}
      >
        {isCommunityPostsFilterPage && !mobileSearchOpen && (
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
        <div className={cn("relative shrink-0", !isCommunityPostsFilterPage && !mobileSearchOpen && "ml-auto")}>
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="p-2 text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300"
            aria-label={mobileSearchOpen ? "Close search" : "Search helpers"}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? <X className="h-6 w-6" strokeWidth={2} /> : <Search className="h-6 w-6" strokeWidth={2} />}
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
        {user && (
          <button
            type="button"
            onClick={() => setDesktopAppMenuOpen(true)}
            className="shrink-0 p-2.5 text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300"
            aria-label="Open app menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );

  /** Mobile: back top-left on every page; jobs tab sits to the right of back when on /jobs?mode=… */
  const jobsModeInUrl = jobsSearchParams.get("mode");
  /** Back: plain icon on the strip (no pill). */
  const mobileUniversalBackBtnClass =
    "pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 transition-all hover:opacity-80 active:scale-95 dark:text-slate-300";

  const MobileLeftHeaderCluster = isPublicUserProfilePage ? null : (
    <div
      className="md:hidden fixed z-[70] pointer-events-none flex max-w-[calc(100vw-9rem)] flex-row items-center gap-1"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))", left: "max(0.75rem, env(safe-area-inset-left))" }}
    >
      <button type="button" onClick={handleHeaderBack} className={mobileUniversalBackBtnClass} aria-label="Back">
        <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
      </button>
      {!mobileSearchOpen && isJobsPage && jobsModeInUrl ? (
        <div className="pointer-events-auto min-w-0 flex-1 overflow-hidden">
          <JobsTabBar menuAlign="left" hideDesktop />
        </div>
      ) : null}
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
        <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
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
      "/freelancer/dashboard",
      "/freelancer/profile",
      "/freelancer/notifications",
      "/freelancer/active-jobs",
      "/client/home",
      "/client/profile",
      "/client/create",
      "/client/active-jobs",
      "/posts",
      "/availability",
      "/public/posts",
      "/liked",
      "/dashboard",
      "/messages",
      "/calendar"
    ];
    if (!allowedPaths.some(path => location.pathname.startsWith(path))) {
      return null;
    }
  }

  // On onboarding page, show basic navigation
  if (location.pathname === "/onboarding" && !profile) {
    return (
      <>
        {DesktopHeader}
        {mobileScrollHeaderLayer}
        {MobileLeftHeaderCluster}
        {MobileFloatingActions}
        {ProfileMenuModal}
        {DesktopAppMenuModal}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none px-0 pb-0 md:px-0 md:pb-0">
          <div
            className={cn(
              "bottom-nav-mobile-shell mx-auto w-full max-w-none overflow-visible rounded-none pointer-events-auto md:mb-6 md:max-w-xs md:rounded-2xl"
            )}
          >
            <div className="flex items-center justify-center px-6 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom,0px)]">
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-500 flex-shrink-0" title="Getting Started">
                <Home className="w-7 h-7" />
              </div>
            </div>
          </div>
        </nav>
        <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </>
    );
  }

  // User navigation (Client & Freelancer)
  if ((profile && !profile.is_admin) || (!profile && (location.pathname.startsWith("/client") || location.pathname.startsWith("/freelancer")))) {
    const isFreelancer = profile?.role === "freelancer";

    const profileTabPath = isFreelancer ? "/freelancer/profile" : "/client/profile";
    const userNav = [
      { path: isFreelancer ? "/freelancer/home" : "/client/home", icon: Home, label: "Home" },
      { path: "/liked", icon: Heart, label: "Liked" },
      // { path: "/jobs", icon: Briefcase, label: "Jobs" }, // hidden for now — re-add Briefcase import when restoring
      { path: "/messages", icon: MessageCircle, label: "Inbox" },
    ];

    return (
      <>
        {DesktopHeader}
        {mobileScrollHeaderLayer}
        {MobileLeftHeaderCluster}
        {MobileFloatingActions}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none overflow-visible px-0 pb-0 md:px-0 md:pb-0">
          <div
            className={cn(
              "bottom-nav-mobile-shell mx-auto w-full max-w-none overflow-visible rounded-none pointer-events-auto md:mb-6 md:max-w-md md:rounded-2xl"
            )}
          >
            <div className="mx-0 flex w-full max-w-none items-center justify-evenly overflow-visible px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 md:justify-between md:px-6 md:py-2 md:pb-2 lg:px-8 xl:px-12">
              {/* Home + Liked */}
              {userNav.slice(0, 2).map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === "/liked"
                    ? location.pathname.startsWith("/liked")
                    : location.pathname.startsWith(item.path);

                const jobsBadgeCount =
                  item.path === "/jobs" ? scheduleChanges + activityInboxCount : 0;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex flex-col items-center justify-center p-1 transition-all relative",
                      isActive ? "text-slate-800 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    <div
                      data-nav-liked-anchor={item.path === "/liked" ? "" : undefined}
                      className={cn(
                        "flex flex-col items-center justify-center w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-2xl transition-all duration-300 relative",
                        isActive
                          ? "bg-white/70 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                          : "md:hover:bg-slate-50 dark:md:hover:bg-zinc-800/80"
                      )}
                    >
                      <Icon
                        className={cn(
                          "transition-all duration-300",
                          isActive ? "w-6 h-6 sm:w-7 sm:h-7 fill-current" : "w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110",
                          isActive && item.path === "/liked" && "text-rose-500 dark:text-rose-400"
                        )}
                      />
                      {jobsBadgeCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -right-1 -top-1 z-10 flex h-6 min-w-6 items-center justify-center border-[3px] border-white px-1 text-[11px] font-black leading-none shadow-sm dark:border-zinc-900 sm:h-7 sm:min-w-7 sm:px-1.5 sm:text-xs"
                        >
                          {jobsBadgeCount > 9 ? "9+" : jobsBadgeCount}
                        </Badge>
                      )}
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 hidden text-[10px] font-semibold leading-none md:inline",
                        isActive && item.path === "/liked" && "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}

              {/* Center FAB — post request vs community offers */}
              <div
                ref={fabMenuRef}
                className="relative z-10 mx-0.5 flex shrink-0 items-center justify-center md:mx-2"
              >
                <button
                  type="button"
                  onClick={() => setFabMenuOpen((v) => !v)}
                  className={cn(
                    "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all active:scale-95",
                    "outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-inset"
                  )}
                  aria-label="Create post or browse"
                  aria-expanded={fabMenuOpen}
                  aria-haspopup="menu"
                >
                  <Plus className="h-7 w-7 stroke-[2.5]" aria-hidden />
                </button>
                {fabMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-[calc(100%+10px)] left-1/2 z-[130] w-[min(22.5rem,calc(100vw-1.25rem))] -translate-x-1/2 rounded-[1.25rem] border border-border/60 bg-card/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.2)] backdrop-blur-xl dark:bg-card/98 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-base font-semibold text-foreground transition-colors hover:bg-muted/80"
                      onClick={() => {
                        navigate("/client/create");
                        setFabMenuOpen(false);
                      }}
                    >
                      <ClipboardList className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug">Post a request</span>
                        <span className="mt-1 block text-[13px] font-normal text-muted-foreground leading-snug">
                          Find helpers — describe what you need
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-base font-semibold text-foreground transition-colors hover:bg-muted/80"
                      onClick={() => {
                        navigate("/availability");
                        setFabMenuOpen(false);
                      }}
                    >
                      <UsersRound className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug">Set availability</span>
                        <span className="mt-1 block text-[13px] font-normal text-muted-foreground leading-snug">
                          Short window — clients see you now and can tap to chat
                        </span>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Messages (Jobs tab commented out in userNav for now) */}
              {userNav.slice(2, 3).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                const inboxBadgeCount = unreadMessages;
                const showMessageBadge = item.path === "/messages" && inboxBadgeCount > 0;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex flex-col items-center justify-center p-1 transition-all relative",
                      isActive ? "text-slate-800 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-2xl transition-all duration-300 relative",
                        isActive
                          ? "bg-white/70 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                          : "md:hover:bg-slate-50 dark:md:hover:bg-zinc-800/80"
                      )}
                    >
                      <Icon className={cn("transition-all duration-300", isActive ? "w-6 h-6 sm:w-7 sm:h-7 fill-current" : "w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110")} />
                    </div>
                    <span className="mt-0.5 hidden text-[10px] font-semibold leading-none md:inline">{item.label}</span>

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
              })}

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
                        isActive ? "text-slate-800 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                      aria-label="Open profile menu"
                    >
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-2xl transition-all duration-300 relative overflow-visible",
                          isActive
                            ? "bg-white/70 shadow-sm ring-1 ring-slate-300/50 dark:bg-white/15 dark:ring-white/25"
                            : "md:hover:bg-slate-50 dark:md:hover:bg-zinc-800/80"
                        )}
                      >
                        <Avatar className="h-9 w-9 border border-black/10 dark:border-white/15">
                          <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
                          <AvatarFallback className="text-[10px] font-bold bg-slate-100 dark:bg-zinc-800">
                            {(profile?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <span className="mt-0.5 hidden text-[10px] font-semibold leading-none md:inline">Profile</span>
                    </button>

                    <Link
                      to={profileTabPath}
                      className={cn(
                        "hidden md:flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative",
                        isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      )}
                    >
                      <div className={cn("flex flex-col items-center justify-center w-[48px] h-[48px] rounded-xl transition-all duration-300 relative", isActive ? "bg-slate-100 dark:bg-zinc-800/80" : "group-hover:bg-slate-50 dark:group-hover:bg-zinc-800")}>
                        <User className={cn("transition-all duration-300", isActive ? "w-7 h-7 fill-current" : "w-7 h-7 group-hover:scale-110")} />
                      </div>
                      <span className="mt-0.5 text-[10px] font-semibold leading-none">Profile</span>
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
        <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </>
    );
  }

  // Default fallback - show basic nav if user exists
  if (user) {
    return (
      <>
        {DesktopHeader}
        {mobileScrollHeaderLayer}
        {MobileLeftHeaderCluster}
        {MobileFloatingActions}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none px-0 pb-0 md:px-0 md:pb-0">
          <div className="bottom-nav-mobile-shell mx-auto w-full max-w-none overflow-visible rounded-none pointer-events-auto md:mb-6 md:max-w-xs md:rounded-2xl">
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
        <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </>
    );
  }

  return null;
}

