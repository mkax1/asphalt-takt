"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Standard-Marker-Icons in Bundlern korrekt einbinden
const icon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMap({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick?: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[lat, lng]}
        icon={icon}
        draggable={Boolean(onPick)}
        eventHandlers={
          onPick
            ? {
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const p = m.getLatLng();
                  onPick(p.lat, p.lng);
                },
              }
            : undefined
        }
      />
      <Recenter lat={lat} lng={lng} />
      {onPick && <ClickHandler onPick={onPick} />}
    </MapContainer>
  );
}
