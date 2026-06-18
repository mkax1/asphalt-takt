"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Anforderung,
  AnforderungStatus,
  Baustelle,
  Benutzer,
  Einsatz,
  Kolonne,
  Materialart,
  Mischanlage,
  Betrieb,
} from "./types";
import {
  SEED_ANFORDERUNGEN,
  SEED_BAUSTELLEN,
  SEED_BENUTZER,
  SEED_EINSAETZE,
  SEED_KOLONNEN,
  SEED_MATERIAL,
} from "./seed";

interface DataState {
  benutzer: Benutzer[];
  baustellen: Baustelle[];
  materialarten: Materialart[];
  kolonnen: Kolonne[];
  anforderungen: Anforderung[];
  einsaetze: Einsatz[];
  mischanlage: Mischanlage;
  betrieb: Betrieb;
}

const SEED_MISCHANLAGE: Mischanlage = {
  adresse: "Ewigkeit 27, 88299 Leutkirch im Allgäu-Tautenhofen",
  breitengrad: 47.8573,
  laengengrad: 9.9967,
  produktionsleistung: 160,
};

const SEED_BETRIEB: Betrieb = {
  fuhrparkLkw: 5,
  sortenwechselRuestzeitMin: 30,
};

const SEED: DataState = {
  benutzer: SEED_BENUTZER,
  baustellen: SEED_BAUSTELLEN,
  materialarten: SEED_MATERIAL,
  kolonnen: SEED_KOLONNEN,
  anforderungen: SEED_ANFORDERUNGEN,
  einsaetze: SEED_EINSAETZE,
  mischanlage: SEED_MISCHANLAGE,
  betrieb: SEED_BETRIEB,
};

const DATA_KEY = "asphalt-takt-data-v1";
const USER_KEY = "asphalt-takt-user-v1";

interface StoreContextType extends DataState {
  currentUser: Benutzer;
  setCurrentUserId: (id: string) => void;
  addAnforderung: (a: Omit<Anforderung, "id" | "erstellt_am">) => Anforderung;
  updateAnforderung: (id: string, patch: Partial<Anforderung>) => void;
  setAnforderungStatus: (id: string, status: AnforderungStatus) => void;
  deleteAnforderung: (id: string) => void;
  addBaustelle: (b: Omit<Baustelle, "id">) => Baustelle;
  updateBaustelle: (id: string, patch: Partial<Baustelle>) => void;
  addMaterialart: (m: Omit<Materialart, "id">) => void;
  updateMaterialart: (id: string, patch: Partial<Materialart>) => void;
  addKolonne: (k: Omit<Kolonne, "id">) => void;
  updateKolonne: (id: string, patch: Partial<Kolonne>) => void;
  addEinsatz: (e: Omit<Einsatz, "id">) => void;
  updateEinsatz: (id: string, patch: Partial<Einsatz>) => void;
  deleteEinsatz: (id: string) => void;
  setMischanlage: (m: Mischanlage) => void;
  setBetrieb: (b: Betrieb) => void;
  resetDaten: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataState>(SEED);
  const [currentUserId, setCurrentUserIdState] = useState<string>("u1");
  const [hydrated, setHydrated] = useState(false);

