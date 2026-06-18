/**
 * Rechen-Logik fuer Asphalt-Mischgut.
 * Annahme aus dem Bauplan (mit Disposition fachlich pruefen):
 *   Dichte ~ 2,4 t/m^3  =>  kg/m^2 = Schichtdicke(cm) * 24
 *   Tonnage = Flaeche(m^2) * kg/m^2 / 1000
 */

import { fmtDatum, parseIso, tageBisHeute } from "./datum";

export const DICHTE_FAKTOR = 24;

export function berechneKgProM2(schichtdickeCm: number): number {
  if (!schichtdickeCm || schichtdickeCm <= 0) return 0;
  return Math.round(schichtdickeCm * DICHTE_FAKTOR);
}

export function berechneTonnage(flaecheM2: number, kgProM2: number): number {
  if (!flaecheM2 || !kgProM2) return 0;
  return Math.round((flaecheM2 * kgProM2) / 1000);
}

export function formatTonnage(t: number): string {
  return `${new Intl.NumberFormat("de-DE").format(Math.round(t))} t`;
}

export function formatZahl(n: number): string {
  return new Intl.NumberFormat("de-DE").format(n);
}

/** Datum als TT.MM.JJJJ – zeitzonensicher (siehe lib/datum). */
export function formatDatum(iso?: string): string {
  return fmtDatum(iso);
}

export type TerminDringlichkeit = "ueberfaellig" | "bald" | "normal";

/**
 * Bewertet einen Wunschtermin gegen das HEUTIGE lokale Datum:
 * - "ueberfaellig": Termin liegt vor heute (und nicht abgeschlossen)
 * - "bald": heute oder innerhalb der nächsten 3 Tage
 * - "normal": alles andere
 *
 * Der Vergleich erfolgt rein auf Kalendertag-Basis (kein UTC-Versatz), sodass
 * ein Termin von heute oder in der Zukunft nie als vergangen gilt.
 */
export function terminDringlichkeit(
  iso: string | undefined,
  abgeschlossen: boolean
): TerminDringlichkeit {
  if (!iso || abgeschlossen) return "normal";
  const d = parseIso(iso);
  if (isNaN(d.getTime())) return "normal";
  const diffTage = tageBisHeute(iso);
  if (diffTage < 0) return "ueberfaellig";
  if (diffTage <= 3) return "bald";
  return "normal";
}
