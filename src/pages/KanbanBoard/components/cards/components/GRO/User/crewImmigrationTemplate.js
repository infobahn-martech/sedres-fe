/**
 * Crew Immigration pass templates (template_type "Crew Immigration") ship their
 * `more_description` as rich HTML with `{placeholder}` tokens. Tokens inside a table row
 * mark that row as the per-crew repeating row; every other token is a single form field.
 * These helpers make the form and preview fully driven by whatever tokens a template uses.
 */

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

const uniq = (list) => Array.from(new Set(list));

const tokensIn = (text) => uniq(Array.from(String(text ?? "").matchAll(PLACEHOLDER_RE), (m) => m[1]));

/** "last_port_country" -> "Last Port Country"; a trailing "_ar" becomes " (Arabic)". */
export const humanizePlaceholder = (key) => {
  const isArabic = /_ar$/.test(key);
  const base = String(key)
    .replace(/_ar$/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
  return isArabic ? `${base} (Arabic)` : base;
};

/**
 * Normalizes templates_by_port for "Crew Immigration": the API returns an object keyed by
 * template variant ({ entry: {...}, return: {...} }), but a plain list is accepted too.
 */
export const parseCrewImmigrationTemplates = (res) => {
  const data = res?.data?.data ?? res?.data ?? null;
  if (!data) return [];
  const entries = Array.isArray(data)
    ? data.map((t, i) => [String(t?.pass_vesselreg_template_id ?? i), t])
    : Object.entries(data);
  return entries
    .filter(([, t]) => t && typeof t === "object" && t.more_description)
    .map(([key, t]) => ({ key, template: t }));
};

/** Splits a template's tokens into single fields and the per-crew repeating-row tokens. */
export const extractCrewImmigrationPlaceholders = (html) => {
  if (!html) return { fieldKeys: [], crewKeys: [] };
  const crewKeys = [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("tr").forEach((tr) => {
      crewKeys.push(...tokensIn(tr.innerHTML));
    });
  }
  const crewSet = new Set(crewKeys);
  return {
    fieldKeys: tokensIn(html).filter((k) => !crewSet.has(k)),
    crewKeys: uniq(crewKeys),
  };
};

const normalizeText = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isUnfilledToken = (value) => /^\{[a-zA-Z0-9_]+\}$/.test(value);

/**
 * Matches template text (with `{token}`s) against the text it was rendered to and returns
 * { token: value }. A token left unfilled in the rendered text, or that cannot be matched, is skipped.
 */
const matchTokens = (templateText, renderedText) => {
  const tpl = normalizeText(templateText);
  const actual = normalizeText(renderedText);
  const keys = [];
  const pattern = tpl
    .split(/(\{[a-zA-Z0-9_]+\})/)
    .map((part) => {
      const token = part.match(/^\{([a-zA-Z0-9_]+)\}$/);
      if (token) {
        keys.push(token[1]);
        return "(.*?)";
      }
      return escapeRegExp(part).replace(/ /g, "\\s*");
    })
    .join("");
  if (keys.length === 0) return {};
  const match = new RegExp(`^${pattern}$`).exec(actual);
  if (!match) return {};
  const values = {};
  keys.forEach((key, i) => {
    const value = String(match[i + 1] ?? "").trim();
    if (value && !isUnfilledToken(value) && values[key] == null) values[key] = value;
  });
  return values;
};

/**
 * Reverse of renderCrewImmigrationTemplate: reads the values a saved letter was rendered with
 * (generated_documents.batches[].entry_html / return_html) back out of it, by lining it up
 * with the template. Returns { fields: { token: value }, crewRows: [{ token: value }] }.
 * Anything that no longer lines up (e.g. the template changed since printing) is left out.
 */
export const extractCrewImmigrationValues = (templateHtml, renderedHtml) => {
  const empty = { fields: {}, crewRows: [] };
  if (!templateHtml || !renderedHtml || typeof DOMParser === "undefined") return empty;
  const parser = new DOMParser();
  const tplDoc = parser.parseFromString(templateHtml, "text/html");
  const outDoc = parser.parseFromString(renderedHtml, "text/html");
  const tplTables = Array.from(tplDoc.querySelectorAll("table"));
  const outTables = Array.from(outDoc.querySelectorAll("table"));
  const crewRows = [];

  if (tplTables.length === outTables.length) {
    tplTables.forEach((tplTable, t) => {
      const tplRows = Array.from(tplTable.querySelectorAll("tr"));
      const crewIndex = tplRows.findIndex((tr) => tokensIn(tr.innerHTML).length > 0);
      if (crewIndex < 0) return;
      const trailing = tplRows.length - crewIndex - 1;
      const outRows = Array.from(outTables[t].querySelectorAll("tr"));
      const renderedCrewRows = outRows.slice(crewIndex, outRows.length - trailing);
      const tplCells = Array.from(tplRows[crewIndex].children);
      renderedCrewRows.forEach((tr) => {
        const cells = Array.from(tr.children);
        const row = {};
        tplCells.forEach((cell, c) => {
          Object.assign(row, matchTokens(cell.textContent, cells[c]?.textContent));
        });
        crewRows.push(row);
        tr.remove();
      });
      tplRows[crewIndex].remove();
    });
  }

  return { fields: matchTokens(tplDoc.body.textContent, outDoc.body.textContent), crewRows };
};

/** True when the value has Latin letters, i.e. is worth sending to the Arabic translator. */
export const needsArabicTranslation = (value) => /[A-Za-z]/.test(String(value ?? ""));

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fillTokens = (text, lookup) =>
  String(text).replace(PLACEHOLDER_RE, (match, key) => {
    const value = lookup(key);
    return value == null || value === "" ? match : escapeHtml(value);
  });

/**
 * Renders the template: repeats every table row containing crew tokens once per crew row,
 * then fills the remaining tokens from `fieldValues`. Unfilled tokens stay visible.
 */
export const renderCrewImmigrationTemplate = (html, fieldValues = {}, crewRows = []) => {
  if (!html) return "";
  let out = html;

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("tr").forEach((tr) => {
      if (tokensIn(tr.innerHTML).length === 0) return;
      const rowTemplate = tr.outerHTML;
      const rendered = crewRows
        .map((row) => fillTokens(rowTemplate, (key) => row?.[key]))
        .join("");
      const holder = doc.createElement("tbody");
      holder.innerHTML = rendered;
      tr.replaceWith(...Array.from(holder.children));
    });
    out = doc.body.innerHTML;
  }

  return fillTokens(out, (key) => fieldValues?.[key]);
};
