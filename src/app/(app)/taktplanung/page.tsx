"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  Gauge,
  Layers,
  Lock,
  MapPin,
  Printer,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatTonnage } from "@/lib/calc";
import { addDays, fmtDatumLang, isoDate, parseIso } from "@/lib/datum";
import { dokumentDrucken, escHtml } from "@/lib/druck";
import { routeBerechnen } from "@/lib/route-cache";
import { LogistikRechner } from "@/components/logistik-rechner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";

/** Richtwerte für die überschlägige LKW-Abschätzung in der Tagesübersicht. */
const SCHAETZ_KAPAZITAET = 25; // t je LKW
const SCHAETZ_EINBAULEISTUNG = 100; // t/h Kolonne
const SCHAETZ_LADEZEIT = 5; // Min.
const SCHAETZ_ENTLADEZEIT = 10; // Min.
const ARBEITSTAG_STD = 8;

function timeToMin(t: string): number {
  const [h, m] = (t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minToTime(min: number): string {
  const m = (((Math.round(min) % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatNum(n: number, nachkomma = 0): string {
  if (!isFinite(n)) return "–";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: nachkomma,
    minimumFractionDigits: 0,
  }).format(n);
}

function coordKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export default function TaktplanungPage() {
  const {
    currentUser,
    anforderungen,
    einsaetze,
    baustellen,
    materialarten,
    kolonnen,
    mischanlage,
    betrieb,
  } = useStore();

  const darfSehen =
    currentUser.rolle === "disposition" || currentUser.rolle === "admin";

  const [datum, setDatum] = useState(() => isoDate(addDays(new Date(), 1)));
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [routen, setRouten] = useState<Record<string, number>>({});
  const [routenLaden, setRoutenLaden] = useState(false);

  const produktionsleistung = mischanlage.produktionsleistung || 160;
  const fuhrpark = betrieb.fuhrparkLkw || 0;
  const ruestzeit = betrieb.sortenwechselRuestzeitMin || 0;

  const materialName = useCallback(
    (id: string) => materialarten.find((m) => m.id === id)?.bezeichnung ?? "—",
    [materialarten]
  );
  const baustelleName = useCallback(
    (id: string) => baustellen.find((b) => b.id === id)?.name ?? "Baustelle",
    [baustellen]
  );

  /** Alle für den gewählten Tag eingeplanten Einsätze mit aufbereiteten Daten. */
  const tagesEinsaetze = useMemo(() => {
    return einsaetze
      .filter((e) => e.datum === datum)
      .map((e) => {
        const a = anforderungen.find((x) => x.id === e.anforderung_id);
        const kolonne = kolonnen.find((k) => k.id === e.kolonne_id);
        // Positionen, die explizit an diesem Tag eingebaut werden.
        const allePositionen = a?.materialien ?? [];
        const positionenTag = allePositionen.filter(
          (pos) => pos.einbautag === datum
        );
        // Sind für diesen Tag eigene Einbautage gepflegt, gelten nur diese –
        // sonst zählt die komplette Tonnage der Anforderung (Summe aller
        // Materialpositionen). So wird sie nie fälschlich als 0 gelesen.
        const positionen =
          positionenTag.length > 0 ? positionenTag : allePositionen;
        const tonnage = positionen.reduce((s, m) => s + m.tonnage, 0);
        const primary = [...positionen].sort(
          (x, y) => y.tonnage - x.tonnage
        )[0];
        const sorteId = primary?.material_id ?? "";
        const startMin = timeToMin(e.startzeit);
        return {
          einsatz: e,
          a,
          kolonne,
          positionen,
          tonnage,
          sorteId,
          sorteName: sorteId ? materialName(sorteId) : "—",
          baustelle: a ? baustelleName(a.baustelle_id) : "Baustelle",
          startMin,
          endeMin: startMin + (e.dauer_std || 0) * 60,
        };
      })
      .filter((x) => x.a)
      .sort((a, b) => a.startMin - b.startMin);
  }, [einsaetze, anforderungen, kolonnen, datum, materialName, baustelleName]);

  // Routen (Fahrzeit) je Baustelle laden
  /* eslint-disable react-hooks/set-state-in-effect -- Ladezustand vor/nach dem Routenabruf setzen */
  useEffect(() => {
    const ziele = tagesEinsaetze
      .filter((x) => x.a?.breitengrad != null && x.a?.laengengrad != null)
      .map((x) => ({
        key: coordKey(x.a!.breitengrad!, x.a!.laengengrad!),
        lat: x.a!.breitengrad!,
        lng: x.a!.laengengrad!,
      }));
    const distinct = [...new Map(ziele.map((z) => [z.key, z])).values()];
    if (distinct.length === 0) {
      setRouten({});
      setRoutenLaden(false);
      return;
    }
    let abbruch = false;
    setRoutenLaden(true);
    Promise.all(
      distinct.map(async (z) => {
        try {
          const d = await routeBerechnen(
            { lat: mischanlage.breitengrad, lng: mischanlage.laengengrad },
            { lat: z.lat, lng: z.lng }
          );
          return [z.key, Math.round(d.fahrzeitMin)] as const;
        } catch {
          return [z.key, null] as const;
        }
      })
    ).then((eintraege) => {
      if (abbruch) return;
      const map: Record<string, number> = {};
      for (const [k, v] of eintraege) if (v != null) map[k] = v;
      setRouten(map);
      setRoutenLaden(false);
    });
    return () => {
      abbruch = true;
    };
  }, [tagesEinsaetze, mischanlage.breitengrad, mischanlage.laengengrad]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const getFahrzeit = useCallback(
    (lat?: number, lng?: number): number | null => {
      if (lat == null || lng == null) return null;
      const v = routen[coordKey(lat, lng)];
      return v == null ? null : v;
    },
    [routen]
  );

  // Benötigte LKW je Einsatz (Schätzung mit Richtwerten)
  const benoetigteLkw = useCallback(
    (fahrzeit: number | null): number | null => {
      if (fahrzeit == null) return null;
      const eff = Math.min(SCHAETZ_EINBAULEISTUNG, produktionsleistung);
      const taktzeit = eff > 0 ? (SCHAETZ_KAPAZITAET / eff) * 60 : 0;
      const umlaufzeit = 2 * fahrzeit + SCHAETZ_LADEZEIT + SCHAETZ_ENTLADEZEIT;
      return taktzeit > 0 ? Math.ceil(umlaufzeit / taktzeit) : 0;
    },
    [produktionsleistung]
  );

  // Tonnage je Mischgutsorte
  const sortenBedarf = useMemo(() => {
    const map = new Map<string, number>();
    for (const ei of tagesEinsaetze) {
      for (const pos of ei.positionen) {
        map.set(pos.material_id, (map.get(pos.material_id) ?? 0) + pos.tonnage);
      }
    }
    return [...map.entries()]
      .map(([material_id, tonnage]) => ({ material_id, tonnage }))
      .sort((a, b) => b.tonnage - a.tonnage);
  }, [tagesEinsaetze]);

  const gesamtTonnage = sortenBedarf.reduce((s, g) => s + g.tonnage, 0);

  // Anlagen-Auslastung
  const anlagenStunden = produktionsleistung > 0 ? gesamtTonnage / produktionsleistung : 0;
  const anlageProzent =
    ARBEITSTAG_STD > 0 ? (anlagenStunden / ARBEITSTAG_STD) * 100 : 0;
  const tagesleistung = produktionsleistung * ARBEITSTAG_STD;

  // Flotten-Spitzenbedarf (max. gleichzeitig benötigte LKW)
  const flotte = useMemo(() => {
    type Ev = { t: number; delta: number };
    const events: Ev[] = [];
    let unbekannt = false;
    for (const ei of tagesEinsaetze) {
      const f = getFahrzeit(ei.a?.breitengrad, ei.a?.laengengrad);
      const lkw = benoetigteLkw(f);
      if (lkw == null) {
        unbekannt = true;
        continue;
      }
      events.push({ t: ei.startMin, delta: lkw });
      events.push({ t: ei.endeMin, delta: -lkw });
    }
    events.sort((a, b) => a.t - b.t || a.delta - b.delta);
    let lauf = 0;
    let peak = 0;
    for (const ev of events) {
      lauf += ev.delta;
      if (lauf > peak) peak = lauf;
    }
    return { peak, unbekannt };
  }, [tagesEinsaetze, getFahrzeit, benoetigteLkw]);

  const flotteProzent = fuhrpark > 0 ? (flotte.peak / fuhrpark) * 100 : 0;

  // Konflikte
  const konflikte = useMemo(() => {
    const liste: { ton: "rot" | "orange"; text: string }[] = [];

    if (fuhrpark > 0 && flotte.peak > fuhrpark) {
      liste.push({
        ton: "rot",
        text: `Zu wenige LKW: Gleichzeitig laufende Einsätze brauchen bis zu ${flotte.peak} LKW, verfügbar sind nur ${fuhrpark}.`,
      });
    }

    // Zeitgleiche Einsätze mit unterschiedlicher Sorte
    let sortenKonflikt = false;
    for (let i = 0; i < tagesEinsaetze.length; i++) {
      for (let j = i + 1; j < tagesEinsaetze.length; j++) {
        const a = tagesEinsaetze[i];
        const b = tagesEinsaetze[j];
        const ueberlappt = a.startMin < b.endeMin && b.startMin < a.endeMin;
        if (ueberlappt && a.sorteId && b.sorteId && a.sorteId !== b.sorteId) {
          sortenKonflikt = true;
        }
      }
    }
    if (sortenKonflikt) {
      liste.push({
        ton: "orange",
        text: "Zeitgleiche Einsätze mit unterschiedlicher Mischgutsorte – die Anlage kann nur eine Sorte gleichzeitig produzieren.",
      });
    }

    if (tagesleistung > 0 && gesamtTonnage > tagesleistung) {
      liste.push({
        ton: "orange",
        text: `Tages-Gesamttonnage (${formatTonnage(gesamtTonnage)}) übersteigt die Tagesleistung der Anlage (${formatTonnage(tagesleistung)} bei ${ARBEITSTAG_STD} Std.).`,
      });
    }

    return liste;
  }, [tagesEinsaetze, flotte.peak, fuhrpark, gesamtTonnage, tagesleistung]);

  // Sortenreihenfolge (gleiche Sorte zusammen, geordnet nach frühestem Start)
  const sortenreihenfolge = useMemo(() => {
    const startProSorte = new Map<string, number>();
    const tonProSorte = new Map<string, number>();
    for (const ei of tagesEinsaetze) {
      for (const pos of ei.positionen) {
        const cur = startProSorte.get(pos.material_id);
        if (cur == null || ei.startMin < cur)
          startProSorte.set(pos.material_id, ei.startMin);
        tonProSorte.set(
          pos.material_id,
          (tonProSorte.get(pos.material_id) ?? 0) + pos.tonnage
        );
      }
    }
    const sorten = [...tonProSorte.entries()]
      .map(([material_id, tonnage]) => ({
        material_id,
        tonnage,
        start: startProSorte.get(material_id) ?? 0,
      }))
      .sort((a, b) => a.start - b.start);
    const wechsel = Math.max(0, sorten.length - 1);
    return { sorten, wechsel, ruestGesamt: wechsel * ruestzeit };
  }, [tagesEinsaetze, ruestzeit]);

  function toggle(id: string) {
    setOffen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function drucken() {
    if (tagesEinsaetze.length === 0) {
      toast.error("Für diesen Tag gibt es keine Einsätze zum Drucken.");
      return;
    }
    const konfliktHtml =
      konflikte.length > 0
        ? `<h2>Konflikte</h2><ul style="margin:6px 0;padding-left:18px">${konflikte
            .map(
              (k) =>
                `<li style="color:${
                  k.ton === "rot" ? "#b91c1c" : "#b45309"
                };margin-bottom:3px">${escHtml(k.text)}</li>`
            )
            .join("")}</ul>`
        : "";

    const sortenHtml = sortenreihenfolge.sorten
      .map(
        (s, i) =>
          `<tr><td class="num">${i + 1}</td><td>${escHtml(
            materialName(s.material_id)
          )}</td><td class="num strong">${formatTonnage(s.tonnage)}</td></tr>`
      )
      .join("");

    const einsatzHtml = tagesEinsaetze
      .map((ei) => {
        const f = getFahrzeit(ei.a?.breitengrad, ei.a?.laengengrad);
        const lkw = benoetigteLkw(f);
        return `<tr>
          <td class="strong">${escHtml(ei.einsatz.startzeit)} Uhr</td>
          <td>${escHtml(ei.baustelle)}</td>
          <td>${escHtml(ei.sorteName)}</td>
          <td class="num">${formatTonnage(ei.tonnage)}</td>
          <td>${escHtml(ei.kolonne?.name ?? "–")}</td>
          <td class="num">${lkw == null ? "–" : lkw}</td>
        </tr>`;
      })
      .join("");

    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Gesamttonnage</div><div class="value">${formatTonnage(
          gesamtTonnage
        )}</div></div>
        <div class="kpi"><div class="label">Einsätze</div><div class="value">${
          tagesEinsaetze.length
        }</div></div>
        <div class="kpi"><div class="label">Anlagen-Auslastung</div><div class="value">${Math.round(
          anlageProzent
        )}%</div></div>
        <div class="kpi"><div class="label">LKW-Spitzenbedarf</div><div class="value">${
          flotte.unbekannt ? "?" : flotte.peak
        } / ${fuhrpark}</div></div>
      </div>
      ${konfliktHtml}
      <h2>Vorgeschlagene Sortenreihenfolge</h2>
      <table>
        <thead><tr><th class="num">#</th><th>Mischgutsorte</th><th class="num">Tonnage</th></tr></thead>
        <tbody>${sortenHtml}</tbody>
      </table>
      <p style="font-size:11px;color:#555;margin:6px 0 0">${
        sortenreihenfolge.wechsel
      } Sortenwechsel · Rüstzeit gesamt ca. ${
        sortenreihenfolge.ruestGesamt
      } Min.</p>
      <h2>Einsätze des Tages</h2>
      <table>
        <thead><tr>
          <th>Start</th><th>Baustelle</th><th>Sorte</th>
          <th class="num">Tonnage</th><th>Kolonne</th><th class="num">LKW</th>
        </tr></thead>
        <tbody>${einsatzHtml}</tbody>
      </table>
      <div class="hinweis">Richtwerte – Anlagenleistung, Flottengröße, Lade-, Entlade- und Rüstzeiten bitte mit Anlage und Disposition abstimmen.</div>`;

    dokumentDrucken({
      titel: "Taktplanung – Tagesdisposition",
      untertitel: fmtDatumLang(datum),
      bodyHtml: body,
      logoUrl: window.location.origin + "/logo.png",
    });
  }

  if (!darfSehen) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Taktplanung"
          description="Tages-Disposition für Mischanlage und LKW-Flotte."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="size-6" />
            </div>
            <p className="text-sm font-medium">Kein Zugriff</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Die Taktplanung steht nur den Rollen Disposition und Administration
              zur Verfügung.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Taktplanung"
        description="Tages-Disposition für Mischanlage und LKW-Flotte."
        actions={
          tagesEinsaetze.length > 0 ? (
            <Button variant="outline" onClick={drucken}>
              <Printer className="size-4" />
              Drucken / PDF
            </Button>
          ) : undefined
        }
      />

      {/* Datumsnavigation */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          {fmtDatumLang(datum)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDatum(isoDate(addDays(parseIso(datum), -1)))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <DateField
            value={datum}
            onChange={(iso) => iso && setDatum(iso)}
            className="w-44"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDatum(isoDate(addDays(parseIso(datum), 1)))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setDatum(isoDate(new Date()))}>
            Heute
          </Button>
        </div>
      </div>

      {tagesEinsaetze.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CalendarDays className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Keine Einsätze geplant</p>
            <p className="text-xs text-muted-foreground">
              Für {fmtDatumLang(datum)} ist keine Produktion eingeplant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tagesübersicht – Kennzahlen */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Gesamttonnage + Sorten */}
            <Card className="overflow-hidden p-0 sm:col-span-2">
              <div className="h-1.5 w-full bg-hebel-gelb" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Factory className="size-3.5 text-primary" />
                  Gesamttonnage des Tages
                </div>
                <div className="mt-1 text-3xl font-semibold leading-none text-primary">
                  {formatTonnage(gesamtTonnage)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sortenBedarf.map((s) => (
                    <span
                      key={s.material_id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs"
                    >
                      <Layers className="size-3 text-primary" />
                      <span className="font-medium">
                        {materialName(s.material_id)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTonnage(s.tonnage)}
                      </span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Anzahl Einsätze */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Truck className="size-3.5 text-primary" />
                  Einsätze
                </div>
                <div className="mt-2 text-3xl font-semibold leading-none">
                  {tagesEinsaetze.length}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {sortenBedarf.length} Mischgutsorte
                  {sortenBedarf.length === 1 ? "" : "n"}
                </div>
              </CardContent>
            </Card>

            {/* Auslastungen */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <Auslastung
                  icon={Gauge}
                  label="Anlagen-Auslastung"
                  wert={`${formatNum(anlagenStunden, 1)} / ${ARBEITSTAG_STD} Std.`}
                  prozent={anlageProzent}
                />
                <Auslastung
                  icon={Truck}
                  label="Flotten-Auslastung"
                  wert={
                    flotte.unbekannt && flotte.peak === 0
                      ? "wird berechnet…"
                      : `${flotte.peak} / ${fuhrpark} LKW`
                  }
                  prozent={flotteProzent}
                />
              </CardContent>
            </Card>
          </div>

          {/* Konflikte */}
          <div className="mb-6 space-y-2">
            {konflikte.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="size-4 shrink-0" />
                Keine Konflikte erkannt – Tagesplanung ist stimmig.
              </div>
            ) : (
              konflikte.map((k, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
                    k.ton === "rot"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-orange-300 bg-orange-50 text-orange-800"
                  )}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{k.text}</span>
                </div>
              ))
            )}
            {routenLaden && (
              <p className="text-xs text-muted-foreground">
                Fahrzeiten werden berechnet – LKW-Bedarf wird gleich
                aktualisiert.
              </p>
            )}
          </div>

          {/* Sortenreihenfolge */}
          {sortenreihenfolge.sorten.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4 text-primary" />
                  Vorgeschlagene Sortenreihenfolge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {sortenreihenfolge.sorten.map((s, i) => (
                    <span key={s.material_id} className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1.5 text-sm">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                          {i + 1}
                        </span>
                        <span className="font-medium">
                          {materialName(s.material_id)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTonnage(s.tonnage)}
                        </span>
                      </span>
                      {i < sortenreihenfolge.sorten.length - 1 && (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sortenreihenfolge.wechsel} Sortenwechsel ×{" "}
                  {ruestzeit} Min. ={" "}
                  <span className="font-medium text-foreground">
                    {sortenreihenfolge.ruestGesamt} Min.
                  </span>{" "}
                  Rüstzeit. Gleiche Sorten möglichst zusammen produzieren.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Einsatz-Detail (aufklappbar) */}
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Einsätze des Tages
          </h2>
          <div className="space-y-3">
            {tagesEinsaetze.map((ei) => {
              const fahrzeit = getFahrzeit(
                ei.a?.breitengrad,
                ei.a?.laengengrad
              );
              const lkw = benoetigteLkw(fahrzeit);
              const istOffen = offen.has(ei.einsatz.id);
              const erstesMaterial = ei.positionen[0]
                ? materialarten.find(
                    (m) => m.id === ei.positionen[0].material_id
                  )
                : undefined;
              return (
                <Card key={ei.einsatz.id} className="overflow-hidden">
                  <button
                    onClick={() => toggle(ei.einsatz.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        istOffen && "rotate-180"
                      )}
                    />
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: ei.kolonne?.farbe || "#64748b" }}
                      title={ei.kolonne?.name}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {ei.baustelle}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="size-3" />
                          {ei.sorteName}
                        </span>
                        <span>{ei.kolonne?.name}</span>
                        <span>ab {minToTime(ei.startMin)} Uhr</span>
                      </span>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="text-sm font-semibold text-primary tabular-nums">
                        {formatTonnage(ei.tonnage)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {lkw == null
                          ? fahrzeit == null && !routenLaden
                            ? "keine Route"
                            : "…"
                          : `${lkw} LKW`}
                      </div>
                    </div>
                  </button>
                  {istOffen && (
                    <div className="border-t bg-muted/20 p-4">
                      <LogistikRechner
                        gesamtTonnage={ei.tonnage}
                        zielLat={ei.a?.breitengrad}
                        zielLng={ei.a?.laengengrad}
                        standardLadekapazitaet={erstesMaterial?.standard_lkw}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <p className="mt-6 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            Richtwerte – Anlagenleistung, Flottengröße, Lade-, Entlade- und
            Rüstzeiten bitte mit Anlage und Disposition abstimmen.
          </p>
        </>
      )}
    </div>
  );
}

function Auslastung({
  icon: Icon,
  label,
  wert,
  prozent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  wert: string;
  prozent: number;
}) {
  const clamped = Math.max(0, Math.min(100, prozent));
  const ton =
    prozent > 100 ? "bg-red-500" : prozent > 80 ? "bg-orange-400" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5 text-primary" />
          {label}
        </span>
        <span className="font-medium tabular-nums">{wert}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", ton)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
