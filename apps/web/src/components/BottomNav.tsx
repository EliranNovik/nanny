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
    <header className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border-b border-border/40 transition-all">
      <div className="max-w-2xl mx-auto px-5 py-2.5 flex items-center justify-between gap-2">
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

        <div className="flex flex-1 items-center gap-2 min-w-0 mx-2 sm:mx-4">
          <div className="min-w-0 flex-1 max-w-[180px] sm:max-w-xs">
            <UserSearch />
          </div>
          {isJobsPage && <JobsTabBar />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationBadgeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute top-1.5 right-1.5 h-4 min-w-4 flex items-center justify-center px-1 text-[9px] font-black border-2 border-white dark:border-zinc-900"
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
            <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-2 shadow-[0_10px_25px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/95">
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
            className="rounded-full bg-white/90 p-2.5 text-slate-600 shadow-lg backdrop-blur-md transition-all hover:bg-white active:scale-95 dark:border dark:border-border/60 dark:bg-zinc-900/90 dark:text-slate-300 dark:hover:bg-zinc-800"
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
            className="relative shrink-0 rounded-full border border-border/60 bg-white/90 p-2.5 text-slate-600 shadow-lg backdrop-blur-md transition-all hover:bg-white active:scale-95 dark:bg-zinc-900/90 dark:text-slate-300 dark:hover:bg-zinc-800"
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
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-border/60 shadow-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-zinc-800 transition-all active:scale-95"
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
          <JobsTabBar menuAlign="left" />
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
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none">
          <div className="w-full md:max-w-xs md:mb-6 md:rounded-full bg-white dark:bg-zinc-900 border-t md:border border-slate-200/50 dark:border-white/5 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] pointer-events-auto">
            <div className="flex items-center justify-center py-2 px-6 pb-[env(safe-area-inset-bottom,0px)]">
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
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none overflow-visible">
          <div className="w-full md:max-w-md md:mb-6 md:rounded-full bg-white dark:bg-zinc-900 border-t md:border border-slate-200/50 dark:border-white/5 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] pointer-events-auto overflow-visible">
            <div className="flex items-center justify-between w-full max-w-2xl mx-auto px-6 py-2 overflow-visible">
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
                      "flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative",
                      isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    )}
                  >
                    <div className={cn("flex flex-col items-center justify-center w-[48px] h-[48px] rounded-xl transition-all duration-300 relative", isActive ? "bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200" : "group-hover:bg-slate-50 dark:group-hover:bg-zinc-800")}>
                      <Icon className={cn("transition-all duration-300", isActive ? "w-7 h-7 fill-current" : "w-7 h-7 group-hover:scale-110")} />
                    </div>
                    <span className="mt-0.5 text-[10px] font-semibold leading-none">{item.label}</span>

                    {jobsBadgeCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute top-1 right-1 h-4 min-w-[16px] flex items-center justify-center px-1 text-[9px] font-bold border-2 border-white dark:border-zinc-900 shadow-sm"
                      >
                        {jobsBadgeCount > 9 ? "9+" : jobsBadgeCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}

              {/* Center Plus Button */}
              <div className="mx-2 flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={() => navigate("/client/create")}
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-transparent text-white transition-all hover:scale-105 active:scale-95"
                  aria-label="Post Job"
                >
                  <img
                    src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                    alt=""
                    className="h-[52px] w-[52px] rounded-full object-cover"
                  />
                </button>
                <span className="mt-0.5 text-[10px] font-semibold leading-none text-slate-400 dark:text-slate-500">Post</span>
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
                      "flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative",
                      isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    )}
                  >
                    <div className={cn("flex flex-col items-center justify-center w-[48px] h-[48px] rounded-xl transition-all duration-300 relative", isActive ? "bg-slate-100 dark:bg-zinc-800/80" : "group-hover:bg-slate-50 dark:group-hover:bg-zinc-800")}>
                      <Icon className={cn("transition-all duration-300", isActive ? "w-7 h-7 fill-current" : "w-7 h-7 group-hover:scale-110")} />
                    </div>
                    <span className="mt-0.5 text-[10px] font-semibold leading-none">{item.label}</span>

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
                        "md:hidden flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative",
                        isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      )}
                      aria-label="Open profile menu"
                    >
                      <div className={cn("flex flex-col items-center justify-center w-[48px] h-[48px] rounded-xl transition-all duration-300 relative overflow-visible", isActive ? "bg-slate-100 dark:bg-zinc-800/80 ring-1 ring-slate-300/70 dark:ring-zinc-700/70" : "group-hover:bg-slate-50 dark:group-hover:bg-zinc-800")}>
                        <Avatar className="h-9 w-9 border border-black/10">
                          <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
                          <AvatarFallback className="text-[10px] font-bold bg-slate-100 dark:bg-zinc-800">
                            {(profile?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <span className="mt-0.5 text-[10px] font-semibold leading-none">Profile</span>
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
            {/* Safe area padding */}
            <div className="h-[env(safe-area-inset-bottom,0px)] w-full" />
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
        <nav className="fixed bottom-0 left-0 right-0 z-[120] flex justify-center pointer-events-none">
          <div className="w-full md:max-w-xs md:mb-6 md:rounded-full bg-white dark:bg-zinc-900 border-t md:border border-slate-200/50 dark:border-white/5 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] pointer-events-auto">
            <div className="max-w-2xl mx-auto flex items-center justify-center py-2 px-6 pb-[env(safe-area-inset-bottom,0px)]">
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

