/** Lets BottomNav open the Discover home “more actions” sheet owned by DiscoverHomeActionFirst. */
let openQuickMore: (() => void) | null = null;

export function registerDiscoverHomeQuickMoreOpener(fn: (() => void) | null) {
  openQuickMore = fn;
}

export function requestDiscoverHomeQuickMoreOpen() {
  openQuickMore?.();
}
