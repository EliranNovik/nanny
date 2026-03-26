import { useState, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
    width: "100%",
    height: "100%",
};

const defaultCenter = {
    lat: 32.0853,
    lng: 34.7818, // Tel Aviv default
};

interface JobMapProps {
    job: any;
    onRouteInfo?: (info: { distance: string; duration: string }) => void;
    onClose?: () => void;
}

export default function JobMap({ job, onRouteInfo, onClose }: JobMapProps) {
    const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: mapsApiKey,
        libraries,
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [center, setCenter] = useState<{ lat: number; lng: number }>(defaultCenter);
    const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Detect Google Maps auth/runtime errors and show actionable guidance.
    useEffect(() => {
        if (!containerRef.current || !isLoaded) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const hasError = containerRef.current?.querySelector('.gm-err-container');
                    if (hasError) {
                        setMapError("Google Maps authorization failed for this domain. Please check API key restrictions and billing.");
                    }
                }
            }
        });

        observer.observe(containerRef.current, { childList: true, subtree: true });

        // Google invokes this global callback on auth failures.
        const previousAuthFailure = (window as any).gm_authFailure;
        (window as any).gm_authFailure = () => {
            setMapError("Google Maps auth failure. This usually means the deployed domain is not allowed in API key referrers.");
            if (typeof previousAuthFailure === "function") previousAuthFailure();
        };

        return () => {
            observer.disconnect();
            (window as any).gm_authFailure = previousAuthFailure;
        };
    }, [isLoaded]);

    // Use a ref to track if we've initialized for this specific job ID to prevent infinite loops/re-renders
    // but allow updates if job ID changes
    const processedJobIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isLoaded || !job) return;

        // Check if we need to process this job
        // We process if we haven't processed ANY job yet, or if the job ID changed
        const shouldProcess = !processedJobIdRef.current || processedJobIdRef.current !== job.id;

        if (!shouldProcess && !loading) return;

        const setupMap = async () => {
            processedJobIdRef.current = job.id;

            // Pickup & Delivery Route Logic
            if (
                job.service_type === "pickup_delivery" &&
                job.service_details?.from_lat &&
                job.service_details?.to_lat
            ) {
                setLoading(true);
                const directionsService = new google.maps.DirectionsService();

                const origin = { lat: Number(job.service_details.from_lat), lng: Number(job.service_details.from_lng) };
                const destination = { lat: Number(job.service_details.to_lat), lng: Number(job.service_details.to_lng) };

                // Center map on midpoint initially
                setCenter({
                    lat: (origin.lat + destination.lat) / 2,
                    lng: (origin.lng + destination.lng) / 2
                });

                directionsService.route({
                    origin,
                    destination,
                    travelMode: google.maps.TravelMode.DRIVING,
                }, (result, status) => {
                    setLoading(false);
                    if (status === "OK" && result) {
                        setDirections(result);
                        const route = result.routes[0];
                        if (route && route.legs[0] && onRouteInfo) {
                            onRouteInfo({
                                distance: route.legs[0].distance?.text || "",
                                duration: route.legs[0].duration?.text || "",
                            });
                        }
                    } else {
                        console.error("Directions request failed due to " + status);
                        if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED') {
                            setMapError("Google Maps request denied. Check Maps API enablement, billing, and HTTP referrer restrictions.");
                        }
                    }
                });
            }
            // Single Location Logic (Geocoding City)
            else if (job.location_city) {
                setLoading(true);
                setDirections(null); // Clear directions if switching to single point
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: job.location_city }, (results, status) => {
                    setLoading(false);
                    if (status === "OK" && results && results[0]) {
                        const loc = results[0].geometry.location;
                        const pos = { lat: loc.lat(), lng: loc.lng() };
                        setCenter(pos);
                        setMarkerPosition(pos);
                    } else {
                        console.error("Geocode was not successful for the following reason: " + status);
                        if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED') {
                            setMapError("Google Geocoding request denied. Check API restrictions and billing.");
                        }
                    }
                });
            }
        };

        setupMap();
    }, [isLoaded, job?.id, job?.service_type, job?.location_city]);

    if (!mapsApiKey) {
        return (
            <div className="h-full w-full bg-muted rounded-lg border border-destructive/20 p-4 flex items-center justify-center text-center">
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-destructive">Google Maps API key is missing</p>
                    <p className="text-xs text-muted-foreground">Set `VITE_GOOGLE_MAPS_API_KEY` in the deployed web environment.</p>
                </div>
            </div>
        );
    }

    if (loadError || mapError) {
        return (
            <div className="h-full w-full bg-muted rounded-lg border border-destructive/20 p-4 flex items-center justify-center text-center">
                <div className="space-y-3 max-w-md">
                    <p className="text-sm font-semibold text-destructive">Google Maps failed to load</p>
                    <p className="text-xs text-muted-foreground">
                        {mapError || "Script load failed. Verify the API key, enabled APIs, billing, and allowed HTTP referrers."}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        Current host: <span className="font-mono">{window.location.host}</span>
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
                            onClick={() => window.location.reload()}
                        >
                            Retry
                        </button>
                        {onClose && (
                            <button
                                type="button"
                                className="text-xs px-3 py-1.5 rounded-md border border-border"
                                onClick={onClose}
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    if (!isLoaded) return <div className="h-full w-full bg-muted animate-pulse rounded-lg flex items-center justify-center text-muted-foreground flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest opacity-50">Initializing Map...</span>
    </div>;

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                zoom={13}
                center={center}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                }}
            >
                {directions ? (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: false,
                            polylineOptions: {
                                strokeColor: "#F97316", // Primary orange
                                strokeWeight: 4,
                            },
                        }}
                    />
                ) : (
                    markerPosition && <Marker position={markerPosition} />
                )}
            </GoogleMap>
        </div>
    );
}
