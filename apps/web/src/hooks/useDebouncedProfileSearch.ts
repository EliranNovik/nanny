import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type ProfileSearchRow = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  average_rating: number | null;
  total_ratings: number | null;
  role: "client" | "freelancer" | null;
  categories: string[] | null;
  phone: string | null;
};

export function useDebouncedProfileSearch(
  query: string,
  debounceMs = 300,
  limit = 8,
) {
  const [results, setResults] = useState<ProfileSearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      const isPhoneQuery = /^[0-9+-\s]+$/.test(trimmed) && trimmed.length >= 3;
      
      let dbQuery = supabase
        .from("profiles")
        .select("id, full_name, photo_url, average_rating, total_ratings, role, categories, phone")
        .limit(limit);

      if (isPhoneQuery) {
        // Search by phone number
        const normalizedPhone = trimmed.replace(/[^0-9]/g, "");
        dbQuery = dbQuery.ilike("phone", `%${normalizedPhone}%`);
      } else {
        // Search by name
        dbQuery = dbQuery.ilike("full_name", `%${trimmed}%`);
      }

      const { data, error } = await dbQuery;

      if (!error && data) setResults(data as ProfileSearchRow[]);
      else setResults([]);
      setLoading(false);
    }, debounceMs);

    return () => clearTimeout(t);
  }, [query, debounceMs, limit]);

  return { results, loading };
}
