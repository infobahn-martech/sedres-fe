// Dynamic field placeholders for report templates.
//
// Fields come from GET report_template/placeholders?report_type_id= as a flat list:
//   [{ key: "vessel_name", token: "{vessel_name}", label: "Vessel name" }, ...]
// The picker shows them in response order. If an item carries a `group` label, items are
// grouped under it; otherwise everything goes into a single "Fields" group.

// Fallback token format when the API omits `token` (e.g. "{vessel_name}").
export const toPlaceholderToken = (key) => `{${key}}`;

const DEFAULT_GROUP = "Fields";

// API response data → [{ key, label, fields: [{ key, label, token }] }].
export const normalizePlaceholderGroups = (data) => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const groups = new Map();
  const seen = new Set();
  data.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const key = String(item.key ?? "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const groupLabel = String(item.group ?? "").trim() || DEFAULT_GROUP;
    if (!groups.has(groupLabel)) groups.set(groupLabel, { key: groupLabel, label: groupLabel, fields: [] });
    groups.get(groupLabel).fields.push({
      key,
      label: String(item.label ?? "").trim() || key,
      token: String(item.token ?? "").trim() || toPlaceholderToken(key),
    });
  });
  return [...groups.values()];
};

// Case-insensitive match on field label, key or group label.
export const filterPlaceholderGroups = (groups, query) => {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return groups;
  return groups.flatMap((group) => {
    if (group.label.toLowerCase().includes(q)) return [group];
    const fields = group.fields.filter(
      (field) => field.label.toLowerCase().includes(q) || field.key.toLowerCase().includes(q)
    );
    return fields.length ? [{ ...group, fields }] : [];
  });
};
