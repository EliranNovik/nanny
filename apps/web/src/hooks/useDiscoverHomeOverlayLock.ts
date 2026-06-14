import { useEffect } from "react";
import {
  popDiscoverHomeOverlayLock,
  pushDiscoverHomeOverlayLock,
} from "@/lib/discoverHomeOverlayState";

/** Call while a Discover home sheet/modal is open (mobile bottom nav hides). */
export function useDiscoverHomeOverlayLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    pushDiscoverHomeOverlayLock();
    return () => popDiscoverHomeOverlayLock();
  }, [locked]);
}
