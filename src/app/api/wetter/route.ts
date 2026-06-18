import { NextResponse } from "next/server";

/**
 * Serverseitige Wettervorhersage über Open-Meteo (kostenlos, ohne API-Key).
 *
 * Liefert die Tagesvorhersage für die übergebenen Koordinaten und das Datum
 * (Höchst-/Tiefsttemperatur, Niederschlag, Regenwahrscheinlichkeit, Wind und
 * den WMO-Wettercode). Open-Meteo liefert nur etwa 16 Tage im Voraus – liegt
 * der Tag außerhalb dieses Fensters, wird klar mit `verfuegbar: false`
 * geantwortet statt mit einem Fehler.
 */

// Open-Meteo liefert kostenlos zuverlässig bis ca. 15 Tage im Voraus.
const MAX_VORHERSAGE_TAGE = 15;
const ZEITZONE = "Europe/Berlin";

/** Heutiges Datum (YYYY-MM-DD) in der Zeitzone Europe/Berlin – unabhängig von
 *  der Zeitzone des Servers (in Produktion oft UTC). */
function heuteBerlinIso(): string {
  // en-CA formatiert als YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Differenz in ganzen Kalendertagen (a − b) über UTC-Mitternacht. */
function tageDiff(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const datum = url.searchParams.get("datum") ?? "";

  // Hinweis: Number(null) bzw. Number("") ergibt 0 – daher müssen leere/fehlende
  // Parameter explizit abgefangen werden, sonst würde 0,0 als gültig gelten.
  if (
    !latRaw ||
    !lngRaw ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(datum)
  ) {
    return NextResponse.json(
      { verfuegbar: false, grund: "Koordinaten oder Datum fehlen." },
      { status: 400 }
    );
  }

  // Vorhersage-Fenster prüfen (heute … heute + 16 Tage), Vergleich gegen das
  // heutige Datum in Europe/Berlin, rein auf Kalendertag-Basis.
  const diffTage = tageDiff(datum, heuteBerlinIso());
  if (diffTage < 0) {
    return NextResponse.json({
      verfuegbar: false,
      grund: "Einbautag liegt in der Vergangenheit.",
    });
  }
  if (diffTage > MAX_VORHERSAGE_TAGE) {
    return NextResponse.json({
      verfuegbar: false,
      grund: `Vorhersage noch nicht verfügbar (mehr als ${MAX_VORHERSAGE_TAGE} Tage im Voraus).`,
    });
  }

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily:
      "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max",
    timezone: ZEITZONE,
    start_date: datum,
    end_date: datum,
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      // Vorhersage darf serverseitig kurz gecacht werden.
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // 400 o. ä. bedeutet i. d. R. einen Tag außerhalb des Vorhersagefensters.
      return NextResponse.json({
        verfuegbar: false,
        grund: "Vorhersage noch nicht verfügbar.",
      });
    }

    const data = await res.json();
    const d = data?.daily;
    const tMax = d?.temperature_2m_max?.[0];
    const tMin = d?.temperature_2m_min?.[0];
    if (typeof tMax !== "number" || typeof tMin !== "number") {
      return NextResponse.json({
        verfuegbar: false,
        grund: "Vorhersage noch nicht verfügbar.",
      });
    }

    return NextResponse.json({
      verfuegbar: true,
      tag: {
        datum,
        tMax,
        tMin,
        niederschlagMm: d.precipitation_sum?.[0] ?? 0,
        regenWk: d.precipitation_probability_max?.[0] ?? 0,
        windMax: d.windspeed_10m_max?.[0] ?? 0,
        code: d.weathercode?.[0] ?? 0,
      },
    });
  } catch {
    return NextResponse.json({
      verfuegbar: false,
      grund: "Wetterdienst nicht erreichbar.",
    });
  }
}
