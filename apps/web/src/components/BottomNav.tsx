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

  // Nothing on landing page (no header, no nav)
  if (location.pathname === "/") {
    return null;
  }

  const notificationBadgeCount =
    profile?.role === "client"
      ? (totalConfirmations > 0 ? 1 : 0) + scheduleChanges
      : profile?.role === "freelancer"
        ? unreadNotifications
        : 0;

  const TopHeader = (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 dark:bg-background/60 backdrop-blur-md">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setProfileMenuOpen(true)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg hover:bg-white/50 dark:hover:bg-muted/50 transition-colors py-1 -my-1 px-1 -mx-1"
          aria-label="Open profile menu"
        >
          <Avatar className="h-8 w-8 flex-shrink-0 border-2 border-background/50">
            <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
            <AvatarFallback className="text-xs">
              {(profile?.full_name ?? user?.email ?? "User").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {profile?.full_name ?? user?.email ?? "User"}
            </span>
            <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openReportModal}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-muted transition-colors"
            aria-label="Report"
            title="Report"
          >
            <AlertCircle className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-muted transition-colors"
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
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="w-fit mx-auto bg-card/95 backdrop-blur-md border rounded-full shadow-lg overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-center min-w-max px-2 py-2">
                <div className="flex items-center justify-center py-2.5 px-3.5 rounded-full flex-shrink-0 text-muted-foreground" title="Getting Started">
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

  // Client navigation - show if profile exists OR if on client pages
  if ((profile && profile.role === "client") || (!profile && location.pathname.startsWith("/client"))) {
    const clientNav = [
      { path: "/dashboard", icon: Home, label: "Dashboard" },
      { path: "/client/active-jobs", icon: Briefcase, label: "Jobs" },
      // { path: "/calendar", icon: Calendar, label: "Calendar" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
      // { path: "/payments", icon: CreditCard, label: "Payments" },
      { path: "/client/profile", icon: User, label: "Profile" },
    ];
    return (
      <>
        {TopHeader}
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="w-fit mx-auto bg-card/95 backdrop-blur-md border rounded-full shadow-lg overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-center min-w-max px-2 py-2 gap-1">
                {clientNav.slice(0, 2).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  const showMessageBadge = item.path === "/messages" && unreadMessages > 0;
                  const totalJobsBadge = (totalConfirmations > 0 ? 1 : 0) + scheduleChanges;
                  const showJobsBadge = item.path === "/client/active-jobs" && totalJobsBadge > 0;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center justify-center py-2.5 px-3.5 rounded-full flex-shrink-0 transition-colors relative",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title={item.label}
                    >
                      <div className="relative">
                        <Icon className="w-6 h-6" />
                        {showMessageBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
                          >
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </Badge>
                        )}
                        {showJobsBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
                          >
                            {totalJobsBadge > 9 ? "9+" : totalJobsBadge}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => navigate("/client/create")}
                  className="flex items-center justify-center h-12 w-12 rounded-full flex-shrink-0 bg-orange-500 text-white hover:bg-orange-600 shadow-lg transition-colors"
                  title="Find a helper"
                  aria-label="Find a helper"
                >
                  <Plus className="w-7 h-7" />
                </button>
                {clientNav.slice(2).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  const showMessageBadge = item.path === "/messages" && unreadMessages > 0;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center justify-center py-2.5 px-3.5 rounded-full flex-shrink-0 transition-colors relative",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title={item.label}
                    >
                      <div className="relative">
                        <Icon className="w-6 h-6" />
                        {showMessageBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
                          >
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </Badge>
                        )}
                      </div>
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

  // Admin navigation
  if (profile && profile.is_admin) {
    const adminNav = [
      { path: "/admin", icon: Briefcase, label: "Admin" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
    ];

    return (
      <>
        {TopHeader}
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="w-fit mx-auto bg-card/95 backdrop-blur-md border rounded-full shadow-lg overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-center min-w-max px-2 py-2 gap-1">
                {adminNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
"flex items-center justify-center py-2.5 px-3.5 rounded-full flex-shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title={item.label}
                    >
                      <Icon className="w-6 h-6" />
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

  // Freelancer navigation - show if profile exists OR if on freelancer pages
  if ((profile && profile.role === "freelancer") || (!profile && location.pathname.startsWith("/freelancer"))) {
    const freelancerNav = [
      { path: "/freelancer/dashboard", icon: Home, label: "Home" },
      { path: "/freelancer/notifications", icon: Bell, label: "Requests" },
      { path: "/freelancer/active-jobs", icon: Briefcase, label: "Jobs" },
      // { path: "/calendar", icon: Calendar, label: "Calendar" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
      // { path: "/payments", icon: CreditCard, label: "Payments" },
      { path: "/freelancer/profile", icon: User, label: "Profile" },
    ];

    return (
      <>
        {TopHeader}
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="w-fit mx-auto bg-card/95 backdrop-blur-md border rounded-full shadow-lg overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-center min-w-max px-2 py-2 gap-1">
                {freelancerNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path === "/freelancer/profile"
                    ? location.pathname.startsWith(item.path)
                    : location.pathname.startsWith(item.path);
                  const showNotificationBadge = item.path === "/freelancer/notifications" && unreadNotifications > 0;
                  const showMessageBadge = item.path === "/messages" && unreadMessages > 0;
                  const showScheduleBadge = item.path === "/freelancer/active-jobs" && scheduleChanges > 0;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center justify-center py-2.5 px-3.5 rounded-full flex-shrink-0 transition-colors relative",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title={item.label}
                    >
                      <div className="relative">
                        <Icon className="w-6 h-6" />
                        {showNotificationBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
                          >
                            {unreadNotifications > 9 ? "9+" : unreadNotifications}
                          </Badge>
                        )}
                        {showMessageBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
                          >
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </Badge>
                        )}
                        {showScheduleBadge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
                          >
                            {scheduleChanges > 9 ? "9+" : scheduleChanges}
                          </Badge>
                        )}
                      </div>
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
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="w-fit mx-auto bg-card/95 backdrop-blur-md border rounded-full shadow-lg overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-center min-w-max px-2 py-2">
                <div className="flex items-center justify-center py-2.5 px-3.5 rounded-full flex-shrink-0 text-muted-foreground" title="Loading...">
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

