"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Factory,
  MapPin,
  Printer,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatTonnage } from "@/lib/calc";
import { dokumentDrucken, escHtml } from "@/lib/druck";
import {
  addDays,
  addMonths,
  endeDesMonats,
  fmtDatumLang,
  fmtMonatJahr,
  fmtTagMonat,
  isoDate,
  kalenderWoche,
  parseIso,
  startDerWoche,
  startDesMonats,
} from "@/lib/datum";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Modus = "tag" | "woche" | "monat";

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const langDatum = fmtDatumLang;
const monatLang = fmtMonatJahr;
const kurz = fmtTagMonat;

interface Beitrag {
  material_id: string;
  tonnage: number;
  baustelle_id: string;
}

interface Spalte {
  key: string;
  label: string;
  sub?: string;
  tage: string[];
  aktiv: boolean;
}

const MODI: { id: Modus; label: string }[] = [
  { id: "tag", label: "Tag" },
  { id: "woche", label: "Woche" },
  { id: "monat", label: "Monat" },
];

export default function TagesbedarfPage() {
  const { anforderungen, einsaetze, baustellen, materialarten } = useStore();

  const [modus, setModus] = useState<Modus>("tag");
  const [datum, setDatum] = useState(() => isoDate(addDays(new Date(), 1)));

  const materialName = useCallback(
    (id: string) => materialarten.find((m) => m.id === id)?.bezeichnung ?? "—",
    [materialarten]
  );
  const materialNr = useCallback(
    (id: string) => materialarten.find((m) => m.id === id)?.material_nr ?? "",
    [materialarten]
  );
  const baustelleName = useCallback(
    (id: string) => baustellen.find((b) => b.id === id)?.name ?? "Baustelle",
    [baustellen]
  );

  /**
   * Liefert alle Mischgut-Beiträge, die an einem bestimmten Tag produziert
   * werden müssen. Maßgeblich ist der Einbautag der Material-Position; fehlt
   * dieser, gilt der Tag eines eingeplanten Einsatzes der Anforderung.
   */
  const bedarfFuerDatum = useCallback(
    (d: string): Beitrag[] => {
      const beitraege: Beitrag[] = [];
      for (const a of anforderungen) {
        const hatEinsatzAmTag = einsaetze.some(
          (e) => e.anforderung_id === a.id && e.datum === d
        );
        for (const pos of a.materialien) {
          const zaehlt = pos.einbautag ? pos.einbautag === d : hatEinsatzAmTag;
          if (zaehlt) {
            beitraege.push({
              material_id: pos.material_id,
              tonnage: pos.tonnage,
              baustelle_id: a.baustelle_id,
            });
          }
        }
      }
      return beitraege;
    },
    [anforderungen, einsaetze]
  );

  // Sichtbarer Zeitraum je nach Modus
  const { von, bis, tage } = useMemo(() => {
    let start: Date;
    let ende: Date;
    if (modus === "monat") {
      start = startDesMonats(parseIso(datum));
      ende = endeDesMonats(parseIso(datum));
    } else if (modus === "woche") {
      start = startDerWoche(parseIso(datum));
      ende = addDays(start, 6);
    } else {
      start = parseIso(datum);
      ende = parseIso(datum);
    }
    const liste: string[] = [];
    for (let d = new Date(start); d <= ende; d = addDays(d, 1)) {
      liste.push(isoDate(d));
    }
    return { von: isoDate(start), bis: isoDate(ende), tage: liste };
  }, [modus, datum]);

  // Aggregierte Sorten-Gruppen für den Zeitraum
  const gruppen = useMemo(() => {
    const map = new Map<string, { tonnage: number; baustellen: Set<string> }>();
    for (const tag of tage) {
      for (const c of bedarfFuerDatum(tag)) {
        const g = map.get(c.material_id) ?? {
          tonnage: 0,
          baustellen: new Set<string>(),
        };
        g.tonnage += c.tonnage;
        g.baustellen.add(c.baustelle_id);
        map.set(c.material_id, g);
      }
    }
    return [...map.entries()]
      .map(([material_id, g]) => ({
        material_id,
        tonnage: g.tonnage,
        anzahlBaustellen: g.baustellen.size,
        baustellen: [...g.baustellen].map(baustelleName),
      }))
      .sort((a, b) => b.tonnage - a.tonnage);
  }, [tage, bedarfFuerDatum, baustelleName]);

  const gesamtTonnage = gruppen.reduce((s, g) => s + g.tonnage, 0);
  const einsaetzeImBereich = einsaetze.filter(
    (e) => e.datum >= von && e.datum <= bis
  ).length;

  // Detail-Aufschlüsselung (Spalten je nach Modus)
  const aufschluesselung = useMemo(() => {
    let spalten: Spalte[];
    if (modus === "monat") {
      const mStart = startDesMonats(parseIso(datum));
      const mEnd = endeDesMonats(parseIso(datum));
      spalten = [];
      for (
        let wStart = startDerWoche(mStart);
        wStart <= mEnd;
        wStart = addDays(wStart, 7)
      ) {
        const wTage: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(wStart, i);
          if (d >= mStart && d <= mEnd) wTage.push(isoDate(d));
        }
        spalten.push({
          key: isoDate(wStart),
          label: `KW ${kalenderWoche(wStart)}`,
          sub: `${wTage.length ? kurz(wTage[0]) : ""}`,
          tage: wTage,
          aktiv: wTage.includes(datum),
        });
      }
    } else {
      const start = startDerWoche(parseIso(datum));
      spalten = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const iso = isoDate(d);
        return {
          key: iso,
          label: TAGE[i],
          sub: `${d.getDate()}.${d.getMonth() + 1}.`,
          tage: [iso],
          aktiv: iso === datum,
        };
      });
    }

    const map = new Map<string, number[]>();
    spalten.forEach((sp, idx) => {
      for (const tag of sp.tage) {
        for (const c of bedarfFuerDatum(tag)) {
          const arr = map.get(c.material_id) ?? new Array(spalten.length).fill(0);
          arr[idx] += c.tonnage;
          map.set(c.material_id, arr);
        }
      }
    });
    const zeilen = [...map.entries()]
      .map(([material_id, werte]) => ({
        material_id,
        werte,
        summe: werte.reduce((s, x) => s + x, 0),
      }))
      .sort((a, b) => b.summe - a.summe);
    const spaltenSummen = spalten.map((_, i) =>
      zeilen.reduce((s, z) => s + z.werte[i], 0)
    );
    const gesamt = spaltenSummen.reduce((s, x) => s + x, 0);
    return { spalten, zeilen, spaltenSummen, gesamt };
  }, [modus, datum, bedarfFuerDatum]);

  function verschiebe(n: number) {
    if (modus === "monat") setDatum(isoDate(addMonths(parseIso(datum), n)));
    else if (modus === "woche")
      setDatum(isoDate(addDays(parseIso(datum), n * 7)));
    else setDatum(isoDate(addDays(parseIso(datum), n)));
  }

  const periodeLabel =
    modus === "tag"
      ? langDatum(datum)
      : modus === "woche"
        ? `KW ${kalenderWoche(parseIso(von))} · ${kurz(von)}–${kurz(bis)}${parseIso(bis).getFullYear()}`
        : monatLang(datum);

  const periodeKurz =
    modus === "tag" ? "des Tages" : modus === "woche" ? "der Woche" : "des Monats";

  function drucken() {
    if (gruppen.length === 0) {
      toast.error("Für diesen Zeitraum gibt es keinen Bedarf zum Drucken.");
      return;
    }
    const zeilen = gruppen
      .map(
        (g) => `
        <tr>
          <td class="strong">${escHtml(materialNr(g.material_id))}</td>
          <td>${escHtml(materialName(g.material_id))}</td>
          <td class="num">${g.anzahlBaustellen}</td>
          <td>${g.baustellen.map(escHtml).join(", ")}</td>
          <td class="num strong">${formatTonnage(g.tonnage)}</td>
        </tr>`
      )
      .join("");
    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Gesamttonnage ${escHtml(
          periodeKurz
        )}</div><div class="value">${formatTonnage(gesamtTonnage)}</div></div>
        <div class="kpi"><div class="label">Mischgutsorten</div><div class="value">${
          gruppen.length
        }</div></div>
        <div class="kpi"><div class="label">Einsätze</div><div class="value">${einsaetzeImBereich}</div></div>
      </div>
      <h2>Bedarf je Mischgutsorte</h2>
      <table>
        <thead>
          <tr>
            <th>Nr.</th><th>Mischgutsorte</th>
            <th class="num">Baustellen</th><th>Baustellen-Namen</th>
            <th class="num">Tonnage</th>
          </tr>
        </thead>
        <tbody>${zeilen}</tbody>
        <tfoot>
          <tr><td colspan="4">Gesamt</td><td class="num">${formatTonnage(
            gesamtTonnage
          )}</td></tr>
        </tfoot>
      </table>
      <div class="hinweis">Richtwerte – bitte mit Anlage und Disposition abstimmen.</div>`;
    dokumentDrucken({
      titel: "Bedarf der Mischanlage",
      untertitel: periodeLabel,
      bodyHtml: body,
      logoUrl: window.location.origin + "/logo.png",
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Bedarf der Mischanlage"
        description="Was die Asphaltmischanlage produzieren muss."
        actions={
          <Button variant="outline" onClick={drucken}>
            <Printer className="size-4" />
            Drucken / PDF
          </Button>
        }
      />

      {/* Steuerleiste: Modus + Navigation */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          {MODI.map((m) => (
            <button
              key={m.id}
              onClick={() => setModus(m.id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                modus === m.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => verschiebe(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <DateField
            value={datum}
            onChange={(iso) => iso && setDatum(iso)}
            className="w-44"
          />
          <Button variant="outline" size="icon" onClick={() => verschiebe(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setDatum(isoDate(new Date()))}
          >
            Heute
          </Button>
        </div>
      </div>

      {/* Große Kennzahl */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="h-1.5 w-full bg-hebel-gelb" />
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Factory className="size-7" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{periodeLabel}</div>
              <div className="mt-0.5 text-4xl font-semibold leading-none text-primary">
                {formatTonnage(gesamtTonnage)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Gesamtbedarf {periodeKurz}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="text-center">
              <div className="text-2xl font-semibold leading-none">
                {einsaetzeImBereich}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Truck className="size-3.5" /> Einsätze
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold leading-none">
                {gruppen.length}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Factory className="size-3.5" /> Sorten
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sorten-Tabelle */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Bedarf nach Mischgutsorte</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {gruppen.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <CalendarDays className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">
                Kein Bedarf für {periodeKurz === "des Tages" ? "diesen Tag" : periodeKurz === "der Woche" ? "diese Woche" : "diesen Monat"}
              </p>
              <p className="text-xs text-muted-foreground">
                Für {periodeLabel} ist keine Produktion eingeplant.
              </p>
            </div>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">Mischgutsorte</TableHead>
                  <TableHead className="w-[18%] text-right">
                    Gesamttonnage
                  </TableHead>
                  <TableHead className="w-[14%] text-right">Baustellen</TableHead>
                  <TableHead className="w-[34%]">Baustellen (Namen)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gruppen.map((g) => (
                  <TableRow key={g.material_id}>
                    <TableCell>
                      <div className="font-medium">
                        {materialName(g.material_id)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Nr. {materialNr(g.material_id)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary tabular-nums">
                      {formatTonnage(g.tonnage)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.anzahlBaustellen}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span>{g.baustellen.join(", ")}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail-Aufschlüsselung */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {modus === "monat"
            ? "Aufschlüsselung nach Kalenderwoche"
            : "Aufschlüsselung nach Wochentag"}
        </h2>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div className="min-w-[720px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Mischgutsorte</TableHead>
                    {aufschluesselung.spalten.map((sp) => (
                      <TableHead
                        key={sp.key}
                        className={cn(
                          "text-right tabular-nums",
                          sp.aktiv && "bg-primary/5 text-primary"
                        )}
                      >
                        <div>{sp.label}</div>
                        {sp.sub && (
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {sp.sub}
                          </div>
                        )}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Summe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aufschluesselung.zeilen.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={aufschluesselung.spalten.length + 2}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Kein Bedarf in diesem Zeitraum.
                      </TableCell>
                    </TableRow>
                  )}
                  {aufschluesselung.zeilen.map((z) => (
                    <TableRow key={z.material_id}>
                      <TableCell className="font-medium">
                        {materialName(z.material_id)}
                      </TableCell>
                      {z.werte.map((w, i) => (
                        <TableCell
                          key={i}
                          className={cn(
                            "text-right tabular-nums",
                            aufschluesselung.spalten[i].aktiv && "bg-primary/5",
                            w === 0 && "text-muted-foreground/40"
                          )}
                        >
                          {w === 0 ? "–" : formatTonnage(w)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold text-primary tabular-nums">
                        {formatTonnage(z.summe)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {aufschluesselung.zeilen.length > 0 && (
                  <tfoot>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Summe</TableCell>
                      {aufschluesselung.spaltenSummen.map((s, i) => (
                        <TableCell
                          key={i}
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            aufschluesselung.spalten[i].aktiv && "bg-primary/5",
                            s === 0 && "font-normal text-muted-foreground/40"
                          )}
                        >
                          {s === 0 ? "–" : formatTonnage(s)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold text-primary tabular-nums">
                        {formatTonnage(aufschluesselung.gesamt)}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
