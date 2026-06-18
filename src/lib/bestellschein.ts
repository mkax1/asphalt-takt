import type { Anforderung, Baustelle } from "./types";
import { formatDatum, formatTonnage, formatZahl } from "./calc";
import { PRIORITAET_LABEL, STATUS_LABEL } from "./status";

const BLAU = "#005A9A";
const GELB = "#E8E000";
const GRAU = "#2C2C2C";

function esc(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jaNein(v?: boolean): string {
  return v ? "Ja" : "Nein";
}

interface Params {
  anforderung: Anforderung;
  baustelle?: Baustelle;
  materialName: (id: string) => string;
  erfasserName?: string;
  logoUrl: string;
}

export function bestellscheinHtml({
  anforderung: a,
  baustelle,
  materialName,
  erfasserName,
  logoUrl,
}: Params): string {
  const gesamtTonnage = a.materialien.reduce((s, m) => s + m.tonnage, 0);

  const einbautage = Array.from(
    new Set(a.materialien.map((m) => m.einbautag).filter(Boolean))
  )
    .map((d) => formatDatum(d as string))
    .join(", ");

  const materialRows = a.materialien
    .map(
      (m) => `
      <tr>
        <td>${esc(materialName(m.material_id))}${
        m.flaechen_bezeichnung
          ? `<span class="sub"> · ${esc(m.flaechen_bezeichnung)}</span>`
          : ""
      }</td>
        <td class="num">${formatZahl(m.flaeche_m2)} m²</td>
        <td class="num">${formatZahl(m.schichtdicke_cm)} cm</td>
        <td class="num">${formatZahl(m.kg_pro_m2)}</td>
        <td class="num strong">${formatTonnage(m.tonnage)}</td>
      </tr>`
    )
    .join("");

  const hinweise: [string, string][] = [];
  if (a.fahrbahnbreite_min || a.fahrbahnbreite_max)
    hinweise.push([
      "Fahrbahnbreite",
      `${a.fahrbahnbreite_min ?? "?"} – ${a.fahrbahnbreite_max ?? "?"} m`,
    ]);
  if (a.schieber_anzahl)
    hinweise.push([
      "Schieber",
      `${a.schieber_anzahl}${a.schieber_typ ? ` (${a.schieber_typ})` : ""}`,
    ]);
  if (a.schaechte_anzahl)
    hinweise.push([
      "Schächte",
      `${a.schaechte_anzahl}${a.schaechte_typ ? ` (${a.schaechte_typ})` : ""}`,
    ]);
  hinweise.push(["Eingespannt", jaNein(a.eingespannt)]);
  hinweise.push(["Schneiden und vergießen", jaNein(a.schneiden_vergiessen)]);
  hinweise.push(["Verkehrsbesonderheit", jaNein(a.verkehrsbesonderheit)]);
  hinweise.push(["TOK-Band", jaNein(a.tok_band)]);

  const hinweiseHtml = hinweise
    .map(
      ([k, v]) =>
        `<div class="hinweis"><span class="hk">${esc(k)}</span><span class="hv">${esc(
          v
        )}</span></div>`
    )
    .join("");

  const jetzt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const zeitraum =
    a.zeitraum_von || a.zeitraum_bis
      ? `${formatDatum(a.zeitraum_von)} – ${formatDatum(a.zeitraum_bis)}`
      : "–";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Bestellschein – ${esc(baustelle?.name ?? "Anforderung")}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, "Liberation Sans", sans-serif;
    color: ${GRAU};
    font-size: 12px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 760px; margin: 0 auto; padding: 28px 32px; }

  header { display: flex; align-items: center; gap: 18px; }
  header img { width: 64px; height: 64px; border-radius: 8px; }
  .head-text { flex: 1; }
  .firma { font-size: 16px; font-weight: bold; color: ${BLAU}; letter-spacing: .2px; }
  .doc-title { font-size: 22px; font-weight: bold; margin-top: 2px; }
  .head-meta { text-align: right; font-size: 11px; color: #555; }

  .rule { height: 4px; background: ${BLAU}; border-radius: 2px; margin: 14px 0 2px; }
  .rule-accent { height: 3px; width: 90px; background: ${GELB}; border-radius: 2px; margin-bottom: 18px; }

  h2 {
    font-size: 12px; text-transform: uppercase; letter-spacing: .6px;
    color: ${BLAU}; margin: 22px 0 8px; padding-left: 8px;
    border-left: 4px solid ${GELB};
  }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .field { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid #eee; }
  .field .k { color: #666; }
  .field .v { font-weight: bold; text-align: right; }

  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  thead th {
    background: ${BLAU}; color: #fff; font-size: 11px; text-align: left;
    padding: 7px 8px; font-weight: bold;
  }
  thead th.num { text-align: right; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #e6e6e6; vertical-align: top; }
  tbody td.num { text-align: right; white-space: nowrap; }
  tbody td.strong { font-weight: bold; color: ${BLAU}; }
  .sub { color: #888; font-weight: normal; }
  tfoot td { padding: 9px 8px; font-weight: bold; border-top: 2px solid ${BLAU}; }
  tfoot td.num { text-align: right; color: ${BLAU}; font-size: 14px; }

  .hinweise { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .hinweis { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee; }
  .hk { color: #666; }
  .hv { font-weight: bold; }

  .notiz { margin-top: 10px; padding: 10px 12px; background: #f5f7f9; border-left: 3px solid ${BLAU}; border-radius: 4px; }

  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #777; display: flex; justify-content: space-between; }

  .toolbar { text-align: center; margin: 16px 0 4px; }
  .toolbar button { background: ${BLAU}; color: #fff; border: 0; padding: 9px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
  @media print { .toolbar { display: none; } .page { padding: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <div class="page">
    <header>
      <img id="logo" src="${esc(logoUrl)}" alt="Josef Hebel" />
      <div class="head-text">
        <div class="firma">Josef Hebel Bauunternehmung</div>
        <div class="doc-title">Mischgut-Bestellschein</div>
      </div>
      <div class="head-meta">
        Priorität: <strong>${esc(PRIORITAET_LABEL[a.prioritaet])}</strong><br />
        Status: ${esc(STATUS_LABEL[a.status])}
      </div>
    </header>

    <div class="rule"></div>
    <div class="rule-accent"></div>

    <h2>Baustelle</h2>
    <div class="grid">
      <div class="field"><span class="k">Name</span><span class="v">${esc(
        baustelle?.name ?? "–"
      )}</span></div>
      <div class="field"><span class="k">Baustellen-Nr.</span><span class="v">${esc(
        baustelle?.baustellennummer ?? "–"
      )}</span></div>
      <div class="field"><span class="k">Adresse</span><span class="v">${esc(
        a.adresse
      )}</span></div>
      <div class="field"><span class="k">Ansprechpartner</span><span class="v">${esc(
        a.ansprechpartner ?? "–"
      )}</span></div>
      <div class="field"><span class="k">Kostenstelle</span><span class="v">${esc(
        a.kostenstelle ?? "–"
      )}</span></div>
      <div class="field"><span class="k">Ordner-Nr.</span><span class="v">${esc(
        baustelle?.ordner_nr ?? "–"
      )}</span></div>
    </div>

    <h2>Termine</h2>
    <div class="grid">
      <div class="field"><span class="k">Wunschtermin</span><span class="v">${formatDatum(
        a.wunschtermin
      )}</span></div>
      <div class="field"><span class="k">Zeitraum</span><span class="v">${zeitraum}</span></div>
      <div class="field"><span class="k">Geplanter Einbautag</span><span class="v">${
        einbautage || "–"
      }</span></div>
      <div class="field"><span class="k">Geschätzte Dauer</span><span class="v">${
        a.dauer_std ? `${a.dauer_std} Std.` : "–"
      }</span></div>
    </div>

    <h2>Material &amp; Mengen</h2>
    <table>
      <thead>
        <tr>
          <th>Sorte / Fläche</th>
          <th class="num">Fläche</th>
          <th class="num">Schichtdicke</th>
          <th class="num">kg/m²</th>
          <th class="num">Tonnage</th>
        </tr>
      </thead>
      <tbody>
        ${materialRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4">Gesamttonnage</td>
          <td class="num">${formatTonnage(gesamtTonnage)}</td>
        </tr>
      </tfoot>
    </table>

    <h2>Einbau &amp; Hinweise</h2>
    <div class="hinweise">
      ${hinweiseHtml}
    </div>
    ${
      a.notiz
        ? `<div class="notiz"><strong>Notiz:</strong> ${esc(a.notiz)}</div>`
        : ""
    }

    <footer>
      <span>Erstellt am ${esc(jetzt)}${
    erfasserName ? ` · Erfasst von ${esc(erfasserName)}` : ""
  }</span>
      <span>Josef Hebel Bauunternehmung · Asphalt-Takt</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Druckt den Bestellschein über einen unsichtbaren iframe – funktioniert auch
 * dann, wenn der Browser Pop-up-Fenster blockiert. Der Nutzer wählt im
 * Druckdialog "Als PDF speichern".
 */
export function bestellscheinDrucken(params: Params): boolean {
  const html = bestellscheinHtml(params);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const cw = iframe.contentWindow;
  const doc = cw?.document;
  if (!cw || !doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let gedruckt = false;
  const drucken = () => {
    if (gedruckt) return;
    gedruckt = true;
    try {
      cw.focus();
      cw.print();
    } catch {
      // ignore
    }
  };

  const entfernen = () => {
    if (document.body.contains(iframe)) iframe.remove();
  };

  cw.onafterprint = () => setTimeout(entfernen, 300);

  const img = doc.getElementById("logo") as HTMLImageElement | null;
  if (img && !img.complete) {
    img.addEventListener("load", drucken);
    img.addEventListener("error", drucken);
    // Fallback, falls das Bild-Event ausbleibt
    setTimeout(drucken, 1500);
  } else {
    setTimeout(drucken, 300);
  }

  // Sicherheitsnetz: iframe nach 2 Minuten aufräumen
  setTimeout(entfernen, 120000);

  return true;
}
