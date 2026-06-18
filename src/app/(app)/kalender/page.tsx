"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { formatTonnage } from "@/lib/calc";
import { fmtDatum, fmtDatumLang } from "@/lib/datum";
import {
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_LABEL_KURZ,
} from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { WetterBadge } from "@/components/wetter-karte";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
import type { Anforderung, Baustelle, Einsatz, Kolonne } from "@/lib/types";

type Ansicht = "woche" | "monat" | "kolonnen";

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function startDerWoche(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startDesMonats(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function kalenderWoche(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

function monatLang(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(d);
}

function wochenBereich(anker: Date): string {
  const ende = addDays(anker, 6);
  const tag = (x: Date) => x.getDate();
  const monat = (x: Date) =>
    new Intl.DateTimeFormat("de-DE", { month: "long" }).format(x);
  if (anker.getMonth() === ende.getMonth()) {
    return `${tag(anker)}.–${tag(ende)}. ${monat(ende)} ${ende.getFullYear()}`;
  }
  const monatKurz = (x: Date) =>
    new Intl.DateTimeFormat("de-DE", { month: "short" }).format(x);
  return `${tag(anker)}. ${monatKurz(anker)} – ${tag(ende)}. ${monatKurz(
    ende
  )} ${ende.getFullYear()}`;
}

function zeitZuMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Prüft, ob ein (geänderter) Einsatz mit einem anderen derselben Kolonne am
 *  selben Tag zeitlich kollidiert. `ignoreId` schließt den eigenen Einsatz aus. */
function hatKonflikt(
  list: Einsatz[],
  kolonneId: string,
  datum: string,
  startMin: number,
  endMin: number,
  ignoreId?: string
): boolean {
  return list.some((e) => {
    if (e.id === ignoreId) return false;
    if (e.kolonne_id !== kolonneId || e.datum !== datum) return false;
    const s = zeitZuMin(e.startzeit);
    const en = s + e.dauer_std * 60;
    return startMin < en && s < endMin;
  });
}

/**
 * Kollisionserkennung für Drag & Drop: zuerst exakt der Ablagebereich unter dem
 * Mauszeiger (verhindert das versehentliche Treffen des Nachbartags), als
 * Rückfall – etwa in Lücken zwischen den Karten – der nächstgelegene Bereich.
 */
const dropErkennung: CollisionDetection = (args) => {
  const unterZeiger = pointerWithin(args);
  if (unterZeiger.length > 0) return unterZeiger;
  return closestCenter(args);
};

function berechneKonflikte(list: Einsatz[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.kolonne_id === b.kolonne_id && a.datum === b.datum) {
        const as = zeitZuMin(a.startzeit);
        const ae = as + a.dauer_std * 60;
        const bs = zeitZuMin(b.startzeit);
        const be = bs + b.dauer_std * 60;
        if (as < be && bs < ae) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
  }
  return set;
}

export default function KalenderPage() {
  const {
    einsaetze,
    kolonnen,
    anforderungen,
    baustellen,
    materialarten,
    currentUser,
    addEinsatz,
    updateEinsatz,
    deleteEinsatz,
    setAnforderungStatus,
  } = useStore();

  const darfPlanen =
    currentUser.rolle === "disposition" || currentUser.rolle === "admin";

  const [ansicht, setAnsicht] = useState<Ansicht>("woche");
  const [anker, setAnker] = useState(() => startDerWoche(new Date()));
  const [detail, setDetail] = useState<Einsatz | null>(null);

  const [open, setOpen] = useState(false);
  const [einsatzEditId, setEinsatzEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    anforderung_id: "",
    kolonne_id: "",
    datum: "",
    startzeit: "06:00",
    dauer_std: "10",
  });
  // Rückfrage beim Mehrfach-Planen derselben Anforderung.
  const [bestaetigung, setBestaetigung] = useState<{
    anzahl: number;
    aktion: () => void;
  } | null>(null);

  const heuteIso = isoDate(new Date());

  // Sichtbarer Zeitraum je nach Ansicht
  const { rangeVon, rangeBis } = useMemo(() => {
    if (ansicht === "monat") {
      const start = startDesMonats(anker);
      const ende = new Date(anker.getFullYear(), anker.getMonth() + 1, 0);
      return { rangeVon: isoDate(start), rangeBis: isoDate(ende) };
    }
    return { rangeVon: isoDate(anker), rangeBis: isoDate(addDays(anker, 6)) };
  }, [ansicht, anker]);

  const sichtbareEinsaetze = useMemo(
    () => einsaetze.filter((e) => e.datum >= rangeVon && e.datum <= rangeBis),
    [einsaetze, rangeVon, rangeBis]
  );

  const konfliktSet = useMemo(
    () => berechneKonflikte(sichtbareEinsaetze),
    [sichtbareEinsaetze]
  );

  const kpiKolonnen = new Set(sichtbareEinsaetze.map((e) => e.kolonne_id)).size;
  const kpiStunden = sichtbareEinsaetze.reduce((s, e) => s + e.dauer_std, 0);

  function info(e: Einsatz) {
    const a = anforderungen.find((x) => x.id === e.anforderung_id);
    const b = baustellen.find((x) => x.id === a?.baustelle_id);
    const kolonne = kolonnen.find((k) => k.id === e.kolonne_id);
    const tonnage = a ? a.materialien.reduce((s, m) => s + m.tonnage, 0) : 0;
    const material = a
      ? a.materialien
          .map(
            (m) =>
              materialarten.find((x) => x.id === m.material_id)?.bezeichnung
          )
          .filter(Boolean)
          .join(", ")
      : "";
    return { a, b, kolonne, tonnage, material };
  }

  // Navigation
  function zurueck() {
    setAnker(ansicht === "monat" ? addMonths(anker, -1) : addDays(anker, -7));
  }
  function weiter() {
    setAnker(ansicht === "monat" ? addMonths(anker, 1) : addDays(anker, 7));
  }
  function heute() {
    setAnker(
      ansicht === "monat" ? startDesMonats(new Date()) : startDerWoche(new Date())
    );
  }
  function wechsleAnsicht(v: Ansicht) {
    setAnsicht(v);
    setAnker((a) => (v === "monat" ? startDesMonats(a) : startDerWoche(a)));
  }

  // Einsatz-Dialog
  function dialogOeffnen(datum?: string, kolonne_id?: string) {
    setEinsatzEditId(null);
    setForm({
      anforderung_id: "",
      kolonne_id: kolonne_id ?? "",
      datum: datum ?? heuteIso,
      startzeit: "06:00",
      dauer_std: "10",
    });
    setOpen(true);
  }

  function dialogBearbeiten(e: Einsatz) {
    setEinsatzEditId(e.id);
    setForm({
      anforderung_id: e.anforderung_id,
      kolonne_id: e.kolonne_id,
      datum: e.datum,
      startzeit: e.startzeit,
      dauer_std: String(e.dauer_std),
    });
    setDetail(null);
    setOpen(true);
  }

  /** Zählt bereits geplante Einsätze einer Anforderung. */
  function anzahlEinsaetze(anforderungId: string): number {
    return einsaetze.filter((e) => e.anforderung_id === anforderungId).length;
  }

  /**
   * Führt eine Plan-Aktion aus – aber nur direkt, wenn die Anforderung noch
   * keinen Einsatz hat. Andernfalls erst nach ausdrücklicher Bestätigung.
   */
  function mitMehrfachPruefung(anforderungId: string, aktion: () => void) {
    const anzahl = anzahlEinsaetze(anforderungId);
    if (anzahl > 0) {
      setBestaetigung({ anzahl, aktion });
    } else {
      aktion();
    }
  }

  function einsatzSpeichern() {
    if (!form.anforderung_id || !form.kolonne_id || !form.datum) {
      toast.error("Bitte Anforderung, Kolonne und Datum wählen.");
      return;
    }
    if (einsatzEditId) {
      updateEinsatz(einsatzEditId, {
        anforderung_id: form.anforderung_id,
        kolonne_id: form.kolonne_id,
        datum: form.datum,
        startzeit: form.startzeit,
        dauer_std: parseFloat(form.dauer_std) || 0,
      });
      toast.success("Einsatz aktualisiert.");
      setOpen(false);
      return;
    }
    mitMehrfachPruefung(form.anforderung_id, () => {
      addEinsatz({
        anforderung_id: form.anforderung_id,
        kolonne_id: form.kolonne_id,
        datum: form.datum,
        startzeit: form.startzeit,
        dauer_std: parseFloat(form.dauer_std) || 0,
        status: "planung_vervollstaendigt",
      });
      const a = anforderungen.find((x) => x.id === form.anforderung_id);
      if (a && (a.status === "neu_erfasst" || a.status === "in_pruefung")) {
        setAnforderungStatus(a.id, "planung_vervollstaendigt");
      }
      toast.success("Einsatz eingeplant.");
      setOpen(false);
    });
  }

  /* --------------------------- Drag & Drop --------------------------- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [aktiverDrag, setAktiverDrag] = useState<{
    typ: "anforderung" | "einsatz";
    id: string;
  } | null>(null);

  // Anforderungen ohne eingeplanten Einsatz (noch zu planen)
  const ungeplante = useMemo(() => {
    const geplant = new Set(einsaetze.map((e) => e.anforderung_id));
    return anforderungen
      .filter((a) => a.status !== "abgeschlossen" && !geplant.has(a.id))
      .sort((a, b) => a.wunschtermin.localeCompare(b.wunschtermin));
  }, [anforderungen, einsaetze]);

  function einsatzAusAnforderung(
    anforderungId: string,
    kolonneId: string,
    datum: string,
    startzeit = "06:00"
  ) {
    const anlegen = () => {
      const a = anforderungen.find((x) => x.id === anforderungId);
      const dauer = a?.dauer_std && a.dauer_std > 0 ? a.dauer_std : 10;
      addEinsatz({
        anforderung_id: anforderungId,
        kolonne_id: kolonneId,
        datum,
        startzeit,
        dauer_std: dauer,
        status: "planung_vervollstaendigt",
      });
      if (a && (a.status === "neu_erfasst" || a.status === "in_pruefung")) {
        setAnforderungStatus(a.id, "planung_vervollstaendigt");
      }
      const start = zeitZuMin(startzeit);
      if (hatKonflikt(einsaetze, kolonneId, datum, start, start + dauer * 60)) {
        toast.warning("Eingeplant – Achtung: Konflikt mit einem anderen Einsatz dieser Kolonne.");
      } else {
        toast.success("Einsatz eingeplant.");
      }
    };
    mitMehrfachPruefung(anforderungId, anlegen);
  }

  function dialogAusAnforderung(anforderungId: string, datum: string) {
    setEinsatzEditId(null);
    setForm({
      anforderung_id: anforderungId,
      kolonne_id: "",
      datum,
      startzeit: "06:00",
      dauer_std: "10",
    });
    setOpen(true);
  }

  function einsatzVerschieben(
    einsatzId: string,
    datum: string,
    kolonneId?: string
  ) {
    const e = einsaetze.find((x) => x.id === einsatzId);
    if (!e) return;
    const neueKolonne = kolonneId ?? e.kolonne_id;
    if (e.datum === datum && neueKolonne === e.kolonne_id) return;
    updateEinsatz(einsatzId, { datum, kolonne_id: neueKolonne });
    const start = zeitZuMin(e.startzeit);
    if (
      hatKonflikt(
        einsaetze,
        neueKolonne,
        datum,
        start,
        start + e.dauer_std * 60,
        einsatzId
      )
    ) {
      toast.warning("Verschoben – Achtung: Konflikt mit einem anderen Einsatz dieser Kolonne.");
    } else {
      toast.success("Einsatz verschoben.");
    }
  }

  function onDragStart(ev: DragStartEvent) {
    const data = ev.active.data.current as
      | { typ: "anforderung" | "einsatz"; id: string }
      | undefined;
    if (data) setAktiverDrag(data);
  }

  function onDragEnd(ev: DragEndEvent) {
    setAktiverDrag(null);
    const aktiv = ev.active.data.current as
      | { typ: "anforderung" | "einsatz"; id: string }
      | undefined;
    const ziel = ev.over?.data.current as
      | { typ: "day"; iso: string }
      | { typ: "cell"; kolonneId: string; iso: string }
      | undefined;
    if (!aktiv || !ziel) return;

    if (aktiv.typ === "anforderung") {
      if (ziel.typ === "day") {
        dialogAusAnforderung(aktiv.id, ziel.iso);
      } else {
        einsatzAusAnforderung(aktiv.id, ziel.kolonneId, ziel.iso);
      }
    } else {
      if (ziel.typ === "day") {
        einsatzVerschieben(aktiv.id, ziel.iso);
      } else {
        einsatzVerschieben(aktiv.id, ziel.iso, ziel.kolonneId);
      }
    }
  }

  const dragAnforderung =
    aktiverDrag?.typ === "anforderung"
      ? anforderungen.find((a) => a.id === aktiverDrag.id)
      : undefined;
  const dragEinsatz =
    aktiverDrag?.typ === "einsatz"
      ? einsaetze.find((e) => e.id === aktiverDrag.id)
      : undefined;

  // Immer den aktuellen Stand des geöffneten Einsatzes anzeigen, damit Datum,
  // Wetter und Status nach einer Änderung sofort konsistent sind.
  const detailLive = detail
    ? einsaetze.find((e) => e.id === detail.id) ?? null
    : null;

  const ANSICHTEN: { id: Ansicht; label: string }[] = [
    { id: "woche", label: "Woche" },
    { id: "monat", label: "Monat" },
    { id: "kolonnen", label: "Kolonnen" },
  ];

  const zeigePanel = darfPlanen && ansicht !== "monat";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Kalender"
        description="Planung der Kolonnen-Einsätze."
        actions={
          darfPlanen ? (
            <Button onClick={() => dialogOeffnen()}>
              <Plus className="size-4" />
              Einsatz planen
            </Button>
          ) : undefined
        }
      />

      {/* Steuerleiste */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          {ANSICHTEN.map((v) => (
            <button
              key={v.id}
              onClick={() => wechsleAnsicht(v.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                ansicht === v.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={zurueck}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={heute}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={weiter}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* KW + Zeitraum + KPIs */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {ansicht !== "monat" && (
            <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
              KW {kalenderWoche(anker)}
            </span>
          )}
          <span className="text-lg font-semibold">
            {ansicht === "monat" ? monatLang(anker) : wochenBereich(anker)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="size-4" /> {sichtbareEinsaetze.length}{" "}
            Einsätze
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-4" /> {kpiKolonnen} Kolonnen
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-4" /> {kpiStunden} Std.
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5",
              konfliktSet.size > 0
                ? "font-medium text-red-600"
                : "text-muted-foreground"
            )}
          >
            <AlertTriangle className="size-4" /> {konfliktSet.size} Konflikte
          </span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={dropErkennung}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setAktiverDrag(null)}
      >
        {zeigePanel && (
          <ZuPlanenPanel anforderungen={ungeplante} info={info} />
        )}

        {ansicht === "woche" && (
          <WochenAnsicht
            anker={anker}
            einsaetze={sichtbareEinsaetze}
            konfliktSet={konfliktSet}
            heuteIso={heuteIso}
            darfPlanen={darfPlanen}
            ziehtGerade={aktiverDrag != null}
            info={info}
            onEinsatz={setDetail}
            onPlanen={dialogOeffnen}
          />
        )}

        {ansicht === "monat" && (
          <MonatsAnsicht
            anker={anker}
            einsaetze={sichtbareEinsaetze}
            konfliktSet={konfliktSet}
            heuteIso={heuteIso}
            info={info}
            onTag={(d) => {
              setAnsicht("woche");
              setAnker(startDerWoche(d));
            }}
          />
        )}

        {ansicht === "kolonnen" && (
          <KolonnenAnsicht
            anker={anker}
            kolonnen={kolonnen}
            einsaetze={sichtbareEinsaetze}
            konfliktSet={konfliktSet}
            heuteIso={heuteIso}
            darfPlanen={darfPlanen}
            ziehtGerade={aktiverDrag != null}
            info={info}
            onEinsatz={setDetail}
            onPlanen={dialogOeffnen}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {dragAnforderung ? (
            <DragVorschau
              titel={info({ anforderung_id: dragAnforderung.id } as Einsatz).b?.name ?? "Anforderung"}
              farbe="#005A9A"
            />
          ) : dragEinsatz ? (
            <DragVorschau
              titel={info(dragEinsatz).b?.name ?? "Einsatz"}
              farbe={info(dragEinsatz).kolonne?.farbe ?? "#005A9A"}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Legende */}
      <div className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Legende – Kolonnen
        </h2>
        <div className="flex flex-wrap gap-2">
          {kolonnen.map((k) => (
            <span
              key={k.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: k.farbe }}
              />
              {k.name}
            </span>
          ))}
        </div>
      </div>

      {/* Detail-Dialog */}
      <EinsatzDetailDialog
        einsatz={detailLive}
        onClose={() => setDetail(null)}
        konflikt={detailLive ? konfliktSet.has(detailLive.id) : false}
        info={info}
        darfPlanen={darfPlanen}
        onEdit={dialogBearbeiten}
        onDelete={(id) => {
          deleteEinsatz(id);
          setDetail(null);
          toast.success("Einsatz entfernt.");
        }}
      />

      {/* Planungs-Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {einsatzEditId ? "Einsatz bearbeiten" : "Einsatz planen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Anforderung *</Label>
              <Select
                value={form.anforderung_id}
                onValueChange={(v) =>
                  setForm({ ...form, anforderung_id: v ?? "" })
                }
                items={Object.fromEntries(
                  anforderungen.map((a) => [
                    a.id,
                    baustellen.find((x) => x.id === a.baustelle_id)?.name ??
                      a.adresse,
                  ])
                )}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Anforderung wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {anforderungen
                    .filter((a) => a.status !== "abgeschlossen")
                    .map((a) => {
                      const b = baustellen.find((x) => x.id === a.baustelle_id);
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          {b?.name ?? a.adresse}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kolonne *</Label>
              <Select
                value={form.kolonne_id}
                onValueChange={(v) => setForm({ ...form, kolonne_id: v ?? "" })}
                items={Object.fromEntries(kolonnen.map((k) => [k.id, k.name]))}
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
                  value={form.datum}
                  onChange={(iso) => setForm({ ...form, datum: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label>Startzeit</Label>
                <TimeField
                  value={form.startzeit}
                  onChange={(zeit) => setForm({ ...form, startzeit: zeit })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dauer (Std.)</Label>
                <Input
                  type="number"
                  value={form.dauer_std}
                  onChange={(e) =>
                    setForm({ ...form, dauer_std: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={einsatzSpeichern}>
              {einsatzEditId ? "Speichern" : "Einplanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mehrfach-Planung bestätigen */}
      <Dialog
        open={bestaetigung != null}
        onOpenChange={(o) => !o && setBestaetigung(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bereits eingeplant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Diese Anforderung ist bereits mit {bestaetigung?.anzahl}{" "}
            {bestaetigung?.anzahl === 1 ? "Einsatz" : "Einsätzen"} eingeplant –
            trotzdem einen weiteren Einsatz anlegen?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBestaetigung(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                bestaetigung?.aktion();
                setBestaetigung(null);
              }}
            >
              <Plus className="size-4" />
              Weiteren Einsatz anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Hilfstypen ----------------------------- */

type InfoFn = (e: Einsatz) => {
  a: Anforderung | undefined;
  b: Baustelle | undefined;
  kolonne: Kolonne | undefined;
  tonnage: number;
  material: string;
};

type DropData =
  | { typ: "day"; iso: string }
  | { typ: "cell"; kolonneId: string; iso: string };

type DragData = { typ: "anforderung" | "einsatz"; id: string };

/* ----------------------------- DnD-Bausteine ----------------------------- */

/** Ablagefläche (Tag oder Kolonnen-Zelle). Hebt sich beim Ziehen hervor. */
function DropZone({
  id,
  data,
  aktiv,
  className,
  children,
}: {
  id: string;
  data: DropData;
  aktiv: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        aktiv && "outline-dashed outline-1 outline-primary/30",
        isOver && "outline-2 outline-primary bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

/** Ziehbares Element (bestehender Einsatz). Klick bleibt erhalten. */
function DragItem({
  id,
  data,
  disabled,
  onClick,
  style,
  className,
  title,
  children,
}: {
  id: string;
  data: DragData;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={style}
      title={title}
      onClick={onClick}
      {...(disabled ? {} : listeners)}
      {...attributes}
      className={cn(
        className,
        !disabled && "cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-40"
      )}
    >
      {children}
    </div>
  );
}

/** Kleine Vorschau, die am Cursor mitgezogen wird. */
function DragVorschau({ titel, farbe }: { titel: string; farbe: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-lg"
      style={{ borderLeft: `4px solid ${farbe}` }}
    >
      <GripVertical className="size-4 text-muted-foreground" />
      <span className="max-w-50 truncate">{titel}</span>
    </div>
  );
}

/* --------------------------- Noch zu planen ---------------------------- */

function ZuPlanenPanel({
  anforderungen,
  info,
}: {
  anforderungen: Anforderung[];
  info: InfoFn;
}) {
  return (
    <div className="mb-4 rounded-xl border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="size-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Noch zu planen ({anforderungen.length})
        </h2>
        {anforderungen.length > 0 && (
          <span className="text-xs text-muted-foreground/70">
            – auf einen Tag bzw. eine Kolonne ziehen
          </span>
        )}
      </div>
      {anforderungen.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-3 py-4 text-center text-xs text-muted-foreground/70">
          Alle Anforderungen sind eingeplant.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {anforderungen.map((a) => (
            <ZuPlanenKarte key={a.id} a={a} info={info} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZuPlanenKarte({ a, info }: { a: Anforderung; info: InfoFn }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `anf:${a.id}`,
    data: { typ: "anforderung", id: a.id } satisfies DragData,
  });
  // info() braucht nur anforderung_id, daher ein minimaler Stub.
  const d = info({ anforderung_id: a.id } as Einsatz);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "w-56 shrink-0 cursor-grab touch-none rounded-lg border border-l-4 bg-card p-2.5 shadow-sm transition hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      style={{ borderLeftColor: "#005A9A" }}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" title={d.b?.name}>
            {d.b?.name ?? a.adresse ?? "Anforderung"}
          </div>
          {d.b?.baustellennummer && (
            <div className="truncate text-xs text-muted-foreground">
              Nr. {d.b.baustellennummer}
            </div>
          )}
          {d.material && (
            <div
              className="mt-1 truncate text-xs text-foreground/70"
              title={`${d.material} · ${formatTonnage(d.tonnage)}`}
            >
              {d.material} · {formatTonnage(d.tonnage)}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between gap-1.5">
            <span
              title={STATUS_LABEL[a.status]}
              className={cn(
                "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                STATUS_BADGE[a.status]
              )}
            >
              {STATUS_LABEL_KURZ[a.status]}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {fmtDatum(a.wunschtermin)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Wochenansicht ----------------------------- */

function WochenAnsicht({
  anker,
  einsaetze,
  konfliktSet,
  heuteIso,
  darfPlanen,
  ziehtGerade,
  info,
  onEinsatz,
  onPlanen,
}: {
  anker: Date;
  einsaetze: Einsatz[];
  konfliktSet: Set<string>;
  heuteIso: string;
  darfPlanen: boolean;
  ziehtGerade: boolean;
  info: InfoFn;
  onEinsatz: (e: Einsatz) => void;
  onPlanen: (datum?: string, kolonne_id?: string) => void;
}) {
  const tage = Array.from({ length: 7 }, (_, i) => addDays(anker, i));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[1000px] grid-cols-7 gap-3">
      {tage.map((tag, i) => {
        const iso = isoDate(tag);
        const tages = einsaetze
          .filter((e) => e.datum === iso)
          .sort((a, b) => a.startzeit.localeCompare(b.startzeit));
        const heute = heuteIso === iso;
        return (
          <DropZone
            key={iso}
            id={`day:${iso}`}
            data={{ typ: "day", iso }}
            aktiv={darfPlanen && ziehtGerade}
            className="h-full rounded-xl"
          >
          <Card
            className={cn(
              "group h-full min-h-44 gap-2 p-2.5",
              heute && "border-primary ring-1 ring-primary/30"
            )}
          >
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-sm font-semibold">
                {TAGE[i]}{" "}
                <span
                  className={cn(
                    "ml-0.5 text-xs font-normal",
                    heute ? "font-semibold text-primary" : "text-muted-foreground"
                  )}
                >
                  {tag.getDate()}.{tag.getMonth() + 1}.
                </span>
              </span>
              {darfPlanen && (
                <button
                  onClick={() => onPlanen(iso)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-primary group-hover:opacity-100"
                  aria-label="Einsatz planen"
                >
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {tages.length === 0 && (
                <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground/70">
                  Kein Einsatz geplant
                </p>
              )}
              {tages.map((e) => {
                const d = info(e);
                const konflikt = konfliktSet.has(e.id);
                return (
                  <DragItem
                    key={e.id}
                    id={`einsatz:${e.id}`}
                    data={{ typ: "einsatz", id: e.id }}
                    disabled={!darfPlanen}
                    onClick={() => onEinsatz(e)}
                    style={{ borderLeftColor: d.kolonne?.farbe ?? "#888" }}
                    className={cn(
                      "w-full rounded-lg border border-l-4 bg-card p-2.5 text-left transition hover:shadow-md",
                      konflikt && "border-red-300 bg-red-50/60"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: d.kolonne?.farbe }}
                      />
                      <span
                        className="truncate text-sm font-semibold"
                        title={d.kolonne?.name}
                      >
                        {d.kolonne?.name}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {e.startzeit} · {e.dauer_std} Std.
                    </div>
                    <div
                      className="mt-1 truncate text-sm font-medium leading-snug"
                      title={d.b?.name}
                    >
                      {d.b?.name ?? "–"}
                    </div>
                    {d.b?.baustellennummer && (
                      <div className="truncate text-xs text-muted-foreground">
                        Nr. {d.b.baustellennummer}
                      </div>
                    )}
                    {d.material && (
                      <div
                        className="mt-1 truncate text-xs text-foreground/70"
                        title={`${d.material} · ${formatTonnage(d.tonnage)}`}
                      >
                        {d.material} · {formatTonnage(d.tonnage)}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {d.a && (
                        <span
                          title={STATUS_LABEL[d.a.status]}
                          className={cn(
                            "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                            STATUS_BADGE[d.a.status]
                          )}
                        >
                          {STATUS_LABEL_KURZ[d.a.status]}
                        </span>
                      )}
                      {konflikt && (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-medium leading-none text-red-700">
                          <AlertTriangle className="size-3" /> Konflikt
                        </span>
                      )}
                    </div>
                  </DragItem>
                );
              })}
            </div>
          </Card>
          </DropZone>
        );
      })}
      </div>
    </div>
  );
}

/* ----------------------------- Monatsansicht ----------------------------- */

function MonatsAnsicht({
  anker,
  einsaetze,
  konfliktSet,
  heuteIso,
  info,
  onTag,
}: {
  anker: Date;
  einsaetze: Einsatz[];
  konfliktSet: Set<string>;
  heuteIso: string;
  info: InfoFn;
  onTag: (d: Date) => void;
}) {
  const monatStart = startDesMonats(anker);
  const gitterStart = startDerWoche(monatStart);
  const tage = Array.from({ length: 42 }, (_, i) => addDays(gitterStart, i));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-7 gap-px rounded-t-lg border bg-border text-center text-xs font-medium">
          {TAGE.map((t) => (
            <div key={t} className="bg-muted/60 py-2">
              {t}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-b-lg border border-t-0 bg-border">
          {tage.map((tag) => {
            const iso = isoDate(tag);
            const imMonat = tag.getMonth() === monatStart.getMonth();
            const heute = heuteIso === iso;
            const tages = einsaetze
              .filter((e) => e.datum === iso)
              .sort((a, b) => a.startzeit.localeCompare(b.startzeit));
            return (
              <button
                key={iso}
                onClick={() => onTag(tag)}
                className={cn(
                  "min-h-24 bg-card p-1.5 text-left align-top transition hover:bg-muted/40",
                  !imMonat && "bg-muted/20 text-muted-foreground"
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      heute && "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {tag.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {tages.slice(0, 3).map((e) => {
                    const d = info(e);
                    const konflikt = konfliktSet.has(e.id);
                    return (
                      <div
                        key={e.id}
                        style={{ backgroundColor: d.kolonne?.farbe }}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white",
                          konflikt && "ring-1 ring-red-500 ring-offset-1"
                        )}
                        title={`${d.kolonne?.name} · ${d.b?.name ?? ""}`}
                      >
                        {e.startzeit} {d.kolonne?.name}
                      </div>
                    );
                  })}
                  {tages.length > 3 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{tages.length - 3} weitere
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Kolonnenansicht ----------------------------- */

function KolonnenAnsicht({
  anker,
  kolonnen,
  einsaetze,
  konfliktSet,
  heuteIso,
  darfPlanen,
  ziehtGerade,
  info,
  onEinsatz,
  onPlanen,
}: {
  anker: Date;
  kolonnen: Kolonne[];
  einsaetze: Einsatz[];
  konfliktSet: Set<string>;
  heuteIso: string;
  darfPlanen: boolean;
  ziehtGerade: boolean;
  info: InfoFn;
  onEinsatz: (e: Einsatz) => void;
  onPlanen: (datum?: string, kolonne_id?: string) => void;
}) {
  const tage = Array.from({ length: 7 }, (_, i) => addDays(anker, i));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[820px]">
        {/* Kopfzeile */}
        <div className="grid grid-cols-[150px_repeat(7,1fr)] border-b bg-muted/40 text-sm">
          <div className="p-2.5 font-medium">Kolonne</div>
          {tage.map((tag, i) => {
            const heute = heuteIso === isoDate(tag);
            return (
              <div
                key={isoDate(tag)}
                className={cn(
                  "border-l p-2.5 text-center",
                  heute && "bg-primary/10 font-semibold text-primary"
                )}
              >
                {TAGE[i]} {tag.getDate()}.{tag.getMonth() + 1}.
              </div>
            );
          })}
        </div>
        {/* Zeilen je Kolonne */}
        {kolonnen.map((k) => (
          <div
            key={k.id}
            className="grid grid-cols-[150px_repeat(7,1fr)] border-b last:border-b-0"
          >
            <div className="flex items-center gap-2 p-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: k.farbe }}
              />
              <span className="text-sm font-medium">{k.name}</span>
            </div>
            {tage.map((tag) => {
              const iso = isoDate(tag);
              const heute = heuteIso === iso;
              const zellen = einsaetze
                .filter((e) => e.kolonne_id === k.id && e.datum === iso)
                .sort((a, b) => a.startzeit.localeCompare(b.startzeit));
              return (
                <DropZone
                  key={iso}
                  id={`cell:${k.id}|${iso}`}
                  data={{ typ: "cell", kolonneId: k.id, iso }}
                  aktiv={darfPlanen && ziehtGerade}
                  className={cn(
                    "group/cell min-h-16 space-y-1 border-l p-1.5",
                    heute && "bg-primary/5"
                  )}
                >
                  {zellen.map((e) => {
                    const d = info(e);
                    const konflikt = konfliktSet.has(e.id);
                    return (
                      <DragItem
                        key={e.id}
                        id={`einsatz:${e.id}`}
                        data={{ typ: "einsatz", id: e.id }}
                        disabled={!darfPlanen}
                        onClick={() => onEinsatz(e)}
                        style={{ backgroundColor: k.farbe }}
                        className={cn(
                          "block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium text-white transition hover:opacity-90",
                          konflikt && "ring-2 ring-red-500"
                        )}
                        title={`${e.startzeit} · ${d.b?.name ?? ""}`}
                      >
                        {e.startzeit} · {d.b?.name ?? "Einsatz"}
                      </DragItem>
                    );
                  })}
                  {darfPlanen && (
                    <button
                      onClick={() => onPlanen(iso, k.id)}
                      className="w-full rounded border border-dashed py-0.5 text-[11px] text-muted-foreground opacity-0 transition hover:text-primary group-hover/cell:opacity-100"
                      aria-label="Einsatz planen"
                    >
                      +
                    </button>
                  )}
                </DropZone>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Detail-Dialog ----------------------------- */

function EinsatzDetailDialog({
  einsatz,
  onClose,
  konflikt,
  info,
  darfPlanen,
  onEdit,
  onDelete,
}: {
  einsatz: Einsatz | null;
  onClose: () => void;
  konflikt: boolean;
  info: InfoFn;
  darfPlanen: boolean;
  onEdit: (e: Einsatz) => void;
  onDelete: (id: string) => void;
}) {
  if (!einsatz) return null;
  const d = info(einsatz);
  const datum = fmtDatumLang(einsatz.datum);

  return (
    <Dialog open={Boolean(einsatz)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="size-3.5 rounded-full"
              style={{ backgroundColor: d.kolonne?.farbe }}
            />
            {d.kolonne?.name}
          </DialogTitle>
        </DialogHeader>

        {konflikt && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="size-4" />
            Zeitliche Überschneidung mit einem anderen Einsatz dieser Kolonne.
          </div>
        )}

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Baustelle
            </dt>
            <dd className="mt-0.5 font-medium">{d.b?.name ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Baustellen-Nr.
            </dt>
            <dd className="mt-0.5">{d.b?.baustellennummer ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Status
            </dt>
            <dd className="mt-0.5">
              {d.a && <StatusBadge status={d.a.status} />}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Termin
            </dt>
            <dd className="mt-0.5">
              {datum} · {einsatz.startzeit} Uhr · {einsatz.dauer_std} Std.
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Material &amp; Tonnage
            </dt>
            <dd className="mt-0.5">
              {d.material || "–"} · {formatTonnage(d.tonnage)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Wetter am Einbautag
            </dt>
            <dd className="mt-1">
              <WetterBadge
                lat={d.a?.breitengrad ?? d.b?.breitengrad}
                lng={d.a?.laengengrad ?? d.b?.laengengrad}
                datum={einsatz.datum}
              />
            </dd>
          </div>
        </dl>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {darfPlanen && (
            <Button onClick={() => onEdit(einsatz)}>
              <Pencil className="size-4" />
              Bearbeiten
            </Button>
          )}
          {d.a && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/anforderungen/${d.a.id}`} />}
            >
              <ExternalLink className="size-4" />
              Zur Anforderung
            </Button>
          )}
          {darfPlanen && (
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => onDelete(einsatz.id)}
            >
              <Trash2 className="size-4" />
              Löschen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
