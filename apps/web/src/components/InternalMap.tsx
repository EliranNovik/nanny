import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet + Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface InternalMapProps {
  job: any;
  className?: string;
}

// Helper to auto-center/zoom the map based on markers
function MapResizer({ markers }: { markers: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, markers]);
  return null;
}

const InternalMap: React.FC<InternalMapProps> = ({ job, className }) => {
  if (!job) return null;

  const isPickupDelivery = job.service_type === 'pickup_delivery';
  const details = job.service_details || {};

  const markers: { pos: [number, number], label: string }[] = [];
  
  if (isPickupDelivery) {
    if (details.from_lat && details.from_lng) {
      markers.push({ pos: [Number(details.from_lat), Number(details.from_lng)], label: 'Pickup' });
    }
    if (details.to_lat && details.to_lng) {
      markers.push({ pos: [Number(details.to_lat), Number(details.to_lng)], label: 'Delivery' });
    }
  } else {
    const lat = details.lat || job.lat;
    const lng = details.lng || job.lng;
    if (lat && lng) {
      markers.push({ pos: [Number(lat), Number(lng)], label: 'Location' });
    }
  }

  // Fallback center if no markers
  const center: [number, number] = markers.length > 0 ? markers[0].pos : [32.0853, 34.7818];

  return (
    <div className={`w-full h-full min-h-[300px] rounded-2xl overflow-hidden shadow-inner border border-black/5 ${className}`}>
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <Marker key={i} position={m.pos}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
        {isPickupDelivery && markers.length === 2 && (
          <Polyline 
            positions={[markers[0].pos, markers[1].pos]} 
            color="#f97316"
            weight={4}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
        <MapResizer markers={markers.map(m => m.pos)} />
      </MapContainer>
    </div>
  );
};

export default InternalMap;
