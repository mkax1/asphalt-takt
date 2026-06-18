"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatDatum, formatTonnage } from "@/lib/calc";
import { naechsterStatus, STATUS_LABEL } from "@/lib/status";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, PrioritaetBadge } from "@/components/status-badge";
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

function JaNein({ v }: { v?: boolean }) {
  return <>{v ? "Ja" : "Nein"}</>;
}

export default function AnforderungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    anforderungen,
    baustellen,
    materialarten,
    currentUser,
    setAnforderungStatus,
  } = useStore();

  const a = anforderungen.find((x) => x.id === id);

  if (!a) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Anforderung nicht gefunden.{" "}
          <Link href="/anforderungen" className="text-primary underline">
            Zur Liste
          </Link>
        </p>
      </div>
    );
  }

  const baustelle = baustellen.find((b) => b.id === a.baustelle_id);
  const gesamtTonnage = a.materialien.reduce((s, m) => s + m.tonnage, 0);
  const next = naechsterStatus(a.status);
  const darfStatusAendern =
    currentUser.rolle === "disposition" || currentUser.rolle === "admin";
  const darfBearbeiten =
    currentUser.rolle === "admin" ||
    (currentUser.id === a.erfasst_von && a.status === "neu_erfasst");

  function statusWeiter() {
    if (!a || !next) return;
    setAnforderungStatus(a.id, next);
    toast.success(`Status: ${STATUS_LABEL[next]}`);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2"
        onClick={() => router.push("/anforderungen")}
      >
        <ArrowLeft className="size-4" />
        Zurück
      </Button>

      <PageHeader
        title={baustelle?.name ?? "Anforderung"}
        description={a.adresse}
        actions={
          <>
            {darfBearbeiten && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/anforderungen/${a.id}/bearbeiten`} />}
              >
                <Pencil className="size-4" />
                Bearbeiten
              </Button>
            )}
            {darfStatusAendern && next && (
              <Button onClick={statusWeiter}>
                {next === "abgeschlossen" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Weiter zu „{STATUS_LABEL[next]}"
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={a.status} />
        <PrioritaetBadge prioritaet={a.prioritaet} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eckdaten</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Info label="Kostenstelle" value={a.kostenstelle} />
                <Info label="Ansprechpartner" value={a.ansprechpartner} />
                <Info
                  label="Wunschtermin"
                  value={formatDatum(a.wunschtermin)}
                />
                <Info
                  label="Zeitraum"
                  value={
                    a.zeitraum_von
                      ? `${formatDatum(a.zeitraum_von)} – ${formatDatum(
                          a.zeitraum_bis
                        )}`
                      : "–"
                  }
                />
                <Info
                  label="Geschätzte Dauer"
                  value={a.dauer_std ? `${a.dauer_std} Std.` : "–"}
                />
                <Info label="Ordner-Nr." value={baustelle?.ordner_nr} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Material &amp; Mengen</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Fläche</TableHead>
                    <TableHead>Fläche m²</TableHead>
                    <TableHead>Dicke</TableHead>
                    <TableHead className="text-right">Tonnage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.materialien.map((m) => {
                    const mat = materialarten.find(
                      (x) => x.id === m.material_id
                    );
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {mat ? `${mat.material_nr} | ${mat.bezeichnung}` : "–"}
                        </TableCell>
                        <TableCell>{m.flaechen_bezeichnung || "–"}</TableCell>
                        <TableCell>{m.flaeche_m2} m²</TableCell>
                        <TableCell>{m.schichtdicke_cm} cm</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatTonnage(m.tonnage)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">
                      Gesamt
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatTonnage(gesamtTonnage)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Einbau &amp; Hinweise</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Info
                  label="Fahrbahnbreite"
                  value={
                    a.fahrbahnbreite_min || a.fahrbahnbreite_max
                      ? `${a.fahrbahnbreite_min ?? "?"} – ${
                          a.fahrbahnbreite_max ?? "?"
                        } m`
                      : "–"
                  }
                />
                <Info label="Schieber" value={a.schieber_anzahl ?? "–"} />
                <Info label="Schächte" value={a.schaechte_anzahl ?? "–"} />
                <Info label="Eingespannt" value={<JaNein v={a.eingespannt} />} />
                <Info
                  label="Schneiden/vergießen"
                  value={<JaNein v={a.schneiden_vergiessen} />}
                />
                <Info
                  label="Verkehrsbesonderheit"
                  value={<JaNein v={a.verkehrsbesonderheit} />}
                />
                <Info label="TOK-Band" value={<JaNein v={a.tok_band} />} />
              </dl>
              {a.notiz && (
                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
                  {a.notiz}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            {a.breitengrad && a.laengengrad ? (
              <LocationMap lat={a.breitengrad} lng={a.laengengrad} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Keine Koordinaten
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status-Verlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(
                  [
                    "neu_erfasst",
                    "in_pruefung",
                    "planung_vervollstaendigt",
                    "in_bearbeitung",
                    "abgeschlossen",
                  ] as const
                ).map((s) => {
                  const reached =
                    [
                      "neu_erfasst",
                      "in_pruefung",
                      "planung_vervollstaendigt",
                      "in_bearbeitung",
                      "abgeschlossen",
                    ].indexOf(a.status) >=
                    [
                      "neu_erfasst",
                      "in_pruefung",
                      "planung_vervollstaendigt",
                      "in_bearbeitung",
                      "abgeschlossen",
                    ].indexOf(s);
                  return (
                    <li key={s} className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          "flex size-5 items-center justify-center rounded-full text-[10px] " +
                          (reached
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {reached ? "✓" : ""}
                      </span>
                      <span className={reached ? "font-medium" : "text-muted-foreground"}>
                        {STATUS_LABEL[s]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
