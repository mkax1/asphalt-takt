"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  LocateFixed,
  Map,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Search,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { geocodeAdresse, warte } from "@/lib/geocode";
import { PageHeader } from "@/components/page-header";
import { StandortAuswahl } from "@/components/standort-auswahl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import type { Baustelle } from "@/lib/types";

/** Standard-Kartenmittelpunkt (Allgäu/Memmingen), bis Koordinaten gesetzt sind. */
const DEFAULT_LAT = 47.9889;
const DEFAULT_LNG = 10.1825;

const leer: Omit<Baustelle, "id"> = {
  ordner_nr: "",
  baustellennummer: "",
  name: "",
  adresse: "",
  breitengrad: undefined,
  laengengrad: undefined,
  ansprechpartner: "",
  hinweis: "",
  status: "aktiv",
};

type SortFeld = "baustellennummer" | "name" | "adresse" | "status";
type StatusFilter = "alle" | "aktiv" | "inaktiv";

function SortKopf({
  feld,
  label,
  className,
  aktuellesFeld,
  richtung,
  onSort,
}: {
  feld: SortFeld;
  label: string;
  className?: string;
  aktuellesFeld: SortFeld;
  richtung: "asc" | "desc";
  onSort: (feld: SortFeld) => void;
}) {
  const aktiv = aktuellesFeld === feld;
  const Icon = !aktiv ? ChevronsUpDown : richtung === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(feld)}
        className={cn(
          "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
          aktiv ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5",
            aktiv ? "text-primary" : "text-muted-foreground/60"
          )}
        />
      </button>
    </TableHead>
  );
}

