import { useEffect, useState } from "react";
import {
  fetchLandingRecentActivity,
  type LandingActivityItem,
} from "@/lib/fetchLandingRecentActivity";
import {
  useDiscoverLatestJobReviews,
  type DiscoverLatestJobReview,
} from "@/hooks/data/useDiscoverLatestJobReviews";

/** Let the first screen paint before the below-the-fold queries start. */
function useAfterFirstPaint() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const start = () => setReady(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(start, { timeout: 900 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(start, 280);
    return () => window.clearTimeout(timer);
  }, []);
  return ready;
}

export function useLandingPagePreview() {
  const ready = useAfterFirstPaint();
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityItems, setActivityItems] = useState<LandingActivityItem[]>([]);
  const { loading: reviewsLoading, rows: reviewRows } =
    useDiscoverLatestJobReviews(12, ready);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setActivityLoading(true);
    void fetchLandingRecentActivity()
      .then((items) => {
        if (!cancelled) setActivityItems(items);
      })
      .catch((err) => {
        console.warn("[useLandingPagePreview] activity", err);
        if (!cancelled) setActivityItems([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const reviews: DiscoverLatestJobReview[] = reviewRows.filter(
    (r) =>
      r.reviewee?.id &&
      Number(r.rating) >= 4 &&
      (r.review_text?.trim() || r.rating),
  );

  return {
    activityLoading: !ready || activityLoading,
    activityItems,
    reviewsLoading: !ready || reviewsLoading,
    reviews,
  };
}
