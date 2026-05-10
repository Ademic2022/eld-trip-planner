import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon path broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const STOP_COLORS = {
  PICKUP: "#16a34a",
  DROPOFF: "#15803d",
  FUEL: "#ea580c",
  OVERNIGHT_REST: "#dc2626",
  REST_BREAK: "#ca8a04",
};

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
}

export default function MapView({ polyline, stops }) {
  const positions = polyline?.map((p) => [p.lat, p.lng]) || [];
  const center = positions[Math.floor(positions.length / 2)] || [39.5, -98.35];

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {positions.length > 1 && (
        <>
          <Polyline positions={positions} color="#2563eb" weight={3} opacity={0.8} />
          <FitBounds positions={positions} />
        </>
      )}

      {stops?.map((stop, i) => {
        const color = STOP_COLORS[stop.stopType] || "#6b7280";
        const icon = makeIcon(color);
        return (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={icon}>
            <Popup>
              <div className="text-sm">
                <strong>{stop.stopType.replace("_", " ")}</strong><br />
                {stop.location}<br />
                {stop.durationHours >= 1
                  ? `${stop.durationHours.toFixed(1)} hrs`
                  : `${Math.round(stop.durationHours * 60)} min`}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