export default function BaustellenPage() {
  const router = useRouter();
  const { baustellen, currentUser, addBaustelle, updateBaustelle } = useStore();
  const darfBearbeiten = currentUser.rolle === "admin";

  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [sortFeld, setSortFeld] = useState<SortFeld>("name");
  const [sortRichtung, setSortRichtung] = useState<"asc" | "desc">("asc");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Baustelle, "id">>(leer);
  const [geocodeLaeuft, setGeocodeLaeuft] = useState(false);

  // Baustellen ohne Koordinaten, aber mit Adresse (Kandidaten fürs Geocoding).
  const ohneKoordinaten = useMemo(
    () =>
      baustellen.filter(
        (b) =>
          (b.breitengrad == null || b.laengengrad == null) && b.adresse?.trim()
      ),
    [baustellen]
  );

  function sortieren(feld: SortFeld) {
    if (sortFeld === feld) {
      setSortRichtung((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSortFeld(feld);
      setSortRichtung("asc");
    }
  }

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let liste = baustellen.filter((b) =>
      statusFilter === "alle" ? true : b.status === statusFilter
    );
    if (q) {
      liste = liste.filter((b) =>
        [b.name, b.baustellennummer, b.adresse, b.ansprechpartner, b.ordner_nr]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q))
      );
    }
    const faktor = sortRichtung === "asc" ? 1 : -1;
    return [...liste].sort((a, b) => {
      const av = (a[sortFeld] ?? "").toString().toLowerCase();
      const bv = (b[sortFeld] ?? "").toString().toLowerCase();
      return av.localeCompare(bv, "de", { numeric: true }) * faktor;
    });
  }, [baustellen, suche, statusFilter, sortFeld, sortRichtung]);

  function neu() {
    setEditId(null);
    setForm(leer);
    setOpen(true);
  }

  function bearbeiten(b: Baustelle) {
    setEditId(b.id);
    const { id: _id, ...rest } = b;
    void _id;
    setForm(rest);
    setOpen(true);
  }

  function statusUmschalten(b: Baustelle) {
    const neuerStatus = b.status === "aktiv" ? "inaktiv" : "aktiv";
    updateBaustelle(b.id, { status: neuerStatus });
    toast.success(
      neuerStatus === "aktiv" ? "Baustelle aktiviert." : "Baustelle deaktiviert."
    );
  }

  /** Ermittelt Koordinaten zu einer Adresse und speichert sie. */
  async function autoGeocode(id: string, adresse: string) {
    const res = await geocodeAdresse(adresse);
    if (res) {
      updateBaustelle(id, {
        breitengrad: res.breitengrad,
        laengengrad: res.laengengrad,
      });
      toast.success("Koordinaten automatisch aus der Adresse ermittelt.");
    }
  }

  function speichern() {
    if (!form.name || !form.baustellennummer || !form.adresse) {
      toast.error("Name, Nummer und Adresse sind Pflicht.");
      return;
    }
    if (editId) {
      const original = baustellen.find((b) => b.id === editId);
      updateBaustelle(editId, form);
      toast.success("Baustelle aktualisiert.");
      // Auto-Geocoding nur, wenn keine Koordinaten gesetzt sind ODER die Adresse
      // geändert wurde, ohne den Pin/die Koordinaten anzupassen.
      const adresseGeaendert = original?.adresse !== form.adresse;
      const koordUnveraendert =
        original?.breitengrad === form.breitengrad &&
        original?.laengengrad === form.laengengrad;
      const brauchtKoordinaten =
        form.breitengrad == null ||
        form.laengengrad == null ||
        (adresseGeaendert && koordUnveraendert);
      setOpen(false);
      if (brauchtKoordinaten) void autoGeocode(editId, form.adresse);
    } else {
      const neu = addBaustelle(form);
      toast.success("Baustelle angelegt.");
      setOpen(false);
      // Kein manueller Pin gesetzt -> Koordinaten aus Adresse holen.
      if (form.breitengrad == null || form.laengengrad == null) {
        void autoGeocode(neu.id, form.adresse);
      }
    }
  }

  /** Sammel-Lauf: alle Baustellen ohne Koordinaten nacheinander geocodieren. */
  async function koordinatenErmitteln() {
    const ziel = ohneKoordinaten;
    if (ziel.length === 0) {
      toast.info("Alle Baustellen mit Adresse haben bereits Koordinaten.");
      return;
    }
    setGeocodeLaeuft(true);
    const tId = toast.loading(`Koordinaten werden ermittelt… (0/${ziel.length})`);
    let erfolg = 0;
    for (let i = 0; i < ziel.length; i++) {
      toast.loading(
        `Koordinaten werden ermittelt… (${i + 1}/${ziel.length})`,
        { id: tId }
      );
      const res = await geocodeAdresse(ziel[i].adresse);
      if (res) {
        updateBaustelle(ziel[i].id, {
          breitengrad: res.breitengrad,
          laengengrad: res.laengengrad,
        });
        erfolg++;
      }
      // Nominatim-Limit einhalten: ~1 Anfrage pro Sekunde.
      if (i < ziel.length - 1) await warte(1100);
    }
    setGeocodeLaeuft(false);
    const fehlend = ziel.length - erfolg;
    toast.success(`${erfolg} von ${ziel.length} Baustellen verortet.`, {
      id: tId,
      description:
        fehlend > 0
          ? `${fehlend} ohne Treffer – bitte Pin manuell setzen.`
          : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Baustellen"
        description="Stammdaten der Baustellen."
        actions={
          <>
            {darfBearbeiten && ohneKoordinaten.length > 0 && (
              <Button
                variant="outline"
                onClick={koordinatenErmitteln}
                disabled={geocodeLaeuft}
                title="Fehlende Koordinaten per Adresse (Nominatim) ermitteln"
              >
                {geocodeLaeuft ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
                Koordinaten ermitteln ({ohneKoordinaten.length})
              </Button>
            )}
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/baustellen/karte" />}
            >
              <Map className="size-4" />
              Auf Karte anzeigen
            </Button>
            {darfBearbeiten && (
              <Button onClick={neu}>
                <Plus className="size-4" />
                Neue Baustelle
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name, Nummer, Ort oder Ansprechpartner suchen…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
          items={{ alle: "Alle Status", aktiv: "Nur aktiv", inaktiv: "Nur inaktiv" }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="aktiv">Nur aktiv</SelectItem>
            <SelectItem value="inaktiv">Nur inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8%]">Ordner</TableHead>
                <SortKopf
                  feld="baustellennummer"
                  label="Nummer"
                  className="w-[13%]"
                  aktuellesFeld={sortFeld}
                  richtung={sortRichtung}
                  onSort={sortieren}
                />
                <SortKopf
                  feld="name"
                  label="Name"
                  className="w-[22%]"
                  aktuellesFeld={sortFeld}
                  richtung={sortRichtung}
                  onSort={sortieren}
                />
                <SortKopf
                  feld="adresse"
                  label="Ort / Adresse"
                  className="w-[24%]"
                  aktuellesFeld={sortFeld}
                  richtung={sortRichtung}
                  onSort={sortieren}
                />
                <TableHead className="w-[13%]">Ansprechpartner</TableHead>
                <SortKopf
                  feld="status"
                  label="Status"
                  className="w-[10%]"
                  aktuellesFeld={sortFeld}
                  richtung={sortRichtung}
                  onSort={sortieren}
                />
                <TableHead className="w-[8%] text-right">
                  {darfBearbeiten ? "Aktion" : ""}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gefiltert.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Keine Baustellen gefunden.
                  </TableCell>
                </TableRow>
              )}
              {gefiltert.map((b) => (
                <TableRow
                  key={b.id}
                  onClick={() => router.push(`/baustellen/${b.id}`)}
                  className={cn(
                    "cursor-pointer",
                    b.status === "inaktiv" && "opacity-55"
                  )}
                >
                  <TableCell
                    className="truncate text-muted-foreground"
                    title={b.ordner_nr}
                  >
                    {b.ordner_nr || "–"}
                  </TableCell>
                  <TableCell className="truncate" title={b.baustellennummer}>
                    {b.baustellennummer}
                  </TableCell>
                  <TableCell className="truncate font-medium" title={b.name}>
                    {b.name}
                  </TableCell>
                  <TableCell className="align-top" title={b.adresse}>
                    <span className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="whitespace-normal break-words">
                        {b.adresse}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell
                    className="truncate"
                    title={b.ansprechpartner}
                  >
                    {b.ansprechpartner || "–"}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {darfBearbeiten ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/baustellen/${b.id}`)}
                          >
                            <ChevronRight className="size-4" />
                            Details öffnen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => bearbeiten(b)}>
                            <Pencil className="size-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => statusUmschalten(b)}>
                            <Power className="size-4" />
                            {b.status === "aktiv"
                              ? "Deaktivieren"
                              : "Aktivieren"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Baustelle bearbeiten" : "Neue Baustelle"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ordner-Nr.</Label>
              <Input
                value={form.ordner_nr}
                onChange={(e) => setForm({ ...form, ordner_nr: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Baustellennummer *</Label>
              <Input
                value={form.baustellennummer}
                onChange={(e) =>
                  setForm({ ...form, baustellennummer: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <StandortAuswahl
                label="Ort / Adresse *"
                wert={{
                  adresse: form.adresse,
                  breitengrad: form.breitengrad ?? DEFAULT_LAT,
                  laengengrad: form.laengengrad ?? DEFAULT_LNG,
                }}
                onChange={(w) =>
                  setForm({
                    ...form,
                    adresse: w.adresse,
                    breitengrad: w.breitengrad,
                    laengengrad: w.laengengrad,
                  })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ansprechpartner</Label>
              <Input
                value={form.ansprechpartner}
                onChange={(e) =>
                  setForm({ ...form, ansprechpartner: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as Baustelle["status"] })
                }
                items={{ aktiv: "Aktiv", inaktiv: "Inaktiv" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="inaktiv">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Baustellenhinweis</Label>
              <Textarea
                value={form.hinweis}
                onChange={(e) => setForm({ ...form, hinweis: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={speichern}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
