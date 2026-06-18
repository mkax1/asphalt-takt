"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  Hourglass,
  Layers,
  Loader2,
  MapPin,
  Route,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatTonnage } from "@/lib/calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function formatNum(n: number, nachkomma = 0): string {
  if (!isFinite(n)) return "–";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: nachkomma,
    minimumFractionDigits: 0,
  }).format(n);
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minToTime(min: number): string {
  const m = (((Math.round(min) % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

type RouteStatus =
  | { status: "idle" }
  | { status: "laden" }
  | { status: "ok"; distanzKm: number; fahrzeitMin: number }
  | { status: "fehler"; fehler: string };

export function LogistikRechner({
  gesamtTonnage,
  zielLat,
  zielLng,
  standardLadekapazitaet,
}: {
  gesamtTonnage: number;
  zielLat?: number;
  zielLng?: number;
  standardLadekapazitaet?: number;
}) {
  const { mischanlage } = useStore();
  const anlageLat = mischanlage.breitengrad;
  const anlageLng = mischanlage.laengengrad;
  const produktionsleistung = mischanlage.produktionsleistung || 160;

  const [einbauleistung, setEinbauleistung] = useState("100");
  const [ladekapazitaet, setLadekapazitaet] = useState(
    standardLadekapazitaet && standardLadekapazitaet > 0
      ? String(standardLadekapazitaet)
      : "25"
  );
  const [anzahlLkw, setAnzahlLkw] = useState("5");
  const [ladezeit, setLadezeit] = useState("5");
  const [entladezeit, setEntladezeit] = useState("10");
  const [einbaustart, setEinbaustart] = useState("07:00");
  const [fahrzeitOverride, setFahrzeitOverride] = useState("");

  const [route, setRoute] = useState<RouteStatus>({ status: "idle" });

  /* eslint-disable react-hooks/set-state-in-effect -- Routenstatus muss vor/nach dem Abruf gesetzt werden */
  useEffect(() => {
    if (zielLat == null || zielLng == null) {
      setRoute({ status: "idle" });
      return;
    }
    let abbruch = false;
    setRoute({ status: "laden" });
    fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { lat: anlageLat, lng: anlageLng },
        to: { lat: zielLat, lng: zielLng },
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Route konnte nicht berechnet werden.");
        }
        return r.json();
      })
      .then((d) => {
        if (!abbruch)
          setRoute({
            status: "ok",
            distanzKm: d.distanzKm,
            fahrzeitMin: d.fahrzeitMin,
          });
      })
      .catch((e) => {
        if (!abbruch)
          setRoute({ status: "fehler", fehler: String(e.message || e) });
      });
    return () => {
      abbruch = true;
    };
  }, [zielLat, zielLng, anlageLat, anlageLng]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const routeFahrzeit =
    route.status === "ok" ? Math.round(route.fahrzeitMin) : null;
  const fahrzeitAuto = fahrzeitOverride === "" && routeFahrzeit != null;
  const fahrzeitAnzeige =
    fahrzeitOverride !== ""
      ? fahrzeitOverride
      : routeFahrzeit != null
        ? String(routeFahrzeit)
        : "";

  const berechnung = useMemo(() => {
    const einbau = parseFloat(einbauleistung) || 0;
    const kap = parseFloat(ladekapazitaet) || 0;
    const lkwVerfuegbar = parseFloat(anzahlLkw) || 0;
    const lz = parseFloat(ladezeit) || 0;
    const ez = parseFloat(entladezeit) || 0;
    const fahrzeit = parseFloat(fahrzeitAnzeige) || 0;

    const effLeistung =
      einbau > 0 && produktionsleistung > 0
        ? Math.min(einbau, produktionsleistung)
        : einbau || produktionsleistung;

    const taktzeit = effLeistung > 0 && kap > 0 ? (kap / effLeistung) * 60 : 0;
    const umlaufzeit = 2 * fahrzeit + lz + ez;
    const benoetigteLkw = taktzeit > 0 ? Math.ceil(umlaufzeit / taktzeit) : 0;
    const anzahlLadungen = kap > 0 ? Math.ceil(gesamtTonnage / kap) : 0;
    const einbaudauer = effLeistung > 0 ? gesamtTonnage / effLeistung : 0;

    const startMin = timeToMin(einbaustart);
    const endeMin = startMin + einbaudauer * 60;

    const lkwRotation = Math.max(1, Math.round(lkwVerfuegbar));
    const ladungen = Array.from({ length: anzahlLadungen }, (_, i) => {
      const n = i + 1;
      const ankunft = startMin + i * taktzeit;
      const abfahrt = ankunft - fahrzeit;
      const beladung = abfahrt - lz;
      const entladungFertig = ankunft + ez;
      const tonnage =
        n === anzahlLadungen
          ? gesamtTonnage - (anzahlLadungen - 1) * kap
          : kap;
      return {
        n,
        lkw: ((n - 1) % lkwRotation) + 1,
        beladung,
        abfahrt,
        ankunft,
        entladungFertig,
        tonnage: Math.max(0, tonnage),
      };
    });

    return {
      einbau,
      effLeistung,
      taktzeit,
      umlaufzeit,
      benoetigteLkw,
      anzahlLadungen,
      einbaudauer,
      endeMin,
      lkwVerfuegbar: Math.round(lkwVerfuegbar),
      ladungen,
    };
  }, [
    einbauleistung,
    ladekapazitaet,
    anzahlLkw,
    ladezeit,
    entladezeit,
    fahrzeitAnzeige,
    einbaustart,
    produktionsleistung,
    gesamtTonnage,
  ]);

  // Ampel-Warnung
  const warnung: { ton: "rot" | "orange" | "gruen"; text: string } =
    berechnung.lkwVerfuegbar < berechnung.benoetigteLkw
      ? {
          ton: "rot",
          text: `Zu wenige LKW – der Fertiger läuft leer. Benötigt: ${berechnung.benoetigteLkw} LKW.`,
        }
      : produktionsleistung < berechnung.einbau
        ? {
            ton: "orange",
            text: `Anlage ist der Engpass – Einbau real auf ${formatNum(
              produktionsleistung
            )} t/h begrenzt.`,
          }
        : {
            ton: "gruen",
            text: "Takt passt – durchgehender Einbau möglich.",
          };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4 text-primary" />
          Logistik &amp; Taktplanung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Strecke ab Mischanlage */}
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Route className="size-3.5 text-primary" />
            Strecke ab Mischanlage
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{mischanlage.adresse}</span>
          </div>

          {route.status === "laden" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Route wird berechnet…
            </div>
          )}
          {route.status === "ok" && (
            <div className="mt-3 flex flex-wrap gap-6">
              <div>
                <div className="text-xl font-semibold text-primary">
                  {formatNum(route.distanzKm, 1)} km
                </div>
                <div className="text-xs text-muted-foreground">Entfernung</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-primary">
                  {formatNum(route.fahrzeitMin, 0)} Min.
                </div>
                <div className="text-xs text-muted-foreground">
                  Fahrzeit (einfach)
                </div>
              </div>
            </div>
          )}
          {(route.status === "idle" || route.status === "fehler") && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {route.status === "idle"
                ? "Für diese Baustelle sind keine Koordinaten hinterlegt. "
                : `Route konnte nicht berechnet werden (${route.fehler}). `}
              Bitte Fahrzeit unten manuell eingeben.
            </div>
          )}
        </div>

        {/* Eingabefelder */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feld
            id="einbau"
            label="Einbauleistung (t/Std.)"
            value={einbauleistung}
            onChange={setEinbauleistung}
          />
          <Feld
            id="kap"
            label="LKW-Ladekapazität (t)"
            value={ladekapazitaet}
            onChange={setLadekapazitaet}
          />
          <Feld
            id="lkw"
            label="Verfügbare LKW"
            value={anzahlLkw}
            onChange={setAnzahlLkw}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fahrzeit">Fahrzeit einfach (Min.)</Label>
              {fahrzeitAuto && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  aus Route
                </span>
              )}
            </div>
            <Input
              id="fahrzeit"
              type="number"
              min={0}
              value={fahrzeitAnzeige}
              placeholder="z. B. 30"
              onChange={(e) => setFahrzeitOverride(e.target.value)}
            />
          </div>
          <Feld
            id="ladezeit"
            label="Ladezeit Anlage (Min.)"
            value={ladezeit}
            onChange={setLadezeit}
          />
          <Feld
            id="entladezeit"
            label="Entladezeit Fertiger (Min.)"
            value={entladezeit}
            onChange={setEntladezeit}
          />
          <div className="space-y-2">
            <Label htmlFor="start">Einbaustart</Label>
            <Input
              id="start"
              type="time"
              value={einbaustart}
              onChange={(e) => setEinbaustart(e.target.value)}
            />
          </div>
        </div>

        {/* Ampel-Warnung */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
            warnung.ton === "rot" &&
              "border-red-300 bg-red-50 text-red-700",
            warnung.ton === "orange" &&
              "border-orange-300 bg-orange-50 text-orange-800",
            warnung.ton === "gruen" &&
              "border-emerald-300 bg-emerald-50 text-emerald-700"
          )}
        >
          {warnung.ton === "gruen" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 shrink-0" />
          )}
          {warnung.text}
        </div>

        {/* Kennzahlen */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kennzahl
            icon={Clock}
            wert={formatNum(berechnung.taktzeit, 1)}
            einheit="Min."
            label="Taktzeit"
          />
          <Kennzahl
            icon={Truck}
            wert={formatNum(berechnung.benoetigteLkw)}
            einheit="LKW"
            label="Benötigte LKW"
          />
          <Kennzahl
            icon={Layers}
            wert={formatNum(berechnung.anzahlLadungen)}
            einheit="Fahrten"
            label="Ladungen"
          />
          <Kennzahl
            icon={Hourglass}
            wert={formatNum(berechnung.einbaudauer, 1)}
            einheit="Std."
            label="Einbaudauer"
          />
          <Kennzahl
            icon={Flag}
            wert={minToTime(berechnung.endeMin)}
            einheit="Uhr"
            label="Einbau-Ende"
          />
        </div>

        {/* Takttabelle */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Zeitplan der Ladungen</h3>
          {berechnung.ladungen.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Keine Ladungen – bitte Tonnage und Ladekapazität prüfen.
            </p>
          ) : (
            <div className="max-h-[480px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Nr.</TableHead>
                    <TableHead className="w-16">LKW</TableHead>
                    <TableHead className="text-right">Beladung Anlage</TableHead>
                    <TableHead className="text-right">Abfahrt</TableHead>
                    <TableHead className="text-right">Ankunft Baustelle</TableHead>
                    <TableHead className="text-right">Entladung fertig</TableHead>
                    <TableHead className="text-right">Tonnage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {berechnung.ladungen.map((l) => (
                    <TableRow key={l.n}>
                      <TableCell className="font-medium">{l.n}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <Truck className="size-3.5 text-primary" />
                          {l.lkw}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {minToTime(l.beladung)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {minToTime(l.abfahrt)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {minToTime(l.ankunft)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {minToTime(l.entladungFertig)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTonnage(l.tonnage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Richtwerte – Leistungen, Lade- und Entladezeiten bitte mit Anlage und
          Kolonne abstimmen.
        </p>
      </CardContent>
    </Card>
  );
}

function Feld({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Kennzahl({
  icon: Icon,
  wert,
  einheit,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  wert: string;
  einheit: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold leading-none text-primary">
          {wert}
        </span>
        <span className="text-sm text-muted-foreground">{einheit}</span>
      </div>
    </div>
  );
}
