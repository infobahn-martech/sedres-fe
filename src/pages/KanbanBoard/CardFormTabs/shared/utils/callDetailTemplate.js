// Helpers for the custom template returned by GET call_file/get_call_detail/{callId}
// (`data.template.tabs`): tab/subtab ordering, tab_key → existing component mapping,
// field ordering, saved-value resolution (including nested `data.time_objects`) and
// read-only display formatting.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const normalizeTemplateKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toNumberOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// Empty = null/undefined, blank string or empty array. 0 and false are real values.
export const isEmptyTemplateValue = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

// Top-level drawer tabs: template tab_key → the tab name CardForm already renders.
const TOP_TAB_BY_KEY = {
  appointment_details: "Appointment Details",
  appointment: "Appointment Details",
  general: "Appointment Details",
  export_approval: "Export Approval",
  operation: "Operation",
  operations: "Operation",
  husbandry: "Husbandry",
  sales_order: "Sales Order",
  comments: "Comments",
  subtasks: "Subtasks",
  sub_tasks: "Subtasks",
  notes: "Notes",
  reports: "Reports",
  kpi: "KPI",
  document_library: "Document Library",
  activity_log: "Activity Log",
};

// Operation subtabs: template tab_key → OPERATION_TABS id (see operationConstants.js).
const OPERATION_SUBTAB_BY_KEY = {
  pre_arrival: "preArrival",
  crew_immigration: "crewImmigration",
  arrival: "arrival",
  departure: "departure",
  check_list: "checkList",
  checklist: "checkList",
};

// Template tabs whose key has no existing component get a namespaced id so they can
// never collide with (or fall through to) another tab's content.
export const TEMPLATE_TAB_ID_PREFIX = "template:";
export const isUnmappedTemplateTabId = (id) => String(id ?? "").startsWith(TEMPLATE_TAB_ID_PREFIX);

const normalizeTab = (tab, keyMap) => {
  const key = normalizeTemplateKey(tab?.tab_key);
  const tabId = tab?.tab_id === undefined || tab?.tab_id === null ? key : String(tab.tab_id);
  const mapped = keyMap ? keyMap[key] : undefined;
  return {
    tabId,
    key,
    label: String(tab?.tab_label ?? "").trim() || key,
    displayOrder: toNumberOr(tab?.display_order, Number.MAX_SAFE_INTEGER),
    fields: Array.isArray(tab?.fields) ? tab.fields : [],
    // Subtabs are kept raw; callers normalize them with their own key map.
    rawSubtabs: Array.isArray(tab?.subtabs) ? tab.subtabs : [],
    // Stage subtabs: `email_preview` (0/1) toggles the composer; `email_template` prefills it
    // ({ report_type_id, subject, body, to_email, from_email, cc_emails }).
    emailPreview:
      tab?.email_preview === undefined || tab?.email_preview === null ? null : Number(tab.email_preview) === 1,
    emailTemplate: tab?.email_template && typeof tab.email_template === "object" ? tab.email_template : null,
    // `id` is what the drawer switches on: the existing tab name, or a namespaced template id.
    id: mapped ?? `${TEMPLATE_TAB_ID_PREFIX}${tabId}`,
    isMapped: Boolean(mapped),
  };
};

const sortTabs = (tabs) =>
  tabs
    .map((tab, index) => ({ tab, index }))
    .sort((a, b) => a.tab.displayOrder - b.tab.displayOrder || a.index - b.index)
    .map(({ tab }) => tab);

// Drops later tabs that resolve to the same id (e.g. two tab_keys mapped to one component).
const dedupeById = (tabs) => {
  const seen = new Set();
  return tabs.filter((tab) => {
    if (seen.has(tab.id)) return false;
    seen.add(tab.id);
    return true;
  });
};

export const normalizeTemplateTabs = (rawTabs, keyMap) =>
  Array.isArray(rawTabs)
    ? dedupeById(sortTabs(rawTabs.filter((tab) => tab && typeof tab === "object").map((tab) => normalizeTab(tab, keyMap))))
    : [];

