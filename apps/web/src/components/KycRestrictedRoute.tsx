import { useLayoutEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { AppBootSplash } from "@/components/AppBootSplash";
import {
  needsKycVerification,
  roleHomePath,
  type KycBlockedAction,
} from "@/lib/kyc";

type KycRestrictedRouteProps = {
  action: KycBlockedAction;
  children: ReactNode;
};

/** Blocks direct URL access to KYC-gated flows (post request, go live). */
export function KycRestrictedRoute({
  action,
  children,
}: KycRestrictedRouteProps) {
  const { user, profile, loading } = useAuth();
  const { openKycRequiredDialog } = useKycGate();

  const profilePending = Boolean(user && !profile);
  const blocked = Boolean(profile && needsKycVerification(profile));
  const homePath = profile
    ? roleHomePath(profile.role)
    : user
      ? "/client/home"
      : "/login";

  useLayoutEffect(() => {
    if (blocked) {
      openKycRequiredDialog(action);
    }
  }, [action, blocked, openKycRequiredDialog]);

  if (loading || profilePending) {
    return <AppBootSplash />;
  }

  if (blocked) {
    return <Navigate to={homePath} replace />;
  }

  return <>{children}</>;
}
