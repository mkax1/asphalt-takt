"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LocationMap = dynamic(() => import("@/components/location-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
      Karte wird geladen…
    </div>
  ),
});

export interface StandortWert {
  adresse: string;
  breitengrad: number;
  laengengrad: number;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

function formatAdresse(
  addr: NominatimAddress | undefined,
  fallback: string
): string {
  if (!addr) return fallback;
  const ort = addr.city || addr.town || addr.village || addr.municipality || "";
  const strasse = [addr.road, addr.house_number].filter(Boolean).join(" ");
  const plzOrt = [addr.postcode, ort].filter(Boolean).join(" ");
  const teile = [strasse, plzOrt].filter(Boolean);
  return teile.length > 0 ? teile.join(", ") : fallback;
}

export function StandortAuswahl({
  wert,
  onChange,
  label = "Adresse / Standort",
}: {
  wert: StandortWert;
  onChange: (w: StandortWert) => void;
  label?: string;
}) {
  const [suchend, setSuchend] = useState(false);
  const [reverseLaeuft, setReverseLaeuft] = useState(false);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  async function reverseGeocode(la: number, ln: number) {
    setReverseLaeuft(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${la}&lon=${ln}`,
        { headers: { "Accept-Language": "de" } }
      );
      const data = await res.json();
      if (data && (data.address || data.display_name)) {
        onChange({
          adresse: formatAdresse(data.address, data.display_name ?? wert.adresse),
          breitengrad: la,
          laengengrad: ln,
        });
      }
    } catch {
      toast.error("Adresse konnte nicht ermittelt werden.");
    } finally {
      setReverseLaeuft(false);
    }
  }

  function handlePick(la: number, ln: number) {
    onChange({ ...wert, breitengrad: la, laengengrad: ln });
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => reverseGeocode(la, ln), 700);
  }

  async function adresseSuchen() {
    if (!wert.adresse.trim()) {
      toast.error("Bitte zuerst eine Adresse eingeben.");
      return;
    }
    setSuchend(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
          wert.adresse
        )}`,
        { headers: { "Accept-Language": "de" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        onChange({
          adresse: data[0].address
            ? formatAdresse(data[0].address, wert.adresse)
            : wert.adresse,
          breitengrad: parseFloat(data[0].lat),
          laengengrad: parseFloat(data[0].lon),
        });
        toast.success("Standort gefunden.");
      } else {
        toast.error("Keine Koordinaten gefunden.");
      }
    } catch {
      toast.error("Adresssuche fehlgeschlagen.");
    } finally {
      setSuchend(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Input
            value={wert.adresse}
            onChange={(e) => onChange({ ...wert, adresse: e.target.value })}
            placeholder="Straße, PLZ Ort"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adresseSuchen();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={adresseSuchen}
            disabled={suchend}
          >
            {suchend ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Adresse suchen
          </Button>
        </div>
      </div>

      <div className="relative">
        <LocationMap
          lat={wert.breitengrad}
          lng={wert.laengengrad}
          onPick={handlePick}
        />
        {reverseLaeuft && (
          <div className="absolute right-3 top-3 z-[1000] flex items-center gap-2 rounded-md bg-background/90 px-2.5 py-1.5 text-xs shadow-sm">
            <Loader2 className="size-3.5 animate-spin" />
            Adresse wird ermittelt…
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          Pinnadel ziehen oder Karte anklicken setzt die Adresse automatisch.
        </p>
        <span className="shrink-0 tabular-nums">
          {wert.breitengrad.toFixed(5)}, {wert.laengengrad.toFixed(5)}
        </span>
      </div>
    </div>
  );
}
