import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useConfirmationCounts } from "@/hooks/useConfirmationCounts";
import { useScheduleChanges } from "@/hooks/useScheduleChanges";
import { Home, MessageCircle, User, Bell, Briefcase, ChevronDown, LogOut, Pencil, Search, X, ArrowLeft } from "lucide-react";
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
import { JobsTabBar } from "@/components/jobs/JobsTabBar";

export function BottomNav() {
  const { profile, loading, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadNotifications, unreadMessages } = useUnreadCounts();
  const { totalConfirmations } = useConfirmationCounts();
  const { scheduleChanges } = useScheduleChanges();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchClusterRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(location.pathname);
  const profilePath = profile?.role === "freelancer" ? "/freelancer/profile" : profile?.role === "client" ? "/client/profile" : "/dashboard";

  const pathnameNorm = location.pathname.replace(/\/$/, "") || "/";
  const isProfileHub =
    pathnameNorm === "/client/profile" || pathnameNorm === "/freelancer/profile";
  const isProfileSubpage = /^\/(client|freelancer)\/profile\/.+/.test(pathnameNorm);
  const profileBackTarget =
    isProfileHub
      ? pathnameNorm.startsWith("/freelancer")
        ? "/freelancer/dashboard"
        : "/dashboard"
      : isProfileSubpage
        ? pathnameNorm.startsWith("/freelancer")
          ? "/freelancer/profile"
          : "/client/profile"
        : null;
  const showProfileBack = profileBackTarget !== null;
  const isJobsPage = pathnameNorm === "/jobs";

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const close = (e: MouseEvent) => {
      if (mobileSearchClusterRef.current && !mobileSearchClusterRef.current.contains(e.target as Node)) {
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (previousPathnameRef.current !== location.pathname && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
    previousPathnameRef.current = location.pathname;
  }, [location.pathname, mobileSearchOpen]);

  // Nothing on landing page, chat pages, or messages page
  if (location.pathname === "/" || location.pathname.startsWith("/chat/") || location.pathname.startsWith("/messages")) {
    return null;
  }

  const notificationBadgeCount =
    (totalConfirmations > 0 ? 1 : 0) + scheduleChanges + unreadNotifications;

  /** Desktop only: top bar — back (profile hub/subpages) or account, search, notifications */
  const DesktopHeader = (
    <header className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-card/70 backdrop-blur-md border-b border-border/40 transition-all">
      <div className="app-desktop-shell grid grid-cols-3 items-center gap-3 py-2.5">
        <div className="flex min-w-0 justify-start">
        {showProfileBack ? (
          <button
            type="button"
            onClick={() => navigate(profileBackTarget!)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-black/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
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
        )}
        </div>

        <div className="flex min-w-0 max-w-full justify-center justify-self-center px-2 md:max-w-xl md:px-4 lg:max-w-2xl">
          <div className="w-full min-w-0">
            <UserSearch />
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
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center border-2 border-white px-1 text-[9px] font-black dark:border-zinc-900 md:right-0.5 md:top-0.5 md:h-5 md:min-w-5 md:px-1.5 md:text-[10px]"
              >
                {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
              </Badge>
            )}
          </button>
        </div>
      </div>
    </header>
  );

  /** Mobile only: floating row — search + notifications (top-right). When search is open, spans width and hides bell. */
  const MobileFloatingActions = (
    <div
      className={cn(
        "md:hidden fixed z-[60] pointer-events-none",
        mobileSearchOpen
          ? "left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))]"
          : "right-[max(0.75rem,env(safe-area-inset-right))]"
      )}
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div
        ref={mobileSearchClusterRef}
        className={cn(
          "pointer-events-auto flex flex-row flex-nowrap items-center gap-2",
          mobileSearchOpen ? "w-full justify-end" : "max-w-[calc(100vw-1rem)] justify-end"
        )}
      >
        {mobileSearchOpen && (
          <div className="min-w-0 flex-1 shrink animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="rounded-2xl border border-slate-200/70 bg-card/95 p-2 shadow-[0_10px_25px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-border/50 dark:bg-card/95">
              <UserSearch
                autoFocus
                onResultSelect={() => setMobileSearchOpen(false)}
                className="max-w-none w-full"
              />
            </div>
          </div>
        )}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="rounded-full bg-card/90 p-2.5 text-slate-600 shadow-lg backdrop-blur-md transition-all hover:bg-card active:scale-95 dark:border dark:border-border/60 dark:text-slate-300 dark:hover:bg-muted"
            aria-label={mobileSearchOpen ? "Close search" : "Search helpers"}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>
        {!mobileSearchOpen && (
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative shrink-0 rounded-full border border-border/60 bg-card/90 p-2.5 text-slate-600 shadow-lg backdrop-blur-md transition-all hover:bg-card active:scale-95 dark:text-slate-300 dark:hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {notificationBadgeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-0.5 -top-0.5 h-4 min-w-4 border-2 border-white px-1 text-[9px] font-black dark:border-zinc-900"
              >
                {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
              </Badge>
            )}
          </button>
        )}
      </div>
    </div>
  );

  /** Mobile: fixed back (left), same vertical band as search + bell (right) */
  const MobileProfileBack =
    showProfileBack && !mobileSearchOpen ? (
      <div
        className="md:hidden fixed z-[60] pointer-events-none"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))", left: "max(0.75rem, env(safe-area-inset-left))" }}
      >
        <button
          type="button"
          onClick={() => navigate(profileBackTarget!)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-md border border-border/60 shadow-lg text-slate-600 dark:text-slate-300 hover:bg-card dark:hover:bg-muted transition-all active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    ) : null;

  /** Mobile jobs: tab pill top-left (search + bell stay top-right) */
  const MobileJobsTabLeft =
    isJobsPage && !showProfileBack && !mobileSearchOpen ? (
      <div
        className="md:hidden fixed z-[60] pointer-events-none"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))", left: "max(0.75rem, env(safe-area-inset-left))" }}
      >
        <div className="pointer-events-auto">
          <JobsTabBar menuAlign="left" hideDesktop />
        </div>
      </div>
    ) : null;

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
        {MobileProfileBack}
        {MobileJobsTabLeft}
        {ProfileMenuModal}
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
      "/freelancer/dashboard",
      "/freelancer/profile",
      "/freelancer/notifications",
      "/freelancer/active-jobs",
      "/client/profile",
      "/client/create",
      "/client/active-jobs",
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
        {MobileProfileBack}
        {MobileJobsTabLeft}
        {MobileFloatingActions}
        {ProfileMenuModal}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-0 md:pb-0">
          <div
            className={cn(
              "bottom-nav-mobile-shell mx-auto w-full max-w-[min(21rem,calc(100vw-2.75rem))] overflow-visible rounded-full pointer-events-auto md:mb-6 md:max-w-xs"
            )}
          >
            <div className="flex items-center justify-center px-6 py-2 md:pb-[env(safe-area-inset-bottom,0px)]">
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
      { path: isFreelancer ? "/freelancer/dashboard" : "/dashboard", icon: Home, label: isFreelancer ? "Home" : "Dashboard" },
      { path: "/jobs", icon: Briefcase, label: "Jobs" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
      { path: profileTabPath, icon: User, label: "Profile" },
    ];

    return (
      <>
        {DesktopHeader}
        {MobileProfileBack}
        {MobileJobsTabLeft}
        {MobileFloatingActions}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none overflow-visible px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-0 md:pb-0">
          <div
            className={cn(
              "bottom-nav-mobile-shell mx-auto w-full max-w-[min(21rem,calc(100vw-2.75rem))] overflow-visible rounded-full pointer-events-auto md:mb-6 md:max-w-md"
            )}
          >
            <div className="mx-0 flex w-full max-w-none items-center justify-evenly overflow-visible px-2 py-2 sm:px-3 md:justify-between md:px-6 md:py-2 lg:px-8 xl:px-12">
              {/* First two items */}
              {userNav.slice(0, 2).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);

                const jobsBadgeCount = item.path === "/jobs"
                  ? (totalConfirmations > 0 ? 1 : 0) + scheduleChanges + unreadNotifications
                  : 0;

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

                    {jobsBadgeCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center border-2 border-white px-1 text-[10px] font-black leading-none dark:border-zinc-900"
                      >
                        {jobsBadgeCount > 9 ? "9+" : jobsBadgeCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}

              {/* Center logo — floats above bar on mobile; no label (overflow clips PNG halo) */}
              <div className="relative z-10 mx-0.5 flex shrink-0 items-center justify-center md:mx-2">
                <button
                  type="button"
                  onClick={() => navigate("/client/create")}
                  className={cn(
                    "flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full text-white transition-all active:scale-95 md:h-[52px] md:w-[52px]",
                    "border-0 bg-transparent p-0 shadow-[0_10px_28px_rgba(0,0,0,0.2)] outline-none ring-0 ring-offset-0",
                    "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "-mt-7 md:mt-0 md:shadow-lg md:hover:scale-105"
                  )}
                  aria-label="Post job"
                >
                  <img
                    src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                    alt=""
                    className="pointer-events-none block h-full w-full scale-[1.12] object-cover object-center outline-none ring-0 md:scale-100"
                  />
                </button>
              </div>

              {/* Messages: mobile + desktop */}
              {userNav.slice(2, 3).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                const showMessageBadge = item.path === "/messages" && unreadMessages > 0;

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
                        className="absolute top-1 right-1 h-4 min-w-[16px] flex items-center justify-center px-1 text-[9px] font-bold border-2 border-white dark:border-zinc-900 shadow-sm"
                      >
                        {unreadMessages > 9 ? "9+" : unreadMessages}
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
        <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </>
    );
  }

  // Default fallback - show basic nav if user exists
  if (user) {
    return (
      <>
        {DesktopHeader}
        {MobileProfileBack}
        {MobileJobsTabLeft}
        {MobileFloatingActions}
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-0 md:pb-0">
          <div className="bottom-nav-mobile-shell mx-auto w-full max-w-[min(21rem,calc(100vw-2.75rem))] overflow-visible rounded-full pointer-events-auto md:mb-6 md:max-w-xs">
            <div className="flex items-center justify-center px-4 py-2 md:px-6 md:pb-[env(safe-area-inset-bottom,0px)]">
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 flex-shrink-0 animate-pulse">
                <Home className="w-7 h-7" />
              </div>
            </div>
          </div>
        </nav>
        {ProfileMenuModal}
        <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </>
    );
  }

  return null;
}

