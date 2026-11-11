import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
import { useAuth } from "@/context/AuthContext";
import { categoryIllustrationSrc } from "@/lib/discoverCategoryTileIcons";
import { haversineDistanceKm } from "@/lib/geo";
import { parseGeneratedPostCopy } from "@/lib/generatedPostCopy";
import { isolatedOfferPostPath } from "@/lib/profilePostShare";
import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { postServiceCategoryLabel } from "@/lib/serviceCategories";
import {
  matchedCategoryIds,
  searchNeedles,
  textHitsNeedles,
} from "@/lib/categorySearchTerms";
import { supabase } from "@/lib/supabase";

export type ListingSearchHit = {
  id: string;
  kind: "offer" | "event" | "post";
  title: string;
  subtitle: string;
  to: string;
  imageUrl: string | null;
  own: boolean;
  distanceKm?: number | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  authorVerified: boolean;
  authorRating: number | null;
  authorRatingCount: number | null;
};

type PostRow = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: string | null;
  storage_path: string | null;
  post_metadata: Record<string, unknown> | null;
  custom_category: string | null;
  post_type_id: string | null;
  ai_generated_copy: unknown;
  created_at?: string | null;
  author?:
    | {
        full_name?: string | null;
        photo_url?: string | null;
        is_verified?: boolean | null;
        average_rating?: number | string | null;
        total_ratings?: number | string | null;
      }
    | {
        full_name?: string | null;
        photo_url?: string | null;
        is_verified?: boolean | null;
        average_rating?: number | string | null;
        total_ratings?: number | string | null;
      }[]
    | null;
};

