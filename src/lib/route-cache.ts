/**
 * Gemeinsamer Zwischenspeicher für Routenberechnungen.
 *
 * Mehrere Komponenten (Logistik-Rechner, Taktplanung) fragen oft dieselbe
 * Strecke an. Damit OpenRouteService nicht mehrfach (und ggf. über das
 * kostenlose Limit hinaus) aufgerufen wird, werden Ergebnisse hier pro
 * Koordinatenpaar gecacht – inklusive laufender Anfragen.
 */

export interface RouteErgebnis {
  distanzKm: number;
  fahrzeitMin: number;
}

export interface Punkt {
  lat: number;
  lng: number;
}

const cache = new Map<string, Promise<RouteErgebnis>>();

function rund(n: number): string {
  return n.toFixed(5);
}

function schluessel(from: Punkt, to: Punkt): string {
  return `${rund(from.lat)},${rund(from.lng)}->${rund(to.lat)},${rund(to.lng)}`;
}

export function routeBerechnen(from: Punkt, to: Punkt): Promise<RouteErgebnis> {
  const k = schluessel(from, to);
  const vorhanden = cache.get(k);
  if (vorhanden) return vorhanden;

  const anfrage = fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Route konnte nicht berechnet werden.");
      }
      const d = await r.json();
      return { distanzKm: d.distanzKm, fahrzeitMin: d.fahrzeitMin };
    })
    .catch((e) => {
      // Fehlgeschlagene Anfragen nicht dauerhaft cachen, damit ein erneuter
      // Versuch möglich bleibt.
      cache.delete(k);
      throw e;
    });

  cache.set(k, anfrage);
  return anfrage;
}
