/**
 * Geocoding-Helfer auf Basis von Nominatim (OpenStreetMap).
 *
 * Nominatim erlaubt nur ~1 Anfrage pro Sekunde. Für Sammel-Läufe daher
 * `warte()` zwischen den Aufrufen verwenden.
 */

export interface GeocodeErgebnis {
  breitengrad: number;
  laengengrad: number;
  /** Von Nominatim normalisierte Adresse (Anzeige optional). */
  adresse: string;
}

/** Kurze Pause (Promise-basiert), um die Nominatim-Rate einzuhalten. */
export function warte(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

function formatAdresse(
  addr: NominatimAddress | undefined,
  fallback: string
): string {
  if (!addr) return fallback;
  const ort = addr.city || addr.town || addr.village || addr.municipality || "";
  const strasse = [addr.road, addr.house_number].filter(Boolean).join(" ");
  const plzOrt = [addr.postcode, ort].filter(Boolean).join(" ");
  const teile = [strasse, plzOrt].filter(Boolean);
  return teile.length > 0 ? teile.join(", ") : fallback;
}

/**
 * Ermittelt Koordinaten zu einer Adresse.
 * Gibt `null` zurück, wenn nichts gefunden wurde oder ein Fehler auftrat.
 */
export async function geocodeAdresse(
  adresse: string
): Promise<GeocodeErgebnis | null> {
  const q = adresse.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
        q
      )}`,
      { headers: { "Accept-Language": "de" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const treffer = data[0];
    const lat = parseFloat(treffer.lat);
    const lng = parseFloat(treffer.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return {
      breitengrad: lat,
      laengengrad: lng,
      adresse: treffer.address ? formatAdresse(treffer.address, q) : q,
    };
  } catch {
    return null;
  }
}