// Top-level tabs from a call detail, or null when the call has no template.
export const getTemplateTopTabs = (detail) => {
  const rawTabs = detail?.template?.tabs;
  if (!Array.isArray(rawTabs)) return null;
  return normalizeTemplateTabs(rawTabs, TOP_TAB_BY_KEY);
};

export const findTemplateTabByKey = (detail, tabKey) => {
  const rawTabs = detail?.template?.tabs;
  if (!Array.isArray(rawTabs)) return null;
  const key = normalizeTemplateKey(tabKey);
  const raw = rawTabs.find((tab) => normalizeTemplateKey(tab?.tab_key) === key);
  return raw ? normalizeTab(raw, TOP_TAB_BY_KEY) : null;
};

// Operation subtabs from the template, or null when the call has no template/Operation tab.
export const getTemplateOperationSubtabs = (detail) => {
  const operationTab = findTemplateTabByKey(detail, "operation");
  if (!operationTab) return null;
  return normalizeTemplateTabs(operationTab.rawSubtabs, OPERATION_SUBTAB_BY_KEY);
};

// Fields in grid reading order: row, then column, then original order.
export const sortTemplateFields = (fields) =>
  (Array.isArray(fields) ? fields : [])
    .filter((field) => field && typeof field === "object")
    .map((field, index) => ({ field, index }))
    .sort(
      (a, b) =>
        toNumberOr(a.field.row_no, Number.MAX_SAFE_INTEGER) - toNumberOr(b.field.row_no, Number.MAX_SAFE_INTEGER) ||
        toNumberOr(a.field.col_no, Number.MAX_SAFE_INTEGER) - toNumberOr(b.field.col_no, Number.MAX_SAFE_INTEGER) ||
        a.index - b.index
    )
    .map(({ field }) => field);

