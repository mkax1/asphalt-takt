"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ListTree, Plus, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { terminDringlichkeit } from "@/lib/calc";
import { PageHeader } from "@/components/page-header";
import { AnforderungCard } from "@/components/anforderung-card";
import { TerminLegende } from "@/components/wunschtermin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, STATUS_REIHENFOLGE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Anforderung, AnforderungStatus, Prioritaet } from "@/lib/types";

type Sortierung =
  | "dringlichkeit"
  | "wunschtermin"
  | "einbautag"
  | "status"
  | "prioritaet";

const SORT_LABEL: Record<Sortierung, string> = {
  dringlichkeit: "Dringlichkeit (Standard)",
  wunschtermin: "Wunschtermin",
  einbautag: "Geplanter Einbau-Tag",
  status: "Status",
  prioritaet: "Priorität",
};

const PRIO_RANG: Record<Prioritaet, number> = { hoch: 0, mittel: 1, niedrig: 2 };

export default function AnforderungenPage() {
  const { anforderungen, baustellen, einsaetze } = useStore();
  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [sortierung, setSortierung] = useState<Sortierung>("dringlichkeit");
  const [gruppieren, setGruppieren] = useState(false);
  const [eingeklappt, setEingeklappt] = useState<Set<string>>(new Set());

  // Frühestes geplantes Einsatz-Datum je Anforderung (für Sortierung "Einbau-Tag").
  const einbauMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of einsaetze) {
      const cur = m.get(e.anforderung_id);
      if (!cur || e.datum < cur) m.set(e.anforderung_id, e.datum);
    }
    return m;
  }, [einsaetze]);

  const gefiltert = useMemo(() => {
    return anforderungen.filter((a) => {
      if (statusFilter !== "alle" && a.status !== statusFilter) return false;
      if (suche.trim()) {
        const b = baustellen.find((x) => x.id === a.baustelle_id);
        const text =
          `${b?.name ?? ""} ${a.adresse} ${a.kostenstelle}`.toLowerCase();
        if (!text.includes(suche.toLowerCase())) return false;
      }
      return true;
    });
  }, [anforderungen, baustellen, statusFilter, suche]);

  const sortiert = useMemo(() => {
    const istUeberfaellig = (a: Anforderung) =>
      terminDringlichkeit(a.wunschtermin, a.status === "abgeschlossen") ===
      "ueberfaellig";
    const cmp = (a: Anforderung, b: Anforderung): number => {
      switch (sortierung) {
        case "wunschtermin":
          return a.wunschtermin.localeCompare(b.wunschtermin);
        case "einbautag": {
          const ea = einbauMap.get(a.id);
          const eb = einbauMap.get(b.id);
          if (!ea && !eb) return a.wunschtermin.localeCompare(b.wunschtermin);
          if (!ea) return 1; // ohne Einbau-Tag ans Ende
          if (!eb) return -1;
          return ea.localeCompare(eb);
        }
        case "status":
          return (
            STATUS_REIHENFOLGE.indexOf(a.status) -
              STATUS_REIHENFOLGE.indexOf(b.status) ||
            a.wunschtermin.localeCompare(b.wunschtermin)
          );
        case "prioritaet":
          return (
            PRIO_RANG[a.prioritaet] - PRIO_RANG[b.prioritaet] ||
            a.wunschtermin.localeCompare(b.wunschtermin)
          );
        case "dringlichkeit":
        default: {
          // Überfällige (offene) zuerst, danach nach Wunschtermin aufsteigend.
          const ua = istUeberfaellig(a) ? 0 : 1;
          const ub = istUeberfaellig(b) ? 0 : 1;
          return ua - ub || a.wunschtermin.localeCompare(b.wunschtermin);
        }
      }
    };
    return [...gefiltert].sort(cmp);
  }, [gefiltert, sortierung, einbauMap]);

  // Gruppierung nach Status (in Ablauf-Reihenfolge), leere Abschnitte ausblenden.
  const gruppen = useMemo(() => {
    return STATUS_REIHENFOLGE.map((status) => ({
      status,
      items: sortiert.filter((a) => a.status === status),
    })).filter((g) => g.items.length > 0);
  }, [sortiert]);

  const toggleGruppe = (status: string) =>
    setEingeklappt((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Anforderungen"
        description="Alle Mischgut-Anforderungen im Überblick."
        actions={
          <Button nativeButton={false} render={<Link href="/anforderungen/neu" />}>
            <Plus className="size-4" />
            Neue Anforderung
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Baustelle, Adresse oder Kostenstelle suchen…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "alle")}
          items={{ alle: "Alle Status", ...STATUS_LABEL }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {STATUS_REIHENFOLGE.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s as AnforderungStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortierung}
          onValueChange={(v) => setSortierung((v as Sortierung) ?? "dringlichkeit")}
          items={SORT_LABEL}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Sortieren" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABEL) as Sortierung[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={gruppieren ? "default" : "outline"}
          onClick={() => setGruppieren((v) => !v)}
          className="shrink-0"
          title="Anforderungen nach Status gruppieren"
        >
          <ListTree className="size-4" />
          Nach Status gruppieren
        </Button>
      </div>

      <TerminLegende className="mb-4" />

      {sortiert.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Keine Anforderungen gefunden.
        </p>
      ) : gruppieren ? (
        <div className="space-y-4">
          {gruppen.map((g) => {
            const offen = !eingeklappt.has(g.status);
            return (
              <section
                key={g.status}
                className="overflow-hidden rounded-xl border bg-card"
              >
                <button
                  onClick={() => toggleGruppe(g.status)}
                  className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        !offen && "-rotate-90"
                      )}
                    />
                    {STATUS_LABEL[g.status]}
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {g.items.length}
                    </span>
                  </span>
                </button>
                {offen && (
                  <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                    {g.items.map((a) => (
                      <AnforderungCard key={a.id} anforderung={a} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortiert.map((a) => (
            <AnforderungCard key={a.id} anforderung={a} />
          ))}
        </div>
      )}
    </div>
  );
}
