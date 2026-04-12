import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type ProfileSearchRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  average_rating: number | null;
  total_ratings: number | null;
};

export function useDebouncedProfileSearch(query: string, debounceMs = 300, limit = 8) {
  const [results, setResults] = useState<ProfileSearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, average_rating, total_ratings")
        .ilike("full_name", `%${query}%`)
        .limit(limit);

      if (!error && data) setResults(data);
      else setResults([]);
      setLoading(false);
    }, debounceMs);

    return () => clearTimeout(t);
  }, [query, debounceMs, limit]);

  return { results, loading };
}
