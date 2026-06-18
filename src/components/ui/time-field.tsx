"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function normalisiere(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Uhrzeit-Eingabefeld im 24-Stunden-Format (HH:MM), unabhängig von der
 * Browser-Locale. Über das Uhr-Symbol lässt sich der native Picker öffnen.
 */
export function TimeField({
  value,
  onChange,
  id,
  className,
  disabled,
  placeholder = "HH:MM",
}: {
  value: string;
  onChange: (zeit: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const nativeRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState(value);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Anzeige mit externem Wert synchronisieren
    setText(value);
  }, [value]);

  function handleText(e: React.ChangeEvent<HTMLInputElement>) {
    const roh = e.target.value;
    setText(roh);
    const norm = normalisiere(roh);
    if (norm) onChange(norm);
  }

  function handleBlur() {
    const norm = normalisiere(text);
    if (norm) {
      onChange(norm);
      setText(norm);
    } else {
      setText(value);
    }
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }

  return (
    <div
      className={cn(
        "relative flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm",
        disabled && "pointer-events-none cursor-not-allowed bg-input/50 opacity-50",
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
        aria-label="Uhrzeit wählen"
        onClick={openPicker}
        disabled={disabled}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Clock className="size-4" />
      </button>
      <input
        ref={nativeRef}
        type="time"
        tabIndex={-1}
        aria-hidden
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-y-0 right-0 w-8 cursor-pointer opacity-0"
      />
    </div>
  );
}
