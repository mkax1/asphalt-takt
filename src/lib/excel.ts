/**
 * Schlanker, abhängigkeitsfreier Excel-Export.
 *
 * Erzeugt eine HTML-basierte `.xls`-Datei (Microsoft-Excel-kompatibel) mit
 * einer oder mehreren Tabellen. Zahlen werden als echte Zahlen exportiert,
 * Texte als Text. Excel öffnet die Datei direkt – ohne externe Bibliothek.
 */

export interface ExcelTabelle {
  titel: string;
  kopf: string[];
  zeilen: (string | number)[][];
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function zelle(wert: string | number): string {
  if (typeof wert === "number" && Number.isFinite(wert)) {
    return `<td style="mso-number-format:'0';" data-type="number">${wert}</td>`;
  }
  return `<td>${esc(wert)}</td>`;
}

function tabelleHtml(t: ExcelTabelle): string {
  const kopf = t.kopf.map((k) => `<th>${esc(k)}</th>`).join("");
  const zeilen = t.zeilen
    .map((row) => `<tr>${row.map(zelle).join("")}</tr>`)
    .join("");
  return `
    <table border="1" cellspacing="0" cellpadding="4">
      <tr><td colspan="${t.kopf.length}" style="font-weight:bold;background:#005A9A;color:#ffffff;">${esc(
        t.titel
      )}</td></tr>
      <tr style="font-weight:bold;background:#eef3f8;">${kopf}</tr>
      ${zeilen}
    </table>
    <br/>`;
}

export function exportExcel(
  dateiname: string,
  titel: string,
  tabellen: ExcelTabelle[]
): void {
  const inhalt = tabellen.map(tabelleHtml).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Auswertung</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
  td, th { border: 0.5pt solid #c0c0c0; padding: 4px 6px; }
  th { text-align: left; }
</style>
</head>
<body>
<h2 style="font-family:Arial,sans-serif;color:#005A9A;">${esc(titel)}</h2>
${inhalt}
</body>
</html>`;

  const blob = new Blob(["\ufeff" + html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname.endsWith(".xls") ? dateiname : `${dateiname}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
