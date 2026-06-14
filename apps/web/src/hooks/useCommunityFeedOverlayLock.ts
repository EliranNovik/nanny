import { useEffect } from "react";
import {
  popCommunityFeedOverlayLock,
  pushCommunityFeedOverlayLock,
} from "@/lib/communityFeedOverlayState";

/** Call while a community feed sheet/modal is open (mobile bottom nav hides). */
export function useCommunityFeedOverlayLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    pushCommunityFeedOverlayLock();
    return () => popCommunityFeedOverlayLock();
  }, [locked]);
}
