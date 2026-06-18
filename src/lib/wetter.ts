/**
 * Wetter-Hilfen für die Einbau-Disposition.
 *
 * Abruf der Tagesvorhersage (über die serverseitige Route /api/wetter), Cache
 * pro Koordinate+Datum, Zuordnung der WMO-Wettercodes zu Zustand/Symbol und
 * die Witterungsbewertung für den Asphalteinbau.
 */

export interface WetterTag {
  datum: string;
  /** Höchsttemperatur in °C */
  tMax: number;
  /** Tiefsttemperatur in °C */
  tMin: number;
  /** Niederschlagsmenge in mm */
  niederschlagMm: number;
  /** Regenwahrscheinlichkeit in % */
  regenWk: number;
  /** maximale Windgeschwindigkeit in km/h */
  windMax: number;
  /** WMO-Wettercode */
  code: number;
}

export type WetterAntwort =
  | { verfuegbar: true; tag: WetterTag }
  | { verfuegbar: false; grund: string };

/* ------------------------------------------------------------------ */
/*  Schwellenwerte – Richtwerte für Asphalteinbau, leicht anpassbar    */
/* ------------------------------------------------------------------ */

export const WITTERUNG_SCHWELLEN = {
  /** Ab dieser Niederschlagsmenge (mm) gilt der Einbau als kritisch. */
  niederschlagKritischMm: 1,
  /** Ab dieser Regenwahrscheinlichkeit (%) gilt der Einbau als kritisch. */
  regenWkKritisch: 70,
  /** Unter dieser Temperatur (°C, Höchstwert) ist Einbau kritisch. */
  tempKritischC: 5,
  /** Vorwarnstufe Regenwahrscheinlichkeit (%). */
  regenWkWarnung: 40,
  /** Vorwarnstufe Temperatur (°C, Höchstwert). */
  tempWarnungC: 8,
};

/* ------------------------------------------------------------------ */
/*  WMO-Wettercodes → Zustand + Symbol                                 */
/* ------------------------------------------------------------------ */

export type WetterIcon =
  | "sonne"
  | "wolke-sonne"
  | "wolke"
  | "nebel"
  | "niesel"
  | "regen"
  | "schnee"
  | "gewitter";

export function wetterZustand(code: number): { label: string; icon: WetterIcon } {
  if (code === 0) return { label: "Klar", icon: "sonne" };
  if (code === 1 || code === 2)
    return { label: "Teils bewölkt", icon: "wolke-sonne" };
  if (code === 3) return { label: "Bedeckt", icon: "wolke" };
  if (code === 45 || code === 48) return { label: "Nebel", icon: "nebel" };
  if (code >= 51 && code <= 57) return { label: "Nieselregen", icon: "niesel" };
  if (code >= 61 && code <= 67) return { label: "Regen", icon: "regen" };
  if (code >= 71 && code <= 77) return { label: "Schnee", icon: "schnee" };
  if (code >= 80 && code <= 82) return { label: "Regenschauer", icon: "regen" };
  if (code === 85 || code === 86) return { label: "Schneeschauer", icon: "schnee" };
  if (code >= 95) return { label: "Gewitter", icon: "gewitter" };
  return { label: "Wechselhaft", icon: "wolke" };
}

/* ------------------------------------------------------------------ */
/*  Witterungsbewertung für den Einbau                                 */
/* ------------------------------------------------------------------ */

export type WitterungStufe = "geeignet" | "warnung" | "kritisch";

export interface WitterungBewertung {
  stufe: WitterungStufe;
  titel: string;
  gruende: string[];
}

export function bewerteWitterung(tag: WetterTag): WitterungBewertung {
  const s = WITTERUNG_SCHWELLEN;
  const kritisch: string[] = [];
  const warnung: string[] = [];

  if (tag.niederschlagMm >= s.niederschlagKritischMm) {
    kritisch.push(`Niederschlag ${tag.niederschlagMm.toFixed(1)} mm erwartet`);
  }
  if (tag.regenWk >= s.regenWkKritisch) {
    kritisch.push(`Regenwahrscheinlichkeit ${Math.round(tag.regenWk)} %`);
  } else if (tag.regenWk >= s.regenWkWarnung) {
    warnung.push(`Regenwahrscheinlichkeit ${Math.round(tag.regenWk)} %`);
  }
  if (tag.tMax < s.tempKritischC) {
    kritisch.push(`zu kalt (max. ${Math.round(tag.tMax)} °C)`);
  } else if (tag.tMax < s.tempWarnungC) {
    warnung.push(`niedrige Temperatur (max. ${Math.round(tag.tMax)} °C)`);
  }

  if (kritisch.length > 0) {
    return {
      stufe: "kritisch",
      titel: "Witterung kritisch für Asphalteinbau",
      gruende: kritisch,
    };
  }
  if (warnung.length > 0) {
    return {
      stufe: "warnung",
      titel: "Witterung beobachten",
      gruende: warnung,
    };
  }
  return {
    stufe: "geeignet",
    titel: "Witterung für Einbau geeignet",
    gruende: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Abruf mit Cache                                                     */
/* ------------------------------------------------------------------ */

const cache = new Map<string, Promise<WetterAntwort>>();

export function wetterAbrufen(
  lat: number,
  lng: number,
  datum: string
): Promise<WetterAntwort> {
  const k = `${lat.toFixed(4)},${lng.toFixed(4)}@${datum}`;
  const vorhanden = cache.get(k);
  if (vorhanden) return vorhanden;

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    datum,
  });
  const anfrage = fetch(`/api/wetter?${params}`)
    .then(async (r) => {
      const j = (await r.json()) as WetterAntwort;
      return j;
    })
    .catch((): WetterAntwort => {
      cache.delete(k);
      return { verfuegbar: false, grund: "Wetterdienst nicht erreichbar." };
    });

  cache.set(k, anfrage);
  return anfrage;
}
