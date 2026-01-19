import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useReportIssue } from "@/context/ReportIssueContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useConfirmationCounts } from "@/hooks/useConfirmationCounts";
import { useScheduleChanges } from "@/hooks/useScheduleChanges";
import { Home, MessageCircle, User, Bell, Briefcase, Calendar, AlertCircle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function BottomNav() {
  const { profile, loading, user } = useAuth();
  const location = useLocation();
  const { openReportModal } = useReportIssue();
  const { unreadNotifications, unreadMessages } = useUnreadCounts();
  const { totalConfirmations } = useConfirmationCounts();
  const { scheduleChanges } = useScheduleChanges();

  // Don't show on login page
  if (location.pathname === "/login") {
    return null;
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
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card shadow-lg z-50 pb-2 md:pb-0">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start min-w-max px-2">
            <div className="flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 text-muted-foreground">
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">Getting Started</span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Client navigation - show if profile exists OR if on client pages
  if ((profile && profile.role === "client") || (!profile && location.pathname.startsWith("/client"))) {
    const clientNav = [
      { path: "/dashboard", icon: Home, label: "Dashboard" },
      { path: "/client/active-jobs", icon: Briefcase, label: "Jobs" },
      { path: "/calendar", icon: Calendar, label: "Calendar" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
      { path: "/payments", icon: CreditCard, label: "Payments" },
      { path: "/client/profile", icon: User, label: "Profile" },
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card shadow-lg z-50 pb-2 md:pb-0">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start min-w-max px-2">
            {clientNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              const showMessageBadge = item.path === "/messages" && unreadMessages > 0;
              
              // Combine confirmation and schedule badges for Jobs button
              const totalJobsBadge = (totalConfirmations > 0 ? 1 : 0) + scheduleChanges;
              const showJobsBadge = item.path === "/client/active-jobs" && totalJobsBadge > 0;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 transition-colors relative",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
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
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
            {/* Report Issue Button */}
            <button
              onClick={openReportModal}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 transition-colors text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-medium">Report</span>
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // Admin navigation
  if (profile && profile.is_admin) {
    const adminNav = [
      { path: "/admin", icon: Briefcase, label: "Admin" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card shadow-lg z-50 pb-2 md:pb-0">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start min-w-max px-2">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    );
  }

  // Freelancer navigation - show if profile exists OR if on freelancer pages
  if ((profile && profile.role === "freelancer") || (!profile && location.pathname.startsWith("/freelancer"))) {
    const freelancerNav = [
      { path: "/freelancer/dashboard", icon: Home, label: "Home" },
      { path: "/freelancer/notifications", icon: Bell, label: "Requests" },
      { path: "/freelancer/active-jobs", icon: Briefcase, label: "Jobs" },
      { path: "/calendar", icon: Calendar, label: "Calendar" },
      { path: "/messages", icon: MessageCircle, label: "Messages" },
      { path: "/payments", icon: CreditCard, label: "Payments" },
      { path: "/freelancer/profile", icon: User, label: "Profile" },
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card shadow-lg z-50 pb-2 md:pb-0">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start min-w-max px-2">
            {freelancerNav.map((item) => {
              const Icon = item.icon;
              // For profile, also check if we're on the edit route
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
                    "flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 transition-colors relative",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
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
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
            {/* Report Issue Button */}
            <button
              onClick={openReportModal}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 transition-colors text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-medium">Report</span>
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // Default fallback - show basic nav if user exists
  if (user) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card shadow-lg z-50 pb-2 md:pb-0">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-start min-w-max px-2">
            <div className="flex flex-col items-center justify-center gap-1 py-3 px-4 flex-shrink-0 text-muted-foreground">
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">Loading...</span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return null;
}