function generatedTitle(raw: unknown): string | null {
  const parsed = parseGeneratedPostCopy(raw);
  if (parsed?.title?.trim()) return parsed.title.trim();
  if (raw && typeof raw === "object") {
    const title = (raw as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return null;
}

const NEAR_ME_SOURCE =
  "\\b(?:near me|nearby|around me|close to me|near my location|close by)\\b";
const NEAR_ME_KM = 50;

/** "cleaning near me" -> the category words, plus a flag to filter by location. */
export function parseNearMeQuery(raw: string): { text: string; nearMe: boolean } {
  const nearMe = new RegExp(NEAR_ME_SOURCE, "i").test(raw);
  const text = raw
    .replace(new RegExp(NEAR_ME_SOURCE, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, nearMe };
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function cityKey(value: string | null | undefined) {
  return (value || "").split(",")[0]?.trim().toLowerCase() || "";
}

function sameCity(a: string | null | undefined, b: string | null | undefined) {
  const left = cityKey(a);
  const right = cityKey(b);
  if (left.length < 2 || right.length < 2) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function safeIlikeTerm(raw: string) {
  return raw.replace(/[%_,.()"'\\]/g, " ").replace(/\s+/g, " ").trim();
}

function postImage(row: PostRow, categoryId: string | null, custom: string | null) {
  if (row.media_type === "image" && row.storage_path?.trim()) {
    return publicProfileMediaUrl(row.storage_path, {
      width: 400,
      height: 400,
      quality: 80,
      resize: "cover",
    });
  }
  return categoryIllustrationSrc(categoryId, custom);
}

function postTitle(row: PostRow, categoryId: string | null, custom: string | null) {
  const caption = row.caption?.trim().replace(/\*\*/g, "").replace(/\s+/g, " ").trim() || "";
  if (caption) return caption;
  return (
    generatedTitle(row.ai_generated_copy) ||
    postServiceCategoryLabel(categoryId, custom) ||
    (row.post_type_id === "event"
      ? "Event"
      : row.post_type_id === "community"
        ? "Post"
        : "Offer")
  );
}

function postCategory(row: PostRow) {
  const meta = row.post_metadata;
  const id =
    (typeof meta?.service === "string" && meta.service) ||
    (typeof meta?.category === "string" && meta.category) ||
    null;
  const custom =
    (typeof meta?.custom_category === "string" && meta.custom_category.trim()) ||
    row.custom_category?.trim() ||
    null;
  const location = typeof meta?.location === "string" ? meta.location.trim() : "";
  return {
    id,
    custom,
    location,
    lat: finiteNumber(meta?.location_lat),
    lng: finiteNumber(meta?.location_lng),
  };
}

function embeddedAuthor(row: PostRow) {
  const author = row.author;
  const embedded = Array.isArray(author) ? author[0] : author;
  return {
    name: embedded?.full_name?.trim() || "",
    photo: embedded?.photo_url?.trim() || null,
    verified: Boolean(embedded?.is_verified),
    rating: finiteNumber(embedded?.average_rating),
    count: finiteNumber(embedded?.total_ratings),
  };
}

export function useDebouncedListingSearch(query: string, debounceMs = 50) {
  const { user, profile } = useAuth();
  const { i18n } = useTranslation();
  const [results, setResults] = useState<ListingSearchHit[]>([]);
  const [settledQuery, setSettledQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [browserPoint, setBrowserPoint] = useState<{ lat: number; lng: number } | null>(null);

  const profileLat = finiteNumber(profile?.location_lat);
  const profileLng = finiteNumber(profile?.location_lng);
  const profileCity = profile?.city?.trim() || null;
  const viewerLat = profileLat ?? browserPoint?.lat ?? null;
  const viewerLng = profileLng ?? browserPoint?.lng ?? null;

  useEffect(() => {
    if (profileLat != null && profileLng != null) return;
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    let cancelled = false;
    void navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            setBrowserPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {},
          { maximumAge: 10 * 60 * 1000, timeout: 4000, enableHighAccuracy: false },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profileLat, profileLng]);

  useEffect(() => {
    const trimmed = query.trim();
    const parsed = parseNearMeQuery(trimmed);
    const searchText = parsed.text;
    if (searchText.length < 2 && !parsed.nearMe) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const needles = searchNeedles(searchText);
        const categoryIds = matchedCategoryIds(searchText);
        const orParts: string[] = [];
        for (const needle of needles.slice(0, 6)) {
          const safe = safeIlikeTerm(needle);
          if (safe.length < 2) continue;
          const pattern = `%${safe}%`;
          orParts.push(`caption.ilike."${pattern}"`, `custom_category.ilike."${pattern}"`);
        }
        for (const id of categoryIds) {
          orParts.push(`custom_category.eq.${id}`);
          orParts.push(`post_metadata->>service.eq.${id}`);
          orParts.push(`post_metadata->>category.eq.${id}`);
        }
        const userId = user?.id ?? null;

        const postSelect =
          "id, author_id, caption, media_type, storage_path, post_metadata, custom_category, post_type_id, ai_generated_copy, created_at, author:profiles!author_id(full_name, photo_url, is_verified, average_rating, total_ratings)";

        const textPostsPromise = orParts.length > 0
          ? supabase
              .from("profile_posts")
              .select(postSelect)
              .in("post_type_id", ["offer_service", "event", "community"])
              .or(orParts.join(","))
              .order("created_at", { ascending: false })
              .limit(24)
          : parsed.nearMe
            ? supabase
                .from("profile_posts")
                .select(postSelect)
                .in("post_type_id", ["offer_service", "event", "community"])
                .order("created_at", { ascending: false })
                .limit(24)
            : Promise.resolve({ data: [] as PostRow[], error: null });

        const ownPostsPromise = userId
          ? supabase
              .from("profile_posts")
              .select(postSelect)
              .eq("author_id", userId)
              .in("post_type_id", ["offer_service", "event", "community"])
              .order("created_at", { ascending: false })
              .limit(24)
          : Promise.resolve({ data: [] as PostRow[], error: null });

        const nameTerm = safeIlikeTerm(searchText);
        const nameProfilesPromise = nameTerm.length >= 2
          ? supabase
              .from("profiles")
              .select("id, full_name, photo_url, is_verified, average_rating, total_ratings")
              .ilike("full_name", `%${nameTerm}%`)
              .limit(5)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null });

        const [textPosts, ownPosts, nameProfiles] = await Promise.all([
          textPostsPromise,
          ownPostsPromise,
          nameProfilesPromise,
        ]);

        if (cancelled) return;

        const namedIds = ((nameProfiles.data ?? []) as { id: string }[]).map((row) => row.id);
        const posts = new Map<string, PostRow>();
        for (const row of [
          ...((textPosts.data ?? []) as PostRow[]),
          ...((ownPosts.data ?? []) as PostRow[]),
        ]) {
          if (row?.id) posts.set(row.id, row);
        }

        const nameById = new Map<string, { name: string; photo: string | null; verified: boolean; rating: number | null; count: number | null }>();
        for (const row of (nameProfiles.data ?? []) as {
          id: string;
          full_name: string | null;
          photo_url: string | null;
          is_verified: boolean | null;
          average_rating: number | string | null;
          total_ratings: number | string | null;
        }[]) {
          if (row.full_name?.trim()) {
            nameById.set(row.id, {
              name: row.full_name.trim(),
              photo: row.photo_url?.trim() || null,
              verified: Boolean(row.is_verified),
              rating: finiteNumber(row.average_rating),
              count: finiteNumber(row.total_ratings),
            });
          }
        }

        const textMatches = (hay: string) =>
          !searchText || textHitsNeedles(hay, needles);

        const placeOf = (city: string | null | undefined, lat: number | null, lng: number | null) => {
          let km: number | null = null;
          if (
            viewerLat != null &&
            viewerLng != null &&
            lat != null &&
            lng != null
          ) {
            km = haversineDistanceKm(viewerLat, viewerLng, lat, lng);
          }
          if (!parsed.nearMe) return { keep: true, km };
          const cityHit = sameCity(city, profileCity);
          if (km != null) return { keep: km <= NEAR_ME_KM || cityHit, km };
          if (profileCity) return { keep: cityHit, km };
          return { keep: true, km };
        };

        const publish = () => {
          const hits: ListingSearchHit[] = [];
          const perAuthor = new Map<string, number>();
          for (const row of posts.values()) {
            const { id: categoryId, custom, location, lat, lng } = postCategory(row);
            const fromName = nameById.get(row.author_id);
            const embedded = embeddedAuthor(row);
            const authorName = fromName?.name || embedded.name;
            const authorPhotoUrl = embedded.photo || fromName?.photo || null;
            const authorVerified = embedded.verified || Boolean(fromName?.verified);
            const authorRating = embedded.rating ?? fromName?.rating ?? null;
            const authorRatingCount = embedded.count ?? fromName?.count ?? null;
            const title = postTitle(row, categoryId, custom);
            const categoryLabel = postServiceCategoryLabel(categoryId, custom);
            const hay = [title, row.caption, custom, categoryLabel, location, authorName]
              .filter(Boolean)
              .join(" ");
            const categoryHit =
              (categoryId != null && categoryIds.includes(categoryId)) ||
              (custom != null && categoryIds.includes(custom));
            const authorNamed = namedIds.includes(row.author_id);
            const offerMustMatchCategory =
              row.post_type_id === "offer_service" && categoryIds.length > 0;
            if (offerMustMatchCategory && !categoryHit) continue;
            if (!textMatches(hay) && !categoryHit && !authorNamed) continue;
            const place = placeOf(location, lat, lng);
            if (!place.keep) continue;
            const seen = perAuthor.get(row.author_id) ?? 0;
            if (authorNamed && !textMatches(hay) && seen >= 3) continue;
            perAuthor.set(row.author_id, seen + 1);

            const own = row.author_id === userId;
            const kind =
              row.post_type_id === "event"
                ? "event"
                : row.post_type_id === "community"
                  ? "post"
                  : "offer";
            const nearLabel =
              place.km != null ? `${place.km < 1 ? "under 1" : Math.round(place.km)} km` : null;
            const postedAgo = row.created_at
              ? formatDistanceToNow(new Date(row.created_at), {
                  addSuffix: true,
                  locale: dateFnsLocaleFor(i18n.language),
                })
              : null;
            const label =
              kind === "event" ? "Event" : kind === "post" ? "Post" : "Offer";
            hits.push({
              id: `${kind}:${row.id}`,
              kind,
              title,
              subtitle: [
                own ? `Your ${label.toLowerCase()}` : label,
                categoryLabel,
                postedAgo,
                nearLabel,
              ].filter(Boolean).join(" · "),
              authorName: authorName || null,
              authorPhotoUrl,
              authorVerified,
              authorRating,
              authorRatingCount,
              to: isolatedOfferPostPath(row.id),
              imageUrl: postImage(row, categoryId, custom),
              own,
              distanceKm: place.km,
            });
          }
          const ordered = parsed.nearMe
            ? [...hits].sort((a, b) => {
                const ak = a.distanceKm ?? Number.POSITIVE_INFINITY;
                const bk = b.distanceKm ?? Number.POSITIVE_INFINITY;
                return ak - bk;
              })
            : hits;
          setResults(ordered.slice(0, 16));
          setSettledQuery(trimmed);
          setLoading(false);
        };

        publish();

        if (namedIds.length > 0) {
          try {
            const { data } = await supabase
              .from("profile_posts")
              .select(postSelect)
              .in("author_id", namedIds)
              .in("post_type_id", ["offer_service", "event", "community"])
              .order("created_at", { ascending: false })
              .limit(12);
            if (cancelled) return;
            for (const row of (data ?? []) as PostRow[]) {
              if (row?.id && !posts.has(row.id)) posts.set(row.id, row);
            }
            publish();
          } catch {
            // The first batch is already on screen.
          }
        }
      })().catch(() => {
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
      });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, debounceMs, user?.id, viewerLat, viewerLng, profileCity, i18n.language]);

  return { results, settledQuery, loading };
}
