import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DiscoverHomeContent } from "@/components/discover/DiscoverHomeContent";
import { HomePageSkeleton } from "@/components/loading/PageSkeletons";

export default function ClientHomePage() {
  const { profile, loading } = useAuth();
  const location = useLocation();

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
    return <DiscoverHomeContent role="client" />;
  }

  if (profile.role === "freelancer") {
    return <Navigate to={{ pathname: "/freelancer/home", search: location.search }} replace />;
  }

  return <DiscoverHomeContent role="client" />;
}
