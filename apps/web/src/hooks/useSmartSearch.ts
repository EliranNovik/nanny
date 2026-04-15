import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedProfileSearch } from "./useDebouncedProfileSearch";
import { 
  filterPageSuggestions, 
  scoreItem, 
  suggestionsForRole,
  type SmartSearchSuggestionKind
} from "@/lib/smartSearchSuggestions";
import { useRecentSearchStore } from "./useRecentSearchStore";
import type { LucideIcon } from "lucide-react";
import { User } from "lucide-react";

export type SmartResult = {
  id: string;
  kind: SmartSearchSuggestionKind | "person" | "recent";
  title: string;
  subtitle?: string;
  to: string;
  icon?: LucideIcon;
  metadata?: {
    role?: string;
    categories?: string[];
    phone?: string;
    matchType?: "name" | "phone" | "category" | "keyword" | "page";
    score?: number;
  };
};

export function useSmartSearch(query: string) {
  const { profile } = useAuth();
  const userRole = profile?.role as "client" | "freelancer" | undefined;
  const { recentItems, addRecent } = useRecentSearchStore();
  
  const { results: dbProfiles, loading: profilesLoading } = useDebouncedProfileSearch(query, 280, 10);
  
  const results = useMemo(() => {
    const trimmed = query.trim();
    
    // 1. Idle state -> Return recents and role-based shortcuts
    if (!trimmed) {
      const topSuggestions = suggestionsForRole(userRole).slice(0, 3).map(s => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        subtitle: s.subtitle,
        to: s.to,
        icon: s.icon
      })) as SmartResult[];

      const recents = recentItems.map(r => ({
        id: r.id,
        kind: "recent" as const,
        title: r.title,
        subtitle: r.subtitle || "Recent",
        to: r.to,
        // We could map icon name back to LucideIcon here if needed
      })) as SmartResult[];

      return [...recents, ...topSuggestions];
    }

    // 2. Searching state
    const isPhoneQuery = /^[0-9+-\s]+$/.test(trimmed) && trimmed.length >= 3;
    
    // a. Static suggestions scores
    const suggestionMatches = filterPageSuggestions(query, userRole).map(s => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      subtitle: s.subtitle,
      to: s.to,
      icon: s.icon,
      metadata: {
        score: scoreItem(query, s, userRole),
        matchType: "keyword" as const
      }
    }));

    // b. Profile results transformation
    const profileMatches = dbProfiles.map(p => {
      let score = 5; // Base score for profile match
      let matchType: "name" | "phone" = "name";

      if (isPhoneQuery && p.phone?.includes(trimmed.replace(/[^0-9]/g, ""))) {
        score += 20;
        matchType = "phone";
      } else if (p.full_name?.toLowerCase().includes(trimmed.toLowerCase())) {
        score += 10;
        if (p.full_name?.toLowerCase().startsWith(trimmed.toLowerCase())) score += 5;
      }

      // Role boost - if I'm a client, show freelancers higher
      if (userRole === "client" && p.role === "freelancer") score += 3;
      if (userRole === "freelancer" && p.role === "client") score += 3;

      return {
        id: p.id,
        kind: "person" as const,
        title: p.full_name || "Unknown User",
        subtitle: p.role === "freelancer" ? `Helper • ${p.categories?.join(", ") || "General"}` : "Client",
        to: `/profile/${p.id}`,
        icon: User,
        metadata: {
          score,
          matchType,
          role: p.role,
          categories: p.categories || [],
          phone: p.phone || undefined
        }
      };
    });

    // 3. Merge and rank
    const combined = [...suggestionMatches, ...profileMatches] as SmartResult[];
    
    return combined.sort((a, b) => {
      const scoreA = a.metadata?.score || 0;
      const scoreB = b.metadata?.score || 0;
      return scoreB - scoreA;
    }).slice(0, 10);

  }, [query, dbProfiles, userRole, recentItems]);

  return { results, loading: profilesLoading, addRecent };
}
