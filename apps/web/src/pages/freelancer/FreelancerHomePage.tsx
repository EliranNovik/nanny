import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DiscoverHomeContent } from "@/components/discover/DiscoverHomeContent";
import { HomePageSkeleton } from "@/components/loading/PageSkeletons";

export default function FreelancerHomePage() {
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

  if (profile.role === "client") {
    return <Navigate to="/client/home" replace />;
  }

  return <DiscoverHomeContent role="freelancer" />;
}
