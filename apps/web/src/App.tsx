import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import OnboardingPage from "@/pages/OnboardingPage";
import CreateJobPage from "@/pages/client/CreateJobPage";
import ConfirmedListPage from "@/pages/client/ConfirmedListPage";
import DashboardPage from "@/pages/client/DashboardPage";
import ClientProfilePage from "@/pages/client/ClientProfilePage";
import ActiveJobsPage from "@/pages/client/ActiveJobsPage";
import MessagesPage from "@/pages/MessagesPage";
import ProfilePage from "@/pages/freelancer/ProfilePage";
import FreelancerDashboardPage from "@/pages/freelancer/DashboardPage";
import NotificationsPage from "@/pages/freelancer/NotificationsPage";
import FreelancerActiveJobsPage from "@/pages/freelancer/ActiveJobsPage";
import ChatPage from "@/pages/ChatPage";
import CalendarPage from "@/pages/CalendarPage";
import AdminPage from "@/pages/admin/AdminPage";
import PaymentsPage from "@/pages/PaymentsPage";

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
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/freelancer/dashboard" replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <LoginPage />} 
      />

      {/* Protected routes */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Client routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
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
            <ClientProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/active-jobs"
        element={
          <ProtectedRoute>
            <ActiveJobsPage />
          </ProtectedRoute>
        }
      />
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

      {/* Freelancer routes */}
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
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/freelancer/profile/edit"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/freelancer/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/freelancer/active-jobs"
        element={
          <ProtectedRoute>
            <FreelancerActiveJobsPage />
          </ProtectedRoute>
        }
      />

      {/* Shared routes */}
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

      {/* Default redirect */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <ConfigCheck />
      <ThemeProvider>
        <BrowserRouter>
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

