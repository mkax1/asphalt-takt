"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Info as InfoIcon,
  MapPin,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatTonnage, formatDatum } from "@/lib/calc";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { WunschterminText } from "@/components/wunschtermin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LocationMap = dynamic(() => import("@/components/location-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
      Karte wird geladen…
    </div>
  ),
});

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "–"}</dd>
    </div>
  );
}

export default function BaustelleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { baustellen, anforderungen, materialarten, einsaetze } = useStore();

  // Geplanter Einbau-Tag (frühestes–spätestes Einsatz-Datum) je Anforderung.
  const einbauText = (anforderungId: string) => {
    const daten = einsaetze
      .filter((e) => e.anforderung_id === anforderungId)
      .map((e) => e.datum)
      .sort();
    if (daten.length === 0) return null;
    return daten[0] === daten[daten.length - 1]
      ? formatDatum(daten[0])
      : `${formatDatum(daten[0])} – ${formatDatum(daten[daten.length - 1])}`;
  };

  const b = baustellen.find((x) => x.id === id);

  if (!b) {
    return (
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" onClick={() => router.push("/baustellen")}>
          <ArrowLeft className="size-4" />
          Zurück
        </Button>
        <Card className="mt-4">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Baustelle nicht gefunden.
          </CardContent>
        </Card>
      </div>
    );
  }

  const eigeneAnforderungen = anforderungen
    .filter((a) => a.baustelle_id === b.id)
    .sort((x, y) => (x.wunschtermin < y.wunschtermin ? -1 : 1));

  const materialName = (mid: string) =>
    materialarten.find((m) => m.id === mid)?.bezeichnung ?? "—";

  function materialListe(materialIds: string[]): string {
    const namen = [...new Set(materialIds)].map(materialName);
    return namen.join(", ");
  }

  const hatKoordinaten = b.breitengrad != null && b.laengengrad != null;

  return (
    <div className="mx-auto max-w-5xl">
      <Button
        variant="ghost"
        className="mb-2"
        onClick={() => router.push("/baustellen")}
      >
        <ArrowLeft className="size-4" />
        Alle Baustellen
      </Button>

      <PageHeader
        title={b.name}
        description={`Baustellennummer ${b.baustellennummer}`}
        actions={
          <Badge
            variant="outline"
            className={
              b.status === "aktiv"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-500"
            }
          >
            {b.status === "aktiv" ? "Aktiv" : "Inaktiv"}
          </Badge>
        }
      />

      {/* Kennzahl */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="h-1.5 w-full bg-hebel-gelb" />
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <div className="text-3xl font-semibold leading-none text-primary">
              {eigeneAnforderungen.length}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {eigeneAnforderungen.length === 1
                ? "Anforderung für diese Baustelle"
                : "Anforderungen für diese Baustelle"}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stammdaten */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <InfoIcon className="size-4 text-primary" />
              Stammdaten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Info label="Ordner-Nr." value={b.ordner_nr} />
              <Info label="Baustellennummer" value={b.baustellennummer} />
              <Info label="Name" value={b.name} />
              <Info label="Ansprechpartner" value={b.ansprechpartner} />
              <div className="col-span-2">
                <Info
                  label="Adresse"
                  value={
                    <span className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      {b.adresse}
                    </span>
                  }
                />
              </div>
              {hatKoordinaten && (
                <div className="col-span-2">
                  <Info
                    label="Koordinaten"
                    value={
                      <span className="tabular-nums">
                        {b.breitengrad!.toFixed(5)},{" "}
                        {b.laengengrad!.toFixed(5)}
                      </span>
                    }
                  />
                </div>
              )}
              {b.hinweis && (
                <div className="col-span-2">
                  <Info label="Baustellenhinweis" value={b.hinweis} />
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Karte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" />
              Standort
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hatKoordinaten ? (
              <LocationMap lat={b.breitengrad!} lng={b.laengengrad!} />
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <MapPin className="size-6 text-muted-foreground/50" />
                Für diese Baustelle sind keine Koordinaten hinterlegt.
                <span className="text-xs">
                  In den Stammdaten über „Bearbeiten“ einen Standort setzen.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Anforderungen */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" />
            Anforderungen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {eigeneAnforderungen.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Für diese Baustelle wurden noch keine Anforderungen erfasst.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Wunschtermin</TableHead>
                  <TableHead>Einbau (geplant)</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Tonnage</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {eigeneAnforderungen.map((a) => {
                  const tonnage = a.materialien.reduce(
                    (s, m) => s + m.tonnage,
                    0
                  );
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/anforderungen/${a.id}`)}
                    >
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>
                        <WunschterminText
                          iso={a.wunschtermin}
                          abgeschlossen={a.status === "abgeschlossen"}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {einbauText(a.id) ?? (
                          <span className="text-muted-foreground">
                            noch nicht eingeplant
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {materialListe(
                          a.materialien.map((m) => m.material_id)
                        ) || "–"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary tabular-nums">
                        {formatTonnage(tonnage)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/anforderungen/${a.id}`}
                          className="inline-flex items-center text-muted-foreground hover:text-primary"
                          aria-label="Anforderung öffnen"
                        >
                          <ArrowRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
