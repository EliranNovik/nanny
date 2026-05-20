import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isFreelancerLiveWindowActive } from "@/lib/freelancerLiveWindow";
import { supabase } from "@/lib/supabase";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

type FreelancerAvailabilityRow = {
  live_until: string | null;
  available_now: boolean | null;
};

/**
 * True when the signed-in user is actively receiving / open to incoming help requests:
 * freelancers with live window or available_now; clients with receive-requests enabled
 * (profiles.is_available_for_jobs and/or freelancer_profiles.available_now).
 */
export function useIsReceivingRequests(): boolean {
  const { user, profile } = useAuth();
  const [freelancerRow, setFreelancerRow] = useState<FreelancerAvailabilityRow | null>(
    null,
  );
  const [clientReceiveFlag, setClientReceiveFlag] = useState<boolean | null>(null);

  const userId = user?.id;
  const isFreelancer = profile?.role === "freelancer";
  const isClient = profile?.role === "client";
  const needsHelperAvailability = isFreelancer || isClient;

  const refreshHelperAvailability = async (uid: string) => {
    const [{ data: fp }, { data: prof }] = await Promise.all([
      supabase
        .from("freelancer_profiles")
        .select("live_until, available_now")
        .eq("user_id", uid)
        .maybeSingle(),
      isClient
        ? supabase
            .from("profiles")
            .select("is_available_for_jobs")
            .eq("id", uid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setFreelancerRow((fp as FreelancerAvailabilityRow | null) ?? null);
    if (isClient) {
      setClientReceiveFlag(prof?.is_available_for_jobs === true);
    }
  };

  useEffect(() => {
    if (!userId || !needsHelperAvailability) {
      setFreelancerRow(null);
      setClientReceiveFlag(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      await refreshHelperAvailability(userId);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, needsHelperAvailability, isClient]);

  useRealtimeSubscription(
    {
      table: "freelancer_profiles",
      event: "*",
      filter: userId ? `user_id=eq.${userId}` : undefined,
      enabled: Boolean(userId && needsHelperAvailability),
    },
    () => {
      if (userId) void refreshHelperAvailability(userId);
    },
  );

  useRealtimeSubscription(
    {
      table: "profiles",
      event: "UPDATE",
      filter: userId ? `id=eq.${userId}` : undefined,
      enabled: Boolean(userId && isClient),
    },
    () => {
      if (userId) void refreshHelperAvailability(userId);
    },
  );

  return useMemo(() => {
    if (!userId || !profile) return false;
    if (profile.role === "freelancer") {
      return isFreelancerLiveWindowActive(freelancerRow);
    }
    if (profile.role === "client") {
      return (
        profile.is_available_for_jobs === true ||
        clientReceiveFlag === true ||
        isFreelancerLiveWindowActive(freelancerRow)
      );
    }
    return false;
  }, [userId, profile, freelancerRow, clientReceiveFlag]);
}
