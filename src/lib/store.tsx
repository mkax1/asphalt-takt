"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
}

const SEED: DataState = {
  benutzer: SEED_BENUTZER,
  baustellen: SEED_BAUSTELLEN,
  materialarten: SEED_MATERIAL,
  kolonnen: SEED_KOLONNEN,
  anforderungen: SEED_ANFORDERUNGEN,
  einsaetze: SEED_EINSAETZE,
};

const DATA_KEY = "asphalt-takt-data-v1";
const USER_KEY = "asphalt-takt-user-v1";

interface StoreContextType extends DataState {
  currentUser: Benutzer;
  setCurrentUserId: (id: string) => void;
  addAnforderung: (a: Omit<Anforderung, "id" | "erstellt_am">) => Anforderung;
  updateAnforderung: (id: string, patch: Partial<Anforderung>) => void;
  setAnforderungStatus: (id: string, status: AnforderungStatus) => void;
  addBaustelle: (b: Omit<Baustelle, "id">) => void;
  updateBaustelle: (id: string, patch: Partial<Baustelle>) => void;
  addMaterialart: (m: Omit<Materialart, "id">) => void;
  updateMaterialart: (id: string, patch: Partial<Materialart>) => void;
  addKolonne: (k: Omit<Kolonne, "id">) => void;
  updateKolonne: (id: string, patch: Partial<Kolonne>) => void;
  addEinsatz: (e: Omit<Einsatz, "id">) => void;
  deleteEinsatz: (id: string) => void;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DATA_KEY);
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
      const neu: Anforderung = {
        ...a,
        id: uid(),
        erstellt_am: new Date().toISOString(),
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
      setData((d) => ({
        ...d,
        anforderungen: d.anforderungen.map((a) =>
          a.id === id ? { ...a, status } : a
        ),
      }));
    },
    []
  );

  const addBaustelle = useCallback((b: Omit<Baustelle, "id">) => {
    setData((d) => ({
      ...d,
      baustellen: [{ ...b, id: uid() }, ...d.baustellen],
    }));
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

  const deleteEinsatz = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      einsaetze: d.einsaetze.filter((e) => e.id !== id),
    }));
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
      addBaustelle,
      updateBaustelle,
      addMaterialart,
      updateMaterialart,
      addKolonne,
      updateKolonne,
      addEinsatz,
      deleteEinsatz,
      resetDaten,
    }),
    [
      data,
      currentUser,
      setCurrentUserId,
      addAnforderung,
      updateAnforderung,
      setAnforderungStatus,
      addBaustelle,
      updateBaustelle,
      addMaterialart,
      updateMaterialart,
      addKolonne,
      updateKolonne,
      addEinsatz,
      deleteEinsatz,
      resetDaten,
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
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
