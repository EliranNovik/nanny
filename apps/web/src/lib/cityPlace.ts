/** Structured city picked from Google Places (dropdown or geocoder). */
export type CityPlaceSelection = {
  /** Human-readable city label for display and profiles.city */
  label: string;
  /** Google Places ID — stable reference for maps, matching, and geocoding */
  placeId: string;
  lat: number | null;
  lng: number | null;
};

function cityLabelFromAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string {
  if (!components?.length) return "";
  for (const c of components) {
    if (c.types.includes("locality")) return c.long_name;
  }
  for (const c of components) {
    if (c.types.includes("administrative_area_level_1")) return c.long_name;
  }
  for (const c of components) {
    if (
      c.types.includes("sublocality") ||
      c.types.includes("sublocality_level_1")
    ) {
      return c.long_name;
    }
  }
  return "";
}

export function cityLabelFromPlace(
  place: google.maps.places.PlaceResult,
): string {
  const fromComponents = cityLabelFromAddressComponents(place.address_components);
  if (fromComponents) return fromComponents;
  const name = place.name?.trim();
  if (name) return name;
  return place.formatted_address?.split(",")[0]?.trim() || "";
}

export function cityPlaceFromPlace(
  place: google.maps.places.PlaceResult,
): CityPlaceSelection | null {
  const label = cityLabelFromPlace(place);
  const placeId = place.place_id?.trim();
  if (!label || !placeId) return null;
  const loc = place.geometry?.location;
  return {
    label,
    placeId,
    lat: loc ? loc.lat() : null,
    lng: loc ? loc.lng() : null,
  };
}

export function cityPlaceFromGeocoderResult(
  result: google.maps.GeocoderResult,
): CityPlaceSelection | null {
  const label =
    cityLabelFromAddressComponents(result.address_components) ||
    result.formatted_address?.split(",")[0]?.trim() ||
    "";
  const placeId = result.place_id?.trim();
  if (!label || !placeId) return null;
  const loc = result.geometry?.location;
  return {
    label,
    placeId,
    lat: loc ? loc.lat() : null,
    lng: loc ? loc.lng() : null,
  };
}

/** Reverse-geocode GPS coordinates to a city-level Google place. */
export async function geocodeCoordsToCityPlace(
  lat: number,
  lng: number,
): Promise<CityPlaceSelection | null> {
  if (typeof google === "undefined" || !google.maps?.Geocoder) {
    return null;
  }

  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        resolve(null);
        return;
      }
      for (const result of results) {
        const selection = cityPlaceFromGeocoderResult(result);
        if (selection) {
          resolve(selection);
          return;
        }
      }
      resolve(cityPlaceFromGeocoderResult(results[0]));
    });
  });
}
