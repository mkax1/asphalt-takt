export type Rolle = "bauleiter" | "disposition" | "admin";

export type AnforderungStatus =
  | "neu_erfasst"
  | "in_pruefung"
  | "planung_vervollstaendigt"
  | "in_bearbeitung"
  | "abgeschlossen";

export type Prioritaet = "niedrig" | "mittel" | "hoch";

export type MaterialKategorie = "tragschicht" | "binderschicht" | "deckschicht";

export interface Mischanlage {
  adresse: string;
  breitengrad: number;
  laengengrad: number;
  /** Produktionsleistung der Anlage in Tonnen pro Stunde. */
  produktionsleistung: number;
}

export interface Benutzer {
  id: string;
  name: string;
  email: string;
  rolle: Rolle;
  firma?: string;
}

export interface Baustelle {
  id: string;
  ordner_nr?: string;
  baustellennummer: string;
  name: string;
  adresse: string;
  ansprechpartner?: string;
  hinweis?: string;
  status: "aktiv" | "inaktiv";
}

export interface Materialart {
  id: string;
  material_nr: string;
  bezeichnung: string;
  kategorie: MaterialKategorie;
  standard_lkw: number;
  standard_taktung_min: number;
}

export interface Kolonne {
  id: string;
  name: string;
  farbe: string;
  aktiv: boolean;
}

export interface MaterialPosition {
  id: string;
  material_id: string;
  flaechen_bezeichnung?: string;
  flaeche_m2: number;
  schichtdicke_cm: number;
  kg_pro_m2: number;
  tonnage: number;
  einbautag?: string;
}

export interface Anforderung {
  id: string;
  baustelle_id: string;
  kostenstelle: string;
  ansprechpartner?: string;
  adresse: string;
  breitengrad?: number;
  laengengrad?: number;
  wunschtermin: string;
  prioritaet: Prioritaet;
  zeitraum_von?: string;
  zeitraum_bis?: string;
  dauer_std?: number;
  status: AnforderungStatus;
  notiz?: string;
  fahrbahnbreite_min?: number;
  fahrbahnbreite_max?: number;
  schieber_anzahl?: number;
  schieber_typ?: string;
  schaechte_anzahl?: number;
  schaechte_typ?: string;
  eingespannt?: boolean;
  schneiden_vergiessen?: boolean;
  verkehrsbesonderheit?: boolean;
  tok_band?: boolean;
  erfasst_von: string;
  erstellt_am: string;
  materialien: MaterialPosition[];
}

export interface Einsatz {
  id: string;
  kolonne_id: string;
  anforderung_id: string;
  datum: string;
  startzeit: string;
  dauer_std: number;
  status: AnforderungStatus;
}
