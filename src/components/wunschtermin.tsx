import { AlertTriangle, CalendarClock } from "lucide-react";
import { formatDatum, terminDringlichkeit } from "@/lib/calc";
import { cn } from "@/lib/utils";

const KLASSE: Record<string, string> = {
  ueberfaellig: "text-red-600 font-semibold",
  bald: "text-orange-600 font-medium",
  normal: "",
};

const TITEL: Record<string, string> = {
  ueberfaellig: "Überfällig",
  bald: "Termin innerhalb der nächsten 3 Tage",
  normal: "Wunschtermin",
};

export function WunschterminText({
  iso,
  abgeschlossen,
  className,
}: {
  iso?: string;
  abgeschlossen: boolean;
  className?: string;
}) {
  const d = terminDringlichkeit(iso, abgeschlossen);
  const Icon = d === "ueberfaellig" ? AlertTriangle : CalendarClock;
  return (
    <span
      className={cn("flex items-center gap-1.5", KLASSE[d], className)}
      title={TITEL[d]}
    >
      <Icon className="size-3.5 shrink-0" />
      {formatDatum(iso)}
    </span>
  );
}

export function TerminLegende({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <span className="font-medium uppercase tracking-wide">Wunschtermin:</span>
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="size-3.5 text-red-600" />
        <span className="text-red-600">Überfällig</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-orange-500" />
        Innerhalb 3 Tagen
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/40" />
        Später / erledigt
      </span>
    </div>
  );
}
