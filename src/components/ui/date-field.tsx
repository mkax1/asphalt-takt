"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  fmtMonatJahr,
  heuteIso,
  isoDate,
  isoZuDeutsch,
  deutschZuIso,
  parseIso,
  startDerWoche,
  startDesMonats,
} from "@/lib/datum";

/** Wochentage – beginnend mit Montag (deutsche/europäische Konvention). */
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Datums-Eingabefeld mit garantiert deutschem Format (TT.MM.JJJJ) und einem
 * eigenen Kalender, dessen Woche immer mit Montag beginnt – unabhängig von der
 * Browser-Locale. Der Wert wird als ISO-String "YYYY-MM-DD" gespeichert.
 */
export function DateField({
  value,
  onChange,
  id,
  className,
  disabled,
  min,
  max,
  placeholder = "TT.MM.JJJJ",
}: {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const [text, setText] = React.useState(() => isoZuDeutsch(value));
  const [offen, setOffen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null
  );
  const [viewMonat, setViewMonat] = React.useState<Date>(() =>
    startDesMonats(value ? parseIso(value) : new Date())
  );

  // Anzeige mit externem Wert synchronisieren.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Anzeige mit externem Wert abgleichen
    setText(isoZuDeutsch(value));
  }, [value]);

  const position = React.useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const breite = 256;
    let left = r.left;
    if (left + breite > window.innerWidth - 8)
      left = window.innerWidth - breite - 8;
    setPos({ top: r.bottom + 4, left: Math.max(8, left) });
  }, []);

  function oeffnen() {
    if (disabled) return;
    setViewMonat(startDesMonats(value ? parseIso(value) : new Date()));
    position();
    setOffen(true);
  }

  // Schließen bei Klick außerhalb, Escape, Scroll oder Größenänderung.
  React.useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        wrapperRef.current?.contains(t) ||
        popupRef.current?.contains(t)
      )
        return;
      setOffen(false);
    }
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    function aufScroll() {
      position();
    }
    document.addEventListener("mousedown", aufKlick);
    document.addEventListener("keydown", aufTaste);
    window.addEventListener("scroll", aufScroll, true);
    window.addEventListener("resize", aufScroll);
    return () => {
      document.removeEventListener("mousedown", aufKlick);
      document.removeEventListener("keydown", aufTaste);
      window.removeEventListener("scroll", aufScroll, true);
      window.removeEventListener("resize", aufScroll);
    };
  }, [offen, position]);

  function handleText(e: React.ChangeEvent<HTMLInputElement>) {
    const roh = e.target.value;
    setText(roh);
    if (roh.trim() === "") {
      onChange("");
      return;
    }
    const iso = deutschZuIso(roh);
    if (iso) onChange(iso);
  }

  function handleBlur() {
    setText(isoZuDeutsch(value));
  }

  function waehle(iso: string) {
    onChange(iso);
    setText(isoZuDeutsch(iso));
    setOffen(false);
  }

  const gitterStart = startDerWoche(startDesMonats(viewMonat));
  const tage = Array.from({ length: 42 }, (_, i) => addDays(gitterStart, i));
  const heute = heuteIso();
  const ausserhalb = (iso: string) =>
    (min && iso < min) || (max && iso > max) || false;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm",
        disabled &&
          "pointer-events-none cursor-not-allowed bg-input/50 opacity-50",
        className
      )}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={handleText}
        onBlur={handleBlur}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Kalender öffnen"
        onClick={oeffnen}
        disabled={disabled}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <CalendarDays className="size-4" />
      </button>

      {offen &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popupRef}
            style={{ top: pos.top, left: pos.left, width: 256 }}
            className="fixed z-[100] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Voriger Monat"
                onClick={() => setViewMonat((m) => addMonths(m, -1))}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-medium capitalize">
                {fmtMonatJahr(viewMonat)}
              </span>
              <button
                type="button"
                aria-label="Nächster Monat"
                onClick={() => setViewMonat((m) => addMonths(m, 1))}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
              {WOCHENTAGE.map((t) => (
                <div key={t} className="py-1">
                  {t}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {tage.map((tag) => {
                const iso = isoDate(tag);
                const imMonat = tag.getMonth() === viewMonat.getMonth();
                const istHeute = iso === heute;
                const istGewaehlt = iso === value;
                const deaktiviert = ausserhalb(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={deaktiviert}
                    onClick={() => waehle(iso)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                      !imMonat && "text-muted-foreground/40",
                      !istGewaehlt && !deaktiviert && "hover:bg-muted",
                      istHeute &&
                        !istGewaehlt &&
                        "font-semibold text-primary ring-1 ring-primary/40",
                      istGewaehlt &&
                        "bg-primary font-semibold text-primary-foreground",
                      deaktiviert && "cursor-not-allowed opacity-30"
                    )}
                  >
                    {tag.getDate()}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
