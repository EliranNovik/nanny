import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function LikedRedirectPage() {
  const { profile } = useAuth();
  const to =
    profile?.role === "freelancer"
      ? "/freelancer/profile/saved"
      : "/client/profile/saved";
  return <Navigate to={to} replace />;
}

