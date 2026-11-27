/**
 * Dynamic task-card popover fields — get_call_detail_by_id `task.fields`.
 *
 * Each entry is either a time object (`source: "time_object"`, bound through the existing
 * time-object state and saved in the `time_objects` JSON) or a task field
 * (`source: "task_field"`, rendered by `field_type` and saved under its own `field_key`):
 *
 *   { source: "task_field", field_key: "vessel_registration_doc", label, field_type: "document",
 *     value, file_url, is_required }
 *   { source: "time_object", field_key: "VIFC", label, field_type: "datetime", value,
 *     is_required, time_object_id, stage_id, sort_order }
 */

export const GRO_FIELD_SOURCE = {
  TIME_OBJECT: "time_object",
  TASK_FIELD: "task_field",
};

const FILE_FIELD_TYPES = new Set(["document", "file", "upload", "attachment", "image", "pdf"]);
const DATETIME_FIELD_TYPES = new Set(["datetime", "date_time", "datetime-local", "timestamp"]);

export const normalizeGroFieldType = (type) => String(type ?? "").trim().toLowerCase() || "text";

export const isGroFileFieldType = (type) => FILE_FIELD_TYPES.has(normalizeGroFieldType(type));

export const isGroDateTimeFieldType = (type) => DATETIME_FIELD_TYPES.has(normalizeGroFieldType(type));

const isRequiredFlag = (value) => value === true || String(value ?? "0").trim() === "1";

const trimText = (value) => String(value ?? "").trim();

/** Options may arrive as ["A","B"], [{value,label}], [{id,name}] or a JSON string of either. */
const normalizeGroFieldOptions = (raw) => {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(",");
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((opt) => {
      if (opt != null && typeof opt === "object") {
        const value = trimText(opt.value ?? opt.id ?? opt.key ?? opt.label ?? opt.name);
        const label = trimText(opt.label ?? opt.name ?? opt.text ?? value);
        return value ? { value, label: label || value } : null;
      }
      const value = trimText(opt);
      return value ? { value, label: value } : null;
    })
    .filter(Boolean);
};

/**
 * Splits `task.fields` into time objects (shaped like the old `stage_time_objects`, so the
 * existing time-object helpers keep working) and task fields, plus the API's display order.
 */
export const parseGroTaskFields = (rawFields) => {
  const list = Array.isArray(rawFields) ? rawFields : [];
  const timeObjects = [];
  const taskFields = [];
  const order = [];

  list.forEach((field) => {
    if (!field || typeof field !== "object") return;
    const source = trimText(field.source).toLowerCase();
    const fieldKey = trimText(field.field_key);

    if (source === GRO_FIELD_SOURCE.TIME_OBJECT || (field.time_object_id != null && source !== GRO_FIELD_SOURCE.TASK_FIELD)) {
      const item = {
        ...field,
        time_object: trimText(field.label ?? field.time_object) || "Date & Time",
        field_key: fieldKey,
        is_required: isRequiredFlag(field.is_required) ? "1" : "0",
        time_object_value: field.value ?? field.time_object_value ?? null,
      };
      timeObjects.push(item);
      order.push({ source: GRO_FIELD_SOURCE.TIME_OBJECT, item });
      return;
    }

    if (!fieldKey) return;
    const item = {
      source: GRO_FIELD_SOURCE.TASK_FIELD,
      field_key: fieldKey,
      label: trimText(field.label) || fieldKey,
      field_type: normalizeGroFieldType(field.field_type),
      value: field.value ?? null,
      file_url: trimText(field.file_url) || null,
      file_name: trimText(field.file_name) || null,
      is_required: isRequiredFlag(field.is_required),
      placeholder: trimText(field.placeholder),
      options: normalizeGroFieldOptions(field.options ?? field.field_options),
      sort_order: field.sort_order,
    };
    taskFields.push(item);
    order.push({ source: GRO_FIELD_SOURCE.TASK_FIELD, item });
  });

  return { timeObjects, taskFields, order };
};

/** "YYYY-MM-DD HH:MM[:SS]" → { date, time } */
const toDateTimeParts = (value) => {
  const match = trimText(value).match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  return match ? { date: match[1], time: match[2] ?? "" } : { date: "", time: "" };
};

const formatDateTimeParts = (parts) => {
  const date = trimText(parts?.date);
  if (!date) return "";
  const time = trimText(parts?.time).slice(0, 5) || "00:00";
  return `${date} ${time}:00`;
};

/** Saved values of the task fields, in the popover's editable shape. Files start empty (null). */
export const buildGroTaskFieldValues = (taskFields) => {
  const values = {};
  (Array.isArray(taskFields) ? taskFields : []).forEach((field) => {
    const type = field.field_type;
    if (isGroFileFieldType(type)) values[field.field_key] = null;
    else if (isGroDateTimeFieldType(type)) values[field.field_key] = toDateTimeParts(field.value);
    else if (type === "checkbox" || type === "boolean") values[field.field_key] = isRequiredFlag(field.value);
    else if (type === "date") values[field.field_key] = trimText(field.value).slice(0, 10);
    else if (type === "time") values[field.field_key] = trimText(field.value).slice(0, 5);
    else values[field.field_key] = field.value == null ? "" : String(field.value);
  });
  return values;
};

/** Previously uploaded file of each document field: { [field_key]: { file_name, file_url } }. */
export const buildGroTaskFieldExistingFiles = (taskFields) => {
  const files = {};
  (Array.isArray(taskFields) ? taskFields : []).forEach((field) => {
    if (!isGroFileFieldType(field.field_type)) return;
    const url = field.file_url || (/^https?:\/\//i.test(trimText(field.value)) ? trimText(field.value) : "");
    const name = field.file_name || (url ? decodeURIComponent(url.split("/").pop() || "") : trimText(field.value));
    if (url || name) files[field.field_key] = { file_name: name || "Uploaded file", file_url: url || null };
  });
  return files;
};

const isEmptyValue = (field, value) => {
  const type = field.field_type;
  if (isGroDateTimeFieldType(type)) return !trimText(value?.date) || !trimText(value?.time);
  if (type === "checkbox" || type === "boolean") return value !== true;
  return !trimText(value);
};

export const validateGroTaskFields = (taskFields, values = {}, existingFiles = {}) => {
  const errors = {};
  (Array.isArray(taskFields) ? taskFields : []).forEach((field) => {
    if (!field.is_required) return;
    const key = field.field_key;
    const missing = isGroFileFieldType(field.field_type)
      ? !values?.[key] && !(existingFiles?.[key]?.file_url || existingFiles?.[key]?.file_name)
      : isEmptyValue(field, values?.[key]);
    if (missing) errors[key] = `${field.label} is required.`;
  });
  return errors;
};

/** arrival/save_arrival_document — each task field is posted under its own field_key. */
export const appendGroTaskFieldsToFormData = (formData, taskFields, values = {}) => {
  (Array.isArray(taskFields) ? taskFields : []).forEach((field) => {
    const key = field.field_key;
    const value = values?.[key];
    const type = field.field_type;
    if (isGroFileFieldType(type)) {
      if (value != null && value !== "") formData.append(key, value);
      return;
    }
    if (isGroDateTimeFieldType(type)) {
      const formatted = formatDateTimeParts(value);
      if (formatted) formData.append(key, formatted);
      return;
    }
    if (type === "checkbox" || type === "boolean") {
      formData.append(key, value === true ? "1" : "0");
      return;
    }
    const text = trimText(value);
    if (text) formData.append(key, text);
  });
  return formData;
};