// `data.time_objects` arrives as nested arrays with exact duplicates — flatten and dedupe.
export const flattenTimeObjects = (detail) => {
  const source = detail?.time_objects;
  if (!Array.isArray(source)) return [];
  const flat = source.flat(Infinity);
  const seen = new Set();
  const rows = [];
  flat.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const id = item.time_object_id === undefined || item.time_object_id === null ? "" : String(item.time_object_id).trim();
    const label = String(item.time_object ?? "").trim();
    const value = item.value ?? item.time_object_value ?? item.event_datetime ?? null;
    const dedupeKey = `${id}|${label}|${value ?? ""}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push({ id, label, normalizedLabel: normalizeTemplateKey(label), value });
  });
  return rows;
};

// Resolves a timeobject field from `data.time_objects`: an explicit time object id on the
// field wins; otherwise the normalized field_key / field_label is matched against `time_object`.
export const resolveTimeObjectValue = (field, timeObjects) => {
  if (!Array.isArray(timeObjects) || timeObjects.length === 0) return null;
  const explicitIdRaw = field?.time_object_id ?? field?.timeobject_id ?? null;
  const explicitId = explicitIdRaw === null || explicitIdRaw === undefined ? "" : String(explicitIdRaw).trim();
  const withValue = (row) => row && !isEmptyTemplateValue(row.value);
  if (explicitId) {
    const match = timeObjects.find((row) => row.id === explicitId && withValue(row));
    return match ? match.value : null;
  }
  const candidates = [normalizeTemplateKey(field?.field_key), normalizeTemplateKey(field?.field_label)].filter(Boolean);
  const match = timeObjects.find((row) => candidates.includes(row.normalizedLabel) && withValue(row));
  return match ? match.value : null;
};

// Root-level properties that back a template field of the same field_key when the field's
// own value is empty. Only these documented pairs are used — other root properties are
// never rendered as extra fields.
const ROOT_FALLBACK_BY_FIELD_KEY = {
  last_port: "last_port",
  next_port: "next_port",
  po_number: "po_number",
  project_name: "project_name",
  srt_number: "srt_number",
  vessel_manager: "vessel_manager",
  billing_instruction: "billing_instruction",
};

export const getTemplateFieldType = (field) =>
  normalizeTemplateKey(field?.field_type ?? field?.type_key ?? "text") || "text";

// Saved value for a field: its own `value`, then (timeobject) the matching time object,
// then a documented root-level fallback.
export const resolveTemplateFieldValue = (field, { detail, timeObjects } = {}) => {
  const own = field?.value ?? field?.field_value;
  if (!isEmptyTemplateValue(own)) return own;
  if (getTemplateFieldType(field) === "timeobject") {
    return resolveTimeObjectValue(field, timeObjects ?? flattenTimeObjects(detail));
  }
  const rootKey = ROOT_FALLBACK_BY_FIELD_KEY[normalizeTemplateKey(field?.field_key)];
  if (rootKey && detail && !isEmptyTemplateValue(detail[rootKey])) return detail[rootKey];
  return own ?? null;
};

// Option label for a saved value: option_value match (string-normalized), then an exact
// option_label match (the API sometimes saves the label, e.g. appointment_type), then a
// case-insensitive label match. Returns null when nothing matches.
export const resolveTemplateOptionLabel = (field, value) => {
  if (isEmptyTemplateValue(value) || typeof value === "object") return null;
  const options = Array.isArray(field?.options) ? field.options : [];
  const target = String(value).trim();
  const optionValue = (opt) => String(typeof opt === "object" ? opt?.option_value ?? "" : opt).trim();
  const optionLabel = (opt) => String(typeof opt === "object" ? opt?.option_label ?? "" : opt).trim();
  const byValue = options.find((opt) => optionValue(opt) === target);
  if (byValue) return optionLabel(byValue) || target;
  const byLabel = options.find((opt) => optionLabel(opt) === target);
  if (byLabel) return optionLabel(byLabel);
  const lower = target.toLowerCase();
  const byLabelCi = options.find((opt) => optionLabel(opt).toLowerCase() === lower);
  return byLabelCi ? optionLabel(byLabelCi) : null;
};

// Formats "YYYY-MM-DD[ HH:MM[:SS]]" as "Sep 11, 2026 at 08:30" from its parts — no Date
// parsing, so no timezone shift. Unparseable values are returned as-is.
export const formatTemplateDateTime = (value, { withTime = true } = {}) => {
  if (isEmptyTemplateValue(value)) return "";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return raw;
  const [, year, month, day, hours, minutes] = match;
  const monthLabel = MONTHS[Number(month) - 1];
  if (!monthLabel) return raw;
  const datePart = `${monthLabel} ${Number(day)}, ${year}`;
  return withTime && hours !== undefined ? `${datePart} at ${hours}:${minutes}` : datePart;
};

const formatTime = (value) => {
  const match = String(value).trim().match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : String(value).trim();
};

const formatScalar = (value) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const SELECT_TYPES = new Set(["dropdown", "select", "radio", "multiselect", "multi_select"]);
const TEXT_TYPES = new Set(["text", "textarea", "email", "number", "phone", "tel", "url", "string"]);

// Read-only display model for one field.
// kind: "empty" | "text" | "list" | "file" | "unsupported"
export const buildTemplateFieldDisplay = (field, context = {}) => {
  const type = getTemplateFieldType(field);
  const value = resolveTemplateFieldValue(field, context);

  if (type === "file") {
    const fileUrl = String(field?.file_url ?? "").trim();
    if (isEmptyTemplateValue(value) && !fileUrl) return { kind: "empty" };
    const fileName = !isEmptyTemplateValue(value) ? String(value).trim() : fileUrl.split("/").pop() || "Attachment";
    return { kind: "file", fileName, fileUrl };
  }

  if (isEmptyTemplateValue(value)) return { kind: "empty" };

  if (type === "checkbox") {
    if (Array.isArray(value)) {
      return { kind: "list", items: value.map((item) => resolveTemplateOptionLabel(field, item) ?? formatScalar(item)) };
    }
    const options = Array.isArray(field?.options) ? field.options : [];
    if (!options.length) {
      // Legacy single checkbox, saved as 1/0, true/false.
      const truthy = value === true || ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
      return { kind: "text", text: truthy ? "Yes" : "No" };
    }
    return { kind: "text", text: resolveTemplateOptionLabel(field, value) ?? formatScalar(value) };
  }

  if (SELECT_TYPES.has(type)) {
    if (Array.isArray(value)) {
      return { kind: "list", items: value.map((item) => resolveTemplateOptionLabel(field, item) ?? formatScalar(item)) };
    }
    return { kind: "text", text: resolveTemplateOptionLabel(field, value) ?? formatScalar(value) };
  }

  if (type === "datetime" || type === "timeobject") return { kind: "text", text: formatTemplateDateTime(value) };
  if (type === "date") return { kind: "text", text: formatTemplateDateTime(value, { withTime: false }) };
  if (type === "time") return { kind: "text", text: formatTime(value) };

  if (Array.isArray(value)) return { kind: "list", items: value.map(formatScalar) };
  if (typeof value === "object") return { kind: "unsupported", type };
  if (TEXT_TYPES.has(type)) return { kind: "text", text: formatScalar(value) };
  // Unknown type with a primitive value: show it as plain text rather than hiding it.
  return { kind: "text", text: formatScalar(value) };
};

// Call type id for the call: root call_type_id, else the template's call_type field value
// (resolved to an option id), else the template's own call_type_id.
export const resolveTemplateCallTypeId = (detail) => {
  if (!detail || typeof detail !== "object") return "";
  if (!isEmptyTemplateValue(detail.call_type_id)) return String(detail.call_type_id).trim();
  const appointmentTab = findTemplateTabByKey(detail, "appointment_details");
  const callTypeField = appointmentTab?.fields.find((field) => normalizeTemplateKey(field?.field_key) === "call_type");
  const fieldValue = callTypeField?.value;
  if (!isEmptyTemplateValue(fieldValue)) {
    const options = Array.isArray(callTypeField.options) ? callTypeField.options : [];
    const target = String(fieldValue).trim();
    const byValue = options.find((opt) => String(opt?.option_value ?? "").trim() === target);
    if (byValue) return target;
    const byLabel = options.find((opt) => String(opt?.option_label ?? "").trim() === target);
    if (byLabel) return String(byLabel.option_value ?? "").trim();
  }
  const templateCallType = detail.template?.call_type_id;
  return isEmptyTemplateValue(templateCallType) ? "" : String(templateCallType).trim();
};

// Call type label for display, resolved from the call detail only.
export const resolveTemplateCallTypeLabel = (detail) => {
  const appointmentTab = findTemplateTabByKey(detail, "appointment_details");
  const callTypeField = appointmentTab?.fields.find((field) => normalizeTemplateKey(field?.field_key) === "call_type");
  if (callTypeField) {
    const label = resolveTemplateOptionLabel(callTypeField, callTypeField.value);
    if (label) return label;
  }
  const templateLabel = detail?.template?.call_type;
  return isEmptyTemplateValue(templateLabel) ? "" : String(templateLabel).trim();
};

// ---------------------------------------------------------------------------
// Editable stage forms (Operation → Pre Arrival / Arrival / Departure)
// ---------------------------------------------------------------------------

const DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/;

// "YYYY-MM-DD HH:mm" from any "YYYY-MM-DD[ T]HH:mm[:ss]" string, without Date parsing.
export const toStageDateTimeValue = (value) => {
  if (isEmptyTemplateValue(value)) return "";
  const match = String(value).trim().match(DATETIME_PATTERN);
  if (!match) return String(value).trim();
  return match[2] ? `${match[1]} ${match[2]}` : `${match[1]} 00:00`;
};

const optionValueOf = (opt) => String(typeof opt === "object" ? opt?.option_value ?? "" : opt).trim();
const optionLabelOf = (opt) => String(typeof opt === "object" ? opt?.option_label ?? "" : opt).trim();

// Saved value → the option_value it refers to (value match, then exact/ci label match).
// Unmatched values are returned as-is so they are never silently dropped.
export const toStageOptionValue = (field, value) => {
  if (isEmptyTemplateValue(value)) return "";
  const options = Array.isArray(field?.options) ? field.options : [];
  const target = String(value).trim();
  if (options.some((opt) => optionValueOf(opt) === target)) return target;
  const byLabel =
    options.find((opt) => optionLabelOf(opt) === target) ??
    options.find((opt) => optionLabelOf(opt).toLowerCase() === target.toLowerCase());
  return byLabel ? optionValueOf(byLabel) : target;
};

const isMultiOptionField = (field, type) =>
  (type === "checkbox" && Array.isArray(field?.options) && field.options.length > 0) ||
  type === "multiselect" ||
  type === "multi_select";

// Initial editable value for a stage field (file fields are handled separately).
export const toStageFormValue = (field, context = {}) => {
  const type = getTemplateFieldType(field);
  const value = resolveTemplateFieldValue(field, context);
  if (type === "file") return null;
  if (type === "datetime" || type === "timeobject") return toStageDateTimeValue(value);
  if (type === "date") {
    const match = isEmptyTemplateValue(value) ? null : String(value).trim().match(DATETIME_PATTERN);
    return match ? match[1] : isEmptyTemplateValue(value) ? "" : String(value);
  }
  if (isMultiOptionField(field, type)) {
    const list = Array.isArray(value) ? value : isEmptyTemplateValue(value) ? [] : [value];
    return list.map((item) => toStageOptionValue(field, item));
  }
  if (type === "checkbox") {
    // Single checkbox without options: keep booleans, interpret 1/0 strings.
    if (typeof value === "boolean") return value;
    if (isEmptyTemplateValue(value)) return false;
    return ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
  }
  if (SELECT_TYPES.has(type)) return toStageOptionValue(field, value);
  // Text-like: keep numbers/booleans as their type; null/undefined become "".
  return value === null || value === undefined ? "" : value;
};

// Value as sent in the save_stage `fields` JSON. Empty → null; numbers stay numbers.
export const toStagePayloadValue = (field, value) => {
  const type = getTemplateFieldType(field);
  if (Array.isArray(value)) return value;
  if (typeof value === "boolean") return value;
  if (isEmptyTemplateValue(value)) return null;
  if (type === "datetime" || type === "timeobject") return toStageDateTimeValue(value);
  if (type === "number" && typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
};

export const isTemplateFieldRequired = (field) =>
  field?.is_required === true || String(field?.is_required ?? "").trim() === "1";

// A file field already holds an attachment when the API returns a filename or file_url.
export const hasExistingTemplateFile = (field) =>
  !isEmptyTemplateValue(field?.value) || !isEmptyTemplateValue(field?.file_url);

// The time_objects row backing a timeobject field (for report-template payloads), or null.
export const findTimeObjectRowForField = (field, timeObjects) => {
  if (!Array.isArray(timeObjects)) return null;
  const explicitId = String(field?.time_object_id ?? field?.timeobject_id ?? "").trim();
  if (explicitId) return timeObjects.find((row) => row.id === explicitId) ?? null;
  const candidates = [normalizeTemplateKey(field?.field_key), normalizeTemplateKey(field?.field_label)].filter(Boolean);
  return timeObjects.find((row) => candidates.includes(row.normalizedLabel)) ?? null;
};

// Option value of a field in another template tab (e.g. appointment_details → port),
// used where a stage needs the call's port / call type and the root has no id.
export const resolveTemplateTabFieldOptionValue = (detail, tabKey, fieldKey) => {
  const tab = findTemplateTabByKey(detail, tabKey);
  const field = tab?.fields.find((item) => normalizeTemplateKey(item?.field_key) === normalizeTemplateKey(fieldKey));
  if (!field) return "";
  return toStageOptionValue(field, field.value);
};
