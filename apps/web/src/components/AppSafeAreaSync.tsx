import { useAppSafeAreaSync } from "@/hooks/useAppSafeAreaSync";

/** Syncs --visual-viewport-*-inset for iOS Safari toolbar / safe-area quirks. */
export function AppSafeAreaSync() {
  useAppSafeAreaSync();
  return null;
}
