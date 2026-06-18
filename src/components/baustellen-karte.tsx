"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface BaustellenMarker {
  id: string;
  name: string;
  nummer: string;
  adresse: string;
  ansprechpartner: string;
  status: "aktiv" | "inaktiv";
  anzahlAnf: number;
  naechsterEinbau: string | null;
  lat: number;
  lng: number;
}

const FARBE_AKTIV = "#005A9A"; // Hebel-Blau
const FARBE_INAKTIV = "#94a3b8"; // dezentes Grau

const FALLBACK_CENTER: [number, number] = [47.9889, 10.1825]; // Allgäu

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Farbiger Punkt-Marker nach Status. */
function pinIcon(aktiv: boolean): L.DivIcon {
  const farbe = aktiv ? FARBE_AKTIV : FARBE_INAKTIV;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${farbe};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function popupHtml(b: BaustellenMarker): string {
  const statusFarbe = b.status === "aktiv" ? FARBE_AKTIV : FARBE_INAKTIV;
  const statusText = b.status === "aktiv" ? "Aktiv" : "Inaktiv";
  const zeile = (label: string, wert: string) =>
    `<div style="display:flex;gap:6px;margin-top:2px"><span style="color:#6b7280;min-width:96px">${label}</span><span style="color:#111827;font-weight:500">${wert}</span></div>`;
  return `
    <div style="font-family:inherit;font-size:13px;line-height:1.45;min-width:210px">
      <div style="font-weight:700;font-size:14px;color:#111827">${esc(
        b.name
      )}</div>
      <div style="margin-top:6px">
        ${zeile("Nummer", esc(b.nummer) || "–")}
        ${zeile("Adresse", esc(b.adresse) || "–")}
        ${zeile("Ansprechp.", esc(b.ansprechpartner) || "–")}
        <div style="display:flex;gap:6px;margin-top:2px">
          <span style="color:#6b7280;min-width:96px">Status</span>
          <span style="display:inline-flex;align-items:center;gap:5px;font-weight:500;color:#111827">
            <span style="width:9px;height:9px;border-radius:9999px;background:${statusFarbe}"></span>${statusText}
          </span>
        </div>
        ${zeile("Anforderungen", String(b.anzahlAnf))}
        ${zeile("Nächster Einbau", b.naechsterEinbau ? esc(b.naechsterEinbau) : "noch nicht eingeplant")}
      </div>
      <a href="/baustellen/${esc(b.id)}"
         style="display:inline-block;margin-top:10px;color:${FARBE_AKTIV};font-weight:600;text-decoration:none">
        Zur Baustelle →
      </a>
    </div>`;
}

function ClusterLayer({ markers }: { markers: BaustellenMarker[] }) {
  const map = useMap();
  useEffect(() => {
    const gruppe = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
    });
    markers.forEach((b) => {
      const m = L.marker([b.lat, b.lng], {
        icon: pinIcon(b.status === "aktiv"),
        title: b.name,
      });
      m.bindPopup(popupHtml(b), { minWidth: 220 });
      gruppe.addLayer(m);
    });
    gruppe.addTo(map);

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
    } else if (markers.length > 1) {
      map.fitBounds(gruppe.getBounds().pad(0.2), { maxZoom: 15 });
    }

    return () => {
      map.removeLayer(gruppe);
    };
  }, [map, markers]);
  return null;
}

export default function BaustellenKarte({
  markers,
}: {
  markers: BaustellenMarker[];
}) {
  const center: [number, number] = markers[0]
    ? [markers[0].lat, markers[0].lng]
    : FALLBACK_CENTER;

  // Erst nach dem Mount rendern und mit stabilem Key versehen, damit Leaflet
  // beim (Hot-)Remount nie einen bereits belegten Container wiederverwendet
  // ("Map container is being reused by another instance").
  const [mountId, setMountId] = useState<string | null>(null);
  useEffect(() => {
    setMountId(Math.random().toString(36).slice(2));
  }, []);

  if (!mountId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Karte wird geladen…
      </div>
    );
  }

  return (
    <MapContainer
      key={mountId}
      center={center}
      zoom={9}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClusterLayer markers={markers} />
    </MapContainer>
  );
}
