import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DiscoverHomeContent } from "@/components/discover/DiscoverHomeContent";
import { HomePageSkeleton } from "@/components/loading/PageSkeletons";

export default function ClientHomePage() {
  const { profile, loading } = useAuth();

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <HomePageSkeleton />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  if (profile.role === "freelancer") {
    return <Navigate to="/freelancer/home" replace />;
  }

  return <DiscoverHomeContent role="client" />;
}
