import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "app_active_location_mode";

export type LocationMode =
  | { type: "gps" }
  | { type: "profile" }
  | { type: "custom"; city: string; country: string | null };

function readMode(): LocationMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { type: "gps" };
    const parsed = JSON.parse(raw) as LocationMode;
    return parsed;
  } catch {
    return { type: "gps" };
  }
}

function writeMode(mode: LocationMode) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ city: string | null; country: string | null }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "MamaLama-App/1.0",
        },
      },
    );
    if (!res.ok) return { city: null, country: null };
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };
    const a = data?.address;
    const city =
      a?.city ?? a?.town ?? a?.village ?? a?.county ?? a?.state ?? null;
    const country = a?.country ?? null;
    return { city, country };
  } catch {
    return { city: null, country: null };
  }
}

export type ActiveLocationResult = {
  /** City to display in the header chip */
  displayCity: string | null;
  /** Country label — detected for GPS, 'Israel' for profile, null for unset */
  displayCountry: string | null;
  /** The active mode */
  mode: LocationMode;
  /** Set a new mode and persist it */
  setMode: (m: LocationMode) => void;
  /** GPS-detected city (null if not yet detected or denied) */
  gpsCity: string | null;
  /** GPS-detected country */
  gpsCountry: string | null;
  /** Profile-saved city */
  profileCity: string | null;
  /** True while GPS is being detected */
  gpsLoading: boolean;
  /** True if GPS permission was denied */
  gpsDenied: boolean;
};

export function useActiveLocation(): ActiveLocationResult {
  const { profile } = useAuth();
  const profileCity = profile?.city?.trim() ?? null;

  const [mode, setModeState] = useState<LocationMode>(readMode);
  const [gpsCity, setGpsCity] = useState<string | null>(null);
  const [gpsCountry, setGpsCountry] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);

  const setMode = useCallback((m: LocationMode) => {
    setModeState(m);
    writeMode(m);
  }, []);

  // Detect GPS city whenever mode is GPS
  useEffect(() => {
    if (mode.type !== "gps") return;
    if (gpsDenied) return;
    if (!("geolocation" in navigator)) {
      setGpsDenied(true);
      return;
    }

    setGpsLoading(true);
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const { city, country } = await reverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        if (cancelled) return;
        setGpsCity(city);
        setGpsCountry(country);
        setGpsLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.warn("[useActiveLocation] GPS denied:", err.message);
        setGpsDenied(true);
        setGpsLoading(false);
        // Fall back to profile mode silently
        setMode({ type: "profile" });
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
    // Re-run only when mode type switches to gps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.type, gpsDenied]);

  let displayCity: string | null = null;
  let displayCountry: string | null = null;

  if (mode.type === "gps") {
    displayCity = gpsCity ?? (gpsLoading ? null : profileCity);
    displayCountry = gpsCountry ?? (gpsCity ? null : profileCity ? "Israel" : null);
  } else if (mode.type === "profile") {
    displayCity = profileCity;
    displayCountry = profileCity ? "Israel" : null;
  } else {
    displayCity = mode.city || null;
    displayCountry = mode.country ?? null;
  }

  return {
    displayCity,
    displayCountry,
    mode,
    setMode,
    gpsCity,
    gpsCountry,
    profileCity,
    gpsLoading,
    gpsDenied,
  };
}
