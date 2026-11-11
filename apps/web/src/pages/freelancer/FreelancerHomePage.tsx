import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DiscoverHomeContent } from "@/components/discover/DiscoverHomeContent";
import { HomePageSkeleton } from "@/components/loading/PageSkeletons";

export default function FreelancerHomePage() {
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
    return <DiscoverHomeContent role="freelancer" />;
  }

  if (profile.role === "client") {
    return <Navigate to={{ pathname: "/client/home", search: location.search }} replace />;
  }

  return <DiscoverHomeContent role="freelancer" />;
}
