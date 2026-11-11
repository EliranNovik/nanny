import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedProfileSearch, type ProfileSearchRow } from "./useDebouncedProfileSearch";
import {
  parseNearMeQuery,
  useDebouncedListingSearch,
  type ListingSearchHit,
} from "./useDebouncedListingSearch";
import { 
  filterPageSuggestions, 
  scoreItem, 
  suggestionsForRole,
  type SmartSearchSuggestionKind
} from "@/lib/smartSearchSuggestions";
import { useRecentSearchStore } from "./useRecentSearchStore";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Newspaper, Tag, User } from "lucide-react";

const EMPTY_PROFILES: ProfileSearchRow[] = [];
const EMPTY_LISTINGS: ListingSearchHit[] = [];

export type SmartResult = {
  id: string;
  kind: SmartSearchSuggestionKind | "person" | "recent" | "offer" | "event" | "post";
  title: string;
  subtitle?: string;
  to: string;
  icon?: LucideIcon;
  imageUrl?: string | null;
  metadata?: {
    role?: string;
    categories?: string[];
    phone?: string;
    matchType?: "name" | "phone" | "category" | "keyword" | "page";
    score?: number;
    own?: boolean;
    authorName?: string | null;
    authorPhotoUrl?: string | null;
    authorVerified?: boolean;
    authorRating?: number | null;
    authorRatingCount?: number | null;
  };
};

export function useSmartSearch(query: string) {
  const { profile } = useAuth();
  const userRole = profile?.role as "client" | "freelancer" | undefined;
  const { recentItems, addRecent } = useRecentSearchStore();
  
  const nearMe = parseNearMeQuery(query);
  const profileQuery = nearMe.nearMe ? nearMe.text : query;
  const {
    results: dbProfiles,
    settledQuery: settledProfileQuery,
    loading: profilesLoading,
  } = useDebouncedProfileSearch(profileQuery, 50, 8);
  const {
    results: listings,
    settledQuery: settledListingQuery,
    loading: listingsLoading,
  } = useDebouncedListingSearch(query, 50);
  const profilesForQuery =
    settledProfileQuery === profileQuery.trim() ? dbProfiles : EMPTY_PROFILES;
  const listingsForQuery =
    settledListingQuery === query.trim() ? listings : EMPTY_LISTINGS;
  
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
    const profileMatches = profilesForQuery.map(p => {
      let score = 12;
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
        imageUrl: p.photo_url,
        metadata: {
          score,
          matchType,
          role: p.role,
          categories: p.categories || [],
          phone: p.phone || undefined,
          authorVerified: Boolean(p.is_verified),
        }
      };
    });

    const q = (nearMe.nearMe ? nearMe.text : trimmed).toLowerCase();
    const listingMatches = listingsForQuery.map((item) => {
      let score = item.own ? 22 : 16;
      if (item.title.toLowerCase().startsWith(q)) score += 12;
      else if (item.title.toLowerCase().includes(q)) score += 6;
      if (nearMe.nearMe && item.distanceKm != null) {
        score += Math.max(0, 24 - item.distanceKm / 2);
      }
      return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        to: item.to,
        icon:
          item.kind === "offer" ? Tag : item.kind === "event" ? CalendarDays : Newspaper,
        imageUrl: item.imageUrl,
        metadata: {
          score,
          own: item.own,
          matchType: "keyword" as const,
          authorName: item.authorName,
          authorPhotoUrl: item.authorPhotoUrl,
          authorVerified: item.authorVerified,
          authorRating: item.authorRating,
          authorRatingCount: item.authorRatingCount,
        },
      };
    });

    const pageMatches = suggestionMatches
      .filter((item) => (item.metadata?.score || 0) >= 12)
      .slice(0, 2)
      .map((item) => ({
        ...item,
        metadata: { ...item.metadata, score: Math.min(item.metadata?.score || 0, 18) },
      }));

    const combined = [
      ...listingMatches,
      ...profileMatches,
      ...pageMatches,
    ] as SmartResult[];

    return combined.sort((a, b) => {
      const scoreA = a.metadata?.score || 0;
      const scoreB = b.metadata?.score || 0;
      return scoreB - scoreA;
    }).slice(0, 16);

  }, [query, profilesForQuery, listingsForQuery, userRole, recentItems, nearMe.nearMe, nearMe.text]);

  return { results, loading: profilesLoading || listingsLoading, addRecent };
}
