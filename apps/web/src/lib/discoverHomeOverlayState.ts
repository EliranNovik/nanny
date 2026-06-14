/** Tracks open Discover home overlays so BottomNav can hide the floating bar. */

type Listener = (anyOpen: boolean) => void;

let overlayCount = 0;
const listeners = new Set<Listener>();

function emit() {
  const anyOpen = overlayCount > 0;
  listeners.forEach((fn) => fn(anyOpen));
}

export function pushDiscoverHomeOverlayLock() {
  overlayCount += 1;
  emit();
}

export function popDiscoverHomeOverlayLock() {
  overlayCount = Math.max(0, overlayCount - 1);
  emit();
}

export function subscribeDiscoverHomeOverlay(
  listener: Listener,
): () => void {
  listener(overlayCount > 0);
  listeners.add(listener);
  return () => listeners.delete(listener);
}
