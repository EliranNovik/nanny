import { useEffect, useState } from "react";
import {
  fetchLandingRecentActivity,
  type LandingActivityItem,
} from "@/lib/fetchLandingRecentActivity";
import {
  fetchLandingHeroPosts,
  type LandingHeroPost,
} from "@/lib/fetchLandingHeroPosts";
import {
  useDiscoverLatestJobReviews,
  type DiscoverLatestJobReview,
} from "@/hooks/data/useDiscoverLatestJobReviews";

export function useLandingPagePreview() {
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityItems, setActivityItems] = useState<LandingActivityItem[]>([]);
  const [heroPostsLoading, setHeroPostsLoading] = useState(true);
  const [heroPosts, setHeroPosts] = useState<LandingHeroPost[]>([]);
  const { loading: reviewsLoading, rows: reviewRows } =
    useDiscoverLatestJobReviews(12);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHeroPostsLoading(true);
    void fetchLandingHeroPosts(12)
      .then((items) => {
        if (!cancelled) setHeroPosts(items);
      })
      .catch((err) => {
        console.warn("[useLandingPagePreview] hero posts", err);
        if (!cancelled) setHeroPosts([]);
      })
      .finally(() => {
        if (!cancelled) setHeroPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const reviews: DiscoverLatestJobReview[] = reviewRows.filter(
    (r) => r.reviewee?.id && (r.review_text?.trim() || r.rating),
  );

  return {
    activityLoading,
    activityItems,
    heroPostsLoading,
    heroPosts,
    reviewsLoading,
    reviews,
  };
}
