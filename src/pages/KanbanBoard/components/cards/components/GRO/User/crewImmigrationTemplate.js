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
