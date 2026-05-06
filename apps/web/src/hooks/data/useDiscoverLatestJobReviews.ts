import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type DiscoverLatestJobReview = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    is_verified: boolean | null;
  } | null;
  reviewee: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
    is_verified: boolean | null;
  } | null;
};

const capLimit = (n: number) => Math.max(1, Math.min(20, Math.floor(n)));

export function useDiscoverLatestJobReviews(limit: number) {
  const { user } = useAuth();
  const capped = capLimit(limit);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DiscoverLatestJobReview[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const q = supabase
        .from("job_reviews")
        .select(
          `
            id,
            rating,
            review_text,
            created_at,
            reviewer:profiles!reviewer_id (
              id,
              full_name,
              photo_url,
              is_verified
            ),
            reviewee:profiles!reviewee_id (
              id,
              full_name,
              photo_url,
              is_verified
            )
          `,
        )
        .order("created_at", { ascending: false })
        .limit(capped);

      const res = user?.id ? await q.neq("reviewee_id", user.id) : await q;

      if (cancelled) return;
      if (res.error) {
        console.warn("[useDiscoverLatestJobReviews] job_reviews:", res.error);
        setRows([]);
        setLoading(false);
        return;
      }

      const data = (res.data ?? []) as any[];
      const normalized = data.map((r) => ({
        ...r,
        reviewer: r.reviewer || {
          id: "",
          full_name: "Anonymous",
          photo_url: null,
          is_verified: null,
        },
        reviewee: r.reviewee || null,
      })) as DiscoverLatestJobReview[];

      setRows(normalized);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [capped, user?.id]);

  return { loading, rows };
}
