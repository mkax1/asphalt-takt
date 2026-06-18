/**
 * Rechen-Logik fuer Asphalt-Mischgut.
 * Annahme aus dem Bauplan (mit Disposition fachlich pruefen):
 *   Dichte ~ 2,4 t/m^3  =>  kg/m^2 = Schichtdicke(cm) * 24
 *   Tonnage = Flaeche(m^2) * kg/m^2 / 1000
 */

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

export function formatDatum(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export type TerminDringlichkeit = "ueberfaellig" | "bald" | "normal";

/**
 * Bewertet einen Wunschtermin:
 * - "ueberfaellig": Termin liegt in der Vergangenheit (und nicht abgeschlossen)
 * - "bald": Termin innerhalb der nächsten 3 Tage
 * - "normal": alles andere
 */
export function terminDringlichkeit(
  iso: string | undefined,
  abgeschlossen: boolean
): TerminDringlichkeit {
  if (!iso || abgeschlossen) return "normal";
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "normal";
  d.setHours(0, 0, 0, 0);
  const diffTage = Math.round((d.getTime() - heute.getTime()) / 86400000);
  if (diffTage < 0) return "ueberfaellig";
  if (diffTage <= 3) return "bald";
  return "normal";
}
