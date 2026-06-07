export type AddressSuggestion = {
  id: string;
  label: string;
  placePrediction?: google.maps.places.PlacePrediction;
  legacyPlaceId?: string;
};

export type ResolvedAddress = {
  address: string;
  lat: number;
  lng: number;
};

type PlacesDataLibrary = {
  AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion;
  AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken;
};

async function loadPlacesDataLibrary(): Promise<PlacesDataLibrary | null> {
  if (typeof google === "undefined" || !google.maps?.importLibrary) return null;
  try {
    return (await google.maps.importLibrary("places")) as PlacesDataLibrary;
  } catch {
    return null;
  }
}

export async function createAddressAutocompleteSessionToken(): Promise<
  google.maps.places.AutocompleteSessionToken | null
> {
  const lib = await loadPlacesDataLibrary();
  if (!lib) return null;
  return new lib.AutocompleteSessionToken();
}

export async function fetchAddressSuggestions(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken | null,
): Promise<AddressSuggestion[]> {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const lib = await loadPlacesDataLibrary();
  if (lib?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    try {
      const request: google.maps.places.AutocompleteRequest = {
        input: trimmed,
        includedRegionCodes: ["il"],
      };
      if (sessionToken) {
        request.sessionToken = sessionToken;
      }

      const { suggestions } =
        await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      return suggestions.flatMap((suggestion, index) => {
        const prediction = suggestion.placePrediction;
        if (!prediction) return [];
        const label = prediction.text?.toString?.() ?? "";
        if (!label) return [];
        return [
          {
            id: prediction.placeId ?? `suggestion-${index}`,
            label,
            placePrediction: prediction,
          },
        ];
      });
    } catch (error) {
      console.warn("[placesAddressAutocomplete] new API failed, falling back", error);
    }
  }

  if (!google.maps.places?.AutocompleteService) return [];

  return new Promise((resolve) => {
    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      {
        input: trimmed,
        componentRestrictions: { country: "il" },
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }
        resolve(
          predictions.map((prediction) => ({
            id: prediction.place_id,
            label: prediction.description,
            legacyPlaceId: prediction.place_id,
          })),
        );
      },
    );
  });
}

async function resolveNewPlacePrediction(
  placePrediction: google.maps.places.PlacePrediction,
): Promise<ResolvedAddress | null> {
  const place = placePrediction.toPlace();
  await place.fetchFields({
    fields: ["formattedAddress", "location", "displayName"],
  });
  const location = place.location;
  if (!location) return null;
  const address =
    place.formattedAddress?.trim() ||
    place.displayName?.trim() ||
    placePrediction.text?.toString?.() ||
    "";
  if (!address) return null;
  return {
    address,
    lat: location.lat(),
    lng: location.lng(),
  };
}

async function resolveLegacyPlaceId(placeId: string): Promise<ResolvedAddress | null> {
  if (!google.maps.places?.PlacesService) return null;

  return new Promise((resolve) => {
    const host = document.createElement("div");
    const service = new google.maps.places.PlacesService(host);
    service.getDetails(
      {
        placeId,
        fields: ["formatted_address", "geometry", "name"],
      },
      (place, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          resolve(null);
          return;
        }
        resolve({
          address:
            place.formatted_address?.trim() ||
            place.name?.trim() ||
            "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      },
    );
  });
}

export async function resolveAddressSuggestion(
  suggestion: AddressSuggestion,
): Promise<ResolvedAddress | null> {
  if (suggestion.placePrediction) {
    return resolveNewPlacePrediction(suggestion.placePrediction);
  }
  if (suggestion.legacyPlaceId) {
    return resolveLegacyPlaceId(suggestion.legacyPlaceId);
  }
  return null;
}
