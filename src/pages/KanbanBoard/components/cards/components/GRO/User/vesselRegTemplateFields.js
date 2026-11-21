/**
 * Vessel Registration pass templates (pass_vesselreg_template) ship their `more_description`
 * as rich HTML from a WYSIWYG editor: a bilingual table (Arabic label | blank value cell(s) |
 * English label) followed by closing paragraphs. These helpers read that table to build an
 * editable field list, and write user-entered values back into the same blank cells for preview.
 */

const TABLE_CELL_TAGS = new Set(["TD", "TH"]);

const getRowCells = (tr) => Array.from(tr.children).filter((el) => TABLE_CELL_TAGS.has(el.tagName));

/** One field per table row: label(s) come from the outer cells, value goes in the inner cell(s). */
export function extractVesselRegTemplateFields(html) {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  return Array.from(table.querySelectorAll("tr"))
    .map((tr, index) => {
      const cells = getRowCells(tr);
      if (cells.length < 2) return null;
      const labelAr = cells[0]?.textContent?.trim() ?? "";
      const labelEn = cells.length > 2 ? cells[cells.length - 1]?.textContent?.trim() ?? "" : "";
      const displayLabel = [labelEn, labelAr].filter(Boolean).join(" / ") || `Field ${index + 1}`;
      return { fieldKey: `row-${index}`, labelAr, labelEn, displayLabel };
    })
    .filter(Boolean);
}

const normalizeLabel = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// vessel/get_vessel_by_call response key -> normalized substrings its template row's
// English label is expected to contain (template labels vary per port, so match loosely).
const VESSEL_API_FIELD_PATTERNS = [
  ["imo_number", ["imo"]],
  ["call_sign", ["callsign", "callsignal"]],
  ["vessel_name", ["shipsname", "vesselname"]],
  ["agent", ["agent"]],
  ["owner", ["owner"]],
  ["captain_name", ["captain"]],
  ["type_of_vessel", ["typeofvessel"]],
  ["flag", ["flag"]],
  ["no_of_crew", ["noofcrew", "numberofcrew"]],
  ["grt", ["grt"]],
  ["nrt", ["nrt"]],
  ["length", ["length"]],
  ["width", ["width", "beam"]],
  ["draft", ["draft", "draught"]],
  ["type_of_load", ["typeofload", "typeofcargo"]],
  ["arriving_from", ["arrivingfrom"]],
  ["dey", ["dey"]],
  ["leaving_for", ["leavingfor"]],
  ["date_of_sailing", ["dateofsailing"]],
  ["purpose_of_dep", ["purposeofdep", "purposeofdeparture"]],
];

/** Matches a template field's English label to its vessel/get_vessel_by_call response key. */
export function matchVesselApiFieldKey(labelEn) {
  const normalized = normalizeLabel(labelEn);
  if (!normalized) return null;
  const match = VESSEL_API_FIELD_PATTERNS.find(([, patterns]) =>
    patterns.some((pattern) => normalized.includes(pattern))
  );
  return match ? match[0] : null;
}

/**
 * Writes fieldValues (keyed by the same `row-N` fieldKey) into the blank cell(s) of each row.
 * Row markup is [labelAr, valueCell1, valueCell2, labelEn] but rendered dir="rtl", so
 * valueCell1 (DOM order) lands in the visual column next to the Arabic label and gets the
 * Arabic translation; valueCell2 lands next to the English label and keeps the typed value.
 */
export function injectVesselRegFieldValues(html, fieldValues, translations = {}) {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");

  if (table) {
    Array.from(table.querySelectorAll("tr")).forEach((tr, index) => {
      const cells = getRowCells(tr);
      if (cells.length < 2) return;
      const fieldKey = `row-${index}`;
      const englishValue = fieldValues?.[fieldKey] ?? "";
      const arabicValue = translations?.[fieldKey] ?? "";
      const valueCells = cells.length > 2 ? cells.slice(1, cells.length - 1) : [cells[cells.length - 1]];
      // Arabic and English columns are filled independently, so typing in the Arabic
      // column reflects in the preview even when the English value is empty.
      valueCells.forEach((cell, cellIndex) => {
        let cellValue = englishValue;
        if (valueCells.length === 1) cellValue = arabicValue || englishValue;
        else if (cellIndex === 0) cellValue = arabicValue;
        if (cellValue) cell.textContent = cellValue;
      });
    });
  }

  return doc.body.innerHTML;
}
