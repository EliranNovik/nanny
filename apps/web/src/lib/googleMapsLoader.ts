import type { Library } from "@googlemaps/js-api-loader";

/**
 * Single identity + library list for every `useJsApiLoader` call.
 * `@googlemaps/js-api-loader` throws if options differ across the app after the first load.
 */
export const GOOGLE_MAPS_SCRIPT_ID = "app-google-maps";

export const GOOGLE_MAPS_LIBRARIES: Library[] = ["maps", "places"];