  // Aktuelle Benutzer-ID als Ref, damit Callbacks ohne erneutes Anlegen
  // immer den neuesten Wert kennen (z. B. fürs Status-Protokoll).
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten erst nach Hydration aus localStorage laden
      if (raw) setData({ ...SEED, ...JSON.parse(raw) });
      const u = localStorage.getItem(USER_KEY);
      if (u) setCurrentUserIdState(u);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(USER_KEY, currentUserId);
    } catch {
      // ignore
    }
  }, [currentUserId, hydrated]);

  const setCurrentUserId = useCallback((id: string) => {
    setCurrentUserIdState(id);
  }, []);

  const addAnforderung = useCallback(
    (a: Omit<Anforderung, "id" | "erstellt_am">) => {
      const jetzt = new Date().toISOString();
      const neu: Anforderung = {
        ...a,
        id: uid(),
        erstellt_am: jetzt,
        statusverlauf: [
          { status: a.status, am: jetzt, von: currentUserIdRef.current },
        ],
      };
      setData((d) => ({ ...d, anforderungen: [neu, ...d.anforderungen] }));
      return neu;
    },
    []
  );

  const updateAnforderung = useCallback(
    (id: string, patch: Partial<Anforderung>) => {
      setData((d) => ({
        ...d,
        anforderungen: d.anforderungen.map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      }));
    },
    []
  );

  const setAnforderungStatus = useCallback(
    (id: string, status: AnforderungStatus) => {
      const eintrag = {
        status,
        am: new Date().toISOString(),
        von: currentUserIdRef.current,
      };
      setData((d) => ({
        ...d,
        anforderungen: d.anforderungen.map((a) =>
          a.id === id
            ? {
                ...a,
                status,
                statusverlauf: [...(a.statusverlauf ?? []), eintrag],
              }
            : a
        ),
      }));
    },
    []
  );

  const deleteAnforderung = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      anforderungen: d.anforderungen.filter((a) => a.id !== id),
      // zugehörige Einsätze ebenfalls entfernen
      einsaetze: d.einsaetze.filter((e) => e.anforderung_id !== id),
    }));
  }, []);

  const addBaustelle = useCallback((b: Omit<Baustelle, "id">) => {
    const neu: Baustelle = { ...b, id: uid() };
    setData((d) => ({
      ...d,
      baustellen: [neu, ...d.baustellen],
    }));
    return neu;
  }, []);

  const updateBaustelle = useCallback(
    (id: string, patch: Partial<Baustelle>) => {
      setData((d) => ({
        ...d,
        baustellen: d.baustellen.map((b) =>
          b.id === id ? { ...b, ...patch } : b
        ),
      }));
    },
    []
  );

  const addMaterialart = useCallback((m: Omit<Materialart, "id">) => {
    setData((d) => ({
      ...d,
      materialarten: [...d.materialarten, { ...m, id: uid() }],
    }));
  }, []);

  const updateMaterialart = useCallback(
    (id: string, patch: Partial<Materialart>) => {
      setData((d) => ({
        ...d,
        materialarten: d.materialarten.map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      }));
    },
    []
  );

  const addKolonne = useCallback((k: Omit<Kolonne, "id">) => {
    setData((d) => ({ ...d, kolonnen: [...d.kolonnen, { ...k, id: uid() }] }));
  }, []);

  const updateKolonne = useCallback((id: string, patch: Partial<Kolonne>) => {
    setData((d) => ({
      ...d,
      kolonnen: d.kolonnen.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    }));
  }, []);

  const addEinsatz = useCallback((e: Omit<Einsatz, "id">) => {
    setData((d) => ({ ...d, einsaetze: [...d.einsaetze, { ...e, id: uid() }] }));
  }, []);

  const updateEinsatz = useCallback((id: string, patch: Partial<Einsatz>) => {
    setData((d) => ({
      ...d,
      einsaetze: d.einsaetze.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const deleteEinsatz = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      einsaetze: d.einsaetze.filter((e) => e.id !== id),
    }));
  }, []);

  const setMischanlage = useCallback((m: Mischanlage) => {
    setData((d) => ({ ...d, mischanlage: m }));
  }, []);

  const setBetrieb = useCallback((b: Betrieb) => {
    setData((d) => ({ ...d, betrieb: b }));
  }, []);

  const resetDaten = useCallback(() => {
    setData(SEED);
  }, []);

  const currentUser =
    data.benutzer.find((b) => b.id === currentUserId) ?? data.benutzer[0];

  const value = useMemo<StoreContextType>(
    () => ({
      ...data,
      currentUser,
      setCurrentUserId,
      addAnforderung,
      updateAnforderung,
      setAnforderungStatus,
      deleteAnforderung,
      addBaustelle,
      updateBaustelle,
      addMaterialart,
      updateMaterialart,
      addKolonne,
      updateKolonne,
      addEinsatz,
      updateEinsatz,
      deleteEinsatz,
      setMischanlage,
      setBetrieb,
      resetDaten,
    }),
    [
      data,
      currentUser,
      setCurrentUserId,
      addAnforderung,
      updateAnforderung,
      setAnforderungStatus,
      deleteAnforderung,
      addBaustelle,
      updateBaustelle,
      addMaterialart,
      updateMaterialart,
      addKolonne,
      updateKolonne,
      addEinsatz,
      updateEinsatz,
      deleteEinsatz,
      setMischanlage,
      setBetrieb,
      resetDaten,
    ]
  );

  // Bis die Daten aus dem Speicher (localStorage = "Datenbank") geladen sind,
  // einen Ladezustand zeigen. So wird nie der Seed-/Ausgangsstand angezeigt und
  // anschließend überschrieben – das vermeidet das Aufblitzen alter Positionen
  // (z. B. eines gerade verschobenen Einsatzes) nach dem Neuladen.
  if (!hydrated) {
    return <DatenLadeschirm />;
  }

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

function DatenLadeschirm() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <span
          className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
        <span className="text-sm">Daten werden geladen…</span>
        <span className="sr-only">Bitte warten</span>
      </div>
    </div>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore muss innerhalb von StoreProvider sein");
  return ctx;
}

export function useBaustelle(id?: string) {
  const { baustellen } = useStore();
  return baustellen.find((b) => b.id === id);
}

export function useMaterial(id?: string) {
  const { materialarten } = useStore();
  return materialarten.find((m) => m.id === id);
}
