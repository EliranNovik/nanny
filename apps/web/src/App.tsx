import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigationType,
  useParams,
  useLocation,
} from "react-router-dom";
import { useAuth as _useAuth } from "@/context/AuthContext";
import { AppSafeAreaSync } from "@/components/AppSafeAreaSync";
import { DocumentScrollOverflowGate } from "@/components/DocumentScrollOverflowGate";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DiscoverHomeScrollHeaderProvider } from "@/context/DiscoverHomeScrollHeaderContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ReportIssueProvider } from "@/context/ReportIssueContext";
import { ConfigCheck } from "@/components/ConfigCheck";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationListener } from "@/components/NotificationListener";
import { IncomingRequestToastListener } from "@/components/IncomingRequestToastListener";
import { ReportIssueModal } from "@/components/ReportIssueModal";
import { SessionAnalyticsInit } from "@/components/SessionAnalyticsInit";
import { AppBootSplash } from "@/components/AppBootSplash";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentLocaleSync } from "@/components/i18n/DocumentLocaleSync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Pages
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import LegalPage from "@/pages/LegalPage";
import OnboardingPage from "@/pages/OnboardingPage";
import CreateJobPage from "@/pages/client/CreateJobPage";
import ConfirmedListPage from "@/pages/client/ConfirmedListPage";
import FreelancerAvailabilityLivePage from "./pages/freelancer/FreelancerAvailabilityLivePage";
import DashboardPage from "@/pages/client/DashboardPage";
import RecentActivityPage from "@/pages/RecentActivityPage";
import ClientHomePage from "@/pages/client/ClientHomePage";
import HelpersPage from "@/pages/client/HelpersPage";
import HelpersMatchPage from "@/pages/client/HelpersMatchPage";
import ExplorePage from "@/pages/explore/ExplorePage";
import FreelancerJobsMatchPage from "@/pages/freelancer/FreelancerJobsMatchPage";
import LikedRedirectPage from "@/pages/LikedRedirectPage";
import ClientProfileLayout from "@/pages/client/profile/ClientProfileLayout";
import ClientProfileHub from "@/pages/client/profile/ClientProfileHub";
import ClientProfilePersonalPage from "@/pages/client/profile/ClientProfilePersonalPage";
import ClientProfileServicesPage from "@/pages/client/profile/ClientProfileServicesPage";
import ClientProfileAppearancePage from "@/pages/client/profile/ClientProfileAppearancePage";
import { ProfileAppLanguagePage } from "@/components/profile/ProfileAppLanguagePage";
import ClientProfileSavedPage from "@/pages/client/profile/ClientProfileSavedPage";
import ClientProfileEventsPage from "@/pages/client/profile/ClientProfileEventsPage";
import PublicProfileMediaManagePage from "@/pages/profile/PublicProfileMediaManagePage";
import MessagesPage from "@/pages/MessagesPage";
import FreelancerProfileLayout from "@/pages/freelancer/profile/FreelancerProfileLayout";
import FreelancerProfileHub from "@/pages/freelancer/profile/FreelancerProfileHub";
import FreelancerProfilePersonalPage from "@/pages/freelancer/profile/FreelancerProfilePersonalPage";
import FreelancerProfileAvailabilityPage from "@/pages/freelancer/profile/FreelancerProfileAvailabilityPage";
import FreelancerProfileAboutPage from "@/pages/freelancer/profile/FreelancerProfileAboutPage";
import FreelancerProfileServicesPage from "@/pages/freelancer/profile/FreelancerProfileServicesPage";
import FreelancerProfileLanguagesPage from "@/pages/freelancer/profile/FreelancerProfileLanguagesPage";
import FreelancerProfileExperiencePage from "@/pages/freelancer/profile/FreelancerProfileExperiencePage";
import FreelancerProfileRatesPage from "@/pages/freelancer/profile/FreelancerProfileRatesPage";
import FreelancerProfileAppearancePage from "@/pages/freelancer/profile/FreelancerProfileAppearancePage";
import FreelancerProfileSavedPage from "@/pages/freelancer/profile/FreelancerProfileSavedPage";
import FreelancerProfileEventsPage from "@/pages/freelancer/profile/FreelancerProfileEventsPage";
import FreelancerDashboardPage from "@/pages/freelancer/DashboardPage";
import FreelancerHomePage from "@/pages/freelancer/FreelancerHomePage";
import UnifiedJobsPage from "@/pages/jobs/UnifiedJobsPage";
import CommunityPostsPage from "@/pages/CommunityPostsPage";
import PostAvailabilityNowPage from "@/pages/PostAvailabilityNowPage";
import CommunityPostHireInterestsPage from "@/pages/CommunityPostHireInterestsPage";
import PublicCommunityPostsPage from "@/pages/PublicCommunityPostsPage";
import ChatPage from "@/pages/ChatPage";
import CalendarPage from "@/pages/CalendarPage";
import AdminPage from "@/pages/admin/AdminPage";
import PaymentsPage from "@/pages/PaymentsPage";
import PastJobDetailsPage from "@/pages/jobs/PastJobDetailsPage";
import PublicProfilePage from "@/pages/PublicProfilePage";
import GlobalPostsPage from "@/pages/GlobalPostsPage";
import KycVerificationPage from "@/pages/KycVerificationPage";
import { KycGateProvider } from "@/context/KycGateContext";
import { GuestAuthPromptProvider } from "@/context/GuestAuthPromptContext";
import { KycRestrictedRoute } from "@/components/KycRestrictedRoute";
import { DesktopSidePanel } from "@/components/nav/DesktopSidePanel";
import { Footer } from "@/components/Footer";
import { Menu, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

// Protected route wrapper
function ProtectedRoute({
  children,
  skipKycGate = false,
}: {
  children: React.ReactNode;
  skipKycGate?: boolean;
}) {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return <AppBootSplash />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  void skipKycGate;

  return <>{children}</>;
}

// Redirect based on role
function RoleRedirect() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <AppBootSplash />;
  }

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  // Admin users go to admin page
  if (profile.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  if (profile.role === "client") {
    return <Navigate to="/client/home" replace />;
  }

  return <Navigate to="/freelancer/home" replace />;
}

