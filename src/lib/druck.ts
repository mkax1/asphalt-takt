/**
 * Allgemeine Druck-/PDF-Hilfe im Josef-Hebel-CI.
 *
 * `dokumentDrucken` rendert eine HTML-Seite (Kopf mit Logo, Titel, beliebiger
 * Inhalt, Fußzeile) in einen unsichtbaren iframe und öffnet den Druckdialog.
 * Dort kann der Nutzer "Als PDF speichern" wählen. Funktioniert auch, wenn
 * Pop-up-Fenster blockiert sind.
 */

const BLAU = "#005A9A";
const GELB = "#E8E000";
const GRAU = "#2C2C2C";

export function escHtml(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface DokumentParams {
  titel: string;
  untertitel?: string;
  /** Fertiges HTML für den Inhaltsbereich. */
  bodyHtml: string;
  logoUrl: string;
}

export function dokumentHtml({
  titel,
  untertitel,
  bodyHtml,
  logoUrl,
}: DokumentParams): string {
  const jetzt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escHtml(titel)}</title>
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
  .page { max-width: 900px; margin: 0 auto; padding: 28px 32px; }

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

  .kpis { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 6px 0 4px; }
  .kpi .label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #777; }
  .kpi .value { font-size: 18px; font-weight: bold; color: ${BLAU}; }

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

  .hinweis { margin-top: 16px; padding: 10px 12px; background: #f5f7f9; border-left: 3px solid ${BLAU}; border-radius: 4px; font-size: 11px; color: #555; }

  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #777; display: flex; justify-content: space-between; }

  @media print { .page { padding: 0; } @page { margin: 14mm; } }
</style>
</head>
<body>
  <div class="page">
    <header>
      <img id="logo" src="${escHtml(logoUrl)}" alt="Josef Hebel" />
      <div class="head-text">
        <div class="firma">Josef Hebel Bauunternehmung</div>
        <div class="doc-title">${escHtml(titel)}</div>
      </div>
      <div class="head-meta">
        ${untertitel ? `<strong>${escHtml(untertitel)}</strong><br />` : ""}
        Gedruckt am ${escHtml(jetzt)}
      </div>
    </header>

    <div class="rule"></div>
    <div class="rule-accent"></div>

    ${bodyHtml}

    <footer>
      <span>Asphalt-Takt</span>
      <span>Josef Hebel Bauunternehmung</span>
    </footer>
  </div>
</body>
</html>`;
}

export function dokumentDrucken(params: DokumentParams): boolean {
  const html = dokumentHtml(params);

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
    setTimeout(drucken, 1500);
  } else {
    setTimeout(drucken, 300);
  }

  setTimeout(entfernen, 120000);

  return true;
}
