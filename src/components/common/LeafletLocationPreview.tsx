import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { divIcon, LatLngExpression } from 'leaflet';

interface LeafletLocationPreviewProps {
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  radiusMeters?: number;
}

const locationIcon = divIcon({
  className: '',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#111827;color:#ffffff;border:2px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.35);font-size:14px;">
      📍
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export function LeafletLocationPreview({
  latitude,
  longitude,
  title,
  subtitle,
  radiusMeters = 300,
}: LeafletLocationPreviewProps) {
  const center: LatLngExpression = [latitude, longitude];

  return (
    <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle center={center} radius={radiusMeters} pathOptions={{ color: '#111827', fillOpacity: 0.12 }} />
      <Marker position={center} icon={locationIcon}>
        <Popup>
          <div className="text-sm">
            <p className="font-bold text-gray-900">{title}</p>
            {subtitle ? <p className="text-gray-600">{subtitle}</p> : null}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
