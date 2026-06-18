"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  bewerteWitterung,
  wetterAbrufen,
  wetterZustand,
  type WetterAntwort,
  type WetterIcon,
  type WetterTag,
} from "@/lib/wetter";
import { fmtDatum } from "@/lib/datum";
import { cn } from "@/lib/utils";

function IconFuer({
  icon,
  className,
}: {
  icon: WetterIcon;
  className?: string;
}) {
  const map = {
    sonne: Sun,
    "wolke-sonne": CloudSun,
    wolke: Cloud,
    nebel: CloudFog,
    niesel: CloudDrizzle,
    regen: CloudRain,
    schnee: CloudSnow,
    gewitter: CloudLightning,
  } as const;
  const Comp = map[icon];
  return <Comp className={className} />;
}

const STUFE_STYLE = {
  geeignet: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warnung: "border-amber-200 bg-amber-50 text-amber-800",
  kritisch: "border-red-300 bg-red-50 text-red-700",
} as const;

/** Gemeinsamer Hook: lädt die Vorhersage für Koordinaten + Datum. */
function useWetter(
  lat: number | undefined,
  lng: number | undefined,
  datum: string | undefined
) {
  const [zustand, setZustand] = useState<
    | { status: "idle" }
    | { status: "laedt" }
    | { status: "fertig"; antwort: WetterAntwort }
  >({ status: "idle" });

  useEffect(() => {
    if (lat == null || lng == null || !datum) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Zustand bei fehlenden Eingaben zurücksetzen
      setZustand({ status: "idle" });
      return;
    }
    let aktiv = true;
    setZustand({ status: "laedt" });
    wetterAbrufen(lat, lng, datum).then((antwort) => {
      if (aktiv) setZustand({ status: "fertig", antwort });
    });
    return () => {
      aktiv = false;
    };
  }, [lat, lng, datum]);

  return zustand;
}

/* ------------------------- Volle Wetterkarte ------------------------- */

export function Wetterkarte({
  lat,
  lng,
  datum,
  bezug,
}: {
  lat?: number;
  lng?: number;
  datum?: string;
  /** Worauf sich das Datum bezieht, z. B. "geplanter Einbautag". */
  bezug?: string;
}) {
  const zustand = useWetter(lat, lng, datum);
  const fehlendeKoordinaten = lat == null || lng == null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Wetter am Einbautag</h3>
          {bezug && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bezug: {bezug}
            </p>
          )}
        </div>
        {datum && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {fmtDatum(datum)}
          </span>
        )}
      </div>

      {fehlendeKoordinaten || !datum ? (
        <NichtVerfuegbar grund="Vorhersage noch nicht verfügbar (keine Koordinaten oder kein Einbautag)." />
      ) : zustand.status === "laedt" || zustand.status === "idle" ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Cloud className="size-4 animate-pulse" />
          Vorhersage wird geladen…
        </div>
      ) : zustand.antwort.verfuegbar ? (
        <WetterInhalt tag={zustand.antwort.tag} />
      ) : (
        <NichtVerfuegbar grund={zustand.antwort.grund} />
      )}
    </div>
  );
}

function WetterInhalt({ tag }: { tag: WetterTag }) {
  const z = wetterZustand(tag.code);
  const b = bewerteWitterung(tag);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <IconFuer icon={z.icon} className="size-9 text-primary" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{z.label}</div>
          <div className="text-2xl font-semibold leading-tight">
            {Math.round(tag.tMax)}°
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {Math.round(tag.tMin)}°
            </span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Kennwert
          icon={<Thermometer className="size-4" />}
          label="Temp."
          wert={`${Math.round(tag.tMin)}–${Math.round(tag.tMax)} °C`}
        />
        <Kennwert
          icon={<Droplets className="size-4" />}
          label="Regen"
          wert={`${tag.niederschlagMm.toFixed(1)} mm · ${Math.round(
            tag.regenWk
          )} %`}
        />
        <Kennwert
          icon={<Wind className="size-4" />}
          label="Wind"
          wert={`${Math.round(tag.windMax)} km/h`}
        />
      </dl>

      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
          STUFE_STYLE[b.stufe]
        )}
      >
        {b.stufe === "geeignet" ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        )}
        <div>
          <div className="font-medium">{b.titel}</div>
          {b.gruende.length > 0 && (
            <div className="text-xs opacity-90">{b.gruende.join(" · ")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kennwert({
  icon,
  label,
  wert,
}: {
  icon: React.ReactNode;
  label: string;
  wert: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{wert}</dd>
    </div>
  );
}

function NichtVerfuegbar({ grund }: { grund: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
      <CloudFog className="mt-0.5 size-4 shrink-0" />
      <div>
        <div className="font-medium text-foreground/80">
          Vorhersage noch nicht verfügbar
        </div>
        <div className="text-xs">{grund}</div>
      </div>
    </div>
  );
}

/* ------------------------- Kompaktes Badge -------------------------- */

export function WetterBadge({
  lat,
  lng,
  datum,
}: {
  lat?: number;
  lng?: number;
  datum?: string;
}) {
  const zustand = useWetter(lat, lng, datum);

  if (lat == null || lng == null || !datum) return null;
  if (zustand.status === "laedt" || zustand.status === "idle") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
        <Cloud className="size-3.5 animate-pulse" />
        Wetter…
      </span>
    );
  }
  if (!zustand.antwort.verfuegbar) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
        <CloudFog className="size-3.5" />
        Vorhersage n. v.
      </span>
    );
  }

  const tag = zustand.antwort.tag;
  const z = wetterZustand(tag.code);
  const b = bewerteWitterung(tag);
  return (
    <span
      title={`${z.label} · ${b.titel}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        STUFE_STYLE[b.stufe]
      )}
    >
      <IconFuer icon={z.icon} className="size-3.5" />
      {Math.round(tag.tMax)}° · {Math.round(tag.regenWk)} %
    </span>
  );
}
