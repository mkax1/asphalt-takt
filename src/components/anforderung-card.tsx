"use client";

import Link from "next/link";
import { CalendarClock, Layers, MapPin } from "lucide-react";
import type { Anforderung } from "@/lib/types";
import { useStore } from "@/lib/store";
import { formatDatum, formatTonnage } from "@/lib/calc";
import { StatusBadge, PrioritaetBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";

export function AnforderungCard({ anforderung }: { anforderung: Anforderung }) {
  const { baustellen, materialarten } = useStore();
  const baustelle = baustellen.find((b) => b.id === anforderung.baustelle_id);
  const tonnage = anforderung.materialien.reduce((s, m) => s + m.tonnage, 0);
  const materialNamen = anforderung.materialien
    .map(
      (m) =>
        materialarten.find((ma) => ma.id === m.material_id)?.bezeichnung ??
        "Material"
    )
    .join(", ");

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
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            {formatDatum(anforderung.wunschtermin)}
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" />
            {formatTonnage(tonnage)}
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
