import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigationType } from "react-router-dom";
import { DocumentScrollOverflowGate } from "@/components/DocumentScrollOverflowGate";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ReportIssueProvider } from "@/context/ReportIssueContext";
import { ConfigCheck } from "@/components/ConfigCheck";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationListener } from "@/components/NotificationListener";
import { ReportIssueModal } from "@/components/ReportIssueModal";

// Pages
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import OnboardingPage from "@/pages/OnboardingPage";
import CreateJobPage from "@/pages/client/CreateJobPage";
import ConfirmedListPage from "@/pages/client/ConfirmedListPage";
import DashboardPage from "@/pages/client/DashboardPage";
import ClientHomePage from "@/pages/client/ClientHomePage";
import HelpersPage from "@/pages/client/HelpersPage";
import ClientProfileLayout from "@/pages/client/profile/ClientProfileLayout";
import ClientProfileHub from "@/pages/client/profile/ClientProfileHub";
import ClientProfilePersonalPage from "@/pages/client/profile/ClientProfilePersonalPage";
import ClientProfileServicesPage from "@/pages/client/profile/ClientProfileServicesPage";
import ClientProfileAppearancePage from "@/pages/client/profile/ClientProfileAppearancePage";
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
import FreelancerDashboardPage from "@/pages/freelancer/DashboardPage";
import FreelancerHomePage from "@/pages/freelancer/FreelancerHomePage";
import UnifiedJobsPage from "@/pages/jobs/UnifiedJobsPage";
import CommunityPostsPage from "@/pages/CommunityPostsPage";
import PostAvailabilityNowPage from "@/pages/PostAvailabilityNowPage";
import CommunityPostHireInterestsPage from "@/pages/CommunityPostHireInterestsPage";
import PublicCommunityPostsPage from "@/pages/PublicCommunityPostsPage";
import LikedPage from "@/pages/LikedPage";
import ChatPage from "@/pages/ChatPage";
import CalendarPage from "@/pages/CalendarPage";
import AdminPage from "@/pages/admin/AdminPage";
import PaymentsPage from "@/pages/PaymentsPage";
import PastJobDetailsPage from "@/pages/jobs/PastJobDetailsPage";
import PublicProfilePage from "@/pages/PublicProfilePage";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Only show loading if we don't have a user yet (initial auth check)
  // If we have a user but profile is still loading, allow navigation to proceed
  // The individual pages can handle their own loading states
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow navigation even if profile is still loading
  // Pages that need profile will handle their own loading states
  return <>{children}</>;
}

// Redirect based on role
function RoleRedirect() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
function RootRoute() {
  const { user, loading } = useAuth();
  const navigationType = useNavigationType();

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
 * Wraps page content with top padding so it clears the fixed BottomNav header.
 * #root already applies env(safe-area-inset-top); pt-14 (~3.5rem) matches the mobile strip
 * (safe-area padding inside the strip + h-10 + margins) and the md desktop bar.
 */
function PageLayoutWithHeader() {
  return (
    <div className="app-main-scroll-pad app-content-below-fixed-header min-h-[100dvh] min-h-[-webkit-fill-available]">
      <Outlet />
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Landing & marketing — landing-style header, no app layout padding */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/onboarding" element={<OnboardingPage />} />

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

      {/* All other routes: layout adds top padding for fixed header */}
      <Route element={<PageLayoutWithHeader />}>
        <Route path="/public/posts" element={<PublicCommunityPostsPage />} />
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
          path="/client/helpers"
          element={
            <ProtectedRoute>
              <HelpersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/create"
          element={
            <ProtectedRoute>
              <CreateJobPage />
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
              <PostAvailabilityNowPage />
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
              <LikedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/jobs/:jobId/confirmed"
          element={
            <ProtectedRoute>
              <ConfirmedListPage />
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
          <Route path="gallery" element={<PublicProfileMediaManagePage />} />
          <Route path="personal" element={<ClientProfilePersonalPage />} />
          <Route path="services" element={<ClientProfileServicesPage />} />
          <Route path="appearance" element={<ClientProfileAppearancePage />} />
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
          <Route path="gallery" element={<PublicProfileMediaManagePage />} />
          <Route path="personal" element={<FreelancerProfilePersonalPage />} />
          <Route path="availability" element={<FreelancerProfileAvailabilityPage />} />
          <Route path="about" element={<FreelancerProfileAboutPage />} />
          <Route path="services" element={<FreelancerProfileServicesPage />} />
          <Route path="languages" element={<FreelancerProfileLanguagesPage />} />
          <Route path="experience" element={<FreelancerProfileExperiencePage />} />
          <Route path="rates" element={<FreelancerProfileRatesPage />} />
          <Route path="appearance" element={<FreelancerProfileAppearancePage />} />
        </Route>
        <Route path="/freelancer/profile/edit" element={<Navigate to="/freelancer/profile" replace />} />

        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <PublicProfilePage />
            </ProtectedRoute>
          }
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
        <Route path="/client/active-jobs" element={<Navigate to="/jobs" replace />} />
        <Route path="/freelancer/active-jobs" element={<Navigate to="/jobs" replace />} />
        <Route path="/freelancer/notifications" element={<Navigate to="/jobs" replace />} />
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
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <DocumentScrollOverflowGate />
          <ToastProvider>
            <AuthProvider>
              <ReportIssueProvider>
                <NotificationListener />
                <AppRoutes />
                <BottomNav />
                <ReportIssueModal />
              </ReportIssueProvider>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </ThemeProvider>
    </>
  );
}

