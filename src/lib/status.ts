import type { AnforderungStatus, Prioritaet, Rolle } from "./types";

export const STATUS_REIHENFOLGE: AnforderungStatus[] = [
  "neu_erfasst",
  "in_pruefung",
  "planung_vervollstaendigt",
  "in_bearbeitung",
  "abgeschlossen",
];

export const STATUS_LABEL: Record<AnforderungStatus, string> = {
  neu_erfasst: "Neu erfasst",
  in_pruefung: "In Prüfung Schwarzdecke",
  planung_vervollstaendigt: "Planung vervollständigt",
  in_bearbeitung: "In Bearbeitung",
  abgeschlossen: "Abgeschlossen",
};

/** Kurzform fuer enge Stellen (z. B. Kalender-Karten). */
export const STATUS_LABEL_KURZ: Record<AnforderungStatus, string> = {
  neu_erfasst: "Neu",
  in_pruefung: "In Prüfung",
  planung_vervollstaendigt: "Geplant",
  in_bearbeitung: "In Arbeit",
  abgeschlossen: "Fertig",
};

/** Tailwind-Klassen je Status fuer farbige Badges. */
export const STATUS_BADGE: Record<AnforderungStatus, string> = {
  neu_erfasst: "bg-slate-100 text-slate-700 border-slate-200",
  in_pruefung: "bg-amber-100 text-amber-800 border-amber-200",
  planung_vervollstaendigt: "bg-emerald-100 text-emerald-800 border-emerald-200",
  in_bearbeitung: "bg-sky-100 text-sky-800 border-sky-200",
  abgeschlossen: "bg-emerald-600 text-white border-emerald-600",
};

export function naechsterStatus(
  status: AnforderungStatus
): AnforderungStatus | null {
  const i = STATUS_REIHENFOLGE.indexOf(status);
  if (i < 0 || i >= STATUS_REIHENFOLGE.length - 1) return null;
  return STATUS_REIHENFOLGE[i + 1];
}

export const PRIORITAET_LABEL: Record<Prioritaet, string> = {
  niedrig: "Niedrig",
  mittel: "Mittel",
  hoch: "Hoch",
};

export const PRIORITAET_BADGE: Record<Prioritaet, string> = {
  niedrig: "bg-slate-100 text-slate-600 border-slate-200",
  mittel: "bg-sky-100 text-sky-700 border-sky-200",
  hoch: "bg-orange-100 text-orange-800 border-orange-200",
};

export const ROLLE_LABEL: Record<Rolle, string> = {
  bauleiter: "Bauleitung Tiefbau",
  disposition: "Schwarzdecke / Disposition",
  admin: "Administrator",
};
