// Dynamic field placeholders for report templates.
//
// Fields come from GET form_template/system_bindings?call_type_id= (the same structure the
// custom template builder uses): tabs in display order, each with its fields and sub_tabs.
// Nothing here knows any tab or field name — groups and fields are built from the response.

// Saved token format — unchanged from the manually typed placeholders (e.g. "{vessel_name}"),
// so existing templates keep working.
export const toPlaceholderToken = (key) => `{${key}}`;

const byDisplayOrder = (a, b) =>
  (Number(a?.display_order) || 0) - (Number(b?.display_order) || 0);

// system_bindings identifies a field by field_key (older responses used system_binding_key).
const fieldKeyOf = (field) => String(field?.field_key ?? field?.system_binding_key ?? "").trim();
const fieldLabelOf = (field) => String(field?.label ?? field?.field_label ?? "").trim();
const tabLabelOf = (tab) => String(tab?.tab_name ?? tab?.tab_label ?? tab?.tab_key ?? "").trim();
const subTabsOf = (tab) => (Array.isArray(tab?.sub_tabs) ? tab.sub_tabs : Array.isArray(tab?.subtabs) ? tab.subtabs : []);

const toGroupFields = (fields) => {
  const seen = new Set();
  return (Array.isArray(fields) ? fields : []).flatMap((field) => {
    const key = fieldKeyOf(field);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ key, label: fieldLabelOf(field) || key, token: toPlaceholderToken(key) }];
  });
};

// system_bindings response data → [{ key, label, fields: [{ key, label, token }] }].
// Sub-tabs become their own groups ("Operation › Pre Arrival"); empty groups are dropped.
export const normalizePlaceholderGroups = (data) => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const isTabbed = data.some((item) => item && ("tab_name" in item || "tab_key" in item));
  // An older flat list of bindings is the Appointment Details tab (as in the template builder).
  const tabs = isTabbed
    ? data
    : [{ tab_key: "appointment_details", tab_name: "Appointment Details", fields: data }];

  const groups = [];
  const walk = (list, parentKey, parentLabel) => {
    [...list]
      .filter((tab) => tab && typeof tab === "object")
      .sort(byDisplayOrder)
      .forEach((tab, index) => {
        const ownLabel = tabLabelOf(tab) || `Tab ${index + 1}`;
        const key = `${parentKey ? `${parentKey}/` : ""}${tab.tab_key ?? ownLabel}`;
        const label = parentLabel ? `${parentLabel} › ${ownLabel}` : ownLabel;
        const fields = toGroupFields(tab.fields);
        if (fields.length) groups.push({ key, label, fields });
        walk(subTabsOf(tab), key, label);
      });
  };
  walk(tabs, "", "");
  return groups;
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
