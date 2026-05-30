/** Sync helpers / job-match search chrome visibility with BottomNav mobile header. */

type Listener = (searchChromeVisible: boolean) => void;

let searchChromeVisible = true;
const listeners = new Set<Listener>();

export function setMatchSearchChromeVisible(visible: boolean): void {
  if (searchChromeVisible === visible) return;
  searchChromeVisible = visible;
  listeners.forEach((fn) => fn(visible));
}

export function subscribeMatchSearchChromeVisible(
  listener: Listener,
): () => void {
  listener(searchChromeVisible);
  listeners.add(listener);
  return () => listeners.delete(listener);
}
