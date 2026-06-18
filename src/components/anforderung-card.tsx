"use client";

import Link from "next/link";
import { Layers, MapPin, Truck } from "lucide-react";
import type { Anforderung } from "@/lib/types";
import { useStore } from "@/lib/store";
import { formatTonnage, formatDatum } from "@/lib/calc";
import { StatusBadge, PrioritaetBadge } from "@/components/status-badge";
import { WunschterminText } from "@/components/wunschtermin";
import { Card } from "@/components/ui/card";

export function AnforderungCard({ anforderung }: { anforderung: Anforderung }) {
  const { baustellen, materialarten, einsaetze } = useStore();
  const baustelle = baustellen.find((b) => b.id === anforderung.baustelle_id);
  const tonnage = anforderung.materialien.reduce((s, m) => s + m.tonnage, 0);
  const materialNamen = anforderung.materialien
    .map(
      (m) =>
        materialarten.find((ma) => ma.id === m.material_id)?.bezeichnung ??
        "Material"
    )
    .join(", ");

  // Geplanter Einbau-Tag aus den eingeplanten Einsätzen (frühestes–spätestes
  // Datum). Aktualisiert sich automatisch über den Store.
  const einbauDaten = einsaetze
    .filter((e) => e.anforderung_id === anforderung.id)
    .map((e) => e.datum)
    .sort();
  const einbauText =
    einbauDaten.length === 0
      ? "noch nicht eingeplant"
      : einbauDaten[0] === einbauDaten[einbauDaten.length - 1]
      ? formatDatum(einbauDaten[0])
      : `${formatDatum(einbauDaten[0])} – ${formatDatum(
          einbauDaten[einbauDaten.length - 1]
        )}`;

  return (
    <Link href={`/anforderungen/${anforderung.id}`}>
      <Card className="gap-0 p-4 transition-all hover:border-primary/40 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium">
              {baustelle?.name ?? "Unbekannte Baustelle"}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{anforderung.adresse}</span>
            </div>
          </div>
          <PrioritaetBadge prioritaet={anforderung.prioritaet} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5" title="Wunschtermin">
            <span className="font-medium text-foreground/70">Wunsch:</span>
            <WunschterminText
              iso={anforderung.wunschtermin}
              abgeschlossen={anforderung.status === "abgeschlossen"}
            />
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" />
            {formatTonnage(tonnage)}
          </span>
        </div>

        <div
          className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
          title="Geplanter Einbau-Tag (aus den Einsätzen)"
        >
          <Truck className="size-3.5 shrink-0" />
          <span className="font-medium text-foreground/70">Einbau:</span>
          <span
            className={
              einbauDaten.length === 0 ? "text-muted-foreground/70" : undefined
            }
          >
            {einbauText}
          </span>
        </div>

        {materialNamen && (
          <div className="mt-2 truncate text-xs text-foreground/70">
            {materialNamen}
          </div>
        )}

        <div className="mt-3">
          <StatusBadge status={anforderung.status} />
        </div>
      </Card>
    </Link>
  );
}
