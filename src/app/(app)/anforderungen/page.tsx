"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { AnforderungCard } from "@/components/anforderung-card";
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
import type { AnforderungStatus } from "@/lib/types";

export default function AnforderungenPage() {
  const { anforderungen, baustellen } = useStore();
  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");

  const gefiltert = useMemo(() => {
    return anforderungen.filter((a) => {
      if (statusFilter !== "alle" && a.status !== statusFilter) return false;
      if (suche.trim()) {
        const b = baustellen.find((x) => x.id === a.baustelle_id);
        const text = `${b?.name ?? ""} ${a.adresse} ${a.kostenstelle}`.toLowerCase();
        if (!text.includes(suche.toLowerCase())) return false;
      }
      return true;
    });
  }, [anforderungen, baustellen, statusFilter, suche]);

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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Baustelle, Adresse oder Kostenstelle suchen…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-64">
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
      </div>

      {gefiltert.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Keine Anforderungen gefunden.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gefiltert.map((a) => (
            <AnforderungCard key={a.id} anforderung={a} />
          ))}
        </div>
      )}
    </div>
  );
}
