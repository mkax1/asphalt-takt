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

/**
 * Tailwind-Klassen je Status – gedeckte, einheitliche Palette
 * (helle Fläche, kräftiger Text, feiner Rahmen).
 */
export const STATUS_BADGE: Record<AnforderungStatus, string> = {
  neu_erfasst: "bg-slate-50 text-slate-600 border-slate-200",
  in_pruefung: "bg-amber-50 text-amber-700 border-amber-200",
  planung_vervollstaendigt: "bg-sky-50 text-sky-700 border-sky-200",
  in_bearbeitung: "bg-indigo-50 text-indigo-700 border-indigo-200",
  abgeschlossen: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function naechsterStatus(
  status: AnforderungStatus
): AnforderungStatus | null {
  const i = STATUS_REIHENFOLGE.indexOf(status);
  if (i < 0 || i >= STATUS_REIHENFOLGE.length - 1) return null;
  return STATUS_REIHENFOLGE[i + 1];
}

export function vorherigerStatus(
  status: AnforderungStatus
): AnforderungStatus | null {
  const i = STATUS_REIHENFOLGE.indexOf(status);
  if (i <= 0) return null;
  return STATUS_REIHENFOLGE[i - 1];
}

export const PRIORITAET_LABEL: Record<Prioritaet, string> = {
  niedrig: "Niedrig",
  mittel: "Mittel",
  hoch: "Hoch",
};

export const PRIORITAET_BADGE: Record<Prioritaet, string> = {
  niedrig: "bg-slate-50 text-slate-600 border-slate-200",
  mittel: "bg-sky-50 text-sky-700 border-sky-200",
  hoch: "bg-orange-50 text-orange-700 border-orange-200",
};

export const ROLLE_LABEL: Record<Rolle, string> = {
  bauleiter: "Bauleitung Tiefbau",
  disposition: "Schwarzdecke / Disposition",
  admin: "Administrator",
};
