import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function getNativeMapUrl(
  job: any,
  provider: "apple" | "google" | "waze" = "google",
) {
  if (!job) return "";

  const details = job.service_details || {};
  const isPickupDelivery = job.service_type === "pickup_delivery";

  // For pickup/delivery, we prefer the 'to' address as destination
  const address = isPickupDelivery
    ? details.to_address
    : job.location_city || job.address;
  const lat = isPickupDelivery ? details.to_lat : details.lat;
  const lng = isPickupDelivery ? details.to_lng : details.lng;

  const encodedAddress = encodeURIComponent(address || "");
  const coords = lat && lng ? `${lat},${lng}` : "";

  switch (provider) {
    case "apple":
      // Apple Maps: Use coords if available, otherwise address
      return coords
        ? `maps://?q=${encodedAddress || "Destination"}&ll=${coords}&z=13`
        : `maps://?q=${encodedAddress}`;

    case "waze":
      // Waze: Prefers coords for precise navigation
      return coords
        ? `waze://?ll=${coords}&navigate=yes`
        : `waze://?q=${encodedAddress}&navigate=yes`;

    case "google":
    default:
      // Google Maps: Works well with both, universal fallback
      if (coords) {
        return `https://www.google.com/maps/search/?api=1&query=${coords}&query_place_id=${encodedAddress}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }
}
