"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { bestellscheinDrucken } from "@/lib/bestellschein";
import { useStore } from "@/lib/store";
import { formatDatum, formatTonnage } from "@/lib/calc";
import { fmtDatum, fmtZeit, tageBisHeute } from "@/lib/datum";
import {
  naechsterStatus,
  vorherigerStatus,
  STATUS_LABEL,
} from "@/lib/status";
import { PageHeader } from "@/components/page-header";
import { LogistikRechner } from "@/components/logistik-rechner";
import { WetterBadge } from "@/components/wetter-karte";
import { StatusBadge, PrioritaetBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    benutzer,
    kolonnen,
    einsaetze,
    currentUser,
    setAnforderungStatus,
    deleteAnforderung,
    addEinsatz,
    deleteEinsatz,
  } = useStore();

  const [loeschOffen, setLoeschOffen] = useState(false);
  const [planOffen, setPlanOffen] = useState(false);
  const [mehrfachOffen, setMehrfachOffen] = useState(false);
  const [planForm, setPlanForm] = useState({
    kolonne_id: "",
    datum: "",
    startzeit: "06:00",
    dauer_std: "10",
  });

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
  const erstesMaterial = materialarten.find(
    (m) => m.id === a.materialien[0]?.material_id
  );
  const next = naechsterStatus(a.status);
  const prev = vorherigerStatus(a.status);
  const darfStatusAendern =
    currentUser.rolle === "disposition" || currentUser.rolle === "admin";
  const darfBearbeiten =
    currentUser.rolle === "admin" ||
    (currentUser.id === a.erfasst_von && a.status === "neu_erfasst");
  const darfLoeschen = currentUser.rolle === "admin";

  const benutzerName = (uid: string) =>
    benutzer.find((u) => u.id === uid)?.name ?? "Unbekannt";

  // Eine Anforderung kann mehrere Einsätze an verschiedenen Tagen/Kolonnen
  // haben. Sortierung: anstehende Einsätze zuerst (nächster oben), vergangene
  // danach. Datum wird intern als ISO geführt, nur die Anzeige ist deutsch.
  const eigeneEinsaetze = einsaetze
    .filter((e) => e.anforderung_id === a.id)
    .sort((x, y) => {
      const xVergangen = tageBisHeute(x.datum) < 0;
      const yVergangen = tageBisHeute(y.datum) < 0;
      if (xVergangen !== yVergangen) return xVergangen ? 1 : -1;
      if (x.datum !== y.datum) {
        // anstehende aufsteigend (frühester zuerst), vergangene absteigend
        return xVergangen
          ? y.datum.localeCompare(x.datum)
          : x.datum.localeCompare(y.datum);
      }
      return x.startzeit.localeCompare(y.startzeit);
    });

  // Standort für die Wettervorhersage je Einsatz.
  const wetterLat = a.breitengrad ?? baustelle?.breitengrad;
  const wetterLng = a.laengengrad ?? baustelle?.laengengrad;

  // Zeitraum automatisch aus den eingeplanten Einsätzen (frühestes–spätestes
  // Datum). Aktualisiert sich automatisch, da aus dem Store abgeleitet.
  const einsatzDaten = eigeneEinsaetze.map((e) => e.datum).sort();
  const zeitraumText =
    einsatzDaten.length === 0
      ? "noch nicht eingeplant"
      : einsatzDaten[0] === einsatzDaten[einsatzDaten.length - 1]
      ? formatDatum(einsatzDaten[0])
      : `${formatDatum(einsatzDaten[0])} – ${formatDatum(
          einsatzDaten[einsatzDaten.length - 1]
        )}`;

  function statusWeiter() {
    if (!a || !next) return;
    setAnforderungStatus(a.id, next);
    toast.success(`Status: ${STATUS_LABEL[next]}`);
  }

  function statusZurueck() {
    if (!a || !prev) return;
    setAnforderungStatus(a.id, prev);
    toast.success(`Status zurückgesetzt: ${STATUS_LABEL[prev]}`);
  }

  function anforderungLoeschenBestaetigt() {
    if (!a) return;
    deleteAnforderung(a.id);
    toast.success("Anforderung gelöscht.");
    router.push("/anforderungen");
  }

  function einsatzEinplanen() {
    if (!a) return;
    if (!planForm.kolonne_id) {
      toast.error("Bitte eine Kolonne wählen.");
      return;
    }
    if (!planForm.datum) {
      toast.error("Bitte ein Datum wählen.");
      return;
    }
    // Schutz vor versehentlichem Mehrfach-Planen: ist bereits ein Einsatz
    // vorhanden, erst nach ausdrücklicher Bestätigung weiteren anlegen.
    if (eigeneEinsaetze.length > 0) {
      setMehrfachOffen(true);
      return;
    }
    einsatzAnlegen();
  }

  function einsatzAnlegen() {
    if (!a) return;
    addEinsatz({
      kolonne_id: planForm.kolonne_id,
      anforderung_id: a.id,
      datum: planForm.datum,
      startzeit: planForm.startzeit || "06:00",
      dauer_std: parseFloat(planForm.dauer_std) || 0,
      status: a.status,
    });
    toast.success("Einsatz eingeplant.");
    setMehrfachOffen(false);
    setPlanOffen(false);
    setPlanForm({
      kolonne_id: "",
      datum: "",
      startzeit: "06:00",
      dauer_std: "10",
    });
  }

  function pdfErzeugen() {
    if (!a) return;
    const ok = bestellscheinDrucken({
      anforderung: a,
      baustelle,
      materialName: (id) => {
        const m = materialarten.find((x) => x.id === id);
        return m ? `${m.material_nr} | ${m.bezeichnung}` : "Material";
      },
      erfasserName: benutzer.find((u) => u.id === a.erfasst_von)?.name,
      logoUrl: window.location.origin + "/logo.png",
    });
    if (!ok) {
      toast.error(
        "Pop-up wurde blockiert. Bitte Pop-ups für diese Seite erlauben."
      );
    }
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
            <Button variant="outline" onClick={pdfErzeugen}>
              <FileText className="size-4" />
              Bestellschein als PDF
            </Button>
            {darfStatusAendern && (
              <Button variant="outline" onClick={() => setPlanOffen(true)}>
                <CalendarPlus className="size-4" />
                Einsatz einplanen
              </Button>
            )}
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
            {darfLoeschen && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setLoeschOffen(true)}
              >
                <Trash2 className="size-4" />
                Löschen
              </Button>
            )}
            {darfStatusAendern && prev && (
              <Button variant="outline" onClick={statusZurueck}>
                <RotateCcw className="size-4" />
                Zurück
              </Button>
            )}
            {darfStatusAendern && next && (
              <Button onClick={statusWeiter}>
                {next === "abgeschlossen" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Weiter zu „{STATUS_LABEL[next]}“
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
                  label="Wunschtermin (Bauleiter)"
                  value={formatDatum(a.wunschtermin)}
                />
                <Info
                  label="Zeitraum (geplant)"
                  value={
                    einsatzDaten.length === 0 ? (
                      <span className="text-muted-foreground">
                        {zeitraumText}
                      </span>
                    ) : (
                      zeitraumText
                    )
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
              <CardTitle className="text-base">Eingeplante Einsätze</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {eigeneEinsaetze.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Einsätze eingeplant.
                </p>
              ) : (
                eigeneEinsaetze.map((e) => {
                  const k = kolonnen.find((x) => x.id === e.kolonne_id);
                  const vergangen = tageBisHeute(e.datum) < 0;
                  return (
                    <div
                      key={e.id}
                      className="rounded-lg border p-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ background: k?.farbe || "#64748b" }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{fmtDatum(e.datum)}</div>
                          <div className="text-xs text-muted-foreground">
                            {fmtZeit(e.startzeit)} Uhr · {e.dauer_std} Std. ·{" "}
                            {k?.name ?? "Kolonne"}
                          </div>
                        </div>
                        {darfStatusAendern && (
                          <button
                            onClick={() => {
                              deleteEinsatz(e.id);
                              toast.success("Einsatz entfernt.");
                            }}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                            aria-label="Einsatz entfernen"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 pl-5">
                        {vergangen ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            <Clock className="size-3.5" />
                            vergangen
                          </span>
                        ) : (
                          <WetterBadge
                            lat={wetterLat}
                            lng={wetterLng}
                            datum={e.datum}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status-Verlauf</CardTitle>
            </CardHeader>
            <CardContent>
              {a.statusverlauf && a.statusverlauf.length > 0 ? (
                <ol className="space-y-3">
                  {a.statusverlauf.map((eintrag, i) => {
                    const aktuell = i === a.statusverlauf!.length - 1;
                    return (
                      <li key={i} className="flex gap-3 text-sm">
                        <span
                          className={
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] " +
                            (aktuell
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {aktuell ? "✓" : i + 1}
                        </span>
                        <div>
                          <div
                            className={
                              aktuell ? "font-medium" : "text-foreground"
                            }
                          >
                            {STATUS_LABEL[eintrag.status]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {fmtDatum(eintrag.am)}, {fmtZeit(eintrag.am)} Uhr ·{" "}
                            {benutzerName(eintrag.von)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aktueller Status: {STATUS_LABEL[a.status]}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <LogistikRechner
          gesamtTonnage={gesamtTonnage}
          zielLat={a.breitengrad}
          zielLng={a.laengengrad}
          standardLadekapazitaet={erstesMaterial?.standard_lkw}
        />
      </div>

      {/* Einsatz einplanen */}
      <Dialog open={planOffen} onOpenChange={setPlanOffen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Einsatz einplanen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {eigeneEinsaetze.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <CalendarPlus className="mt-0.5 size-4 shrink-0" />
                <span>
                  Diese Anforderung ist bereits mit{" "}
                  {eigeneEinsaetze.length}{" "}
                  {eigeneEinsaetze.length === 1 ? "Einsatz" : "Einsätzen"}{" "}
                  eingeplant. Beim Speichern wird ein zusätzlicher Einsatz
                  angelegt.
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Kolonne *</Label>
              <Select
                value={planForm.kolonne_id}
                onValueChange={(v) =>
                  setPlanForm({ ...planForm, kolonne_id: v ?? "" })
                }
                items={Object.fromEntries(
                  kolonnen.filter((k) => k.aktiv).map((k) => [k.id, k.name])
                )}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kolonne wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {kolonnen
                    .filter((k) => k.aktiv)
                    .map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Datum *</Label>
                <DateField
                  value={planForm.datum}
                  onChange={(iso) => setPlanForm({ ...planForm, datum: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label>Startzeit</Label>
                <TimeField
                  value={planForm.startzeit}
                  onChange={(zeit) =>
                    setPlanForm({ ...planForm, startzeit: zeit })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dauer (Std.)</Label>
                <Input
                  type="number"
                  min={0}
                  value={planForm.dauer_std}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, dauer_std: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOffen(false)}>
              Abbrechen
            </Button>
            <Button onClick={einsatzEinplanen}>Einplanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mehrfach-Planung bestätigen */}
      <Dialog open={mehrfachOffen} onOpenChange={setMehrfachOffen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bereits eingeplant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Diese Anforderung ist bereits eingeplant – trotzdem einen weiteren
            Einsatz anlegen?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMehrfachOffen(false)}>
              Abbrechen
            </Button>
            <Button onClick={einsatzAnlegen}>
              <CalendarPlus className="size-4" />
              Weiteren Einsatz anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschen bestätigen */}
      <Dialog open={loeschOffen} onOpenChange={setLoeschOffen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anforderung löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Diese Anforderung wird dauerhaft entfernt
            {eigeneEinsaetze.length > 0
              ? ` – inklusive ${eigeneEinsaetze.length} eingeplanter Einsätze`
              : ""}
            . Das kann nicht rückgängig gemacht werden.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoeschOffen(false)}>
              Abbrechen
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={anforderungLoeschenBestaetigt}
            >
              <Trash2 className="size-4" />
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
