// Location utility functions for GPS and reverse geocoding

export interface LocationData {
  city: string;
  lat?: number;
  lng?: number;
}

/**
 * Get user's current location using GPS
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let message = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location access denied. Please enable location permissions in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get city name
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Use Nominatim API for reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          "User-Agent": "NannyApp/1.0", // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch location data");
    }

    const data = await response.json();
    
    // Extract city name from address components
    const address = data.address || {};
    
    // Try different possible city fields (varies by country)
    const city = 
      address.city || 
      address.town || 
      address.village || 
      address.municipality ||
      address.county ||
      address.state_district ||
      address.state ||
      "Unknown";
    
    return city;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    throw new Error("Failed to determine city from location");
  }
}

/**
 * Get city name from GPS coordinates
 */
export async function getCityFromLocation(): Promise<string> {
  const location = await getCurrentLocation();
  return await reverseGeocode(location.lat, location.lng);
}
