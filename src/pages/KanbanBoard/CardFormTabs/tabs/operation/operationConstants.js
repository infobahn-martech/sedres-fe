export const OPERATION_TABS = {
  PRE_ARRIVAL: "preArrival",
  CHECK_LIST: "checkList",
  ARRIVAL: "arrival",
  DEPARTURE: "departure",
};

export const PRE_ARRIVAL_SABER_STATUS_OPTIONS = [
  { value: "Applied by Client", label: "Applied by Client" },
  { value: "Applied by Sedres", label: "Applied by Sedres" },
];

export const PRE_ARRIVAL_WEATHER_FORECAST_OPTIONS = [
  { value: "Normal weather", label: "Normal weather" },
  { value: "Bad weather", label: "Bad weather" },
];

export const SABER_APPLIED_BY_SEDRES = "Applied by Sedres";
export const BAD_WEATHER = "Bad weather";

/** Role IDs from `users/get_users_by_role` / `task_documents.role_id` (document handling). */
export const PRE_ARRIVAL_GRO_ROLE_ID = 4;
export const PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID = 5;
export const PRE_ARRIVAL_MWP_USER_ROLE_ID = 10;

/** API expects integers on save; UI keeps human-readable option values. */
export const PRE_ARRIVAL_SABER_STATUS_SAVE_VALUE = {
  "Applied by Client": 1,
  "Applied by Sedres": 2,
};

export const PRE_ARRIVAL_WEATHER_FORECAST_SAVE_VALUE = {
  "Normal weather": 1,
  "Bad weather": 2,
};

/** Map numeric / string values from get_prearrival_detail to form select values. */
export const mapApiSaberStatusToFormValue = (raw) => {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = Number(raw);
  if (Number.isNaN(n)) return "";
  return (
    Object.entries(PRE_ARRIVAL_SABER_STATUS_SAVE_VALUE).find(([, v]) => Number(v) === n)?.[0] || ""
  );
};

export const mapApiWeatherForecastToFormValue = (raw) => {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = Number(raw);
  if (Number.isNaN(n)) return "";
  return (
    Object.entries(PRE_ARRIVAL_WEATHER_FORECAST_SAVE_VALUE).find(([, v]) => Number(v) === n)?.[0] ||
    ""
  );
};

export const EVENT_NAME_FIELD_KEY_MAP = {
  "expected time of arrival": "expectedArrival",
  "expected commencement of custom inspection": "customsInspection",
  "expected commencement of immigration clearance for crew": "immigrationClearance",
  "expected completion of inward clearance": "inwardClearance",
  "actual time of arrival": "actualArrival",
  "custom inspection commenced": "customInspectionCommenced",
  "custom inspection completed": "customInspectionCompleted",
  "crew immigration commenced": "crewImmigrationCommenced",
  "crew immigration completed": "crewImmigrationCompleted",
  "vessel inward formalities completed": "vesselInwardFormalitiesCompleted",
  "marine work permit applied": "marineWorkPermitApplied",
  "marine work permit issued": "marineWorkPermitIssued",
  "marine work permit expires": "marineWorkPermitExpires",
  "request for outward clearance received": "outwardClearanceRequestReceived",
  "outward clearance issued": "outwardClearanceIssued",
  "outward clearance delivered": "outwardClearanceDelivered",
  "vessel sailed": "vesselSailed",
};

export const toPascalCase = (text = "") =>
  String(text)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

export const getEventFieldKeyPrefix = (eventName = "") => {
  const normalized = String(eventName).trim().toLowerCase();
  if (EVENT_NAME_FIELD_KEY_MAP[normalized]) {
    return EVENT_NAME_FIELD_KEY_MAP[normalized];
  }
  const pascal = toPascalCase(eventName);
  return pascal ? `operation${pascal}` : "operationEvent";
};

export const isEventFieldRequired = (field) =>
  String(field?.is_required ?? "0") === "1" || field?.is_required === true || field?.is_required === 1;

export const mapEventFields = (responseData) => {
  const rows = responseData?.fields || responseData?.data || responseData?.time_objects || [];
  return rows
    .filter((field) => {
      const eventName = field?.event_name ?? field?.time_object;
      const eventType = String(field?.event_type || "").toLowerCase();
      const inputType = String(field?.input_type || "").toLowerCase();
      return Boolean(eventName) && (eventType === "datetime" || inputType === "datetime" || !field?.event_type);
    })
    .map((field, index) => ({
      ...field,
      event_name: field?.event_name ?? field?.time_object ?? "",
      event_type_id: field?.event_type_id ?? field?.time_object_id,
      keyPrefix: getEventFieldKeyPrefix(field?.event_name ?? field?.time_object ?? ""),
      is_required: isEventFieldRequired(field),
      sort_order: Number(field?.sort_order ?? index + 1),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const FALLBACK_PRE_ARRIVAL_FIELDS = [
  { event_name: "Expected time of arrival", keyPrefix: "expectedArrival", event_type_id: 1, sort_order: 1 },
  { event_name: "Expected commencement of custom inspection", keyPrefix: "customsInspection", event_type_id: 2, sort_order: 2 },
  { event_name: "Expected commencement of Immigration clearance for crew", keyPrefix: "immigrationClearance", event_type_id: 3, sort_order: 3 },
  { event_name: "Expected completion of inward clearance", keyPrefix: "inwardClearance", event_type_id: 4, sort_order: 4 },
];

export const FALLBACK_ARRIVAL_FIELDS = [
  { event_name: "Actual time of arrival", keyPrefix: "actualArrival", stage_id: 2, sort_order: 1 },
  { event_name: "Custom Inspection commenced", keyPrefix: "customInspectionCommenced", stage_id: 2, sort_order: 2 },
  { event_name: "Custom Inspection completed", keyPrefix: "customInspectionCompleted", stage_id: 2, sort_order: 3 },
  { event_name: "Crew immigration commenced", keyPrefix: "crewImmigrationCommenced", stage_id: 2, sort_order: 4 },
  { event_name: "Crew immigration completed", keyPrefix: "crewImmigrationCompleted", stage_id: 2, sort_order: 5 },
  { event_name: "Vessel Inward formalities completed", keyPrefix: "vesselInwardFormalitiesCompleted", stage_id: 3, sort_order: 1 },
  { event_name: "Marine work permit applied", keyPrefix: "marineWorkPermitApplied", stage_id: 3, sort_order: 2 },
  { event_name: "Marine work permit issued", keyPrefix: "marineWorkPermitIssued", stage_id: 3, sort_order: 3 },
  { event_name: "Marine work permit expires", keyPrefix: "marineWorkPermitExpires", stage_id: 3, sort_order: 4 },
];

export const FALLBACK_DEPARTURE_FIELDS = [
  { event_name: "Request for outward clearance received", keyPrefix: "outwardClearanceRequestReceived", sort_order: 1 },
  { event_name: "Outward clearance issued", keyPrefix: "outwardClearanceIssued", sort_order: 2 },
  { event_name: "Outward clearance delivered", keyPrefix: "outwardClearanceDelivered", sort_order: 3 },
  { event_name: "Vessel Sailed", keyPrefix: "vesselSailed", sort_order: 4 },
];
