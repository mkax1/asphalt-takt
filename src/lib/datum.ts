/**
 * Zentrale Datums- und Zeit-Helfer für die gesamte App.
 *
 * Es wird durchgängig die deutsche Locale verwendet:
 *   - Datum:   TT.MM.JJJJ        (z. B. 19.06.2026)
 *   - Uhrzeit: HH:MM (24 Std.)   (z. B. 07:00)
 *   - Wochentage / Monate auf Deutsch
 *
 * Intern werden Datumswerte immer als ISO-String "YYYY-MM-DD" gespeichert,
 * damit Sortierung und Vergleiche zuverlässig funktionieren.
 */

export const LOCALE = "de-DE";

/** Wandelt ein Date in ein ISO-Datum (YYYY-MM-DD) ohne Zeitzonen-Versatz. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Wandelt ein ISO-Datum sicher in ein lokales Date um (kein UTC-Versatz). */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Heutiges Datum als ISO-String (lokale Zeitzone). */
export function heuteIso(): string {
  return isoDate(new Date());
}

/**
 * Differenz in ganzen Kalendertagen zwischen zwei ISO-Daten (a − b).
 * Rechnet rein auf Tagesbasis über UTC-Mitternacht und ist damit unabhängig
 * von Zeitzone und Sommer-/Winterzeit.
 */
export function tageDiff(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  const a = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const b = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((a - b) / 86400000);
}

/** Kalendertage vom heutigen lokalen Datum bis zum Ziel (Zukunft = positiv). */
export function tageBisHeute(iso: string): number {
  return tageDiff(iso, heuteIso());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startDerWoche(d: Date): Date {
  const date = new Date(d);
  const tag = (date.getDay() + 6) % 7; // Montag = 0
  date.setDate(date.getDate() - tag);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startDesMonats(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endeDesMonats(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function kalenderWoche(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

/** Nimmt einen ISO-String oder ein Date entgegen. */
function alsDate(wert: string | Date | undefined | null): Date | null {
  if (!wert) return null;
  if (wert instanceof Date) return isNaN(wert.getTime()) ? null : wert;
  // reines ISO-Datum (YYYY-MM-DD) zeitzonensicher parsen
  if (/^\d{4}-\d{2}-\d{2}$/.test(wert)) return parseIso(wert);
  const d = new Date(wert);
  return isNaN(d.getTime()) ? null : d;
}

/** Datum kurz: 19.06.2026 */
export function fmtDatum(wert: string | Date | undefined | null): string {
  const d = alsDate(wert);
  if (!d) return "–";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Datum lang mit Wochentag: Donnerstag, 19. Juni 2026 */
export function fmtDatumLang(wert: string | Date | undefined | null): string {
  const d = alsDate(wert);
  if (!d) return "–";
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Monat + Jahr: Juni 2026 */
export function fmtMonatJahr(wert: string | Date | undefined | null): string {
  const d = alsDate(wert);
  if (!d) return "–";
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Monatsname lang: Juni */
export function fmtMonat(wert: string | Date): string {
  const d = alsDate(wert);
  if (!d) return "–";
  return new Intl.DateTimeFormat(LOCALE, { month: "long" }).format(d);
}

/** Monatsname kurz: Juni → "Jun" */
export function fmtMonatKurz(wert: string | Date): string {
  const d = alsDate(wert);
  if (!d) return "–";
  return new Intl.DateTimeFormat(LOCALE, { month: "short" }).format(d);
}

/** Tag + Monat ohne Jahr: 19.06. */
export function fmtTagMonat(wert: string | Date | undefined | null): string {
  const d = alsDate(wert);
  if (!d) return "–";
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** Uhrzeit 24h: 07:00 */
export function fmtZeit(wert: string | Date | undefined | null): string {
  if (typeof wert === "string" && /^\d{1,2}:\d{2}/.test(wert)) {
    const [h, m] = wert.split(":");
    return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
  }
  const d = alsDate(wert);
  if (!d) return "–";
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/* ---- Umwandlung für deutsche Eingabefelder ---- */

/** ISO (2026-06-19) → deutsches Format (19.06.2026); leer bleibt leer. */
export function isoZuDeutsch(iso: string | undefined | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/**
 * Deutsches Format (19.06.2026 oder 19.6.26) → ISO (2026-06-19).
 * Gibt null zurück, wenn die Eingabe (noch) kein gültiges Datum ist.
 */
export function deutschZuIso(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(t);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  let jahr = Number(yyyy);
  if (yyyy.length === 2) jahr += jahr < 70 ? 2000 : 1900;
  const tag = Number(dd);
  const monat = Number(mm);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  const d = new Date(jahr, monat - 1, tag);
  // Plausibilität (z. B. 31.02. abfangen)
  if (
    d.getFullYear() !== jahr ||
    d.getMonth() !== monat - 1 ||
    d.getDate() !== tag
  )
    return null;
  return isoDate(d);
}
