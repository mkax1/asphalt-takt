"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { AnforderungCard } from "@/components/anforderung-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="flex-row items-center gap-4 p-5">
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-xl",
          tone
        )}
      >
        <Icon className="size-6" />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { anforderungen } = useStore();

  const gesamt = anforderungen.length;
  const neu = anforderungen.filter(
    (a) => a.status === "neu_erfasst" || a.status === "in_pruefung"
  );
  const inBearbeitung = anforderungen.filter(
    (a) =>
      a.status === "planung_vervollstaendigt" || a.status === "in_bearbeitung"
  );
  const abgeschlossen = anforderungen.filter(
    (a) => a.status === "abgeschlossen"
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Überblick über alle Mischgut-Anforderungen."
        actions={
          <Button nativeButton={false} render={<Link href="/anforderungen/neu" />}>
            <Plus className="size-4" />
            Neue Anforderung
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Anforderungen gesamt"
          value={gesamt}
          icon={ClipboardList}
          tone="bg-primary/10 text-primary"
        />
        <KpiCard
          label="Neu / In Prüfung"
          value={neu.length}
          icon={Sparkles}
          tone="bg-amber-100 text-amber-700"
        />
        <KpiCard
          label="In Bearbeitung"
          value={inBearbeitung.length}
          icon={Loader2}
          tone="bg-sky-100 text-sky-700"
        />
        <KpiCard
          label="Abgeschlossen"
          value={abgeschlossen.length}
          icon={CheckCircle2}
          tone="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Offene Anforderungen
            </h2>
            <span className="text-sm text-muted-foreground">{neu.length}</span>
          </div>
          <div className="space-y-3">
            {neu.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Keine offenen Anforderungen.
              </p>
            )}
            {neu.map((a) => (
              <AnforderungCard key={a.id} anforderung={a} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              In Bearbeitung
            </h2>
            <span className="text-sm text-muted-foreground">
              {inBearbeitung.length}
            </span>
          </div>
          <div className="space-y-3">
            {inBearbeitung.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nichts in Bearbeitung.
              </p>
            )}
            {inBearbeitung.map((a) => (
              <AnforderungCard key={a.id} anforderung={a} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
