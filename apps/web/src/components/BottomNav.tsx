import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useReportIssue } from "@/context/ReportIssueContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useConfirmationCounts } from "@/hooks/useConfirmationCounts";
import { useScheduleChanges } from "@/hooks/useScheduleChanges";
import { Home, MessageCircle, User, Bell, Briefcase, AlertCircle, Plus, ChevronDown, LogOut, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsModal } from "@/components/NotificationsModal";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function BottomNav() {
  const { profile, loading, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { openReportModal } = useReportIssue();
  const { unreadNotifications, unreadMessages } = useUnreadCounts();
  const { totalConfirmations } = useConfirmationCounts();
  const { scheduleChanges } = useScheduleChanges();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profilePath = profile?.role === "freelancer" ? "/freelancer/profile" : profile?.role === "client" ? "/client/profile" : "/dashboard";

  // Nothing on landing page, chat pages, or messages page
  if (location.pathname === "/" || location.pathname.startsWith("/chat/") || location.pathname.startsWith("/messages")) {
    return null;
  }

  const notificationBadgeCount =
    (totalConfirmations > 0 ? 1 : 0) + scheduleChanges + unreadNotifications;

  const TopHeader = (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between relative">
        <button
          type="button"
          onClick={() => setProfileMenuOpen(true)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors py-1 -my-1 px-1 -mx-1"
          aria-label="Open profile menu"
        >
          <Avatar className="h-8 w-8 flex-shrink-0 border-2 border-background/50">
            <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
            <AvatarFallback className="text-xs">
              {(profile?.full_name ?? user?.email ?? "User").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-sm font-medium text-black dark:text-white truncate">
              {profile?.full_name ?? user?.email ?? "User"}
            </span>
            <ChevronDown className="w-4 h-4 flex-shrink-0 text-black/80 dark:text-white/80" />
          </span>
        </button>

        {/* Center Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center items-center">
          <button
            onClick={() => navigate("/client/create")}
            className="group transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center p-1"
            title="Find a helper"
            aria-label="Find a helper"
          >
            <img
              src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
              alt="Logo"
              className="w-10 h-10 object-contain rounded-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openReportModal}
            className="p-2 rounded-full text-black/80 dark:text-white/80 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
            aria-label="Report"
            title="Report"
          >
            <AlertCircle className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative p-2 rounded-full text-black/80 dark:text-white/80 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationBadgeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center px-1 text-[10px] font-bold"
              >
                {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
              </Badge>
            )}
          </button>
        </div>
      </div>
    </header>
  );

  const ProfileMenuModal = (
    <Dialog open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
      <DialogContent className="max-w-xs p-4 gap-3 rounded-xl left-4 right-4 top-14 translate-x-0 translate-y-0 w-[calc(100%-2rem)] max-w-sm data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2">
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
        {TopHeader}
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
        {TopHeader}
        {ProfileMenuModal}
        <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 pb-4 pointer-events-auto">
            <div className="w-full max-w-xs mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-center min-w-max px-4 py-2">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-500 flex-shrink-0" title="Getting Started">
                  <Home className="w-6 h-6" />
                </div>
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

    const userNav = [
      { path: isFreelancer ? "/freelancer/dashboard" : "/dashboard", icon: Home, label: isFreelancer ? "Home" : "Dashboard" },
      { path: "/jobs", icon: Briefcase, label: "Jobs" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
      { path: isFreelancer ? "/freelancer/profile" : "/client/profile", icon: User, label: "Profile" },
    ];

    return (
      <>
        {TopHeader}
        <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 pb-4 pointer-events-auto">
            <div className="w-full max-w-[400px] sm:max-w-md mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between w-full px-5 py-2">
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
                        "flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative group",
                        isActive ? "text-orange-600 dark:text-orange-500" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      )}
                    >
                      <div className={cn("flex flex-col items-center justify-center w-[48px] h-[48px] rounded-2xl transition-all duration-300 relative", isActive ? "bg-orange-50 dark:bg-orange-500/10" : "group-hover:bg-slate-50 dark:group-hover:bg-zinc-800")}>
                        <Icon className={cn("transition-all duration-300", isActive ? "w-7 h-7" : "w-7 h-7 group-hover:scale-110")} />
                      </div>

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
                <button
                  type="button"
                  onClick={() => navigate("/client/create")}
                  className="flex items-center justify-center h-[52px] w-[52px] rounded-full bg-orange-500 text-white shadow-[0_8px_20px_rgba(249,115,22,0.3)] hover:shadow-[0_12px_24px_rgba(249,115,22,0.4)] transition-all hover:scale-105 active:scale-95 mx-1"
                  aria-label="Create Job"
                >
                  <Plus className="w-8 h-8" />
                </button>

                {/* Last two items */}
                {userNav.slice(2).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  const showMessageBadge = item.path === "/messages" && unreadMessages > 0;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex flex-col items-center justify-center p-1 rounded-2xl transition-all relative group",
                        isActive ? "text-orange-600 dark:text-orange-500" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      )}
                    >
                      <div className={cn("flex flex-col items-center justify-center w-[48px] h-[48px] rounded-2xl transition-all duration-300 relative", isActive ? "bg-orange-50 dark:bg-orange-500/10" : "group-hover:bg-slate-50 dark:group-hover:bg-zinc-800")}>
                        <Icon className={cn("transition-all duration-300", isActive ? "w-7 h-7" : "w-7 h-7 group-hover:scale-110")} />
                      </div>

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
              </div>
            </div>
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
        {TopHeader}
        <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 pb-4 pointer-events-auto">
            <div className="w-full max-w-xs mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-center min-w-max px-4 py-2">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 flex-shrink-0 animate-pulse">
                  <Home className="w-6 h-6" />
                </div>
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