/**
 * `/` — marketing for everyone when chosen in-app (PUSH).
 * Signed-in users are sent to role home only on direct entry (POP) or redirects (REPLACE), e.g. first load at `/` or `/login` → `/`.
 */
function RedirectJobConfirmedToLive() {
  const { jobId } = useParams<{ jobId: string }>();
  return <Navigate to={`/client/jobs/${jobId}/live`} replace />;
}

function RootRoute() {
  const { user, loading } = useAuth();
  const navigationType = useNavigationType();

  if (loading && !user) {
    return <AppBootSplash />;
  }

  if (!user) {
    return <LandingPage />;
  }

  if (navigationType === "PUSH") {
    return <LandingPage />;
  }

  return (
    <ProtectedRoute>
      <RoleRedirect />
    </ProtectedRoute>
  );
}

/**
 * Pages that should stay mounted across navigation to avoid reload flashes.
 * They are rendered permanently but hidden via CSS when not on their route.
 */
const KEEP_ALIVE_ROUTES = [
  "/client/helpers",
  "/freelancer/jobs/match",
  "/messages",
];

function KeepAlivePages() {
  const { pathname } = useLocation();
  const { user } = _useAuth();

  if (!user) return null;

  return (
    <>
      {KEEP_ALIVE_ROUTES.map((route) => {
        const isActive = pathname === route ||
          pathname.startsWith(route + "?") ||
          // Match /messages/:conversationId sub-routes under the /messages keep-alive slot
          (route === "/messages" && pathname.startsWith("/messages/"));
        return (
          <div
            key={route}
            aria-hidden={!isActive}
            style={isActive ? undefined : { display: "none", visibility: "hidden", pointerEvents: "none" }}
          >
            {route === "/client/helpers" && <HelpersPage />}
            {route === "/freelancer/jobs/match" && <FreelancerJobsMatchPage />}
            {route === "/messages" && <MessagesPage />}
          </div>
        );
      })}
    </>
  );
}

