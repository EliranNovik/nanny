import { useState, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import MapFallback from "./MapFallback";

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
}

export default function JobMap({ job, onRouteInfo }: JobMapProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        libraries,
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [center, setCenter] = useState<{ lat: number; lng: number }>(defaultCenter);
    const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [showFallback, setShowFallback] = useState(false);

    // Use a ref to track if we've initialized for this specific job ID to prevent infinite loops/re-renders
    // but allow updates if job ID changes
    const processedJobIdRef = useRef<string | null>(null);

    useEffect(() => {
        // If map fails to load within 10 seconds, offer fallback
        const timer = setTimeout(() => {
            if (!isLoaded && !loadError) setShowFallback(true);
        }, 10000);
        return () => clearTimeout(timer);
    }, [isLoaded, loadError]);

    useEffect(() => {
        if (!isLoaded || !job) return;
        
        // Hide fallback if map finally loads
        setShowFallback(false);

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
                    }
                });
            }
        };

        setupMap();
    }, [isLoaded, job?.id, job?.service_type, job?.location_city]);

    if (loadError || showFallback) return <MapFallback job={job} onRetry={() => setShowFallback(false)} />;
    if (!isLoaded) return <div className="h-full w-full bg-muted animate-pulse rounded-lg flex items-center justify-center text-muted-foreground flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest opacity-50">Initializing Map...</span>
    </div>;

    return (
        <div className="relative w-full h-full overflow-hidden">
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
