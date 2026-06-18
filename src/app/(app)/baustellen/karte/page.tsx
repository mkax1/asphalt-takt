"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  LocateFixed,
  MapPinOff,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { geocodeAdresse, warte } from "@/lib/geocode";
import { fmtDatum, heuteIso } from "@/lib/datum";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BaustellenMarker } from "@/components/baustellen-karte";

const BaustellenKarte = dynamic(
  () => import("@/components/baustellen-karte"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Karte wird geladen…
      </div>
    ),
  }
);

export default function BaustellenKartePage() {
  const { baustellen, anforderungen, einsaetze, currentUser, updateBaustelle } =
    useStore();
  const darfBearbeiten = currentUser.rolle === "admin";
  const [geocodeLaeuft, setGeocodeLaeuft] = useState(false);

  const { mitStandort, ohneStandort } = useMemo(() => {
    const heute = heuteIso();
    const mit: BaustellenMarker[] = [];
    const ohne: typeof baustellen = [];

    for (const b of baustellen) {
      const anfIds = anforderungen
        .filter((a) => a.baustelle_id === b.id)
        .map((a) => a.id);
      const daten = einsaetze
        .filter((e) => anfIds.includes(e.anforderung_id))
        .map((e) => e.datum)
        .sort();
      const naechsterIso = daten.find((d) => d >= heute) ?? null;

      if (b.breitengrad != null && b.laengengrad != null) {
        mit.push({
          id: b.id,
          name: b.name,
          nummer: b.baustellennummer,
          adresse: b.adresse,
          ansprechpartner: b.ansprechpartner ?? "",
          status: b.status,
          anzahlAnf: anfIds.length,
          naechsterEinbau: naechsterIso ? fmtDatum(naechsterIso) : null,
          lat: b.breitengrad,
          lng: b.laengengrad,
        });
      } else {
        ohne.push(b);
      }
    }
    return { mitStandort: mit, ohneStandort: ohne };
  }, [baustellen, anforderungen, einsaetze]);

  const geocodeKandidaten = ohneStandort.filter((b) => b.adresse?.trim());

  async function koordinatenErmitteln() {
    if (geocodeKandidaten.length === 0) return;
    setGeocodeLaeuft(true);
    const tId = toast.loading(
      `Koordinaten werden ermittelt… (0/${geocodeKandidaten.length})`
    );
    let erfolg = 0;
    for (let i = 0; i < geocodeKandidaten.length; i++) {
      toast.loading(
        `Koordinaten werden ermittelt… (${i + 1}/${geocodeKandidaten.length})`,
        { id: tId }
      );
      const res = await geocodeAdresse(geocodeKandidaten[i].adresse);
      if (res) {
        updateBaustelle(geocodeKandidaten[i].id, {
          breitengrad: res.breitengrad,
          laengengrad: res.laengengrad,
        });
        erfolg++;
      }
      // Nominatim-Limit einhalten: ~1 Anfrage pro Sekunde.
      if (i < geocodeKandidaten.length - 1) await warte(1100);
    }
    setGeocodeLaeuft(false);
    const fehlend = geocodeKandidaten.length - erfolg;
    toast.success(
      `${erfolg} von ${geocodeKandidaten.length} Baustellen verortet.`,
      {
        id: tId,
        description:
          fehlend > 0
            ? `${fehlend} ohne Treffer – bitte Pin manuell setzen.`
            : undefined,
      }
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2"
        nativeButton={false}
        render={<Link href="/baustellen" />}
      >
        <ArrowLeft className="size-4" />
        Zurück
      </Button>

      <PageHeader
        title="Baustellen auf der Karte"
        description={`${mitStandort.length} mit Standort${
          ohneStandort.length > 0 ? ` · ${ohneStandort.length} ohne` : ""
        }`}
        actions={
          darfBearbeiten && geocodeKandidaten.length > 0 ? (
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
              Koordinaten aus Adressen ermitteln ({geocodeKandidaten.length})
            </Button>
          ) : undefined
        }
      />

      {/* Legende */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-hebel-blau ring-2 ring-white" />
          Aktiv
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-slate-400 ring-2 ring-white" />
          Inaktiv
        </span>
      </div>

      <div className="h-[68vh] min-h-[420px] w-full overflow-hidden rounded-xl border shadow-sm">
        {mitStandort.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/30 text-center text-sm text-muted-foreground">
            <MapPinOff className="size-8 text-muted-foreground/50" />
            <p>Keine Baustelle hat hinterlegte Koordinaten.</p>
          </div>
        ) : (
          <BaustellenKarte markers={mitStandort} />
        )}
      </div>

      {/* Baustellen ohne Koordinaten */}
      {ohneStandort.length > 0 && (
        <Card className="mt-5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPinOff className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              Ohne Standort ({ohneStandort.length})
            </h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Diese Baustellen erscheinen nicht auf der Karte – bitte Koordinaten
            ergänzen.
          </p>
          <ul className="divide-y rounded-lg border">
            {ohneStandort.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/baustellen/${b.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.baustellennummer ? `Nr. ${b.baustellennummer} · ` : ""}
                      {b.adresse || "keine Adresse"}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
