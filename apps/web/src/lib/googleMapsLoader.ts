import type { Library } from "@googlemaps/js-api-loader";

/**
 * Single identity + library list for every `useJsApiLoader` call.
 * `@googlemaps/js-api-loader` throws if options differ across the app after the first load.
 */
export const GOOGLE_MAPS_SCRIPT_ID = "app-google-maps";

export const GOOGLE_MAPS_LIBRARIES: Library[] = ["maps", "places"];

/** One-finger pan/zoom on embedded search maps (helpers + job match). */
export const GOOGLE_MAP_EMBED_OPTIONS = {
  gestureHandling: "greedy",
  fullscreenControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  zoomControl: false,
  scaleControl: false,
  rotateControl: false,
  clickableIcons: false,
} as const;

/** Asymmetric fitBounds padding — extra right inset clears the vertical radius slider. */
export const MAP_SEARCH_CIRCLE_FIT_PADDING: google.maps.Padding = {
  top: 48,
  right: 108,
  bottom: 56,
  left: 28,
};
