import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DiscoverHomeContent } from "@/components/discover/DiscoverHomeContent";

export default function ClientHomePage() {
  const { profile, loading } = useAuth();

  if (loading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 dark:bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
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
