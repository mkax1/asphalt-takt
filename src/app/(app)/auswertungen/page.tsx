"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Layers,
  Lock,
  Printer,
  Target,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatTonnage, formatZahl } from "@/lib/calc";
import {
  addDays,
  addMonths,
  endeDesMonats,
  fmtDatum,
  fmtMonatJahr,
  fmtMonatKurz,
  isoDate,
  kalenderWoche,
  parseIso,
  startDerWoche,
  startDesMonats,
} from "@/lib/datum";
import { STATUS_LABEL, STATUS_REIHENFOLGE } from "@/lib/status";
import { dokumentDrucken, escHtml } from "@/lib/druck";
import { exportExcel, type ExcelTabelle } from "@/lib/excel";
import type { Anforderung } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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

const HEBEL_BLAU = "#005A9A";
const ACHSE = "#94a3b8";
const GITTER = "#eef1f5";

type Modus = "monat" | "quartal" | "jahr" | "frei";

/** Gesamttonnage einer Anforderung aus ihren Materialpositionen. */
function anfTonnage(a: Anforderung): number {
  return a.materialien.reduce((s, m) => s + m.tonnage, 0);
}

/** Bezugsdatum: frühester Einbautag, sonst Wunschtermin. */
function bezugsDatum(a: Anforderung): string {
  const tage = a.materialien
    .map((m) => m.einbautag)
    .filter((d): d is string => Boolean(d))
    .sort();
  return tage[0] ?? a.wunschtermin;
}

/** Tonnage einer Anforderung, die an einem bestimmten Tag eingebaut wird. */
function tagTonnage(a: Anforderung, datum: string): number {
  const hatEinbautag = a.materialien.some((m) => m.einbautag);
  if (!hatEinbautag) return anfTonnage(a);
  return a.materialien
    .filter((m) => m.einbautag === datum)
    .reduce((s, m) => s + m.tonnage, 0);
}

function abschlussDatum(a: Anforderung): string | null {
  const eintrag = [...(a.statusverlauf ?? [])]
    .reverse()
    .find((e) => e.status === "abgeschlossen");
  return eintrag ? eintrag.am.slice(0, 10) : null;
}

interface TipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}

