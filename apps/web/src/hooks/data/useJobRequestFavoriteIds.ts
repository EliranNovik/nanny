import { useQuery } from "@tanstack/react-query";
import { fetchJobRequestFavoriteIds } from "@/lib/jobRequestFavorites";
import { queryKeys } from "./keys";

export function useJobRequestFavoriteIds(userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.jobRequestFavorites(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async () => fetchJobRequestFavoriteIds(userId!),
  });
}
