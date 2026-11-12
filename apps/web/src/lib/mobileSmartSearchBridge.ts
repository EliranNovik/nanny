/** Lets the Help others hero open the mobile search overlay owned by BottomNav. */
let openSearch: (() => void) | null = null;

export function registerMobileSmartSearchOpener(fn: (() => void) | null) {
  openSearch = fn;
}

export function requestMobileSmartSearchOpen() {
  openSearch?.();
}