/**
 * Wraps page content with top padding so it clears the fixed BottomNav header.
 * Mobile + desktop: solid fixed header bar; shell uses --app-mobile-header-stack.
 */
function PageLayoutWithHeader() {
  const { pathname } = useLocation();
  const [desktopSidePanelCollapsed, setDesktopSidePanelCollapsed] = useState(false);
  const shouldHideDesktopFooter =
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/chat/");

  // When on a keep-alive route, render the persistent page instead of the Outlet
  const isKeepAliveRoute = KEEP_ALIVE_ROUTES.some(
    (r) => pathname === r ||
      pathname.startsWith(r + "?") ||
      (r === "/messages" && pathname.startsWith("/messages/")),
  );

  return (
    <div className="app-main-scroll-pad app-content-below-fixed-header app-wide-desktop-content min-h-[100dvh] min-h-[-webkit-fill-available]">
      <div className="min-h-[100dvh] min-h-[-webkit-fill-available]">
        <DesktopSidePanel collapsed={desktopSidePanelCollapsed} />
        <button
          type="button"
          onClick={() => setDesktopSidePanelCollapsed((v) => !v)}
          className={cn(
            "fixed top-4 z-[260] hidden h-10 w-10 items-center justify-center rounded-2xl",
            "border border-border/70 bg-background/90 text-foreground shadow-lg backdrop-blur-xl",
            "transition-[left,transform,background-color] duration-200 hover:bg-muted active:scale-[0.97] md:flex xl:hidden",
            desktopSidePanelCollapsed ? "left-4" : "left-[228px]",
          )}
          aria-label={desktopSidePanelCollapsed ? "Open sidebar" : "Collapse sidebar"}
          aria-pressed={!desktopSidePanelCollapsed}
        >
          {desktopSidePanelCollapsed ? (
            <Menu className="h-5 w-5" strokeWidth={2.6} aria-hidden />
          ) : (
            <PanelLeftClose className="h-5 w-5" strokeWidth={2.6} aria-hidden />
          )}
        </button>
        {/* On desktop, leave room for the fixed left panel */}
        <div
          className={cn(
            "min-w-0 app-mobile-scroll-top-clearance",
            !desktopSidePanelCollapsed && "app-side-panel-offset",
          )}
        >
          {/* Always-mounted keep-alive pages */}
          <KeepAlivePages />
          {/* Normal outlet — hidden when a keep-alive route is active */}
          {!isKeepAliveRoute && <Outlet />}
          {!shouldHideDesktopFooter ? (
            <div className="hidden md:block">
              <Footer />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing & marketing — landing-style header, no app layout padding */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/disclaimer" element={<LegalPage />} />
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/cookies" element={<LegalPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<LoginPage oauthCallback />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/onboarding/verify"
        element={
          <ProtectedRoute skipKycGate>
            <KycVerificationPage />
          </ProtectedRoute>
        }
      />

      {/* All other routes: layout adds top padding for fixed header */}
      <Route element={<PageLayoutWithHeader />}>
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/public/posts" element={<PublicCommunityPostsPage />} />
        <Route path="/community/feed" element={<GlobalPostsPage />} />
        {/* Client routes */}
        <Route
          path="/client/home"
          element={
            <ProtectedRoute>
              <ClientHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recent-activity"
          element={
            <ProtectedRoute>
              <RecentActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/helpers"
          element={
            <ProtectedRoute>
              <HelpersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/helpers/match"
          element={
            <ProtectedRoute>
              <HelpersMatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/explore"
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/explore"
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/jobs/match"
          element={
            <ProtectedRoute>
              <FreelancerJobsMatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/create"
          element={
            <ProtectedRoute>
              <KycRestrictedRoute action="start_request">
                <CreateJobPage />
              </KycRestrictedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts"
          element={
            <ProtectedRoute>
              <CommunityPostsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/availability/post-now"
          element={
            <ProtectedRoute>
              <KycRestrictedRoute action="go_live">
                <PostAvailabilityNowPage />
              </KycRestrictedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/availability"
          element={
            <ProtectedRoute>
              <CommunityPostsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/availability/post/:postId/hires"
          element={
            <ProtectedRoute>
              <CommunityPostHireInterestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/liked"
          element={
            <ProtectedRoute>
              <LikedRedirectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/jobs/:jobId/live"
          element={
            <ProtectedRoute>
              <ConfirmedListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/jobs/:jobId/confirmed"
          element={
            <ProtectedRoute>
              <RedirectJobConfirmedToLive />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/profile"
          element={
            <ProtectedRoute>
              <ClientProfileLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientProfileHub />} />
          <Route path="saved" element={<ClientProfileSavedPage />} />
          <Route path="events" element={<ClientProfileEventsPage />} />
          <Route path="gallery" element={<PublicProfileMediaManagePage />} />
          <Route path="personal" element={<ClientProfilePersonalPage />} />
          <Route path="services" element={<ClientProfileServicesPage />} />
          <Route path="appearance" element={<ClientProfileAppearancePage />} />
          <Route path="language" element={<ProfileAppLanguagePage />} />
        </Route>

        {/* Freelancer routes */}
        <Route
          path="/freelancer/home"
          element={
            <ProtectedRoute>
              <FreelancerHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/availability/:postId/live"
          element={
            <ProtectedRoute>
              <FreelancerAvailabilityLivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/dashboard"
          element={
            <ProtectedRoute>
              <FreelancerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/profile"
          element={
            <ProtectedRoute>
              <FreelancerProfileLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FreelancerProfileHub />} />
          <Route path="saved" element={<FreelancerProfileSavedPage />} />
          <Route path="events" element={<FreelancerProfileEventsPage />} />
          <Route path="gallery" element={<PublicProfileMediaManagePage />} />
          <Route path="personal" element={<FreelancerProfilePersonalPage />} />
          <Route
            path="availability"
            element={<FreelancerProfileAvailabilityPage />}
          />
          <Route path="about" element={<FreelancerProfileAboutPage />} />
          <Route path="services" element={<FreelancerProfileServicesPage />} />
          <Route
            path="languages"
            element={<FreelancerProfileLanguagesPage />}
          />
          <Route
            path="experience"
            element={<FreelancerProfileExperiencePage />}
          />
          <Route path="rates" element={<FreelancerProfileRatesPage />} />
          <Route
            path="appearance"
            element={<FreelancerProfileAppearancePage />}
          />
          <Route path="language" element={<ProfileAppLanguagePage />} />
        </Route>
        <Route
          path="/freelancer/profile/edit"
          element={<Navigate to="/freelancer/profile" replace />}
        />

        <Route
          path="/profile/:userId"
          element={<PublicProfilePage />}
        />

        {/* Shared routes */}
        <Route
          path="/jobs"
          element={
            <ProtectedRoute>
              <UnifiedJobsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs/:jobId/details"
          element={
            <ProtectedRoute>
              <PastJobDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/active-jobs"
          element={<Navigate to="/jobs" replace />}
        />
        <Route
          path="/freelancer/active-jobs"
          element={<Navigate to="/jobs" replace />}
        />
        <Route
          path="/freelancer/notifications"
          element={<Navigate to="/jobs" replace />}
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect for authenticated users */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <RoleRedirect />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <ConfigCheck />
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <DocumentScrollOverflowGate />
            <AppSafeAreaSync />
            <DocumentLocaleSync />
            <ToastProvider>
              <AuthProvider>
                <GuestAuthPromptProvider>
                <KycGateProvider>
                  <SessionAnalyticsInit />
                  <DiscoverHomeScrollHeaderProvider>
                    <ReportIssueProvider>
                      <NotificationListener />
                      <IncomingRequestToastListener />
                      <AppRoutes />
                      <BottomNav />
                      <ReportIssueModal />
                    </ReportIssueProvider>
                  </DiscoverHomeScrollHeaderProvider>
                </KycGateProvider>
                </GuestAuthPromptProvider>
              </AuthProvider>
            </ToastProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </>
  );
}
