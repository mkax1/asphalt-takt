"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Search, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { berechneKgProM2, berechneTonnage, formatTonnage } from "@/lib/calc";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Anforderung, MaterialPosition, Prioritaet } from "@/lib/types";

const LocationMap = dynamic(() => import("@/components/location-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
      Karte wird geladen…
    </div>
  ),
});

interface PosForm {
  key: string;
  material_id: string;
  flaechen_bezeichnung: string;
  flaeche_m2: string;
  schichtdicke_cm: string;
  einbautag: string;
}

function leerePosition(): PosForm {
  return {
    key: Math.random().toString(36).slice(2),
    material_id: "",
    flaechen_bezeichnung: "",
    flaeche_m2: "",
    schichtdicke_cm: "",
    einbautag: "",
  };
}

function s(n?: number): string {
  return n === undefined || n === null ? "" : String(n);
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

/** Baut aus den Nominatim-Adressdetails eine kompakte, lesbare Adresse. */
function formatAdresse(
  addr: NominatimAddress | undefined,
  fallback: string
): string {
  if (!addr) return fallback;
  const ort = addr.city || addr.town || addr.village || addr.municipality || "";
  const strasse = [addr.road, addr.house_number].filter(Boolean).join(" ");
  const plzOrt = [addr.postcode, ort].filter(Boolean).join(" ");
  const teile = [strasse, plzOrt].filter(Boolean);
  return teile.length > 0 ? teile.join(", ") : fallback;
}

export function AnforderungForm({ initial }: { initial?: Anforderung }) {
  const router = useRouter();
  const {
    baustellen,
    materialarten,
    currentUser,
    addAnforderung,
    updateAnforderung,
  } = useStore();

  const istBearbeiten = Boolean(initial);

  const [baustelleId, setBaustelleId] = useState(initial?.baustelle_id ?? "");
  const [kostenstelle, setKostenstelle] = useState(initial?.kostenstelle ?? "");
  const [ansprechpartner, setAnsprechpartner] = useState(
    initial?.ansprechpartner ?? ""
  );
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [lat, setLat] = useState(initial?.breitengrad ?? 47.9889);
  const [lng, setLng] = useState(initial?.laengengrad ?? 10.1825);
  const [wunschtermin, setWunschtermin] = useState(initial?.wunschtermin ?? "");
  const [prioritaet, setPrioritaet] = useState<Prioritaet>(
    initial?.prioritaet ?? "mittel"
  );
  const [zeitraumVon, setZeitraumVon] = useState(initial?.zeitraum_von ?? "");
  const [zeitraumBis, setZeitraumBis] = useState(initial?.zeitraum_bis ?? "");
  const [dauer, setDauer] = useState(s(initial?.dauer_std));
  const [notiz, setNotiz] = useState(initial?.notiz ?? "");

  const [fbMin, setFbMin] = useState(s(initial?.fahrbahnbreite_min));
  const [fbMax, setFbMax] = useState(s(initial?.fahrbahnbreite_max));
  const [schieberAnzahl, setSchieberAnzahl] = useState(
    s(initial?.schieber_anzahl)
  );
  const [schieberTyp, setSchieberTyp] = useState(initial?.schieber_typ ?? "");
  const [schaechteAnzahl, setSchaechteAnzahl] = useState(
    s(initial?.schaechte_anzahl)
  );
  const [eingespannt, setEingespannt] = useState(initial?.eingespannt ?? false);
  const [schneidenVergiessen, setSchneidenVergiessen] = useState(
    initial?.schneiden_vergiessen ?? false
  );
  const [verkehr, setVerkehr] = useState(
    initial?.verkehrsbesonderheit ?? false
  );
  const [tokBand, setTokBand] = useState(initial?.tok_band ?? false);
  const [pdfName, setPdfName] = useState("");

  const [positionen, setPositionen] = useState<PosForm[]>(
    initial && initial.materialien.length > 0
      ? initial.materialien.map((m) => ({
          key: m.id,
          material_id: m.material_id,
          flaechen_bezeichnung: m.flaechen_bezeichnung ?? "",
          flaeche_m2: s(m.flaeche_m2),
          schichtdicke_cm: s(m.schichtdicke_cm),
          einbautag: m.einbautag ?? "",
        }))
      : [leerePosition()]
  );
  const [suchend, setSuchend] = useState(false);
  const [reverseLaeuft, setReverseLaeuft] = useState(false);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  async function reverseGeocode(la: number, ln: number) {
    setReverseLaeuft(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${la}&lon=${ln}`,
        { headers: { "Accept-Language": "de" } }
      );
      const data = await res.json();
      if (data && (data.address || data.display_name)) {
        setAdresse(formatAdresse(data.address, data.display_name ?? adresse));
      } else {
        toast.error("Keine Adresse zu diesem Punkt gefunden.");
      }
    } catch {
      toast.error("Adresse konnte nicht ermittelt werden.");
    } finally {
      setReverseLaeuft(false);
    }
  }

  /** Wird bei Klick auf die Karte oder Ziehen der Nadel aufgerufen. */
  function handlePick(la: number, ln: number) {
    setLat(la);
    setLng(ln);
    // Debounce: erst nach kurzer Ruhephase eine Nominatim-Anfrage senden.
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      reverseGeocode(la, ln);
    }, 700);
  }

  function handleBaustelle(id: string) {
    setBaustelleId(id);
    const b = baustellen.find((x) => x.id === id);
    if (b) {
      setAdresse(b.adresse);
      setKostenstelle(b.baustellennummer);
      if (b.ansprechpartner) setAnsprechpartner(b.ansprechpartner);
    }
  }

  function updatePos(key: string, patch: Partial<PosForm>) {
    setPositionen((ps) =>
      ps.map((p) => (p.key === key ? { ...p, ...patch } : p))
    );
  }

  function posTonnage(p: PosForm) {
    const flaeche = parseFloat(p.flaeche_m2) || 0;
    const dicke = parseFloat(p.schichtdicke_cm) || 0;
    const kg = berechneKgProM2(dicke);
    return { kg, tonnage: berechneTonnage(flaeche, kg) };
  }

  const gesamtTonnage = positionen.reduce(
    (sum, p) => sum + posTonnage(p).tonnage,
    0
  );

  async function adresseSuchen() {
    if (!adresse.trim()) {
      toast.error("Bitte zuerst eine Adresse eingeben.");
      return;
    }
    setSuchend(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
          adresse
        )}`,
        { headers: { "Accept-Language": "de" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
        if (data[0].address) {
          setAdresse(formatAdresse(data[0].address, adresse));
        }
        toast.success("Standort gefunden.");
      } else {
        toast.error("Keine Koordinaten gefunden.");
      }
    } catch {
      toast.error("Adresssuche fehlgeschlagen.");
    } finally {
      setSuchend(false);
    }
  }

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!baustelleId) return toast.error("Bitte eine Baustelle wählen.");
    if (!wunschtermin) return toast.error("Bitte einen Wunschtermin angeben.");

    const gueltigePos = positionen.filter(
      (p) => p.material_id && p.flaeche_m2 && p.schichtdicke_cm
    );
    if (gueltigePos.length === 0)
      return toast.error(
        "Bitte mindestens eine vollständige Material-Position angeben."
      );

    const materialien: MaterialPosition[] = gueltigePos.map((p) => {
      const { kg, tonnage } = posTonnage(p);
      return {
        id: p.key,
        material_id: p.material_id,
        flaechen_bezeichnung: p.flaechen_bezeichnung || undefined,
        flaeche_m2: parseFloat(p.flaeche_m2),
        schichtdicke_cm: parseFloat(p.schichtdicke_cm),
        kg_pro_m2: kg,
        tonnage,
        einbautag: p.einbautag || undefined,
      };
    });

    const datensatz = {
      baustelle_id: baustelleId,
      kostenstelle,
      ansprechpartner: ansprechpartner || undefined,
      adresse,
      breitengrad: lat,
      laengengrad: lng,
      wunschtermin,
      prioritaet,
      zeitraum_von: zeitraumVon || undefined,
      zeitraum_bis: zeitraumBis || undefined,
      dauer_std: dauer ? parseFloat(dauer) : undefined,
      notiz: notiz || undefined,
      fahrbahnbreite_min: fbMin ? parseFloat(fbMin) : undefined,
      fahrbahnbreite_max: fbMax ? parseFloat(fbMax) : undefined,
      schieber_anzahl: schieberAnzahl ? parseInt(schieberAnzahl) : undefined,
      schieber_typ: schieberTyp || undefined,
      schaechte_anzahl: schaechteAnzahl ? parseInt(schaechteAnzahl) : undefined,
      eingespannt,
      schneiden_vergiessen: schneidenVergiessen,
      verkehrsbesonderheit: verkehr,
      tok_band: tokBand,
      materialien,
    };

    if (initial) {
      updateAnforderung(initial.id, datensatz);
      toast.success("Anforderung aktualisiert.");
      router.push(`/anforderungen/${initial.id}`);
    } else {
      const neu = addAnforderung({
        ...datensatz,
        status: "neu_erfasst",
        erfasst_von: currentUser.id,
      });
      toast.success("Anforderung gespeichert.");
      router.push(`/anforderungen/${neu.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={istBearbeiten ? "Anforderung bearbeiten" : "Neue Anforderung"}
        description="Mischgut-Anforderung für eine Baustelle erfassen."
      />

      <form onSubmit={speichern} className="space-y-6">
        {/* 1. Baustelle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                1
              </span>
              Baustelle &amp; Standort
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Baustelle *</Label>
                <Select
                  value={baustelleId}
                  onValueChange={(v) => v && handleBaustelle(v)}
                  items={Object.fromEntries(
                    baustellen.map((b) => [b.id, b.name])
                  )}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Baustelle wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {baustellen
                      .filter((b) => b.status === "aktiv")
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kostenstelle</Label>
                <Input
                  value={kostenstelle}
                  onChange={(e) => setKostenstelle(e.target.value)}
                  placeholder="z. B. 97200350"
                />
              </div>
              <div className="space-y-2">
                <Label>Ansprechpartner</Label>
                <Input
                  value={ansprechpartner}
                  onChange={(e) => setAnsprechpartner(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Adresse / Standort *</Label>
                <div className="flex gap-2">
                  <Input
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    placeholder="Straße, PLZ Ort"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adresseSuchen();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={adresseSuchen}
                    disabled={suchend}
                  >
                    {suchend ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    Adresse suchen
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative">
              <LocationMap lat={lat} lng={lng} onPick={handlePick} />
              {reverseLaeuft && (
                <div className="absolute right-3 top-3 z-[1000] flex items-center gap-2 rounded-md bg-background/90 px-2.5 py-1.5 text-xs shadow-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  Adresse wird ermittelt…
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Pinnadel ziehen oder Karte anklicken setzt die Adresse
                automatisch.
              </p>
              <span className="shrink-0 tabular-nums">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Material */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                2
              </span>
              Material &amp; Mengen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {positionen.map((p, idx) => {
              const { kg, tonnage } = posTonnage(p);
              return (
                <div key={p.key} className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Position {idx + 1}
                    </span>
                    {positionen.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPositionen((ps) =>
                            ps.filter((x) => x.key !== p.key)
                          )
                        }
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Material *</Label>
                      <Select
                        value={p.material_id}
                        onValueChange={(v) =>
                          updatePos(p.key, { material_id: v ?? "" })
                        }
                        items={Object.fromEntries(
                          materialarten.map((m) => [
                            m.id,
                            `${m.material_nr} | ${m.bezeichnung}`,
                          ])
                        )}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Material wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialarten.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.material_nr} | {m.bezeichnung}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Flächen-Bezeichnung</Label>
                      <Input
                        value={p.flaechen_bezeichnung}
                        onChange={(e) =>
                          updatePos(p.key, {
                            flaechen_bezeichnung: e.target.value,
                          })
                        }
                        placeholder="z. B. Fahrbahn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Einbautag</Label>
                      <Input
                        type="date"
                        value={p.einbautag}
                        onChange={(e) =>
                          updatePos(p.key, { einbautag: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fläche (m²) *</Label>
                      <Input
                        type="number"
                        value={p.flaeche_m2}
                        onChange={(e) =>
                          updatePos(p.key, { flaeche_m2: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Schichtdicke (cm) *</Label>
                      <Input
                        type="number"
                        value={p.schichtdicke_cm}
                        onChange={(e) =>
                          updatePos(p.key, { schichtdicke_cm: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 rounded-md bg-background p-3 text-sm">
                    <span className="text-muted-foreground">
                      kg/m²:{" "}
                      <span className="font-medium text-foreground">{kg}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Tonnage:{" "}
                      <span className="font-semibold text-primary">
                        {formatTonnage(tonnage)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              onClick={() => setPositionen((ps) => [...ps, leerePosition()])}
            >
              <Plus className="size-4" />
              Material hinzufügen
            </Button>

            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Gesamt-Tonnage
              </span>
              <span className="text-lg font-semibold text-primary">
                {formatTonnage(gesamtTonnage)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Termin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                3
              </span>
              Termin &amp; Ausführung
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Wunschtermin *</Label>
              <Input
                type="date"
                value={wunschtermin}
                onChange={(e) => setWunschtermin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select
                value={prioritaet}
                onValueChange={(v) => setPrioritaet(v as Prioritaet)}
                items={{ niedrig: "Niedrig", mittel: "Mittel", hoch: "Hoch" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                  <SelectItem value="mittel">Mittel</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zeitraum von</Label>
              <Input
                type="date"
                value={zeitraumVon}
                onChange={(e) => setZeitraumVon(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Zeitraum bis</Label>
              <Input
                type="date"
                value={zeitraumBis}
                onChange={(e) => setZeitraumBis(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Geschätzte Dauer (Std.)</Label>
              <Input
                type="number"
                value={dauer}
                onChange={(e) => setDauer(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. Einbau & Hinweise */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                4
              </span>
              Einbau &amp; Hinweise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fahrbahnbreite min. (m)</Label>
                <Input
                  type="number"
                  value={fbMin}
                  onChange={(e) => setFbMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fahrbahnbreite max. (m)</Label>
                <Input
                  type="number"
                  value={fbMax}
                  onChange={(e) => setFbMax(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Schieber Anzahl</Label>
                <Input
                  type="number"
                  value={schieberAnzahl}
                  onChange={(e) => setSchieberAnzahl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Schieber Typ</Label>
                <Input
                  value={schieberTyp}
                  onChange={(e) => setSchieberTyp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Schächte Anzahl</Label>
                <Input
                  type="number"
                  value={schaechteAnzahl}
                  onChange={(e) => setSchaechteAnzahl(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Eingespannt", v: eingespannt, set: setEingespannt },
                {
                  label: "Schneiden und vergießen",
                  v: schneidenVergiessen,
                  set: setSchneidenVergiessen,
                },
                {
                  label: "Verkehrsbesonderheit",
                  v: verkehr,
                  set: setVerkehr,
                },
                { label: "TOK-Band", v: tokBand, set: setTokBand },
              ].map((c) => (
                <label
                  key={c.label}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <Checkbox
                    checked={c.v}
                    onCheckedChange={(val) => c.set(Boolean(val))}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Notiz / Hinweise</Label>
              <Textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={3}
                placeholder="Besonderheiten, Bezugsquelle des Mischguts, …"
              />
            </div>

            <div className="space-y-2">
              <Label>PDF-Unterlage (≤ 5 MB)</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="size-4" />
                {pdfName || "Datei auswählen…"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setPdfName(e.target.files?.[0]?.name ?? "")}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Abbrechen
          </Button>
          <Button type="submit">
            {istBearbeiten ? "Änderungen speichern" : "Anforderung bestätigen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