function Tip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="text-muted-foreground">
        {formatTonnage(Number(payload[0]?.value ?? 0))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            tone
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-tight">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function ChartCard({
  titel,
  beschreibung,
  children,
}: {
  titel: string;
  beschreibung?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titel}</CardTitle>
        {beschreibung && (
          <p className="text-xs text-muted-foreground">{beschreibung}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Horizontales Ranking-Balkendiagramm (lange Beschriftungen links). */
function RankingChart({
  data,
}: {
  data: { name: string; tonnage: number }[];
}) {
  if (data.length === 0) {
    return <LeerHinweis />;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} stroke={GITTER} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatZahl(Number(v))}
          stroke={ACHSE}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          stroke="#64748b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<Tip />} />
        <Bar
          dataKey="tonnage"
          fill={HEBEL_BLAU}
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertikales Balkendiagramm (Zeitverlauf, Status). */
function SaeulenChart({
  data,
}: {
  data: { name: string; tonnage: number }[];
}) {
  if (data.length === 0) {
    return <LeerHinweis />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={GITTER} />
        <XAxis
          dataKey="name"
          stroke={ACHSE}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => formatZahl(Number(v))}
          stroke={ACHSE}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<Tip />} />
        <Bar dataKey="tonnage" fill={HEBEL_BLAU} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LeerHinweis() {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      Keine Daten im gewählten Zeitraum.
    </div>
  );
}

export default function AuswertungenPage() {
  const { anforderungen, einsaetze, baustellen, materialarten, kolonnen, currentUser } =
    useStore();

  const darfSehen =
    currentUser.rolle === "disposition" || currentUser.rolle === "admin";

  const [modus, setModus] = useState<Modus>("monat");
  const [anker, setAnker] = useState(() => new Date());
  const [freiVon, setFreiVon] = useState(() =>
    isoDate(startDesMonats(new Date()))
  );
  const [freiBis, setFreiBis] = useState(() => isoDate(endeDesMonats(new Date())));

  const materialName = (id: string) => {
    const m = materialarten.find((x) => x.id === id);
    return m ? `${m.material_nr} | ${m.bezeichnung}` : "Material";
  };
  const baustelleName = (id: string) =>
    baustellen.find((b) => b.id === id)?.name ?? "Baustelle";

  // Zeitraum bestimmen
  const { von, bis, label } = useMemo(() => {
    if (modus === "frei") {
      const v = freiVon <= freiBis ? freiVon : freiBis;
      const b = freiVon <= freiBis ? freiBis : freiVon;
      return { von: v, bis: b, label: `${fmtDatum(v)} – ${fmtDatum(b)}` };
    }
    const y = anker.getFullYear();
    if (modus === "jahr") {
      return {
        von: isoDate(new Date(y, 0, 1)),
        bis: isoDate(new Date(y, 11, 31)),
        label: String(y),
      };
    }
    if (modus === "quartal") {
      const q = Math.floor(anker.getMonth() / 3);
      return {
        von: isoDate(new Date(y, q * 3, 1)),
        bis: isoDate(endeDesMonats(new Date(y, q * 3 + 2, 1))),
        label: `Q${q + 1} ${y}`,
      };
    }
    return {
      von: isoDate(startDesMonats(anker)),
      bis: isoDate(endeDesMonats(anker)),
      label: fmtMonatJahr(anker),
    };
  }, [modus, anker, freiVon, freiBis]);

  function springe(richtung: number) {
    if (modus === "jahr") {
      setAnker((d) => new Date(d.getFullYear() + richtung, d.getMonth(), 1));
    } else if (modus === "quartal") {
      setAnker((d) => addMonths(d, richtung * 3));
    } else {
      setAnker((d) => addMonths(d, richtung));
    }
  }

  // Gefilterte Daten
  const filterAnf = useMemo(
    () =>
      anforderungen.filter((a) => {
        const bd = bezugsDatum(a);
        return bd >= von && bd <= bis;
      }),
    [anforderungen, von, bis]
  );

  const filterEinsaetze = useMemo(
    () => einsaetze.filter((e) => e.datum >= von && e.datum <= bis),
    [einsaetze, von, bis]
  );

  // KPIs
  const gesamtTonnage = useMemo(
    () => filterAnf.reduce((s, a) => s + anfTonnage(a), 0),
    [filterAnf]
  );

  const termintreue = useMemo(() => {
    const fertige = filterAnf.filter((a) => a.status === "abgeschlossen");
    if (fertige.length === 0) return null;
    let puenktlich = 0;
    for (const a of fertige) {
      if (!a.wunschtermin) {
        puenktlich++;
        continue;
      }
      const ab = abschlussDatum(a) ?? bezugsDatum(a);
      if (ab <= a.wunschtermin) puenktlich++;
    }
    return Math.round((puenktlich / fertige.length) * 100);
  }, [filterAnf]);

  const oeJeEinsatz =
    filterEinsaetze.length > 0 ? gesamtTonnage / filterEinsaetze.length : 0;

  // 1. Tonnage je Mischgutsorte
  const sorten = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of filterAnf) {
      for (const m of a.materialien) {
        map.set(m.material_id, (map.get(m.material_id) ?? 0) + m.tonnage);
      }
    }
    return [...map.entries()]
      .map(([id, tonnage]) => ({ name: materialName(id), tonnage }))
      .sort((a, b) => b.tonnage - a.tonnage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAnf, materialarten]);

  // 2. Tonnage je Baustelle (Top 8)
  const baustellenRanking = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of filterAnf) {
      map.set(a.baustelle_id, (map.get(a.baustelle_id) ?? 0) + anfTonnage(a));
    }
    return [...map.entries()]
      .map(([id, tonnage]) => ({ name: baustelleName(id), tonnage }))
      .sort((a, b) => b.tonnage - a.tonnage)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAnf, baustellen]);

  // 3. Tonnage + Einsätze je Kolonne
  const kolonnenAuslastung = useMemo(() => {
    const map = new Map<string, { tonnage: number; einsaetze: number }>();
    for (const e of filterEinsaetze) {
      const a = anforderungen.find((x) => x.id === e.anforderung_id);
      const eintrag = map.get(e.kolonne_id) ?? { tonnage: 0, einsaetze: 0 };
      eintrag.einsaetze += 1;
      if (a) eintrag.tonnage += tagTonnage(a, e.datum);
      map.set(e.kolonne_id, eintrag);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        name: kolonnen.find((k) => k.id === id)?.name ?? "Kolonne",
        tonnage: v.tonnage,
        einsaetze: v.einsaetze,
      }))
      .sort((a, b) => b.tonnage - a.tonnage);
  }, [filterEinsaetze, anforderungen, kolonnen]);

  // 4. Tonnage-Verlauf über die Zeit
  const verlauf = useMemo(() => {
    const spanTage =
      Math.round(
        (parseIso(bis).getTime() - parseIso(von).getTime()) / 86400000
      ) + 1;
    const proWoche = spanTage <= 100;
    const buckets: { name: string; start: string; end: string }[] = [];
    const ende = parseIso(bis);
    if (proWoche) {
      let ws = startDerWoche(parseIso(von));
      while (ws <= ende) {
        const we = addDays(ws, 6);
        buckets.push({
          name: `KW ${kalenderWoche(ws)}`,
          start: isoDate(ws),
          end: isoDate(we),
        });
        ws = addDays(ws, 7);
      }
    } else {
      let ms = startDesMonats(parseIso(von));
      while (ms <= ende) {
        buckets.push({
          name: `${fmtMonatKurz(ms)} ${String(ms.getFullYear()).slice(2)}`,
          start: isoDate(ms),
          end: isoDate(endeDesMonats(ms)),
        });
        ms = addMonths(ms, 1);
      }
    }
    return buckets.map((b) => {
      const tonnage = filterAnf
        .filter((a) => {
          const bd = bezugsDatum(a);
          return bd >= b.start && bd <= b.end;
        })
        .reduce((s, a) => s + anfTonnage(a), 0);
      return { name: b.name, tonnage };
    });
  }, [filterAnf, von, bis]);

  // 5. Status-Verteilung
  const statusVerteilung = useMemo(() => {
    return STATUS_REIHENFOLGE.map((s) => ({
      status: s,
      name: STATUS_LABEL[s],
      anzahl: filterAnf.filter((a) => a.status === s).length,
    }));
  }, [filterAnf]);

  /* ----------------------------- Export ----------------------------- */

  function exportTabellen(): ExcelTabelle[] {
    return [
      {
        titel: "Kennzahlen",
        kopf: ["Kennzahl", "Wert"],
        zeilen: [
          ["Zeitraum", label],
          ["Gesamttonnage (t)", Math.round(gesamtTonnage)],
          ["Anforderungen", filterAnf.length],
          ["Einsätze", filterEinsaetze.length],
          ["Termintreue (%)", termintreue == null ? "–" : termintreue],
          ["Ø Tonnage je Einsatz (t)", Math.round(oeJeEinsatz)],
        ],
      },
      {
        titel: "Tonnage je Mischgutsorte",
        kopf: ["Mischgutsorte", "Tonnage (t)"],
        zeilen: sorten.map((s) => [s.name, Math.round(s.tonnage)]),
      },
      {
        titel: "Tonnage je Baustelle",
        kopf: ["Baustelle", "Tonnage (t)"],
        zeilen: baustellenRanking.map((s) => [s.name, Math.round(s.tonnage)]),
      },
      {
        titel: "Auslastung je Kolonne",
        kopf: ["Kolonne", "Einsätze", "Tonnage (t)"],
        zeilen: kolonnenAuslastung.map((s) => [
          s.name,
          s.einsaetze,
          Math.round(s.tonnage),
        ]),
      },
      {
        titel: "Tonnage-Verlauf",
        kopf: ["Zeitraum", "Tonnage (t)"],
        zeilen: verlauf.map((s) => [s.name, Math.round(s.tonnage)]),
      },
      {
        titel: "Status-Verteilung",
        kopf: ["Status", "Anzahl"],
        zeilen: statusVerteilung.map((s) => [s.name, s.anzahl]),
      },
    ];
  }

  function excelExport() {
    exportExcel(
      `Auswertung_${label.replace(/[^\w]+/g, "_")}`,
      `Auswertung – ${label}`,
      exportTabellen()
    );
  }

  function pdfExport() {
    const tab = (t: ExcelTabelle) => `
      <h2>${escHtml(t.titel)}</h2>
      <table>
        <thead><tr>${t.kopf
          .map((k, i) => `<th${i > 0 ? ' class="num"' : ""}>${escHtml(k)}</th>`)
          .join("")}</tr></thead>
        <tbody>${t.zeilen
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (z, i) =>
                    `<td${i > 0 ? ' class="num"' : ""}>${escHtml(
                      typeof z === "number" ? formatZahl(z) : z
                    )}</td>`
                )
                .join("")}</tr>`
          )
          .join("")}</tbody>
      </table>`;
    const tabellen = exportTabellen();
    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Gesamttonnage</div><div class="value">${formatTonnage(
          gesamtTonnage
        )}</div></div>
        <div class="kpi"><div class="label">Anforderungen</div><div class="value">${
          filterAnf.length
        }</div></div>
        <div class="kpi"><div class="label">Einsätze</div><div class="value">${
          filterEinsaetze.length
        }</div></div>
        <div class="kpi"><div class="label">Termintreue</div><div class="value">${
          termintreue == null ? "–" : termintreue + "%"
        }</div></div>
        <div class="kpi"><div class="label">Ø je Einsatz</div><div class="value">${formatTonnage(
          oeJeEinsatz
        )}</div></div>
      </div>
      ${tabellen.slice(1).map(tab).join("")}
      <div class="hinweis">Berechnungsgrundlage: Tonnagewerte aus den Materialpositionen der Anforderungen. Zuordnung über frühesten Einbautag, sonst Wunschtermin.</div>`;
    dokumentDrucken({
      titel: "Auswertung",
      untertitel: label,
      bodyHtml: body,
      logoUrl: window.location.origin + "/logo.png",
    });
  }

  if (!darfSehen) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Auswertungen"
          description="Auswertungen über die Mischgut-Anforderungen."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="size-6" />
            </div>
            <p className="text-sm font-medium">Kein Zugriff</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Die Auswertungen stehen nur den Rollen Disposition und
              Administration zur Verfügung.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const MODI: { id: Modus; label: string }[] = [
    { id: "monat", label: "Monat" },
    { id: "quartal", label: "Quartal" },
    { id: "jahr", label: "Jahr" },
    { id: "frei", label: "Frei" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Auswertungen"
        description="Kennzahlen und Diagramme über die Mischgut-Anforderungen."
        actions={
          <>
            <Button variant="outline" onClick={excelExport}>
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button variant="outline" onClick={pdfExport}>
              <Printer className="size-4" />
              PDF
            </Button>
          </>
        }
      />

      {/* Zeitraum-Auswahl */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          {MODI.map((m) => (
            <button
              key={m.id}
              onClick={() => setModus(m.id)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                modus === m.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {modus === "frei" ? (
          <div className="flex items-center gap-2">
            <DateField value={freiVon} onChange={(d) => d && setFreiVon(d)} className="w-40" />
            <span className="text-muted-foreground">–</span>
            <DateField value={freiBis} onChange={(d) => d && setFreiBis(d)} className="w-40" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => springe(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold">
              {label}
            </span>
            <Button variant="outline" size="icon" onClick={() => springe(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="Gesamttonnage"
          value={formatTonnage(gesamtTonnage)}
          icon={Layers}
          tone="bg-primary/10 text-primary"
        />
        <KpiCard
          label="Anforderungen"
          value={String(filterAnf.length)}
          icon={ClipboardList}
          tone="bg-sky-100 text-sky-700"
        />
        <KpiCard
          label="Einsätze"
          value={String(filterEinsaetze.length)}
          icon={Truck}
          tone="bg-indigo-100 text-indigo-700"
        />
        <KpiCard
          label="Termintreue"
          value={termintreue == null ? "–" : `${termintreue}%`}
          icon={Target}
          tone="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          label="Ø Tonnage / Einsatz"
          value={formatTonnage(oeJeEinsatz)}
          icon={BarChart3}
          tone="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Diagramme */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          titel="Tonnage je Mischgutsorte"
          beschreibung="Absteigend nach Tonnage."
        >
          <RankingChart data={sorten} />
          <MiniTabelle
            kopf={["Mischgutsorte", "Tonnage"]}
            zeilen={sorten.map((s) => [s.name, formatTonnage(s.tonnage)])}
          />
        </ChartCard>

        <ChartCard
          titel="Tonnage je Baustelle"
          beschreibung="Top-Baustellen im Zeitraum."
        >
          <RankingChart data={baustellenRanking} />
          <MiniTabelle
            kopf={["Baustelle", "Tonnage"]}
            zeilen={baustellenRanking.map((s) => [s.name, formatTonnage(s.tonnage)])}
          />
        </ChartCard>

        <ChartCard
          titel="Auslastung je Kolonne"
          beschreibung="Tonnage und Anzahl Einsätze."
        >
          <RankingChart data={kolonnenAuslastung} />
          <MiniTabelle
            kopf={["Kolonne", "Einsätze", "Tonnage"]}
            zeilen={kolonnenAuslastung.map((s) => [
              s.name,
              String(s.einsaetze),
              formatTonnage(s.tonnage),
            ])}
          />
        </ChartCard>

        <ChartCard
          titel="Tonnage-Verlauf"
          beschreibung="Produktionsmenge über die Zeit."
        >
          <SaeulenChart data={verlauf} />
          <MiniTabelle
            kopf={["Zeitraum", "Tonnage"]}
            zeilen={verlauf.map((s) => [s.name, formatTonnage(s.tonnage)])}
          />
        </ChartCard>

        <ChartCard
          titel="Status-Verteilung"
          beschreibung="Anforderungen je Status."
        >
          <SaeulenChart
            data={statusVerteilung.map((s) => ({
              name: s.name,
              tonnage: s.anzahl,
            }))}
          />
          <div className="mt-4 space-y-2">
            {statusVerteilung.map((s) => (
              <div
                key={s.status}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <StatusBadge status={s.status} />
                <span className="font-medium tabular-nums">{s.anzahl}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Berechnungsgrundlage: Tonnagewerte stammen aus den Materialpositionen der
        Anforderungen. Die Zuordnung zum Zeitraum erfolgt über den frühesten
        Einbautag, ersatzweise über den Wunschtermin. Kolonnen-Tonnage wird über
        die geplanten Einsätze ermittelt.
      </p>
    </div>
  );
}

function MiniTabelle({
  kopf,
  zeilen,
}: {
  kopf: string[];
  zeilen: string[][];
}) {
  if (zeilen.length === 0) return null;
  return (
    <div className="mt-4 -mb-1 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {kopf.map((k, i) => (
              <TableHead
                key={k}
                className={i > 0 ? "text-right" : undefined}
              >
                {k}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {zeilen.map((row, ri) => (
            <TableRow key={ri}>
              {row.map((z, ci) => (
                <TableCell
                  key={ci}
                  className={cn(
                    ci > 0 && "text-right tabular-nums",
                    ci === 0 && "font-medium"
                  )}
                >
                  {z}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
