import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DISCOVER_OPEN_JOB_STATUSES } from "@/lib/discoverOpenJobStatuses";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";

export type ChatHeaderAvatarStatus = {
  isLive24h: boolean;
  hasPostedRequest: boolean;
};

const idleStatus: ChatHeaderAvatarStatus = {
  isLive24h: false,
  hasPostedRequest: false,
};

export function useChatHeaderAvatarStatus(
  userId: string | null | undefined,
): ChatHeaderAvatarStatus {
  const [status, setStatus] = useState<ChatHeaderAvatarStatus>(idleStatus);

  useEffect(() => {
    if (!userId) {
      setStatus(idleStatus);
      return;
    }

    let cancelled = false;
    void (async () => {
      const openStatuses = Array.from(DISCOVER_OPEN_JOB_STATUSES);
      const [{ data: fp }, openRequestsRes] = await Promise.all([
        supabase
          .from("freelancer_profiles")
          .select("live_until")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("job_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", userId)
          .in("status", openStatuses),
      ]);

      if (cancelled) return;

      setStatus({
        isLive24h: isFreelancerInActive24hLiveWindow(fp),
        hasPostedRequest: (openRequestsRes.count ?? 0) > 0,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return status;
}
