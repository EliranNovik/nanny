import type { Library } from "@googlemaps/js-api-loader";

/**
 * Single identity + library list for every `useJsApiLoader` call.
 * `@googlemaps/js-api-loader` throws if options differ across the app after the first load.
 */
export const GOOGLE_MAPS_SCRIPT_ID = "app-google-maps";

export const GOOGLE_MAPS_LIBRARIES: Library[] = ["maps", "places"];

/** One-finger pan/zoom on embedded maps (avoids cooperative two-finger mode). */
export const GOOGLE_MAP_EMBED_OPTIONS = {
  gestureHandling: "greedy",
} as const;
