/**
 * Previously toggled document overflow; that broke scrolling in Chrome. Kept as a no-op
 * so any stale imports/render sites stay valid. Overscroll is handled in index.css.
 */
export function DocumentScrollOverflowGate() {
  return null;
}
